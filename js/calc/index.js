/* ============================================================
 * 模块 1：利润计算器
 * ============================================================ */
(function () {
  const shippingCore = typeof TKShippingCore !== 'undefined' ? TKShippingCore : null;
  const DEFAULTS = {
    fee: 7, rate: 23.5, shipping: 17,
    discounts: [0.35, 0.38, 0.40, 0.42, 0.45, 0.48, 0.50],
    cost: 30, targetMargin: 1.4, anchor: 0.40, origPrice: null,
    costNew: 10, labelFeeNew: 1.2, overseasShippingNew: 0, shippingMultiplierNew: 1.1, shippingSourceNew: 'manual',
    feeNew: 10, rateNew: 23.5, discountsNew: [0.35, 0.38, 0.40, 0.42, 0.45, 0.48, 0.50],
    targetMarginNew: 1.4, anchorNew: 0.40, origPriceNew: null,
    shipCargoTypeNew: 'general', shipActualWeightNew: 100,
    shipLengthNew: 10, shipWidthNew: 10, shipHeightNew: 10,
    salePrice: 0, calcTab: 'pricingNew',
    shipCargoType: 'general', shipActualWeight: 500,
    shipLength: 20, shipWidth: 15, shipHeight: 10
  };
  const SHIPPING_RULES = shippingCore?.SHIPPING_RULES || {};
  const MIN_BILLABLE_WEIGHT_KG = shippingCore?.DEFAULT_CONSTANTS?.MIN_BILLABLE_WEIGHT_KG ?? 0.05;
  const MAX_WEIGHT_KG = shippingCore?.DEFAULT_CONSTANTS?.MAX_WEIGHT_KG ?? 30;
  const VOLUME_DIVISOR = shippingCore?.DEFAULT_CONSTANTS?.VOLUME_DIVISOR ?? 8000;
  const VOLUME_TRIGGER_MULTIPLIER = shippingCore?.DEFAULT_CONSTANTS?.VOLUME_TRIGGER_MULTIPLIER ?? 1.5;
  const SIZE_LIMITS = shippingCore?.DEFAULT_CONSTANTS?.SIZE_LIMITS ?? [60, 50, 40];
  const CUSTOMER_SHIPPING_JPY = shippingCore?.DEFAULT_CONSTANTS?.CUSTOMER_SHIPPING_JPY ?? 350;
  const LS_KEY = 'tk.profit.v1';
  const globalSettings = typeof window !== 'undefined'
    ? (window.__tkGlobalSettingsStore || (typeof TKGlobalSettings !== 'undefined' ? TKGlobalSettings.create() : null))
    : null;

  const shared = CalcShared.create({
    storageKey: LS_KEY,
    defaults: DEFAULTS
  });
  const { $ } = shared;
  const state = shared.load();
  const globalRate = typeof globalSettings?.getExchangeRate === 'function'
    ? globalSettings.getExchangeRate()
    : null;
  if (globalRate !== null) {
    state.rateNew = globalRate;
  } else if (typeof globalSettings?.setExchangeRate === 'function' && state.rateNew > 0) {
    globalSettings.setExchangeRate(state.rateNew);
  }

  const els = {
    calcTabs: Array.from(document.querySelectorAll('[data-calc-tab]')),
    calcPanels: {
      pricing: $('calc-panel-pricing'),
      pricingNew: $('calc-panel-pricing-new'),
      review: $('calc-panel-review')
    },
    calcHelpBtn: $('calc-help-btn'),
    calcHelpModal: $('calc-help-modal'),
    calcHelpClose: $('calc-help-close'),
    fee: $('fee'), feeNew: $('feeNew'), feeReview: $('feeReview'),
    rate: $('rate'), rateNew: $('rateNew'), rateReview: $('rateReview'),
    shipping: $('shipping'), shippingReview: $('shippingReview'),
    discounts: $('discounts'), discountsNew: $('discountsNew'),
    cost: $('cost'), costNew: $('costNew'), costReview: $('costReview'),
    labelFeeNew: $('labelFeeNew'), labelFeeReview: $('labelFeeReview'),
    overseasShippingNew: $('overseasShippingNew'),
    shippingMultiplierNew: $('shippingMultiplierNew'), shippingMultiplierReview: $('shippingMultiplierReview'),
    totalCostNew: $('totalCostNew'),
    targetMargin: $('targetMargin'), targetMarginNew: $('targetMarginNew'),
    anchor: $('anchor'), anchorNew: $('anchorNew'),
    origPrice: $('origPrice'), origPriceNew: $('origPriceNew'),
    tbody: $('tbody'), tbodyNew: $('tbodyNew'),
    salePrice: $('salePrice'), saleNet: $('saleNet'), saleProfit: $('saleProfit'), saleMargin: $('saleMargin'),
    totalCostReview: $('totalCostReview'),
    shipCargoTypeNew: $('shipCargoTypeNew'), shipActualWeightNew: $('shipActualWeightNew'),
    shipLengthNew: $('shipLengthNew'), shipWidthNew: $('shipWidthNew'), shipHeightNew: $('shipHeightNew'),
    shipCargoTypeReview: $('shipCargoTypeReview'), shipActualWeightReviewCalc: $('shipActualWeightReviewCalc'),
    shipLengthReviewCalc: $('shipLengthReviewCalc'), shipWidthReviewCalc: $('shipWidthReviewCalc'), shipHeightReviewCalc: $('shipHeightReviewCalc'),
    shipActualKgNew: $('shipActualKgNew'), shipActualRuleNew: $('shipActualRuleNew'),
    shipVolWeightNew: $('shipVolWeightNew'), shipVolFormulaNew: $('shipVolFormulaNew'),
    shipChargeWeightNew: $('shipChargeWeightNew'), shipChargeRuleNew: $('shipChargeRuleNew'),
    shipBandNew: $('shipBandNew'), shipFeeCnyNew: $('shipFeeCnyNew'), shipFeeFormulaNew: $('shipFeeFormulaNew'),
    shipChargeReasonNew: $('shipChargeReasonNew'),
    importShippingNew: $('importShippingNew'),
    shipActualKgReview: $('shipActualKgReview'), shipActualRuleReview: $('shipActualRuleReview'),
    shipVolWeightReview: $('shipVolWeightReview'), shipVolFormulaReview: $('shipVolFormulaReview'),
    shipChargeWeightReview: $('shipChargeWeightReview'), shipChargeRuleReview: $('shipChargeRuleReview'),
    shipBandReview: $('shipBandReview'), shipFeeCnyReview: $('shipFeeCnyReview'), shipFeeFormulaReview: $('shipFeeFormulaReview'),
    shipChargeReasonReview: $('shipChargeReasonReview'),
    importShippingReview: $('importShippingReview'),
    shipCargoType: $('shipCargoType'), shipActualWeight: $('shipActualWeight'),
    shipLength: $('shipLength'), shipWidth: $('shipWidth'), shipHeight: $('shipHeight'),
    shipActualKg: $('shipActualKg'),
    shipVolWeight: $('shipVolWeight'), shipChargeWeight: $('shipChargeWeight'),
    shipChargeReason: $('shipChargeReason'),
    shipBand: $('shipBand'), shipRateLine: $('shipRateLine'),
    shipFeeJpy: $('shipFeeJpy'), shipFeeCny: $('shipFeeCny'),
    shipFormula: $('shipFormula'), shipCnyFormula: $('shipCnyFormula'), shipAlerts: $('shipAlerts')
  };

  const shipping = CalcShipping.create({
    state,
    els,
    helpers: shared,
    constants: {
      SHIPPING_RULES,
      MIN_BILLABLE_WEIGHT_KG,
      MAX_WEIGHT_KG,
      VOLUME_DIVISOR,
      VOLUME_TRIGGER_MULTIPLIER,
      SIZE_LIMITS,
      CUSTOMER_SHIPPING_JPY
    }
  });
  const legacy = CalcLegacyPricing.create({
    state,
    els,
    helpers: shared,
    save: nextState => shared.save(nextState)
  });
  const pricing = CalcPricing.create({
    state,
    els,
    helpers: shared,
    shipping,
    save: nextState => shared.save(nextState)
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
})();
