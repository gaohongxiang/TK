import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const srcSource = fs.readFileSync(path.join(root, 'src', 'orders', 'form-utils.ts'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  srcSource,
  /function resolveProductSnapshotSource\(/,
  '订单弹窗 ESM 纯函数模块需要负责商品/SKU 快照合并'
);

assert.match(
  srcSource,
  /function createOrderItemDraft\(/,
  '订单弹窗 ESM 纯函数模块需要负责明细草稿归一化'
);

assert.match(
  srcSource,
  /function getOrderItemsFromOrder\(/,
  '订单弹窗 ESM 纯函数模块需要负责从订单恢复明细'
);

assert.match(
  srcSource,
  /function parseSizeText\(/,
  '订单弹窗 ESM 纯函数模块需要负责尺寸解析'
);

assert.match(
  ordersPageSource,
  /normalizeOrderItems\(order\?\.items \|\| \[\]\)[\s\S]*function ProductCombo\([\s\S]*function SkuCombo\(/,
  'React 订单页需要直接接管订单明细恢复、商品下拉和 SKU 下拉'
);

assert.match(
  srcSource,
  /const OrderTrackerFormUtils = \{/,
  '路线二 M5 需要提供订单表单纯函数 ESM 模块'
);

assert.doesNotMatch(
  srcSource,
  /window\.OrderTrackerFormUtils/,
  '订单表单纯函数 ESM 模块应保持纯 ESM，不应再挂旧全局命名空间'
);

assert.match(
  srcSource,
  /export\s+\{[\s\S]*OrderTrackerFormUtils[\s\S]*createOrderItemDraft[\s\S]*getOrderItemsFromOrder[\s\S]*parseSizeText[\s\S]*\}/,
  '订单表单纯函数 ESM 模块需要导出命名空间和关键纯函数'
);

assert.doesNotMatch(
  ordersPageSource,
  /from '..\/..\/..\/orders\/crud\.mjs'|from ['"]\.\/crud\.mjs['"]/,
  'React 订单页不应再依赖已删除的 orders/crud 过渡模块'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/form-utils\.js" defer><\/script>/,
  'index.html 不应再加载旧订单 form-utils 普通脚本'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/crud\.js" defer><\/script>/,
  'index.html 不应再加载旧订单 CRUD 普通脚本'
);

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

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

(async () => {
  const module = await import(path.join(root, 'src', 'orders', 'form-utils.ts'));
  const utils = module.OrderTrackerFormUtils;
  assert.strictEqual(utils.buildProductLabel(product), 'TK-1 - 雨衣', '订单表单 ESM 商品标签需要合并 TK ID 和名称');
  assert.strictEqual(utils.formatProductSize(product.defaults), '20×10×5', '订单表单 ESM 商品尺寸需要格式化成长宽高');
  assert.deepStrictEqual(
    utils.getProductSkus({
      skus: [
        { skuId: 'sku-1', skuName: '白色' },
        { skuId: ' ', skuName: '无效' },
        { skuName: '缺少ID' }
      ]
    }),
    [{ skuId: 'sku-1', skuName: '白色' }],
    '订单表单 ESM 商品 SKU 列表需要过滤缺少 SKU ID 的行'
  );
  assert.strictEqual(utils.buildSkuLabel({ skuId: '', skuName: '' }), '未命名SKU', '订单表单 ESM 空 SKU 需要显示兜底标签');

  const inheritedSnapshot = utils.resolveProductSnapshotSource(product, {
    skuId: 'sku-1',
    skuName: '白色',
    useProductDefaults: true
  });
  assert.strictEqual(inheritedSnapshot.weightG, '120', '订单表单 ESM 继承默认参数的 SKU 需要使用商品默认重量');
  assert.strictEqual(inheritedSnapshot.estimatedShippingFee, '18.5', '订单表单 ESM 继承默认参数的 SKU 需要使用商品默认运费');

  const ownSnapshot = utils.resolveProductSnapshotSource(product, {
    skuId: 'sku-2',
    skuName: '黑色',
    weightG: '150',
    sizeText: '30×20×10'
  });
  assert.strictEqual(ownSnapshot.weightG, '150', '订单表单 ESM 自带参数的 SKU 不应被商品默认值覆盖');
  assert.strictEqual(utils.skuUsesProductDefaults({ weightG: '150' }), false, '订单表单 ESM 自带重量的 SKU 不应继承商品默认参数');

  const draft = utils.createOrderItemDraft({
    lineId: 'line-1',
    '产品名称': '雨衣',
    '数量': '0',
    '跟随订单默认快递': 'false',
    '快递公司': '中通快递'
  }, { uid: () => 'new-line' });
  assert.strictEqual(draft.quantity, '1', '订单表单 ESM 无效数量需要回落到 1');
  assert.strictEqual(draft.useOrderCourier, false, '订单表单 ESM 明细需要识别不跟随订单默认快递');

  const legacyDrafts = utils.buildLegacyOrderItems({
    '产品名称': ' legacy product ',
    '数量': '3',
    '售价': '1200'
  }, { uid: () => 'legacy-line' });
  assert.strictEqual(legacyDrafts.length, 1, '订单表单 ESM 旧版单商品订单需要恢复成一条明细');
  assert.strictEqual(legacyDrafts[0].productName, 'legacy product', '订单表单 ESM 旧版订单明细需要清理产品名空白');
  assert.strictEqual(legacyDrafts[0].quantity, '3', '订单表单 ESM 旧版订单明细需要保留有效数量');

  const restored = utils.getOrderItemsFromOrder({
    '快递公司': '圆通快递',
    '快递单号': 'YT123',
    items: [
      { lineId: 'line-2', productName: '杯子', quantity: '2' }
    ]
  }, { uid: () => 'fallback-line' });
  assert.strictEqual(restored[0].courierCompany, '圆通快递', '订单表单 ESM 恢复明细时需要补入订单级快递公司');
  assert.strictEqual(restored[0].trackingNo, 'YT123', '订单表单 ESM 恢复明细时需要补入订单级快递单号');

  assert.strictEqual(
    utils.buildOrderItemsSummary([
      { productName: '雨衣', productSkuName: '白色' },
      { productName: '杯子', productSkuName: '' }
    ]),
    '雨衣 - 白色 / 杯子',
    '订单表单 ESM 明细摘要需要合并商品名和 SKU 名'
  );

  const parsedSize = utils.parseSizeText('20*10*5');
  assert.strictEqual(parsedSize.lengthCm, 20, '订单表单 ESM 尺寸解析需要支持星号分隔并拆出长度');
  assert.strictEqual(parsedSize.widthCm, 10, '订单表单 ESM 尺寸解析需要支持星号分隔并拆出宽度');
  assert.strictEqual(parsedSize.heightCm, 5, '订单表单 ESM 尺寸解析需要支持星号分隔并拆出高度');
  const incompleteSize = utils.parseSizeText('20×10');
  assert.strictEqual(incompleteSize.lengthCm, '', '订单表单 ESM 尺寸不足三段时需要返回空长度');
  assert.strictEqual(incompleteSize.widthCm, '', '订单表单 ESM 尺寸不足三段时需要返回空宽度');
  assert.strictEqual(incompleteSize.heightCm, '', '订单表单 ESM 尺寸不足三段时需要返回空高度');

  assert.strictEqual(utils.parseMoneyValue('1,234.50'), 1234.5, '订单表单 ESM 金额解析需要去掉千分位逗号');
  assert.strictEqual(utils.formatNumericValue(12.3), '12.3', '订单表单 ESM 数字格式化需要去掉多余 0');
  assert.strictEqual(utils.formatMoneyValue(Number.NaN), '', '订单表单 ESM 无效金额格式化需要返回空字符串');

  assert.equal(typeof module.OrderTrackerFormUtils.createOrderItemDraft, 'function', '订单表单 ESM 需要暴露命名空间');
  assert.deepStrictEqual(
    plain(module.OrderTrackerFormUtils.getOrderItemsFromOrder({
      '快递公司': '圆通快递',
      '快递单号': 'YT123',
      items: [
        { lineId: 'line-2', productName: '杯子', quantity: '2' }
      ]
    }, { uid: () => 'fallback-line' })),
    plain(restored),
    '订单表单 ESM 恢复明细行为需要保持稳定'
  );
  assert.deepStrictEqual(
    plain(module.OrderTrackerFormUtils.resolveProductSnapshotSource(product, {
      skuId: 'sku-1',
      skuName: '白色',
      useProductDefaults: true
    })),
    plain(inheritedSnapshot),
    '订单表单 ESM 商品/SKU 快照合并需要保持稳定'
  );
  assert.deepStrictEqual(
    plain(module.OrderTrackerFormUtils.parseSizeText('20*10*5')),
    plain(parsedSize),
    '订单表单 ESM 尺寸解析需要保持稳定'
  );

  console.log('orders form utils module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
