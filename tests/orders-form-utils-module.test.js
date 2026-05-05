const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'orders', 'form-utils.js'), 'utf8');
const crudSource = fs.readFileSync(path.join(root, 'js', 'orders', 'crud.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerFormUtils = \(function \(\) \{/,
  '订单弹窗需要独立的纯函数模块'
);

assert.match(
  source,
  /function resolveProductSnapshotSource\(/,
  '订单弹窗纯函数模块需要负责商品/SKU 快照合并'
);

assert.match(
  source,
  /function createOrderItemDraft\(/,
  '订单弹窗纯函数模块需要负责明细草稿归一化'
);

assert.match(
  source,
  /function getOrderItemsFromOrder\(/,
  '订单弹窗纯函数模块需要负责从订单恢复明细'
);

assert.match(
  source,
  /function parseSizeText\(/,
  '订单弹窗纯函数模块需要负责尺寸解析'
);

assert.match(
  crudSource,
  /const formUtils = OrderTrackerFormUtils/,
  '订单 CRUD 需要接入 OrderTrackerFormUtils'
);

assert.doesNotMatch(
  crudSource,
  /function createOrderItemDraft\(|function resolveProductSnapshotSource\(|function parseSizeText\(/,
  '订单 CRUD 不应继续内联已经拆出的纯函数'
);

assert.match(
  htmlSource,
  /<script src="js\/orders\/tabs\.js" defer><\/script>\s*<script src="js\/orders\/form-utils\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>/,
  'index.html 需要在订单 CRUD 前加载 form-utils.js'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTrackerFormUtils = OrderTrackerFormUtils;`, sandbox);
const utils = sandbox.OrderTrackerFormUtils;

const product = {
  tkId: 'TK-1',
  name: '雨衣',
  defaults: {
    cargoType: 'general',
    weightG: '120',
    lengthCm: '20',
    widthCm: '10',
    heightCm: '5',
    estimatedShippingFee: '18.5'
  }
};

assert.strictEqual(utils.buildProductLabel(product), 'TK-1 - 雨衣', '商品标签需要合并 TK ID 和名称');
assert.strictEqual(utils.formatProductSize(product.defaults), '20×10×5', '商品尺寸需要格式化成长宽高');
assert.deepStrictEqual(
  utils.getProductSkus({
    skus: [
      { skuId: 'sku-1', skuName: '白色' },
      { skuId: ' ', skuName: '无效' },
      { skuName: '缺少ID' }
    ]
  }),
  [{ skuId: 'sku-1', skuName: '白色' }],
  '商品 SKU 列表需要过滤缺少 SKU ID 的行'
);
assert.strictEqual(utils.buildSkuLabel({ skuId: '', skuName: '' }), '未命名SKU', '空 SKU 需要显示兜底标签');

const inheritedSnapshot = utils.resolveProductSnapshotSource(product, {
  skuId: 'sku-1',
  skuName: '白色',
  useProductDefaults: true
});
assert.strictEqual(inheritedSnapshot.weightG, '120', '继承默认参数的 SKU 需要使用商品默认重量');
assert.strictEqual(inheritedSnapshot.estimatedShippingFee, '18.5', '继承默认参数的 SKU 需要使用商品默认运费');

const ownSnapshot = utils.resolveProductSnapshotSource(product, {
  skuId: 'sku-2',
  skuName: '黑色',
  weightG: '150',
  sizeText: '30×20×10'
});
assert.strictEqual(ownSnapshot.weightG, '150', '自带参数的 SKU 不应被商品默认值覆盖');
assert.strictEqual(utils.skuUsesProductDefaults({ weightG: '150' }), false, '自带重量的 SKU 不应继承商品默认参数');

const draft = utils.createOrderItemDraft({
  lineId: 'line-1',
  '产品名称': '雨衣',
  '数量': '0',
  '跟随订单默认快递': 'false',
  '快递公司': '中通快递'
}, { uid: () => 'new-line' });
assert.strictEqual(draft.quantity, '1', '无效数量需要回落到 1');
assert.strictEqual(draft.useOrderCourier, false, '明细需要识别不跟随订单默认快递');

const legacyDrafts = utils.buildLegacyOrderItems({
  '产品名称': ' legacy product ',
  '数量': '3',
  '售价': '1200'
}, { uid: () => 'legacy-line' });
assert.strictEqual(legacyDrafts.length, 1, '旧版单商品订单需要恢复成一条明细');
assert.strictEqual(legacyDrafts[0].productName, 'legacy product', '旧版订单明细需要清理产品名空白');
assert.strictEqual(legacyDrafts[0].quantity, '3', '旧版订单明细需要保留有效数量');

const restored = utils.getOrderItemsFromOrder({
  '快递公司': '圆通快递',
  '快递单号': 'YT123',
  items: [
    { lineId: 'line-2', productName: '杯子', quantity: '2' }
  ]
}, { uid: () => 'fallback-line' });
assert.strictEqual(restored[0].courierCompany, '圆通快递', '恢复明细时需要补入订单级快递公司');
assert.strictEqual(restored[0].trackingNo, 'YT123', '恢复明细时需要补入订单级快递单号');

assert.strictEqual(
  utils.buildOrderItemsSummary([
    { productName: '雨衣', productSkuName: '白色' },
    { productName: '杯子', productSkuName: '' }
  ]),
  '雨衣 - 白色 / 杯子',
  '明细摘要需要合并商品名和 SKU 名'
);

const parsedSize = utils.parseSizeText('20*10*5');
assert.strictEqual(parsedSize.lengthCm, 20, '尺寸解析需要支持星号分隔并拆出长度');
assert.strictEqual(parsedSize.widthCm, 10, '尺寸解析需要支持星号分隔并拆出宽度');
assert.strictEqual(parsedSize.heightCm, 5, '尺寸解析需要支持星号分隔并拆出高度');
const incompleteSize = utils.parseSizeText('20×10');
assert.strictEqual(incompleteSize.lengthCm, '', '尺寸不足三段时需要返回空长度');
assert.strictEqual(incompleteSize.widthCm, '', '尺寸不足三段时需要返回空宽度');
assert.strictEqual(incompleteSize.heightCm, '', '尺寸不足三段时需要返回空高度');

assert.strictEqual(utils.parseMoneyValue('1,234.50'), 1234.5, '金额解析需要去掉千分位逗号');
assert.strictEqual(utils.formatNumericValue(12.3), '12.3', '数字格式化需要去掉多余 0');
assert.strictEqual(utils.formatMoneyValue(Number.NaN), '', '无效金额格式化需要返回空字符串');

console.log('orders form utils module contract ok');
