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
  /function normalizeQuantityInput\(value: unknown\)[\s\S]*if \(!\/\^\\d\+\$\/\.test\(text\)\) return null[\s\S]*text\.replace\(\/\^0\+\/, ''\)[\s\S]*<IntegerInput[\s\S]*pattern="\[1-9\]\[0-9\]\*"[\s\S]*data-item-field="quantity"[\s\S]*if \(quantity === null\) return/,
  'React 订单明细数量输入需要允许临时清空，但只接受大于等于 1 的整数'
);

assert.match(
  ordersPageSource,
  /if \(!isPositiveIntegerText\(item\.quantity\)\) \{[\s\S]*每条明细的数量必须是大于等于 1 的整数/,
  'React 订单保存前需要校验每条明细数量是大于等于 1 的整数'
);

assert.match(
  ordersPageSource,
  /manualSizeText: !!String\(order\?\.\['尺寸'\][\s\S]*const sizeText = draft\.manualSizeText \? draft\.sizeText : \(singleSize \|\| draft\.sizeText\)[\s\S]*updateDraft\(\{ sizeText: event\.target\.value, manualSizeText: true \}\)/,
  'React 订单总尺寸需要支持手动编辑，且不应直接覆盖当前运费'
);

assert.match(
  ordersPageSource,
  /manualWeightText: !!String\(order\?\.\['重量'\][\s\S]*const weightText = draft\.manualWeightText \? draft\.weightText : \(totals\.weight \? formatNumericValue\(totals\.weight\) : draft\.weightText\)[\s\S]*updateDraft\(\{ weightText: event\.target\.value, manualWeightText: true \}\)/,
  'React 订单总重量需要支持手动编辑，且不应直接覆盖当前运费'
);

assert.match(
  ordersPageSource,
  /const savedEstimatedShippingFee = String\(order\?\.\['预估运费'\][\s\S]*const preserveSavedShippingFee = !!order && !!savedEstimatedShippingFee\.trim\(\)[\s\S]*preserveSavedShippingFee[\s\S]*shippingFeeMode === 'manual'[\s\S]*<DecimalInput name="预估运费"[\s\S]*updateDraft\(\{ estimatedShippingFee: value, shippingFeeMode: 'manual', manualEstimatedShippingFee: true \}\)/,
  'React 订单预估运费需要保留老订单已保存运费，用户手动输入后也保留用户值'
);

assert.match(
  ordersPageSource,
  /const refreshPricingContext = \(\) => \{[\s\S]*setPricingContext\(store\.getPricingContext\(\)\)[\s\S]*store\.subscribe\(refreshPricingContext\)[\s\S]*window\.addEventListener\(SETTINGS_CHANGED_EVENT, refreshPricingContext\)/,
  'React 订单页需要订阅全局定价参数和事件，但参数变化不应直接覆盖当前运费'
);

assert.match(
  ordersPageSource,
  /const ruleDraft = useMemo\(\(\) => computeShippingRuleDraft\(draft, products, pricingContext\)[\s\S]*const showRefreshShippingFee = shouldRefreshShippingFee\(draft, ruleDraft\)[\s\S]*预估总海外运费（¥）[\s\S]*预估海外运费规则说明[\s\S]*参数[\s\S]*title="根据当前参数刷新运费"[\s\S]*onDraftChange\(ruleDraft\)[\s\S]*根据当前参数刷新运费[\s\S]*<div className=\{orderShippingRuleClass\} id="ot-shipping-rule-preview"[\s\S]*pricingRuleText/,
  'React 订单预估运费需要展示参数、说明按钮，并在标题旁允许按当前参数刷新运费'
);

assert.match(
  ordersPageSource,
  /\{showRefreshShippingFee \? \([\s\S]*title="根据当前参数刷新运费"[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*onDraftChange\(ruleDraft\)/,
  'React 订单参数标题旁的刷新按钮应只在当前运费与规则值不一致时显示并写回规则草稿'
);

assert.match(
  ordersPageSource,
  /orderMoneyRowClass = 'quint[\s\S]*70px_minmax\(88px,\.72fr\)_minmax\(88px,\.72fr\)_minmax\(116px,\.9fr\)_minmax\(170px,1\.15fr\)_minmax\(118px,\.9fr\)[\s\S]*orderShippingRuleClass = 'ot-shipping-rule flex min-h-\[42px\][\s\S]*orderShippingRuleButtonClass = 'ml-1 inline-flex h-\[20px\][\s\S]*orderShippingHelpButtonClass[\s\S]*orderProfitLabelClass = '!flex-nowrap'/,
  'React 订单金额行需要让金额输入、参数和预估利润对齐并填满行宽'
);

assert.match(
  ordersPageSource,
  /id="ot-shipping-rule-help-modal"[\s\S]*<DialogTitle id="ot-shipping-rule-help-title">预估海外运费规则<\/DialogTitle>[\s\S]*<HelpItem label="计算输入">[\s\S]*<HelpItem label="计费重量">[\s\S]*<HelpItem label="金额换算">[\s\S]*<HelpItem label="订单处理">[\s\S]*<HelpItem label="刷新按钮">/,
  'React 订单预估运费说明按钮需要打开规则说明弹窗，并说明新老订单的刷新规则'
);

assert.match(
  ordersPageSource,
  /label="总售价（円）"[\s\S]*label="总采购额（¥）"[\s\S]*预估总海外运费（¥）[\s\S]*预估利润（¥）[\s\S]*达人佣金（¥）/,
  'React 订单金额字段单位需要统一使用符号'
);

assert.doesNotMatch(
  ordersPageSource,
  /当前规则计算|预估总海外运费（计入利润）|总售价（日元）|总采购额（元）|预估利润（人民币）/,
  'React 订单金额区需要使用短文案，避免挤出弹窗'
);

assert.doesNotMatch(
  ordersPageSource,
  /切回自动运费|draft\.manualEstimatedShippingFee \? '手动' : '自动'/,
  'React 订单预估运费不应把内部手动/自动状态直接暴露给用户'
);

assert.match(
  ordersPageSource,
  /applyShippingRefreshPolicy\(nextDraft, draft, products, pricingContext, !!resetAuto\.shipping\)[\s\S]*applyShippingRefreshPolicy\(nextDraft, draft, products, pricingContext, true\)[\s\S]*items: \[\.\.\.draft\.items, createEmptyOrderItem\(\)\]/,
  'React 订单明细结构变化后需要恢复总尺寸自动汇总，但不应直接覆盖当前运费'
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
