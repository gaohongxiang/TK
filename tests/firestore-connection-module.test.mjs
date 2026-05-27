import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'firestore-connection.ts'), 'utf8');
const appRuntimeSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'AppRuntime.tsx'), 'utf8');

assert.match(
  source,
  /const TKFirestoreConnection = \{/,
  '需要独立的 Firestore 连接 ESM 模块'
);

assert.match(
  source,
  /function parseConfigInput\(/,
  '全局 Firestore 连接模块需要解析 firebaseConfig'
);

assert.match(
  source,
  /tk\.firestore\.cfg\.v1/,
  '全局 Firestore 连接模块需要使用独立的本地存储键'
);

assert.doesNotMatch(
  source,
  /LEGACY_ORDER_KEY|migrateLegacyConfig|clearLegacyConfigs|gistId|token/,
  '完整 React SPA 不应再保留旧订单配置迁移或 Gist 配置兼容层'
);

assert.match(
  source,
  /function open\(/,
  '全局 Firestore 连接模块需要暴露打开弹层的方法'
);

assert.match(
  source,
  /function notifyRulesUpdateNeeded\(/,
  '全局 Firestore 连接模块需要暴露规则更新提示入口'
);

assert.match(
  source,
  /function requestDisconnect\([\s\S]*uiController\?\.requestDisconnect\?\.\(options\)[\s\S]*项目连接不会在日常使用中断开[\s\S]*return false/,
  '项目连接不应在日常 UI 中断开，旧 requestDisconnect 调用也不能清除本地连接配置'
);

assert.doesNotMatch(
  appRuntimeSource,
  /function applyDisconnect|app-firestore-disconnect-modal|TKFirestoreConnection\.clearConfig\(\)/,
  '全局运行层不应再提供断开项目连接弹层或清除本地连接配置'
);

assert.doesNotMatch(
  source,
  /windowRef\.confirm|\.confirm\?\.\(|\.confirm\(/,
  'Firestore 连接模块不应使用浏览器默认 confirm 弹窗'
);

assert.match(
  source,
  /tk-firestore-config-changed/,
  '全局 Firestore 连接模块需要广播配置变化事件'
);

assert.match(
  source,
  /const COMPACT_CONNECTION_PREFIX = 'c1~'[\s\S]*function createCompactConnectionString[\s\S]*function decodeConnectionPayload/,
  '全局 Firestore 连接模块需要使用紧凑项目连接 payload'
);

assert.doesNotMatch(
  source,
  /tk_config|decodeBase64Url|encodeBase64Url|\^#\(\?:connect\|tk_config\)=/,
  '项目连接链接不再兼容旧 tk_config/#connect/base64 格式'
);

assert.match(
  source,
  /function applyConnectionLinkFromLocation[\s\S]*function createConnectionLink\([\s\S]*#login\?connect=/,
  '全局 Firestore 连接模块需要生成打开登录页并导入配置的项目连接链接'
);

assert.doesNotMatch(
  source,
  /window\.TKFirestoreConnection|globalThis\.window\.TKFirestoreConnection/,
  'Firestore 连接模块不应再挂旧 window.TKFirestoreConnection，全站应通过 ESM import 使用'
);

(async () => {
  const module = await import(`file://${path.join(root, 'src', 'firestore-connection.ts')}`);

  assert.equal(typeof module.TKFirestoreConnection.open, 'function', 'Firestore 连接模块需要暴露 open');
  assert.equal(typeof module.TKFirestoreConnection.getConfig, 'function', 'Firestore 连接模块需要暴露 getConfig');
  assert.equal(typeof module.TKFirestoreConnection.clearConfig, 'function', 'Firestore 连接模块需要暴露 clearConfig');
  assert.equal(typeof module.TKFirestoreConnection.registerUI, 'function', 'Firestore 连接模块需要暴露 React UI 注册入口');
  assert.equal(typeof module.TKFirestoreConnection.notifyRulesUpdateNeeded, 'function', 'Firestore 连接模块需要暴露 notifyRulesUpdateNeeded');
  assert.equal(typeof module.TKFirestoreConnection.closeDisconnectConfirm, 'function', 'Firestore 连接模块需要保留关闭旧弹层兼容入口');
  assert.equal(typeof module.TKFirestoreConnection.createConnectionLink, 'function', 'Firestore 连接模块需要暴露项目连接链接生成入口');
  assert.equal(typeof module.parseConfigInput, 'function', 'Firestore 连接模块需要导出 parseConfigInput 供测试和后续迁移复用');

  const parsed = module.TKFirestoreConnection.parseConfigInput(`const firebaseConfig = {
    apiKey: "AIza",
    authDomain: "demo.firebaseapp.com",
    projectId: "demo",
    appId: "1:web:demo"
  };`);

  assert.equal(parsed.projectId, 'demo', 'Firestore 连接模块应能解析 projectId');
  assert.equal(module.normalizeConfigText({ apiKey: 'key', projectId: 'p', appId: 'app' }).includes('"authDomain": "p.firebaseapp.com"'), true, 'Firestore 连接模块需要补齐默认 authDomain');
  const link = module.TKFirestoreConnection.createConnectionLink(parsed, 'https://example.com/tool');
  assert.match(link, /^https:\/\/example\.com\/tool\/#login\?connect=c1~/, '项目连接链接应打开登录页并使用紧凑 payload');
  assert.equal(module.TKFirestoreConnection.parseConfigInput(module.TKFirestoreConnection.decodeConnectionPayload(link.split('connect=')[1])).projectId, 'demo', '项目连接链接需要可还原 config');
  assert.equal(module.TKFirestoreConnection.decodeConnectionPayload(module.TKFirestoreConnection.encodeConnectionPayload(parsed)).includes('"projectId": "demo"'), true, '连接配置需要可编码和解码');

  console.log('firestore connection module ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
