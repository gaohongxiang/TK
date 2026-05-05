import { ensureGlobalSettingsStore } from '../global-settings.mjs';
import { TKShippingCore } from '../shipping-core.mjs';
import { CalcShared } from './shared.mjs';
import { CalcShipping } from './shipping.mjs';
import { CalcLegacyPricing } from './legacy.mjs';
import { CalcPricing } from './pricing.mjs';

const LS_KEY = 'tk.profit.v1';

const DEFAULTS = {
  fee: 7,
  rate: 23.5,
  shipping: 17,
  discounts: [0.35, 0.38, 0.40, 0.42, 0.45, 0.48, 0.50],
  creatorRate: 0,
  cost: 30,
  targetMargin: 1.4,
  anchor: 0.40,
  origPrice: null,
  costNew: 10,
  labelFeeNew: 1.2,
  overseasShippingNew: 0,
  shippingMultiplierNew: 1.1,
  shippingSourceNew: 'manual',
  feeNew: 10,
  creatorRateNew: 0,
  rateNew: 23.5,
  discountsNew: [0.35, 0.38, 0.40, 0.42, 0.45, 0.48, 0.50],
  targetMarginNew: 1.4,
  anchorNew: 0.40,
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
};

function getShippingConstants(shippingCore = TKShippingCore) {
  return {
    SHIPPING_RULES: shippingCore?.SHIPPING_RULES || {},
    MIN_BILLABLE_WEIGHT_KG: shippingCore?.DEFAULT_CONSTANTS?.MIN_BILLABLE_WEIGHT_KG ?? 0.05,
    MAX_WEIGHT_KG: shippingCore?.DEFAULT_CONSTANTS?.MAX_WEIGHT_KG ?? 30,
    VOLUME_DIVISOR: shippingCore?.DEFAULT_CONSTANTS?.VOLUME_DIVISOR ?? 8000,
    VOLUME_TRIGGER_MULTIPLIER: shippingCore?.DEFAULT_CONSTANTS?.VOLUME_TRIGGER_MULTIPLIER ?? 1.5,
    SIZE_LIMITS: shippingCore?.DEFAULT_CONSTANTS?.SIZE_LIMITS ?? [60, 50, 40],
    CUSTOMER_SHIPPING_JPY: shippingCore?.DEFAULT_CONSTANTS?.CUSTOMER_SHIPPING_JPY ?? 350
  };
}

