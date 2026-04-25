const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'firestore-connection.js'), 'utf8');

assert.match(
  source,
  /const TKFirestoreConnection = \(function \(\) \{/,
  '需要独立的全局 Firestore 连接模块'
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
  /tk-firestore-config-changed/,
  '全局 Firestore 连接模块需要广播配置变化事件'
);

assert.match(
  source,
  /window\.TKFirestoreConnection\s*=\s*TKFirestoreConnection;/,
  '全局 Firestore 连接模块需要挂到 window 上，供订单和商品库直接调用'
);

const sandbox = {
  window: {
    addEventListener() {},
    dispatchEvent() {}
  },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  },
  document: {
    querySelector() { return null; },
    addEventListener() {}
  },
  CustomEvent: function CustomEvent(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.TKFirestoreConnection = TKFirestoreConnection;`, sandbox);

assert.equal(typeof sandbox.TKFirestoreConnection.open, 'function', '全局 Firestore 连接模块需要暴露 open');
assert.equal(typeof sandbox.TKFirestoreConnection.getConfig, 'function', '全局 Firestore 连接模块需要暴露 getConfig');
assert.equal(typeof sandbox.TKFirestoreConnection.clearConfig, 'function', '全局 Firestore 连接模块需要暴露 clearConfig');
assert.equal(typeof sandbox.TKFirestoreConnection.notifyRulesUpdateNeeded, 'function', '全局 Firestore 连接模块需要暴露 notifyRulesUpdateNeeded');

const parsed = sandbox.TKFirestoreConnection.parseConfigInput(`const firebaseConfig = {
  apiKey: "AIza",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  appId: "1:web:demo"
};`);

assert.equal(parsed.projectId, 'demo', '全局 Firestore 连接模块应能解析 projectId');

console.log('firestore connection module ok');
