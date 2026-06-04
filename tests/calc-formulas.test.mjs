import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const formulasSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'formulas.ts'), 'utf8');
const reactCalculatorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'calculator', 'CalculatorApp.tsx'), 'utf8');

assert.match(formulasSource, /export\s+\{/, '路线二 M3 需要提供 calc 纯公式 ESM 导出');
assert.match(formulasSource, /\bcalcLegacyRow\b/, 'calc 纯公式 ESM 模块需要导出 calcLegacyRow');
assert.match(formulasSource, /\bderiveLegacyOrigPrice\b/, 'calc 纯公式 ESM 模块需要导出 deriveLegacyOrigPrice');
assert.match(formulasSource, /\bcalcPricingRow\b/, 'calc 纯公式 ESM 模块需要导出 calcPricingRow');
assert.match(formulasSource, /\bderivePricingOrigPrice\b/, 'calc 纯公式 ESM 模块需要导出 derivePricingOrigPrice');
assert.match(formulasSource, /\bcalcSalePrice\b/, 'calc 纯公式 ESM 模块需要导出 calcSalePrice');
assert.match(formulasSource, /\bcalcPricingV3Row\b/, 'calc 纯公式 ESM 模块需要导出 calcPricingV3Row');
assert.match(formulasSource, /\bderivePricingV3OrigPrice\b/, 'calc 纯公式 ESM 模块需要导出 derivePricingV3OrigPrice');
assert.match(formulasSource, /\bcalcSalePriceV3\b/, 'calc 纯公式 ESM 模块需要导出 calcSalePriceV3');
assert.match(formulasSource, /\bcalcSalePriceV3Transfer\b/, 'calc 纯公式 ESM 模块需要导出包邮转嫁利润复盘公式');
assert.match(
  reactCalculatorSource,
  /deriveLegacyOrigPrice\(\{ \.\.\.state, anchor \}\)[\s\S]*calcLegacyRow\(state, origPrice, discount\)/,
  'React 旧定价面板需要直接复用纯公式模块'
);
assert.match(
  reactCalculatorSource,
  /derivePricingOrigPrice\(\{ state: pricingState, totalCost \}\)[\s\S]*calcPricingRow\(\{/,
  'React 定价V2面板需要直接复用纯公式模块'
);
assert.match(
  reactCalculatorSource,
  /derivePricingV3OrigPrice\(\{ state: pricingState, totalCost[\s\S]*calcPricingV3Row\(\{/,
  'React 定价V3面板需要直接复用纯公式模块'
);
assert.match(
  reactCalculatorSource,
  /const result = isTransferReview[\s\S]*calcSalePriceV3Transfer\(\{[\s\S]*: calcSalePriceV3\(\{ state, totalCost, customerShippingJpy \}\)/,
  'React 利润复盘面板需要按口径复用 V3 纯公式模块'
);
assert.match(
  reactCalculatorSource,
  /calcSalePriceV3Transfer\(\{[\s\S]*transferShippingJpy: DEFAULT_CONSTANTS\.CUSTOMER_SHIPPING_JPY[\s\S]*id="reviewFreeShippingTransfer"/,
  'React 利润复盘面板需要提供包邮转嫁口径并复用纯公式模块'
);
assert.match(
  reactCalculatorSource,
  /reviewFeeRowClass = 'mt-\[18px\] !grid-cols-\[74px_minmax\(148px,1\.14fr\)_repeat\(3,minmax\(0,1fr\)\)\][\s\S]*FormRow columns=\{5\} className=\{reviewFeeRowClass\}[\s\S]*包邮转嫁[\s\S]*id="reviewFreeShippingTransfer"[\s\S]*type="checkbox"[\s\S]*aria-label="包邮转嫁"[\s\S]*<Field id="feeReview" label="TK 平台手续费率（%）" labelClassName=\{reviewFeeLabelClass\}/,
  'React 利润复盘包邮转嫁应放在 TK 平台手续费率前面'
);
assert.doesNotMatch(
  reactCalculatorSource,
  /id="reviewFreeShippingTransfer"[\s\S]*<button/,
  'React 利润复盘包邮转嫁开关不应使用按钮形式'
);
assert.doesNotMatch(
  reactCalculatorSource,
  /reviewTransferSwitchLeftClass|reviewTransferSwitchRightClass/,
  'React 利润复盘包邮转嫁开关内部不应再显示文字'
);
assert.doesNotMatch(
  reactCalculatorSource,
  /reviewFreeShippingTransferHelp|review-free-shipping-transfer-help-modal|review-free-shipping-transfer-help-title/,
  'React 利润复盘不应再通过包邮转嫁字段旁的说明按钮展示口径'
);
assert.match(
  reactCalculatorSource,
  /<CardTitle>[\s\S]*<span>成交输入<\/span>[\s\S]*id="review-pricing-guide-btn"[\s\S]*aria-controls="review-pricing-guide-modal"[\s\S]*aria-label="利润复盘口径说明"[\s\S]*id="salePrice"[\s\S]*id="review-pricing-guide-modal"[\s\S]*<DialogTitle id="review-pricing-guide-title">利润复盘口径说明<\/DialogTitle>[\s\S]*定价V3用于测算包邮转嫁后的售价；利润复盘只按已成交订单的实际售价复盘[\s\S]*商品售价按订单里的平台实际售价填写[\s\S]*不会自动加减 350円[\s\S]*不包邮时[\s\S]*平台费基数为商品售价 \+ 买家运费 350円[\s\S]*包邮转嫁时[\s\S]*收入扣回 350円[\s\S]*平台费和达人佣金按当前填写的商品售价计算/,
  'React 利润复盘成交输入标题后应提供整体口径说明按钮'
);
assert.doesNotMatch(
  reactCalculatorSource,
  /reviewGuideClass|包邮后售价更高/,
  'React 利润复盘包邮转嫁说明不应常驻展示或使用定价对比口径'
);
assert.doesNotMatch(
  reactCalculatorSource,
  /toggleTransferReview[\s\S]*salePrice:/,
  'React 利润复盘切换包邮转嫁时不应自动修改商品售价'
);
assert.match(
  reactCalculatorSource,
  /不能让每个折扣都刚好包邮转嫁 350[\s\S]*需要特别注意达人佣金：包邮转嫁后商品售价变高，达人佣金按更高的包邮商品售价计算/,
  'React 定价V3包邮转嫁说明需要在最后明确达人费用会随包邮售价增加'
);
assert.doesNotMatch(
  reactCalculatorSource,
  /reviewSaleModeHintClass|reviewSaleModeRowClass/,
  'React 利润复盘不应再用独立说明行占用表单空间'
);
assert.match(
  reactCalculatorSource,
  /商品售价 = 原价 × 折扣[\s\S]*平台手续费 =（商品售价 \+ 买家支付运费）× 平台手续费率 ÷ 汇率[\s\S]*达人佣金 = 商品售价 × 达人佣金率 ÷ 汇率[\s\S]*人民币到手 = 商品售价 ÷ 汇率 − 平台手续费 − 达人佣金[\s\S]*原价反推 = \[总费用 × 目标利润率 × 汇率 \+ 买家支付运费 × 平台手续费率\] ÷ \[基准折扣 × \(1 − 平台手续费率 − 达人佣金率\)\]/,
  '利润计算器页面公式文案需要和 V3 主口径一致'
);
assert.match(
  reactCalculatorSource,
  /有效收入 =（实际商品售价 − 包邮转嫁运费 350円）÷ 日元汇率[\s\S]*平台手续费 = 实际商品售价 × 平台手续费率 ÷ 日元汇率[\s\S]*达人佣金 = 实际商品售价 × 达人佣金率 ÷ 日元汇率/,
  '利润计算器页面需要说明包邮转嫁复盘口径'
);
['legacy.mjs', 'pricing.mjs'].forEach(file => {
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'calc', file)), `完整 React SPA 后不应保留 calc ${file} DOM 壳层`);
});

function approxEqual(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

function approxRow(actual, expected, fields, message) {
  fields.forEach(field => approxEqual(actual[field], expected[field], `${message}.${field}`));
}

const legacyState = {
  fee: 10,
  creatorRate: 10,
  rate: 20,
  shipping: 5,
  cost: 10,
  targetMargin: 2,
  anchor: 0.5
};

const pricingState = {
  feeNew: 10,
  creatorRateNew: 10,
  rateNew: 20,
  costNew: 10,
  overseasShippingNew: 2,
  targetMarginNew: 1.5,
  anchorNew: 0.5,
  discountsNew: [0.5],
  origPriceNew: 800,
  salePrice: 300
};

(async () => {
  const formulas = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'formulas.ts')}`);
  const legacyExpected = {
    discount: 0.5,
    jpyPrice: 450,
    creatorCommission: 2.25,
    cnyNet: 15.25,
    margin: 1.525
  };
  const pricingExpected = {
    discount: 0.5,
    jpyPrice: 360,
    cnyNet: 16.2,
    creatorCommission: 1.8,
    profit: 4.199999999999999,
    margin: 1.3499999999999999
  };
  const saleExpected = {
    cnyNet: 13.5,
    creatorCommission: 1.5,
    profit: 1.5,
    margin: 1.125
  };
  const pricingV3Expected = {
    discount: 0.5,
    jpyPrice: 400,
    cnyNet: 14.25,
    platformFee: 3.75,
    creatorCommission: 2,
    profit: 2.25,
    margin: 1.1875
  };
  const saleV3Expected = {
    cnyNet: 10.25,
    platformFee: 3.25,
    creatorCommission: 1.5,
    profit: -1.75,
    margin: 0.8541666666666666
  };
  const pricingV3TransferExpected = {
    discount: 0.5,
    jpyPrice: 750,
    cnyNet: 12.5,
    platformFee: 3.75,
    creatorCommission: 3.75,
    profit: 0.5,
    margin: 1.0416666666666667,
    transferredJpy: 350,
    effectiveJpyPrice: 400
  };
  const saleV3TransferExpected = {
    cnyNet: 12.5,
    platformFee: 3.75,
    creatorCommission: 3.75,
    profit: 0.5,
    margin: 1.0416666666666667,
    effectiveSalePrice: 400
  };

  approxRow(
    formulas.calcLegacyRow(legacyState, 1000, 0.5),
    legacyExpected,
    ['discount', 'jpyPrice', 'cnyNet', 'creatorCommission', 'margin'],
    'calc 公式 ESM 模块旧定价行公式不正确'
  );
  approxEqual(formulas.deriveLegacyOrigPrice(legacyState), 1234.567901234568, 'calc 公式 ESM 模块旧定价原价反推不正确');

  approxRow(
    formulas.calcPricingRow({
      state: pricingState,
      totalCost: pricingState.costNew + pricingState.overseasShippingNew,
      origPrice: 800,
      discount: 0.5
    }),
    pricingExpected,
    ['discount', 'jpyPrice', 'cnyNet', 'creatorCommission', 'profit', 'margin'],
    'calc 公式 ESM 模块定价新行公式不正确'
  );
  approxEqual(
    formulas.derivePricingOrigPrice({
      state: pricingState,
      totalCost: pricingState.costNew + pricingState.overseasShippingNew
    }),
    888.8888888888889,
    'calc 公式 ESM 模块定价新原价反推不正确'
  );
  approxRow(
    formulas.calcPricingV3Row({
      state: pricingState,
      totalCost: pricingState.costNew + pricingState.overseasShippingNew,
      origPrice: 800,
      discount: 0.5,
      customerShippingJpy: 350
    }),
    pricingV3Expected,
    ['discount', 'jpyPrice', 'cnyNet', 'platformFee', 'creatorCommission', 'profit', 'margin'],
    'calc 公式 ESM 模块定价V3行公式不正确'
  );
  approxEqual(
    formulas.derivePricingV3OrigPrice({
      state: pricingState,
      totalCost: pricingState.costNew + pricingState.overseasShippingNew,
      customerShippingJpy: 350
    }),
    987.5,
    'calc 公式 ESM 模块定价V3原价反推不正确'
  );
  approxRow(
    formulas.calcPricingV3TransferRow({
      state: pricingState,
      totalCost: pricingState.costNew + pricingState.overseasShippingNew,
      baseOrigPrice: 800,
      transferDiscount: 0.5,
      discount: 0.5,
      transferShippingJpy: 350
    }),
    pricingV3TransferExpected,
    ['discount', 'jpyPrice', 'cnyNet', 'platformFee', 'creatorCommission', 'profit', 'margin', 'transferredJpy', 'effectiveJpyPrice'],
    'calc 公式 ESM 模块定价V3包邮转嫁行公式不正确'
  );
  approxRow(
    formulas.calcSalePrice({
      state: pricingState,
      totalCost: pricingState.costNew + pricingState.overseasShippingNew
    }),
    saleExpected,
    ['cnyNet', 'creatorCommission', 'profit', 'margin'],
    'calc 公式 ESM 模块利润复盘公式不正确'
  );
  approxRow(
    formulas.calcSalePriceV3({
      state: pricingState,
      totalCost: pricingState.costNew + pricingState.overseasShippingNew,
      customerShippingJpy: 350
    }),
    saleV3Expected,
    ['cnyNet', 'platformFee', 'creatorCommission', 'profit', 'margin'],
    'calc 公式 ESM 模块利润复盘 V3 公式不正确'
  );
  approxRow(
    formulas.calcSalePriceV3Transfer({
      state: { ...pricingState, salePrice: 750 },
      totalCost: pricingState.costNew + pricingState.overseasShippingNew,
      transferShippingJpy: 350
    }),
    saleV3TransferExpected,
    ['cnyNet', 'platformFee', 'creatorCommission', 'profit', 'margin', 'effectiveSalePrice'],
    'calc 公式 ESM 模块利润复盘 V3 包邮转嫁公式不正确'
  );

  console.log('calc formulas ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
