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
  /function computeItemTotals\(items: OrderItemDraft\[\]\)[\s\S]*const quantity = parseItemQuantity\(item\.quantity\)[\s\S]*unitPurchase \* quantity[\s\S]*unitSale \* quantity[\s\S]*unitWeight \* quantity/,
  'React 订单弹窗需要按有效正整数数量汇总采购额、售价和重量'
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

assert.match(
  ordersPageSource,
  /function OrderDateInput[\s\S]*showNativeDatePicker\(event\.currentTarget\)[\s\S]*<OrderDateInput name="下单时间"[\s\S]*<OrderDateInput name="采购日期"/,
  'React 订单日期输入需要整框点击打开原生日期选择器'
);

assert.match(
  ordersPageSource,
  /orderDateInputIconClass = 'pointer-events-none absolute right-3[\s\S]*<CalendarDays className=\{orderDateInputIconClass\}/,
  'React 订单日期输入需要把日历图标固定在输入框最右侧'
);

assert.match(
  ordersPageSource,
  /function normalizeQuantityInput\(value: unknown\)[\s\S]*if \(!\/\^\\d\+\$\/\.test\(text\)\) return null[\s\S]*text\.replace\(\/\^0\+\/, ''\)[\s\S]*inputMode="numeric"[\s\S]*pattern="\[1-9\]\[0-9\]\*"[\s\S]*data-item-field="quantity"[\s\S]*if \(quantity === null\) return/,
  'React 订单明细数量输入需要允许临时清空，但只接受大于等于 1 的整数'
);

assert.match(
  ordersPageSource,
  /if \(!isPositiveIntegerText\(item\.quantity\)\) \{[\s\S]*每条明细的数量必须是大于等于 1 的整数/,
  'React 订单保存前需要校验每条明细数量是大于等于 1 的整数'
);

assert.match(
  ordersPageSource,
  /manualSizeText: !!String\(order\?\.\['尺寸'\][\s\S]*const sizeText = draft\.manualSizeText \? draft\.sizeText : \(singleSize \|\| draft\.sizeText\)[\s\S]*updateDraft\(\{ sizeText: event\.target\.value, manualSizeText: true, manualEstimatedShippingFee: false \}\)/,
  'React 订单总尺寸需要支持手动编辑，不应被自动 SKU 尺寸覆盖'
);

assert.match(
  ordersPageSource,
  /manualWeightText: !!String\(order\?\.\['重量'\][\s\S]*const weightText = draft\.manualWeightText \? draft\.weightText : \(totals\.weight \? formatNumericValue\(totals\.weight\) : draft\.weightText\)[\s\S]*updateDraft\(\{ weightText: event\.target\.value, manualWeightText: true, manualEstimatedShippingFee: false \}\)/,
  'React 订单总重量需要支持手动编辑，不应被订单明细汇总覆盖'
);

assert.match(
  ordersPageSource,
  /manualEstimatedShippingFee: !!String\(order\?\.\['预估运费'\][\s\S]*const estimatedShippingFee = draft\.manualEstimatedShippingFee[\s\S]*computeEstimatedShipping\(\{ \.\.\.draft, items, weightText, sizeText \}, products\)[\s\S]*updateDraft\(\{ estimatedShippingFee: event\.target\.value, manualEstimatedShippingFee: true \}\)/,
  'React 订单预估运费需要按重量和尺寸自动重算，同时保留用户手动输入'
);

assert.match(
  ordersPageSource,
  /computeAutoFields\(\{[\s\S]*manualWeightText: false,[\s\S]*manualSizeText: false,[\s\S]*manualEstimatedShippingFee: false,[\s\S]*items: nextItems[\s\S]*computeAutoFields\(\{[\s\S]*manualWeightText: false,[\s\S]*manualSizeText: false,[\s\S]*manualEstimatedShippingFee: false,[\s\S]*items: \[\.\.\.draft\.items, createEmptyOrderItem\(\)\]/,
  'React 订单明细结构变化后需要恢复总尺寸自动汇总'
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