function createCalcElements(rootDocument, shared) {
  const getById = id => rootDocument?.getElementById?.(id) || shared.$(id);
  return {
    calcTabs: Array.from(rootDocument?.querySelectorAll?.('[data-calc-tab]') || []),
    calcPanels: {
      pricing: getById('calc-panel-pricing'),
      pricingNew: getById('calc-panel-pricing-new'),
      review: getById('calc-panel-review')
    },
    calcHelpBtn: getById('calc-help-btn'),
    calcHelpModal: getById('calc-help-modal'),
    calcHelpClose: getById('calc-help-close'),
    fee: getById('fee'),
    feeNew: getById('feeNew'),
    feeReview: getById('feeReview'),
    creatorRate: getById('creatorRate'),
    creatorRateNew: getById('creatorRateNew'),
    creatorRateReview: getById('creatorRateReview'),
    rate: getById('rate'),
    rateNew: getById('rateNew'),
    rateReview: getById('rateReview'),
    shipping: getById('shipping'),
    shippingReview: getById('shippingReview'),
    discounts: getById('discounts'),
    discountsNew: getById('discountsNew'),
    cost: getById('cost'),
    costNew: getById('costNew'),
    costReview: getById('costReview'),
    labelFeeNew: getById('labelFeeNew'),
    labelFeeReview: getById('labelFeeReview'),
    overseasShippingNew: getById('overseasShippingNew'),
    shippingMultiplierNew: getById('shippingMultiplierNew'),
    shippingMultiplierReview: getById('shippingMultiplierReview'),
    totalCostNew: getById('totalCostNew'),
    targetMargin: getById('targetMargin'),
    targetMarginNew: getById('targetMarginNew'),
    anchor: getById('anchor'),
    anchorNew: getById('anchorNew'),
    origPrice: getById('origPrice'),
    origPriceNew: getById('origPriceNew'),
    tbody: getById('tbody'),
    tbodyNew: getById('tbodyNew'),
    salePrice: getById('salePrice'),
    saleNet: getById('saleNet'),
    saleCommission: getById('saleCommission'),
    saleCommissionReview: getById('saleCommissionReview'),
    saleProfit: getById('saleProfit'),
    saleMargin: getById('saleMargin'),
    totalCostReview: getById('totalCostReview'),
    shipCargoTypeNew: getById('shipCargoTypeNew'),
    shipActualWeightNew: getById('shipActualWeightNew'),
    shipLengthNew: getById('shipLengthNew'),
    shipWidthNew: getById('shipWidthNew'),
    shipHeightNew: getById('shipHeightNew'),
    shipCargoTypeReview: getById('shipCargoTypeReview'),
    shipActualWeightReviewCalc: getById('shipActualWeightReviewCalc'),
    shipLengthReviewCalc: getById('shipLengthReviewCalc'),
    shipWidthReviewCalc: getById('shipWidthReviewCalc'),
    shipHeightReviewCalc: getById('shipHeightReviewCalc'),
    shipActualKgNew: getById('shipActualKgNew'),
    shipActualRuleNew: getById('shipActualRuleNew'),
    shipVolWeightNew: getById('shipVolWeightNew'),
    shipVolFormulaNew: getById('shipVolFormulaNew'),
    shipChargeWeightNew: getById('shipChargeWeightNew'),
    shipChargeRuleNew: getById('shipChargeRuleNew'),
    shipBandNew: getById('shipBandNew'),
    shipFeeCnyNew: getById('shipFeeCnyNew'),
    shipFeeFormulaNew: getById('shipFeeFormulaNew'),
    shipChargeReasonNew: getById('shipChargeReasonNew'),
    importShippingNew: getById('importShippingNew'),
    shipActualKgReview: getById('shipActualKgReview'),
    shipActualRuleReview: getById('shipActualRuleReview'),
    shipVolWeightReview: getById('shipVolWeightReview'),
    shipVolFormulaReview: getById('shipVolFormulaReview'),
    shipChargeWeightReview: getById('shipChargeWeightReview'),
    shipChargeRuleReview: getById('shipChargeRuleReview'),
    shipBandReview: getById('shipBandReview'),
    shipFeeCnyReview: getById('shipFeeCnyReview'),
    shipFeeFormulaReview: getById('shipFeeFormulaReview'),
    shipChargeReasonReview: getById('shipChargeReasonReview'),
    importShippingReview: getById('importShippingReview'),
    shipCargoType: getById('shipCargoType'),
    shipActualWeight: getById('shipActualWeight'),
    shipLength: getById('shipLength'),
    shipWidth: getById('shipWidth'),
    shipHeight: getById('shipHeight'),
    shipActualKg: getById('shipActualKg'),
    shipVolWeight: getById('shipVolWeight'),
    shipChargeWeight: getById('shipChargeWeight'),
    shipChargeReason: getById('shipChargeReason'),
    shipBand: getById('shipBand'),
    shipRateLine: getById('shipRateLine'),
    shipFeeJpy: getById('shipFeeJpy'),
    shipFeeCny: getById('shipFeeCny'),
    shipFormula: getById('shipFormula'),
    shipCnyFormula: getById('shipCnyFormula'),
    shipAlerts: getById('shipAlerts')
  };
}

function initCalc({
  document: rootDocument = globalThis.document,
  window: rootWindow = globalThis.window,
  storageKey = LS_KEY,
  defaults = DEFAULTS,
  shippingCore = TKShippingCore
} = {}) {
  if (!rootDocument) return null;

  const globalSettings = rootWindow ? ensureGlobalSettingsStore(rootWindow) : null;
  const shared = CalcShared.create({
    storageKey,
    defaults
  });
  const state = shared.load();
  const globalRate = typeof globalSettings?.getExchangeRate === 'function'
    ? globalSettings.getExchangeRate()
    : null;
  if (globalRate !== null) {
    state.rateNew = globalRate;
  } else if (typeof globalSettings?.setExchangeRate === 'function' && state.rateNew > 0) {
    globalSettings.setExchangeRate(state.rateNew);
  }

  const els = createCalcElements(rootDocument, shared);
  const shipping = CalcShipping.create({
    state,
    els,
    helpers: shared,
    constants: getShippingConstants(shippingCore),
    shippingCore
  });
  const legacy = CalcLegacyPricing.create({
    state,
    els,
    helpers: shared,
    save: nextState => shared.save(nextState),
    document: rootDocument
  });
  const pricing = CalcPricing.create({
    state,
    els,
    helpers: shared,
    shipping,
    save: nextState => shared.save(nextState),
    document: rootDocument
  });

  legacy.bindLegacyPricing();
  pricing.bindPricing();
  if (els.rateNew && typeof globalSettings?.setExchangeRate === 'function') {
    els.rateNew.addEventListener('input', () => {
      globalSettings.setExchangeRate(shared.toNumber(els.rateNew.value) || null);
    });
  }
  legacy.syncInputsFromState();
  pricing.syncInputsFromState();
  legacy.rerenderLegacyPricing({ derive: false });
  pricing.renderCalcTab();
  pricing.rerenderAll();

  return {
    state,
    els,
    shared,
    shipping,
    legacy,
    pricing,
    globalSettings
  };
}

if (typeof document !== 'undefined') {
  initCalc();
}

export {
  DEFAULTS,
  LS_KEY,
  createCalcElements,
  getShippingConstants,
  initCalc
};
