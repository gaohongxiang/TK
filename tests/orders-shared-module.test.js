const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'shared.js'), 'utf8');
const globalSettingsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'global-settings.js'), 'utf8');
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

const sandbox = {
  window: {
    __tkGlobalSettingsStore: {
      getExchangeRate: () => 20
    }
  }
};
vm.createContext(sandbox);
vm.runInContext(`${globalSettingsSource}\n${source}\nthis.OrderTrackerShared = OrderTrackerShared;`, sandbox);

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
  sharedTools.normalizeOrderRecord({ id: 'm8zj7r2a1b2c3d' }).createdAt,
  new Date(parseInt('m8zj7r2a', 36)).toISOString(),
  '共享 helper 模块应能从旧 uid 中补出稳定的创建时间'
);

assert.equal(
  sharedTools.detectCourierCompany('SF123456'),
  '顺丰快递',
  '共享 helper 模块应能识别快递公司'
);

assert.equal(
  sharedTools.getPricingExchangeRate(),
  20,
  '共享 helper 模块应优先读取利润计算器的日元汇率'
);

assert.equal(
  sharedTools.computeOrderSaleCny({ '售价': '600' }, 20),
  30,
  '共享 helper 模块应能把订单日元售价折算成人民币'
);

assert.equal(
  sharedTools.computeOrderSaleCny({ '售价': '0' }, 20),
  null,
  '共享 helper 模块应把 0 日元售价视为未录入，而不是有效销售额'
);

assert.equal(
  sharedTools.computeOrderEstimatedProfit({ '售价': '600', '采购价格': '19.8', '预估运费': '6.5' }, 20),
  3.7,
  '共享 helper 模块应能按统一汇率计算订单人民币利润'
);

assert.equal(
  sharedTools.computeOrderEstimatedProfit({ '售价': '0', '采购价格': '19.8', '预估运费': '6.5' }, 20),
  null,
  '共享 helper 模块应把 0 日元售价视为未录入，不应产出 0 利润'
);

assert.match(
  indexSource,
  /OrderTrackerShared\.create\(/,
  'js/orders/index.js 需要通过 OrderTrackerShared.create 接入共享 helper 模块'
);

assert.match(
  htmlSource,
  /<script src="js\/global-settings\.js" defer><\/script>[\s\S]*<script src="js\/orders\/shared\.js" defer><\/script>\s*<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 需要在订单模块前先加载全局设置模块，并在 index.js 前先加载 shared.js'
);

console.log('orders shared module contract ok');
