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
  /function hasLegacyOrderStructure\(/,
  '共享 helper 模块需要包含旧订单结构识别逻辑'
);

assert.match(
  source,
  /function migrateOrderToCurrentShape\(/,
  '共享 helper 模块需要包含旧订单结构迁移逻辑'
);

assert.match(
  source,
  /function cleanOrderToCurrentShape\(/,
  '共享 helper 模块需要包含订单结构清洗逻辑'
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
  sharedTools.computeOrderCreatorCommission({ '售价': '600', '达人佣金率': '10' }, 20),
  3,
  '共享 helper 模块应能按订单总售价和达人佣金率计算达人佣金'
);

assert.equal(
  sharedTools.computeOrderCreatorCommission({ '售价': '600', '达人佣金率': '10', '是否退款': '1' }, 20),
  0,
  '退款订单的达人佣金应按 0 处理'
);

assert.equal(
  sharedTools.computeOrderSaleCny({ '售价': '600', '是否退款': '1' }, 20),
  0,
  '退款订单的实际收入应按 0 计算'
);

assert.equal(
  sharedTools.computeOrderSaleCny({ '售价': '0' }, 20),
  null,
  '共享 helper 模块应把 0 日元售价视为未录入，而不是有效销售额'
);

assert.equal(
  sharedTools.computeOrderEstimatedProfit({ '售价': '600', '采购价格': '19.8', '预估运费': '6.5', '达人佣金率': '10' }, 20),
  0.7,
  '共享 helper 模块应能把达人佣金一并计入订单人民币利润'
);

assert.equal(
  sharedTools.computeOrderEstimatedProfit({ '售价': '600', '采购价格': '19.8', '预估运费': '6.5' }, 20),
  3.7,
  '共享 helper 模块在没有达人佣金率时应维持原利润口径'
);

assert.equal(
  sharedTools.computeOrderEstimatedProfit({ '售价': '600', '采购价格': '19.8', '预估运费': '6.5', '是否退款': '1' }, 20),
  -26.3,
  '退款订单的利润应按实收 0 减去成本计算'
);

assert.equal(
  sharedTools.computeOrderEstimatedProfit({ '售价': '0', '采购价格': '19.8', '预估运费': '6.5' }, 20),
  null,
  '共享 helper 模块应把 0 日元售价视为未录入，不应产出 0 利润'
);

const normalizedMultiItemOrder = sharedTools.normalizeOrderRecord({
  items: [
    {
      lineId: 'a',
      productTkId: 'TK-1',
      productSkuId: 'SKU-1',
      productSkuName: '白色 / S',
      productName: '马克杯',
      quantity: '2',
      unitPurchasePrice: '10',
      unitSalePrice: '300',
      unitWeightG: '120',
      unitSizeText: '10×10×10',
      useOrderCourier: true
    },
    {
      lineId: 'b',
      productTkId: 'TK-1',
      productSkuId: 'SKU-2',
      productSkuName: '黑色 / M',
      productName: '马克杯',
      quantity: '3',
      unitPurchasePrice: '12',
      unitSalePrice: '320',
      unitWeightG: '140',
      unitSizeText: '12×10×10',
      useOrderCourier: false,
      courierCompany: '顺丰快递',
      trackingNo: 'SF9988'
    }
  ]
});

assert.equal(
  normalizedMultiItemOrder['数量'],
  '5',
  '共享 helper 模块应能从多条订单明细汇总总件数'
);

assert.equal(
  normalizedMultiItemOrder['采购价格'],
  '56',
  '共享 helper 模块应能从多条订单明细汇总总采购额'
);

assert.equal(
  normalizedMultiItemOrder['售价'],
  '1560',
  '共享 helper 模块应能从多条订单明细汇总总售价'
);

assert.equal(
  normalizedMultiItemOrder['重量'],
  '660',
  '共享 helper 模块应默认按各 SKU 单件重量 × 数量汇总订单总重量'
);

assert.equal(
  normalizedMultiItemOrder['商品TK ID'],
  '',
  '多条订单明细时不应把某一个商品 TK ID 冒充成整单商品'
);

assert.equal(
  normalizedMultiItemOrder['快递公司'],
  '顺丰快递',
  '共享 helper 模块应能从订单明细汇总快递公司'
);

assert.equal(
  normalizedMultiItemOrder.items[1].trackingNo,
  'SF9988',
  '共享 helper 模块应保留订单明细自己的快递单号'
);

const migratedLegacyOrder = sharedTools.migrateOrderToCurrentShape({
  id: 'legacy-order',
  '商品TK ID': 'TK-9',
  '商品SKU ID': 'SKU-9',
  '商品SKU名称': '蓝 / M',
  '产品名称': '测试商品',
  '数量': '2',
  '重量': '320',
  '尺寸': '20×10×8',
  '快递公司': '中通快递',
  '快递单号': 'ZT123456'
});

assert.equal(
  sharedTools.hasLegacyOrderStructure({
    '商品TK ID': 'TK-9',
    '产品名称': '测试商品'
  }),
  true,
  '共享 helper 模块应识别没有 items[] 的旧订单结构'
);

assert.ok(
  Array.isArray(migratedLegacyOrder.items) && migratedLegacyOrder.items.length === 1,
  '旧订单迁移后应补成包含 items[] 的新结构'
);

assert.equal(
  migratedLegacyOrder.items[0].trackingNo,
  'ZT123456',
  '旧订单迁移后应把顶层快递单号迁入订单明细'
);

const cleanedOrder = sharedTools.cleanOrderToCurrentShape({
  id: 'dirty-order',
  '快递公司': '中通快递',
  '快递单号': 'ZT123456',
  items: [
    {
      lineId: 'line-1',
      productTkId: 'TK-1',
      productSkuId: 'SKU-1',
      productSkuName: '黑 / XXL',
      productName: '雨衣 - 黑 / XXL',
      quantity: 1,
      unitWeightG: 650,
      unitSizeText: '35×32×5',
      useOrderCourier: null,
      courierCompany: '',
      trackingNo: ''
    }
  ]
});

assert.equal(
  cleanedOrder.items[0].productName,
  '雨衣',
  '订单结构清洗应去掉明细商品名称里重复拼接的 SKU 后缀'
);

assert.equal(
  cleanedOrder.items[0].courierCompany,
  '中通快递',
  '订单结构清洗应把顶层快递公司补入明细'
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
