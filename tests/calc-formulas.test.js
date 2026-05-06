const fs = require('fs');
const path = require('path');
const assert = require('assert');

const formulasSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'formulas.mjs'), 'utf8');
const srcLegacySource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'legacy.mjs'), 'utf8');
const srcPricingSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'pricing.mjs'), 'utf8');

assert.match(formulasSource, /export\s+\{/, '路线二 M3 需要提供 calc 纯公式 ESM 导出');
assert.match(formulasSource, /\bcalcLegacyRow\b/, 'calc 纯公式 ESM 模块需要导出 calcLegacyRow');
assert.match(formulasSource, /\bderiveLegacyOrigPrice\b/, 'calc 纯公式 ESM 模块需要导出 deriveLegacyOrigPrice');
assert.match(formulasSource, /\bcalcPricingRow\b/, 'calc 纯公式 ESM 模块需要导出 calcPricingRow');
assert.match(formulasSource, /\bderivePricingOrigPrice\b/, 'calc 纯公式 ESM 模块需要导出 derivePricingOrigPrice');
assert.match(formulasSource, /\bcalcSalePrice\b/, 'calc 纯公式 ESM 模块需要导出 calcSalePrice');
assert.match(
  srcLegacySource,
  /import\s+\{[\s\S]*calcLegacyRow as calcLegacyRowFormula[\s\S]*deriveLegacyOrigPrice as deriveLegacyOrigPriceFormula[\s\S]*\}\s+from\s+'\.\/formulas\.mjs'/,
  '路线二 M3 legacy ESM 壳层需要复用公式模块'
);
assert.match(srcLegacySource, /export\s+\{[\s\S]*CalcLegacyPricing[\s\S]*create[\s\S]*\}/, '路线二 M3 需要提供 legacy ESM 壳层导出');
assert.match(
  srcPricingSource,
  /import\s+\{[\s\S]*calcPricingRow[\s\S]*calcSalePrice as calcSalePriceFormula[\s\S]*derivePricingOrigPrice[\s\S]*\}\s+from\s+'\.\/formulas\.mjs'/,
  '路线二 M3 pricing ESM 壳层需要复用公式模块'
);
assert.match(srcPricingSource, /export\s+\{[\s\S]*CalcPricing[\s\S]*create[\s\S]*\}/, '路线二 M3 需要提供 pricing ESM 壳层导出');

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
  const sharedModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'shared.mjs')}`);
  const formulas = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'formulas.mjs')}`);
  const legacyModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'legacy.mjs')}`);
  const pricingModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'pricing.mjs')}`);

  const helpers = sharedModule.CalcShared.create({ storageKey: 'tk.profit.v1', defaults: {} });
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
    profit: 4.2,
    margin: 1.35
  };
  const saleExpected = {
    cnyNet: 13.5,
    creatorCommission: 1.5,
    profit: 1.5,
    margin: 1.125
  };

  approxRow(
    formulas.calcLegacyRow(legacyState, 1000, 0.5),
    legacyExpected,
    ['discount', 'jpyPrice', 'cnyNet', 'creatorCommission', 'margin'],
    'calc 公式 ESM 模块旧定价行公式不正确'
  );
  approxEqual(formulas.deriveLegacyOrigPrice(legacyState), 1234.567901234568, 'calc 公式 ESM 模块旧定价原价反推不正确');

  const legacyEsm = legacyModule.CalcLegacyPricing.create({
    state: { ...legacyState },
    els: {},
    helpers,
    save: () => {}
  });
  assert.equal(typeof legacyEsm.calcLegacyRow, 'function', 'legacy ESM 壳层需要暴露 calcLegacyRow');
  assert.equal(typeof legacyEsm.deriveLegacyOrigPrice, 'function', 'legacy ESM 壳层需要暴露 deriveLegacyOrigPrice');
  approxRow(
    legacyEsm.calcLegacyRow(1000, 0.5),
    legacyExpected,
    ['discount', 'jpyPrice', 'cnyNet', 'creatorCommission', 'margin'],
    'legacy ESM 壳层旧定价行公式不正确'
  );
  approxEqual(legacyEsm.deriveLegacyOrigPrice(), 1234.567901234568, 'legacy ESM 壳层旧定价原价反推不正确');

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
    formulas.calcSalePrice({
      state: pricingState,
      totalCost: pricingState.costNew + pricingState.overseasShippingNew
    }),
    saleExpected,
    ['cnyNet', 'creatorCommission', 'profit', 'margin'],
    'calc 公式 ESM 模块利润复盘公式不正确'
  );

  const pricingEsm = pricingModule.CalcPricing.create({
    state: { ...pricingState },
    els: { calcTabs: [], calcPanels: {} },
    helpers,
    shipping: {
      getShippingMultiplierNew: () => 1,
      applyCalculatedShippingCostNew: () => null,
      computeTotalCostNew: () => pricingState.costNew + pricingState.overseasShippingNew,
      computePricingNewShipping: () => ({}),
      renderPricingNewShipping: () => {},
      renderShippingCalc: () => {}
    },
    save: () => {},
    document: { getElementById: () => null, activeElement: null }
  });
  assert.equal(typeof pricingEsm.calcRow, 'function', 'pricing ESM 壳层需要暴露 calcRow');
  assert.equal(typeof pricingEsm.deriveOrigPrice, 'function', 'pricing ESM 壳层需要暴露 deriveOrigPrice');
  assert.equal(typeof pricingEsm.calcSalePrice, 'function', 'pricing ESM 壳层需要暴露 calcSalePrice');
  approxRow(
    pricingEsm.calcRow('pricingNew', 800, 0.5),
    pricingExpected,
    ['discount', 'jpyPrice', 'cnyNet', 'creatorCommission', 'profit', 'margin'],
    'pricing ESM 壳层定价新行公式不正确'
  );
  approxEqual(pricingEsm.deriveOrigPrice('pricingNew'), 888.8888888888889, 'pricing ESM 壳层定价新原价反推不正确');
  approxRow(
    pricingEsm.calcSalePrice(),
    saleExpected,
    ['cnyNet', 'creatorCommission', 'profit', 'margin'],
    'pricing ESM 壳层利润复盘公式不正确'
  );

  console.log('calc formulas ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
