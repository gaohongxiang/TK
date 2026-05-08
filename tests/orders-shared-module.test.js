const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const esmPath = path.join(__dirname, '..', 'src', 'orders', 'shared.mjs');
const esmSource = fs.readFileSync(esmPath, 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.match(
  esmSource,
  /const OrderTrackerShared = \{/,
  'ESM 订单共享 helper 需要保留 OrderTrackerShared 命名导出'
);

assert.match(
  esmSource,
  /function create\(/,
  'ESM 订单共享 helper 需要暴露 create 工厂'
);

assert.match(
  esmSource,
  /function normalizeOrderRecord\(/,
  'ESM 订单共享 helper 需要包含订单归一化逻辑'
);

assert.match(
  esmSource,
  /export \{[\s\S]*OrderTrackerShared[\s\S]*create[\s\S]*normalizeOrderRecord[\s\S]*computeOrderEstimatedProfit[\s\S]*\}/,
  'ESM 订单共享 helper 需要导出共享命名空间和关键纯函数'
);

assert.doesNotMatch(
  esmSource,
  /window\.OrderTrackerShared/,
  'ESM 订单共享 helper 应保持纯 ESM，不应再挂旧全局命名空间'
);

const multiItemOrderInput = {
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
};

const legacyOrderInput = {
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
};

const dirtyOrderInput = {
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
};

assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'orders', 'index.mjs')), '完整 React SPA 重建后旧订单 DOM 入口应删除');

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再加载旧订单 ESM 入口'
);

assert.match(
  ordersPageSource,
  /normalizeOrderRecord[\s\S]*computeOrderEstimatedProfit[\s\S]*computeOrderCreatorCommission/,
  'React 订单页需要直接复用订单共享计算和归一化 helper'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/table\.js" defer><\/script>/,
  'index.html 不应再加载旧订单 table 普通脚本'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/shared\.js" defer><\/script>/,
  'index.html 不应再加载旧订单共享 helper 普通脚本'
);

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

