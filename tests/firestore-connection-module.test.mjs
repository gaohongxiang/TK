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
  /function requestDisconnect\([\s\S]*uiController\?\.requestDisconnect\?\.\(options\)[\s\S]*clearConfig\(\)/,
  '退出数据库需要优先交给 React 站内确认弹层，再兜底清除本地连接配置'
);

assert.match(
  appRuntimeSource,
  /function applyDisconnect\([\s\S]*TKFirestoreConnection\.clearConfig\(\)[\s\S]*setDisconnectOpen\(false\)/,
  '确认退出数据库后需要清除本地连接配置并关闭站内确认弹层'
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
  assert.equal(typeof module.TKFirestoreConnection.closeDisconnectConfirm, 'function', 'Firestore 连接模块需要暴露关闭退出确认弹层的方法');
  assert.equal(typeof module.parseConfigInput, 'function', 'Firestore 连接模块需要导出 parseConfigInput 供测试和后续迁移复用');

  const parsed = module.TKFirestoreConnection.parseConfigInput(`const firebaseConfig = {
    apiKey: "AIza",
    authDomain: "demo.firebaseapp.com",
    projectId: "demo",
    appId: "1:web:demo"
  };`);

  assert.equal(parsed.projectId, 'demo', 'Firestore 连接模块应能解析 projectId');
  assert.equal(module.normalizeConfigText({ apiKey: 'key', projectId: 'p', appId: 'app' }).includes('"authDomain": "p.firebaseapp.com"'), true, 'Firestore 连接模块需要补齐默认 authDomain');

  console.log('firestore connection module ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
