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
  /const result = calcSalePriceV3\(\{ state, totalCost[\s\S]*\}\)/,
  'React 利润复盘面板需要直接复用 V3 纯公式模块'
);
assert.match(
  reactCalculatorSource,
  /商品售价 = 原价 × 折扣[\s\S]*平台手续费 =（商品售价 \+ 买家支付运费）× 平台手续费率 ÷ 汇率[\s\S]*达人佣金 = 商品售价 × 达人佣金率 ÷ 汇率[\s\S]*人民币到手 = 商品售价 ÷ 汇率 − 平台手续费 − 达人佣金[\s\S]*原价反推 = \[总费用 × 目标利润率 × 汇率 \+ 买家支付运费 × 平台手续费率\] ÷ \[基准折扣 × \(1 − 平台手续费率 − 达人佣金率\)\][\s\S]*平台手续费 =（商品售价 \+ 买家支付运费 350円）× 平台手续费率 ÷ 日元汇率[\s\S]*人民币到手 = 商品售价 ÷ 日元汇率 − 平台手续费 − 达人佣金/,
  '利润计算器页面公式文案需要和 V3 主口径一致'
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

  console.log('calc formulas ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
