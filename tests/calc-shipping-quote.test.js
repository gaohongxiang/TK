const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const shippingCoreSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'shipping-core.js'), 'utf8');
const sharedSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'shared.js'), 'utf8');
const shippingSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'shipping.js'), 'utf8');
const srcShippingSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'shipping.mjs'), 'utf8');

assert.match(
  srcShippingSource,
  /import\s+\{\s*TKShippingCore\s*\}\s+from\s+'..\/shipping-core\.mjs'/,
  '路线二 M3 calc shipping ESM 模块需要复用共享运费核心'
);
assert.match(
  srcShippingSource,
  /export\s+\{[\s\S]*CalcShipping[\s\S]*create[\s\S]*\}/,
  '路线二 M3 calc shipping 需要提供 ESM 导出'
);

const sandbox = {
  document: {
    getElementById: () => null
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  console
};
vm.createContext(sandbox);
vm.runInContext(`${shippingCoreSource}\n${sharedSource}\n${shippingSource}\nthis.TKShippingCore = TKShippingCore; this.CalcShared = CalcShared; this.CalcShipping = CalcShipping;`, sandbox);

const shared = sandbox.CalcShared.create({
  storageKey: 'tk.profit.v1',
  defaults: {
    fee: 7,
    rate: 23.5,
    shipping: 17,
    discounts: [0.35, 0.4, 0.5],
    cost: 30,
    targetMargin: 1.4,
    anchor: 0.4,
    origPrice: null,
    costNew: 10,
    labelFeeNew: 1.2,
    overseasShippingNew: 0,
    shippingMultiplierNew: 1.1,
    shippingSourceNew: 'manual',
    feeNew: 10,
    rateNew: 23.5,
    discountsNew: [0.35, 0.4, 0.5],
    targetMarginNew: 1.4,
    anchorNew: 0.4,
    origPriceNew: null,
    shipCargoTypeNew: 'general',
    shipActualWeightNew: 100,
    shipLengthNew: 10,
    shipWidthNew: 10,
    shipHeightNew: 10,
    salePrice: 0,
    calcTab: 'pricingNew',
    shipCargoType: 'general',
    shipActualWeight: 500,
    shipLength: 20,
    shipWidth: 15,
    shipHeight: 10
  }
});

const state = shared.load();
const els = {};

const shipping = sandbox.CalcShipping.create({
  state,
  els,
  helpers: shared,
  constants: {
    SHIPPING_RULES: {
      general: {
        label: '普货',
        bands: [
          { max: 0.5, range: '0 - 0.5 kg', parcel: 545, perKg: 340 },
          { max: 1, range: '0.5 - 1 kg', parcel: 560, perKg: 340 },
          { max: 2, range: '1 - 2 kg', parcel: 590, perKg: 340 },
          { max: 5, range: '2 - 5 kg', parcel: 590, perKg: 405 },
          { max: 10, range: '5 - 10 kg', parcel: 590, perKg: 415 },
          { max: 20, range: '10 - 20 kg', parcel: 590, perKg: 425 },
          { max: 30, range: '20 - 30 kg', parcel: 590, perKg: 435 }
        ]
      },
      special: {
        label: '特货',
        bands: [
          { max: 0.5, range: '0 - 0.5 kg', parcel: 555, perKg: 400 },
          { max: 1, range: '0.5 - 1 kg', parcel: 580, perKg: 420 },
          { max: 2, range: '1 - 2 kg', parcel: 610, perKg: 420 },
          { max: 5, range: '2 - 5 kg', parcel: 610, perKg: 510 },
          { max: 10, range: '5 - 10 kg', parcel: 610, perKg: 525 },
          { max: 20, range: '10 - 20 kg', parcel: 610, perKg: 535 },
          { max: 30, range: '20 - 30 kg', parcel: 610, perKg: 545 }
        ]
      }
    },
    MIN_BILLABLE_WEIGHT_KG: 0.05,
    MAX_WEIGHT_KG: 30,
    VOLUME_DIVISOR: 8000,
    VOLUME_TRIGGER_MULTIPLIER: 1.5,
    SIZE_LIMITS: [60, 50, 40],
    CUSTOMER_SHIPPING_JPY: 350,
    PRICING_TARGET_KEYS: []
  }
});

const volumeQuote = shipping.computeShippingQuote({
  cargoType: 'general',
  actualWeight: 50,
  length: 30,
  width: 10,
  height: 10,
  rate: 23.5
});

assert.equal(volumeQuote.band.range, '0 - 0.5 kg', '体积重命中的价卡区间不正确');
assert.equal(volumeQuote.chargeWeightKg, 0.375, '应按体积重计费');
assert.equal(volumeQuote.jpyFee, 322.5, '应扣除用户承担的 350 円');

const floorQuote = shipping.computeShippingQuote({
  cargoType: 'general',
  actualWeight: 10,
  length: '',
  width: '',
  height: '',
  rate: 23.5
});

assert.equal(floorQuote.chargeWeightKg, 0.05, '低于 50g 时应按 0.05kg 起计');
assert.ok(
  floorQuote.alerts.some(alert => alert.text.includes('50g')),
  '低于 50g 时需要给出提示'
);

(async () => {
  const sharedModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'shared.mjs')}`);
  const shippingModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'shipping.mjs')}`);

  const esmShared = sharedModule.CalcShared.create({
    storageKey: 'tk.profit.v1',
    defaults: {}
  });
  const esmState = {
    ...state,
    shippingMultiplierNew: 1.1,
    labelFeeNew: 1.2,
    costNew: 10,
    overseasShippingNew: 0,
    shipCargoTypeNew: 'general',
    shipActualWeightNew: 50,
    shipLengthNew: 30,
    shipWidthNew: 10,
    shipHeightNew: 10,
    rateNew: 23.5
  };
  const esmEls = {
    overseasShippingNew: { value: '' },
    shippingReview: { value: '' }
  };
  const esmShipping = shippingModule.CalcShipping.create({
    state: esmState,
    els: esmEls,
    helpers: esmShared,
    constants: {
      SHIPPING_RULES: sandbox.TKShippingCore.SHIPPING_RULES,
      MIN_BILLABLE_WEIGHT_KG: 0.05,
      MAX_WEIGHT_KG: 30,
      VOLUME_DIVISOR: 8000,
      VOLUME_TRIGGER_MULTIPLIER: 1.5,
      SIZE_LIMITS: [60, 50, 40],
      CUSTOMER_SHIPPING_JPY: 350
    }
  });

  const esmQuote = esmShipping.computePricingNewShipping();
  assert.equal(esmQuote.chargeWeightKg, volumeQuote.chargeWeightKg, 'calc shipping ESM 模块需要复用同一运费 quote 逻辑');
  assert.equal(esmShipping.getCalculatedShippingCostNew(esmQuote), 16.3, 'calc shipping ESM 模块需要计算最终人民币运费');
  assert.equal(esmShipping.applyCalculatedShippingCostNew(esmQuote, { markSource: true }), 16.3, 'calc shipping ESM 模块需要支持回填计算运费');
  assert.equal(esmState.shippingSourceNew, 'calculator', 'calc shipping ESM 模块需要保留计算器来源标记');
  assert.equal(esmShipping.computeTotalCostNew(), 26.3, 'calc shipping ESM 模块需要计算定价新总成本');
  assert.equal(esmShipping.renderShippingCalc(), null, 'calc shipping ESM 模块在缺少 DOM 容器时应安全返回');

  console.log('calc shipping quote ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
