const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'firestore-connection.mjs'), 'utf8');

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
  /function requestDisconnect\([\s\S]*app-firestore-disconnect-modal[\s\S]*modal\.classList\.add\('show'\)/,
  '退出数据库需要走站内确认弹层，再清除本地连接配置'
);

assert.match(
  source,
  /function applyDisconnect\([\s\S]*clearConfig\(\)[\s\S]*closeDisconnectConfirm\(\)/,
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

assert.match(
  source,
  /window\.TKFirestoreConnection\s*=\s*TKFirestoreConnection/,
  'Firestore 连接 ESM 模块需要挂到 window 上，供订单和商品库直接调用'
);

(async () => {
  const module = await import(`file://${path.join(root, 'src', 'firestore-connection.mjs')}`);

  assert.equal(typeof module.TKFirestoreConnection.open, 'function', 'Firestore 连接模块需要暴露 open');
  assert.equal(typeof module.TKFirestoreConnection.getConfig, 'function', 'Firestore 连接模块需要暴露 getConfig');
  assert.equal(typeof module.TKFirestoreConnection.clearConfig, 'function', 'Firestore 连接模块需要暴露 clearConfig');
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
