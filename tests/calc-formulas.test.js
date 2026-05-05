const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const sharedSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'shared.js'), 'utf8');
const legacySource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'legacy.js'), 'utf8');
const pricingSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'pricing.js'), 'utf8');
const formulasSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'formulas.mjs'), 'utf8');

assert.match(
  formulasSource,
  /export\s+\{/,
  '路线二 M3 需要提供 calc 纯公式 ESM 导出'
);
assert.match(formulasSource, /\bcalcLegacyRow\b/, 'calc 纯公式 ESM 模块需要导出 calcLegacyRow');
assert.match(formulasSource, /\bderiveLegacyOrigPrice\b/, 'calc 纯公式 ESM 模块需要导出 deriveLegacyOrigPrice');
assert.match(formulasSource, /\bcalcPricingRow\b/, 'calc 纯公式 ESM 模块需要导出 calcPricingRow');
assert.match(formulasSource, /\bderivePricingOrigPrice\b/, 'calc 纯公式 ESM 模块需要导出 derivePricingOrigPrice');
assert.match(formulasSource, /\bcalcSalePrice\b/, 'calc 纯公式 ESM 模块需要导出 calcSalePrice');

const sandbox = {
  document: {
    getElementById: () => null,
    activeElement: null
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  console
};
vm.createContext(sandbox);
vm.runInContext(
  `${sharedSource}\n${legacySource}\n${pricingSource}\nthis.CalcShared = CalcShared; this.CalcLegacyPricing = CalcLegacyPricing; this.CalcPricing = CalcPricing;`,
  sandbox
);

function approxEqual(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

function approxRow(actual, expected, fields, message) {
  fields.forEach(field => approxEqual(actual[field], expected[field], `${message}.${field}`));
}

const helpers = sandbox.CalcShared.create({
  storageKey: 'tk.profit.v1',
  defaults: {}
});

const legacyState = {
  fee: 10,
  creatorRate: 10,
  rate: 20,
  shipping: 5,
  cost: 10,
  targetMargin: 2,
  anchor: 0.5
};
const legacy = sandbox.CalcLegacyPricing.create({
  state: legacyState,
  els: {},
  helpers,
  save: () => {}
});

assert.equal(typeof legacy.calcLegacyRow, 'function', '旧定价模块需要暴露 calcLegacyRow');
assert.equal(typeof legacy.deriveLegacyOrigPrice, 'function', '旧定价模块需要暴露 deriveLegacyOrigPrice');

const legacyRow = legacy.calcLegacyRow(1000, 0.5);
approxEqual(legacyRow.jpyPrice, 450, '旧定价日元售价公式不正确');
approxEqual(legacyRow.creatorCommission, 2.25, '旧定价达人佣金公式不正确');
approxEqual(legacyRow.cnyNet, 15.25, '旧定价人民币到手公式不正确');
approxEqual(legacyRow.margin, 1.525, '旧定价利润率公式不正确');
approxEqual(legacy.deriveLegacyOrigPrice(), 1234.567901234568, '旧定价原价反推公式不正确');

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
const pricing = sandbox.CalcPricing.create({
  state: pricingState,
  els: {
    calcTabs: [],
    calcPanels: {}
  },
  helpers,
  shipping: {
    getShippingMultiplierNew: () => 1,
    getCalculatedShippingCostNew: () => null,
    applyCalculatedShippingCostNew: () => null,
    computeTotalCostNew: () => pricingState.costNew + pricingState.overseasShippingNew,
    computePricingNewShipping: () => ({}),
    renderPricingNewShipping: () => {},
    renderShippingCalc: () => {}
  },
  save: () => {}
});

assert.equal(typeof pricing.calcRow, 'function', '定价新模块需要暴露 calcRow');
assert.equal(typeof pricing.deriveOrigPrice, 'function', '定价新模块需要暴露 deriveOrigPrice');
assert.equal(typeof pricing.calcSalePrice, 'function', '定价新模块需要暴露 calcSalePrice');

const pricingRow = pricing.calcRow('pricingNew', 800, 0.5);
approxEqual(pricingRow.jpyPrice, 360, '定价新日元售价公式不正确');
approxEqual(pricingRow.cnyNet, 16.2, '定价新人民币到手公式不正确');
approxEqual(pricingRow.creatorCommission, 1.8, '定价新达人佣金公式不正确');
approxEqual(pricingRow.profit, 4.2, '定价新利润公式不正确');
approxEqual(pricingRow.margin, 1.35, '定价新利润率公式不正确');
approxEqual(pricing.deriveOrigPrice('pricingNew'), 888.8888888888889, '定价新原价反推公式不正确');

const sale = pricing.calcSalePrice();
approxEqual(sale.cnyNet, 13.5, '利润复盘人民币到手公式不正确');
approxEqual(sale.creatorCommission, 1.5, '利润复盘达人佣金公式不正确');
approxEqual(sale.profit, 1.5, '利润复盘利润公式不正确');
approxEqual(sale.margin, 1.125, '利润复盘利润率公式不正确');

(async () => {
  const formulas = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'formulas.mjs')}`);

  approxRow(
    formulas.calcLegacyRow(legacyState, 1000, 0.5),
    legacyRow,
    ['discount', 'jpyPrice', 'cnyNet', 'creatorCommission', 'margin'],
    'calc 公式 ESM 模块需要和旧定价行公式一致'
  );
  approxEqual(
    formulas.deriveLegacyOrigPrice(legacyState),
    legacy.deriveLegacyOrigPrice(),
    'calc 公式 ESM 模块需要和旧定价原价反推一致'
  );

  approxRow(
    formulas.calcPricingRow({
      state: pricingState,
      totalCost: pricingState.costNew + pricingState.overseasShippingNew,
      origPrice: 800,
      discount: 0.5
    }),
    pricingRow,
    ['discount', 'jpyPrice', 'cnyNet', 'creatorCommission', 'profit', 'margin'],
    'calc 公式 ESM 模块需要和定价新行公式一致'
  );
  approxEqual(
    formulas.derivePricingOrigPrice({
      state: pricingState,
      totalCost: pricingState.costNew + pricingState.overseasShippingNew
    }),
    pricing.deriveOrigPrice('pricingNew'),
    'calc 公式 ESM 模块需要和定价新原价反推一致'
  );
  approxRow(
    formulas.calcSalePrice({
      state: pricingState,
      totalCost: pricingState.costNew + pricingState.overseasShippingNew
    }),
    sale,
    ['cnyNet', 'creatorCommission', 'profit', 'margin'],
    'calc 公式 ESM 模块需要和利润复盘公式一致'
  );

  console.log('calc formulas ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
