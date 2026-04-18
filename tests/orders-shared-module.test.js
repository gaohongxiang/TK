const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'shared.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'index.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerShared = \(function \(\) \{/,
  '需要新的订单共享 helper 模块'
);

assert.match(
  source,
  /function create\(/,
  '订单共享 helper 模块需要暴露 create 工厂'
);

assert.match(
  source,
  /function normalizeOrderRecord\(/,
  '共享 helper 模块需要包含订单归一化逻辑'
);

assert.match(
  source,
  /function detectCourierCompany\(/,
  '共享 helper 模块需要包含快递识别逻辑'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTrackerShared = OrderTrackerShared;`, sandbox);

const sharedTools = sandbox.OrderTrackerShared.create({
  state: {
    orders: [{ id: '1', '账号': 'A' }]
  },
  constants: {
    UNASSIGNED_ACCOUNT_SLOT: '__unassigned__',
    ACCOUNT_FILE_PREFIX: 'tk-order-tracker__',
    ACCOUNT_FILE_SUFFIX: '.json',
    COURIER_AUTO_DETECTORS: [
      { name: '顺丰快递', test: value => /^SF/i.test(value) }
    ]
  }
});

assert.deepEqual(
  sharedTools.uniqueAccounts([' A ', '', 'B', 'A']),
  ['A', 'B'],
  '共享 helper 模块应能正确去重账号'
);

assert.equal(
  sharedTools.normalizeOrderRecord({ '入仓状态': '已入仓', '订单状态': '' })['订单状态'],
  '已入仓',
  '共享 helper 模块应合并旧状态字段'
);

assert.equal(
  sharedTools.detectCourierCompany('SF123456'),
  '顺丰快递',
  '共享 helper 模块应能识别快递公司'
);

assert.match(
  indexSource,
  /OrderTrackerShared\.create\(/,
  'js/orders/index.js 需要通过 OrderTrackerShared.create 接入共享 helper 模块'
);

assert.match(
  htmlSource,
  /<script src="js\/orders\/table\.js" defer><\/script>\s*<script src="js\/orders\/sync\.js" defer><\/script>\s*<script src="js\/orders\/export\.js" defer><\/script>\s*<script src="js\/orders\/tabs\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>\s*<script src="js\/orders\/session\.js" defer><\/script>\s*<script src="js\/orders\/shared\.js" defer><\/script>\s*<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 需要在 index.js 前先加载 shared.js'
);

console.log('orders shared module contract ok');
