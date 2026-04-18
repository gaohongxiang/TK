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
  /async function connect\(/,
  '订单会话模块需要包含连接逻辑'
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
  sync: {
    verifyToken: async () => ({ login: 'tester' }),
    createGist: async () => 'gist-id',
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
