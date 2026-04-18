const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const sharedSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'shared.js'), 'utf8');
const legacySource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'legacy.js'), 'utf8');
const pricingSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'pricing.js'), 'utf8');

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

const helpers = sandbox.CalcShared.create({
  storageKey: 'tk.profit.v1',
  defaults: {}
});

const legacyState = {
  fee: 10,
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
approxEqual(legacyRow.cnyNet, 17.5, '旧定价人民币到手公式不正确');
approxEqual(legacyRow.margin, 1.75, '旧定价利润率公式不正确');
approxEqual(legacy.deriveLegacyOrigPrice(), 1111.111111111111, '旧定价原价反推公式不正确');

const pricingState = {
  feeNew: 10,
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
approxEqual(pricingRow.cnyNet, 18, '定价新人民币到手公式不正确');
approxEqual(pricingRow.profit, 6, '定价新利润公式不正确');
approxEqual(pricingRow.margin, 1.5, '定价新利润率公式不正确');
approxEqual(pricing.deriveOrigPrice('pricingNew'), 800, '定价新原价反推公式不正确');

const sale = pricing.calcSalePrice();
approxEqual(sale.cnyNet, 15, '利润复盘人民币到手公式不正确');
approxEqual(sale.profit, 3, '利润复盘利润公式不正确');
approxEqual(sale.margin, 1.25, '利润复盘利润率公式不正确');

console.log('calc formulas ok');
