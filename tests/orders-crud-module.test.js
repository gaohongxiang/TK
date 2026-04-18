const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'crud.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'index.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerCrud = \(function \(\) \{/,
  '需要新的订单 CRUD 模块'
);

assert.match(
  source,
  /function create\(/,
  '订单 CRUD 模块需要暴露 create 工厂'
);

assert.match(
  source,
  /function openModal\(/,
  '订单 CRUD 模块需要包含弹窗打开逻辑'
);

assert.match(
  source,
  /async function deleteOrder\(/,
  '订单 CRUD 模块需要包含删除逻辑'
);

assert.match(
  source,
  /function bindEvents\(/,
  '订单 CRUD 模块需要包含表单事件绑定逻辑'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTrackerCrud = OrderTrackerCrud;`, sandbox);

const crudTools = sandbox.OrderTrackerCrud.create({
  state: {},
  constants: {
    ORDER_STATUS_OPTIONS: []
  },
  helpers: {
    $: () => null,
    uid: () => 'id',
    todayStr: () => '2026-04-19',
    addDays: () => '2026-04-25',
    computeWarning: () => ({ text: '-' }),
    normalizeOrderRecord: value => value,
    escapeHtml: value => String(value),
    normalizeStatusValue: value => String(value || '').trim(),
    detectCourierCompany: () => '',
    maybeAutoDetectCourierFromForm: () => '',
    getOrderFormCourierFields: () => ({}),
    showDatePicker: () => {}
  },
  ui: {
    getUniqueAccounts: () => [],
    promptAddAccount: async () => null,
    addAccount: () => false,
    markAccountsDirty: () => {},
    markOrderAccountsDirty: () => {},
    commitLocalOrders: async () => {},
    resetTablePage: () => {},
    toast: () => {}
  }
});

assert.equal(typeof crudTools.openModal, 'function', 'CRUD 模块需要返回 openModal');
assert.equal(typeof crudTools.closeModal, 'function', 'CRUD 模块需要返回 closeModal');
assert.equal(typeof crudTools.deleteOrder, 'function', 'CRUD 模块需要返回 deleteOrder');
assert.equal(typeof crudTools.bindEvents, 'function', 'CRUD 模块需要返回 bindEvents');

assert.match(
  indexSource,
  /OrderTrackerCrud\.create\(/,
  'js/orders/index.js 需要通过 OrderTrackerCrud.create 接入 CRUD 模块'
);

assert.match(
  htmlSource,
  /<script src="js\/orders\/table\.js" defer><\/script>\s*<script src="js\/orders\/sync\.js" defer><\/script>\s*<script src="js\/orders\/export\.js" defer><\/script>\s*<script src="js\/orders\/tabs\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>\s*<script src="js\/orders\/session\.js" defer><\/script>\s*<script src="js\/orders\/shared\.js" defer><\/script>\s*<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 需要在 index.js 前先加载 crud.js、session.js、shared.js'
);

console.log('orders crud module contract ok');
