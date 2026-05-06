const fs = require('fs');
const path = require('path');
const assert = require('assert');

const srcPricingSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'pricing.mjs'), 'utf8');

assert.match(
  srcPricingSource,
  /function bindPricing\(\)[\s\S]*bindNumber\(els\.costReview, 'costNew'\)[\s\S]*bindNumber\(els\.costNew, 'costNew'\)/,
  'pricing ESM 壳层需要保留定价新和利润复盘输入双向同步绑定'
);

function createFakeElement(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    value: '',
    innerHTML: '',
    textContent: '',
    className: '',
    dataset: {},
    children: [],
    listeners: {},
    selectionStart: 0,
    selectionEnd: 0,
    addEventListener(type, handler) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(handler);
    },
    dispatch(type, extra = {}) {
      const event = { target: this, isComposing: false, ...extra };
      (this.listeners[type] || []).forEach(handler => handler(event));
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
    classList: {
      add() { },
      remove() { },
      contains() { return false; },
      toggle() { }
    }
  };
}

const fakeDocument = {
  activeElement: null,
  getElementById: () => null,
  createElement: tag => createFakeElement(tag),
  addEventListener: () => { }
};

const state = {
  feeNew: 10,
  rateNew: 20,
  costNew: 10,
  overseasShippingNew: 2,
  labelFeeNew: 1.2,
  shippingMultiplierNew: 1.1,
  targetMarginNew: 1.5,
  anchorNew: 0.5,
  discountsNew: [0.35, 0.5],
  origPriceNew: 800,
  salePrice: 0,
  calcTab: 'pricingNew',
  shipCargoTypeNew: 'general',
  shipActualWeightNew: 100,
  shipLengthNew: 10,
  shipWidthNew: 10,
  shipHeightNew: 10,
  shipCargoType: 'general',
  shipActualWeight: 500,
  shipLength: 20,
  shipWidth: 15,
  shipHeight: 10
};

function createFakeEls() {
  return {
    calcTabs: [],
    calcPanels: {},
    costNew: createFakeElement('input'),
    costReview: createFakeElement('input'),
    overseasShippingNew: createFakeElement('input'),
    shippingReview: createFakeElement('input'),
    labelFeeNew: createFakeElement('input'),
    labelFeeReview: createFakeElement('input'),
    shippingMultiplierNew: createFakeElement('input'),
    shippingMultiplierReview: createFakeElement('input'),
    totalCostNew: createFakeElement('input'),
    totalCostReview: createFakeElement('input'),
    feeNew: createFakeElement('input'),
    rateNew: createFakeElement('input'),
    discountsNew: createFakeElement('input'),
    targetMarginNew: createFakeElement('input'),
    origPriceNew: createFakeElement('input'),
    anchorNew: createFakeElement('select'),
    tbodyNew: createFakeElement('tbody'),
    salePrice: createFakeElement('input'),
    saleNet: createFakeElement('div'),
    saleProfit: createFakeElement('div'),
    saleMargin: createFakeElement('div'),
    shipCargoTypeNew: createFakeElement('select'),
    shipCargoTypeReview: createFakeElement('select'),
    shipActualWeightNew: createFakeElement('input'),
    shipActualWeightReviewCalc: createFakeElement('input'),
    shipLengthNew: createFakeElement('input'),
    shipLengthReviewCalc: createFakeElement('input'),
    shipWidthNew: createFakeElement('input'),
    shipWidthReviewCalc: createFakeElement('input'),
    shipHeightNew: createFakeElement('input'),
    shipHeightReviewCalc: createFakeElement('input'),
    shipCargoType: createFakeElement('select'),
    shipActualWeight: createFakeElement('input'),
    shipLength: createFakeElement('input'),
    shipWidth: createFakeElement('input'),
    shipHeight: createFakeElement('input'),
    importShippingNew: createFakeElement('button'),
    importShippingReview: createFakeElement('button')
  };
}

(async () => {
  const sharedModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'shared.mjs')}`);
  const pricingModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'pricing.mjs')}`);
  const helpers = sharedModule.CalcShared.create({
    storageKey: 'tk.profit.v1',
    defaults: {}
  });
  const esmState = { ...state };
  const esmEls = createFakeEls();
  const esmPricing = pricingModule.CalcPricing.create({
    state: esmState,
    els: esmEls,
    helpers,
    shipping: {
      getShippingMultiplierNew: () => Math.max(1, esmState.shippingMultiplierNew || 1),
      applyCalculatedShippingCostNew: () => null,
      computeTotalCostNew: () => esmState.costNew + esmState.overseasShippingNew,
      computePricingNewShipping: () => ({}),
      renderPricingNewShipping: () => { },
      renderShippingCalc: () => { }
    },
    save: () => { },
    document: fakeDocument
  });

  esmPricing.syncInputsFromState();
  esmPricing.bindPricing();

  esmEls.costNew.value = '25';
  esmEls.costNew.dispatch('input');
  assert.equal(String(esmEls.costReview.value), '25', 'pricing ESM 壳层需要同步定价新采购价到利润复盘');
  assert.equal(String(esmEls.totalCostReview.value), '27.00', 'pricing ESM 壳层需要同步利润复盘总费用');

  esmEls.costReview.value = '31.5';
  esmEls.costReview.dispatch('input');
  assert.equal(String(esmEls.costNew.value), '31.5', 'pricing ESM 壳层需要同步利润复盘采购价到定价新');
  assert.equal(String(esmEls.totalCostNew.value), '33.50', 'pricing ESM 壳层需要同步定价新总费用');

  console.log('calc pricing sync ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
