const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'session.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'index.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'sync.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerSession = \(function \(\) \{/,
  '需要新的订单会话模块'
);

assert.match(
  source,
  /function create\(/,
  '订单会话模块需要暴露 create 工厂'
);

assert.match(
  source,
  /window\.TKFirestoreConnection/,
  '订单会话模块需要通过全局 Firestore 连接模块读取配置'
);

assert.doesNotMatch(
  source,
  /gist|storageMode|parseConfigInput\(|connectOrMigrateFirestore|ot-migrate-from-gist|input\[name="ot-storage-mode"\]/,
  '订单会话模块不应再保留 Gist 迁移或存储模式切换逻辑'
);

assert.match(
  source,
  /tk-firestore-config-changed/,
  '订单会话模块需要监听全局 Firestore 配置变化事件'
);

assert.match(
  source,
  /#ot-open-connection/,
  '订单会话模块需要绑定未连接状态下的打开连接按钮'
);

assert.match(
  source,
  /classList\.add\('is-spinning'\)[\s\S]*syncNow[\s\S]*classList\.remove\('is-spinning'\)/,
  '订单会话模块需要在手动刷新时给刷新按钮加上转圈状态'
);

assert.match(
  source,
  /async function onEnter\(/,
  '订单会话模块需要包含进入模块时的恢复逻辑'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTrackerSession = OrderTrackerSession;`, sandbox);

const sessionTools = sandbox.OrderTrackerSession.create({
  state: {},
  constants: { LS_KEY: 'tk.orders.cfg.v1' },
  helpers: {
    $: () => null,
    loadCfg: () => null,
    saveCfg: () => {},
    loadAccounts: () => []
  },
  ui: {
    toast: () => {},
    setSync: () => {},
    openModal: () => {},
    exportOrdersCsv: () => {},
    bindCrudEvents: () => {},
    renderAccTabs: () => {},
    renderTable: () => {}
  },
  providers: {
    getProviderByMode: () => ({
      init: async () => {},
      isConnected: () => false
    })
  },
  sync: {
    setRemoteProvider: () => {},
    hydrateCache: async () => false,
    syncNow: async () => true,
    resetTrackerState: () => {},
    renderLocalOrders: () => {},
    queueSync: () => {},
    cancelPendingSync: () => {}
  }
});

assert.equal(typeof sessionTools.init, 'function', '会话模块需要返回 init');
assert.equal(typeof sessionTools.onEnter, 'function', '会话模块需要返回 onEnter');

assert.match(
  syncSource,
  /cancelPendingSync/,
  '同步模块需要提供取消待同步任务的接口'
);

assert.match(
  syncSource,
  /orders、order_accounts、sync_state 和 products[\s\S]*notifyRulesUpdateNeeded/,
  '订单同步在 Firestore 权限不足时需要触发全局规则更新提示'
);

assert.match(
  indexSource,
  /OrderTrackerSession\.create\(/,
  'js/orders/index.js 需要通过 OrderTrackerSession.create 接入会话模块'
);

assert.match(
  htmlSource,
  /<script src="js\/orders\/table\.js" defer><\/script>\s*<script src="js\/orders\/sync\.js" defer><\/script>\s*<script src="js\/orders\/export\.js" defer><\/script>\s*<script src="js\/orders\/tabs\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>\s*<script src="js\/orders\/session\.js" defer><\/script>\s*<script src="js\/orders\/shared\.js" defer><\/script>\s*<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 需要在 index.js 前先加载 session.js 和 shared.js'
);

console.log('orders session module contract ok');
