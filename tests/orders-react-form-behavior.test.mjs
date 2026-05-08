import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.ok(!fs.existsSync(path.join(root, 'src', 'orders', 'crud.mjs')), '完整 React SPA 后不应保留未使用的 orders/crud 过渡模块');

assert.match(
  ordersPageSource,
  /function ProductCombo\([\s\S]*value && !options\.some\(option => option\.value === value\)[\s\S]*label: `\$\{value\}（已不存在）`/,
  'React 订单商品下拉需要在已选商品不存在时保留当前值'
);

assert.match(
  ordersPageSource,
  /function SkuCombo\([\s\S]*value && !options\.some\(option => option\.value === value\)[\s\S]*label: `\$\{value\}（已不存在）`/,
  'React 订单 SKU 下拉需要在已选 SKU 不存在时保留当前值'
);

assert.match(
  ordersPageSource,
  /function computeItemTotals\(items: OrderItemDraft\[\]\)[\s\S]*unitPurchase \* quantity[\s\S]*unitSale \* quantity[\s\S]*unitWeight \* quantity/,
  'React 订单弹窗需要按订单明细汇总采购额、售价和重量'
);

assert.match(
  ordersPageSource,
  /computeOrderCreatorCommission\(\{[\s\S]*'达人佣金率': draft\.creatorCommissionRate[\s\S]*computeOrderEstimatedProfit\(\{[\s\S]*'预估运费': estimatedShippingFee/,
  'React 订单弹窗需要复用共享订单口径自动计算达人佣金和预估利润'
);

assert.match(
  ordersPageSource,
  /const detected = detectCourierCompany\(trackingNo,\s*COURIER_AUTO_DETECTORS\);[\s\S]*updateItem\(index,\s*\{ trackingNo, courierCompany: detected \|\| item\.courierCompany \}\)/,
  'React 订单明细需要在填写快递单号时按单号自动识别快递公司'
);

(async () => {
  const formUtils = await import(pathToFileURL(path.join(root, 'src', 'orders', 'form-utils.ts')).href);
  const shared = await import(pathToFileURL(path.join(root, 'src', 'orders', 'shared.ts')).href);

  const product = {
    tkId: 'TK-1',
    name: '雨衣',
    skus: [{ skuId: 'SKU-1', skuName: '白色 / M' }]
  };

  assert.equal(formUtils.buildProductLabel(product), 'TK-1 - 雨衣', '订单表单纯函数需要生成商品标签');
  assert.equal(formUtils.buildSkuLabel(product.skus[0]), '白色 / M - SKU-1', '订单表单纯函数需要生成 SKU 标签');
  assert.equal(
    formUtils.buildOrderItemsSummary([
      { productName: '雨衣', productSkuName: '白色', quantity: '2' },
      { productName: '杯子', quantity: '3' }
    ]),
    '雨衣 - 白色 / 杯子',
    '订单表单纯函数需要稳定汇总多明细商品摘要'
  );

  assert.equal(
    shared.computeOrderCreatorCommission({ '售价': '600', '达人佣金率': '10' }, 20),
    3,
    '订单共享纯函数需要按日元售价、佣金率和汇率折算人民币'
  );
  assert.equal(
    shared.computeOrderEstimatedProfit({ '售价': '600', '采购价格': '19.8', '预估运费': '6.5', '达人佣金率': '10' }, 20),
    0.7,
    '订单共享纯函数需要扣除采购价、预估运费和达人佣金'
  );

  console.log('orders react form behavior ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
