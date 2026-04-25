const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const shippingCoreSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'shipping-core.js'), 'utf8');
const sharedSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'shared.js'), 'utf8');
const shippingSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'shipping.js'), 'utf8');

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

console.log('calc shipping quote ok');