(async () => {
  const sharedModule = await import(pathToFileURL(esmPath).href);
  const esmTools = sharedModule.OrderTrackerShared.create({
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
    esmTools.uniqueAccounts([' A ', '', 'B', 'A']),
    ['A', 'B'],
    'ESM 共享 helper 应能正确去重账号'
  );

  assert.equal(
    esmTools.normalizeOrderRecord({ '入仓状态': '已入仓', '订单状态': '' })['订单状态'],
    '已入仓',
    'ESM 共享 helper 应合并旧状态字段'
  );

  assert.equal(
    esmTools.normalizeOrderRecord({ id: 'm8zj7r2a1b2c3d' }).createdAt,
    new Date(parseInt('m8zj7r2a', 36)).toISOString(),
    'ESM 共享 helper 应能从旧 uid 中补出稳定的创建时间'
  );

  assert.equal(
    esmTools.computeOrderSaleCny({ '售价': '600' }, 20),
    30,
    'ESM 共享 helper 应能把订单日元售价折算成人民币'
  );

  assert.equal(
    esmTools.computeOrderCreatorCommission({ '售价': '600', '达人佣金率': '10' }, 20),
    3,
    'ESM 共享 helper 应能按订单总售价和达人佣金率计算达人佣金'
  );

  assert.equal(
    esmTools.computeOrderCreatorCommission({ '售价': '600', '达人佣金率': '10', '是否退款': '1' }, 20),
    0,
    'ESM 共享 helper 退款订单的达人佣金应按 0 处理'
  );

  assert.equal(
    esmTools.computeOrderSaleCny({ '售价': '600', '是否退款': '1' }, 20),
    0,
    'ESM 共享 helper 退款订单的实际收入应按 0 计算'
  );

  assert.equal(
    esmTools.computeOrderSaleCny({ '售价': '0' }, 20),
    null,
    'ESM 共享 helper 应把 0 日元售价视为未录入，而不是有效销售额'
  );

  assert.equal(
    esmTools.computeOrderEstimatedProfit({ '售价': '600', '采购价格': '19.8', '预估运费': '6.5', '达人佣金率': '10' }, 20),
    0.7,
    'ESM 共享 helper 应能把达人佣金一并计入订单人民币利润'
  );

  assert.equal(
    esmTools.computeOrderEstimatedProfit({ '售价': '600', '采购价格': '19.8', '预估运费': '6.5' }, 20),
    3.7,
    'ESM 共享 helper 在没有达人佣金率时应维持原利润口径'
  );

  assert.equal(
    esmTools.computeOrderEstimatedProfit({ '售价': '600', '采购价格': '19.8', '预估运费': '6.5', '是否退款': '1' }, 20),
    -26.3,
    'ESM 共享 helper 退款订单的利润应按实收 0 减去成本计算'
  );

  assert.equal(
    esmTools.computeOrderEstimatedProfit({ '售价': '0', '采购价格': '19.8', '预估运费': '6.5' }, 20),
    null,
    'ESM 共享 helper 应把 0 日元售价视为未录入，不应产出 0 利润'
  );

  assert.equal(
    esmTools.detectCourierCompany('SF123456'),
    '顺丰快递',
    'ESM 共享 helper 应能识别快递公司'
  );

  const normalizedMultiItemOrder = esmTools.normalizeOrderRecord(toPlain(multiItemOrderInput));
  assert.equal(
    normalizedMultiItemOrder['数量'],
    '5',
    'ESM 共享 helper 应能从多条订单明细汇总总件数'
  );
  assert.equal(
    normalizedMultiItemOrder['采购价格'],
    '56',
    'ESM 共享 helper 应能从多条订单明细汇总总采购额'
  );
  assert.equal(
    normalizedMultiItemOrder['售价'],
    '1560',
    'ESM 共享 helper 应能从多条订单明细汇总总售价'
  );
  assert.equal(
    normalizedMultiItemOrder['重量'],
    '660',
    'ESM 共享 helper 应默认按各 SKU 单件重量 × 数量汇总订单总重量'
  );
  assert.equal(
    normalizedMultiItemOrder['商品TK ID'],
    '',
    'ESM 共享 helper 多条订单明细时不应把某一个商品 TK ID 冒充成整单商品'
  );
  assert.equal(
    normalizedMultiItemOrder['快递公司'],
    '顺丰快递',
    'ESM 共享 helper 应能从订单明细汇总快递公司'
  );
  assert.equal(
    normalizedMultiItemOrder.items[1].trackingNo,
    'SF9988',
    'ESM 共享 helper 应保留订单明细自己的快递单号'
  );

  const migratedLegacyOrder = esmTools.migrateOrderToCurrentShape(toPlain(legacyOrderInput));
  assert.equal(
    esmTools.hasLegacyOrderStructure({
      '商品TK ID': 'TK-9',
      '产品名称': '测试商品'
    }),
    true,
    'ESM 共享 helper 应识别没有 items[] 的旧订单结构'
  );
  assert.ok(
    Array.isArray(migratedLegacyOrder.items) && migratedLegacyOrder.items.length === 1,
    'ESM 共享 helper 旧订单迁移后应补成包含 items[] 的新结构'
  );
  assert.equal(
    migratedLegacyOrder.items[0].trackingNo,
    'ZT123456',
    'ESM 共享 helper 旧订单迁移后应把顶层快递单号迁入订单明细'
  );

  const cleanedOrder = esmTools.cleanOrderToCurrentShape(toPlain(dirtyOrderInput));
  assert.equal(
    cleanedOrder.items[0].productName,
    '雨衣',
    'ESM 共享 helper 订单结构清洗应去掉明细商品名称里重复拼接的 SKU 后缀'
  );
  assert.equal(
    cleanedOrder.items[0].courierCompany,
    '中通快递',
    'ESM 共享 helper 订单结构清洗应把顶层快递公司补入明细'
  );

  assert.equal(
    sharedModule.computeOrderEstimatedProfit({ '售价': '600', '采购价格': '19.8', '预估运费': '6.5', '达人佣金率': '10' }, 20),
    0.7,
    'ESM 订单共享模块应支持直接导入核心纯函数'
  );

  console.log('orders shared module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
