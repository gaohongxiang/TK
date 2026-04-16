/* ============================================================
 * 模块 1：利润计算器
 * ============================================================ */
(function () {
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
  const SHIPPING_RULES = {
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
  };
  const MIN_BILLABLE_WEIGHT_KG = 0.05;
  const MAX_WEIGHT_KG = 30;
  const VOLUME_DIVISOR = 8000;
  const VOLUME_TRIGGER_MULTIPLIER = 1.5;
  const SIZE_LIMITS = [60, 50, 40];
  const CUSTOMER_SHIPPING_JPY = 350;
  const LS_KEY = 'tk.profit.v1';
  const $ = id => document.getElementById(id);
  const state = load();

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
  const SYNCED_INPUTS = {
    cost: ['cost'],
    fee: ['fee'],
    rate: ['rate'],
    shipping: ['shipping']
  };
  const PRICING_VIEWS = {
    pricingNew: {
      fee: 'feeNew',
      rate: 'rateNew',
      costValue: 'totalCostNew',
      discountsState: 'discountsNew',
      targetMarginState: 'targetMarginNew',
      anchorState: 'anchorNew',
      origPriceState: 'origPriceNew',
      anchor: 'anchorNew',
      discounts: 'discountsNew',
      tbody: 'tbodyNew'
    }
  };

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!s) return { ...DEFAULTS };
      const merged = { ...DEFAULTS, ...s };
      if (!s.pricingNewDefaultsApplied) {
        if (!Object.prototype.hasOwnProperty.call(s, 'costNew') || s.costNew === 30) merged.costNew = DEFAULTS.costNew;
        if (!Object.prototype.hasOwnProperty.call(s, 'labelFeeNew') || s.labelFeeNew === 0) merged.labelFeeNew = DEFAULTS.labelFeeNew;
        if (!Object.prototype.hasOwnProperty.call(s, 'shippingMultiplierNew') || s.shippingMultiplierNew === 1) merged.shippingMultiplierNew = DEFAULTS.shippingMultiplierNew;
        if (!Object.prototype.hasOwnProperty.call(s, 'feeNew') || s.feeNew === 7) merged.feeNew = DEFAULTS.feeNew;
        if (!Object.prototype.hasOwnProperty.call(s, 'shipActualWeightNew') || s.shipActualWeightNew === 500) merged.shipActualWeightNew = DEFAULTS.shipActualWeightNew;
        merged.pricingNewDefaultsApplied = true;
      }
      if (!s.pricingNewDimensionsApplied) {
        if (!Object.prototype.hasOwnProperty.call(s, 'shipLengthNew') || s.shipLengthNew === '' || s.shipLengthNew === 20) merged.shipLengthNew = DEFAULTS.shipLengthNew;
        if (!Object.prototype.hasOwnProperty.call(s, 'shipWidthNew') || s.shipWidthNew === '' || s.shipWidthNew === 15) merged.shipWidthNew = DEFAULTS.shipWidthNew;
        if (!Object.prototype.hasOwnProperty.call(s, 'shipHeightNew') || s.shipHeightNew === '') merged.shipHeightNew = DEFAULTS.shipHeightNew;
        merged.pricingNewDimensionsApplied = true;
      }
      if (!s.calcTabDefaultApplied) {
        merged.calcTab = 'pricingNew';
        merged.calcTabDefaultApplied = true;
      }
      return merged;
    } catch (e) { return { ...DEFAULTS }; }
  }
  function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  function parseDiscounts(str) {
    return String(str || '').split(/[,，\s]+/).filter(Boolean).map(x => {
      x = x.trim();
      if (x.endsWith('%')) return parseFloat(x) / 100;
      const n = parseFloat(x);
      return n > 1 ? n / 100 : n;
    }).filter(n => !isNaN(n) && n > 0 && n <= 1);
  }
  function fmtDiscount(d) { return (+(d * 10).toFixed(2)) + '折'; }
  function fmtMoney(n, digits = 2) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }
  function fmtCny(n, digits = 2) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return `${n < 0 ? '-¥' : '¥'}${fmtMoney(Math.abs(n), digits)}`;
  }
  function fmtMargin(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return n.toFixed(2);
  }
  function fmtWeight(n, digits = 3) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    const fixed = n.toFixed(digits).replace(/\.?0+$/, '');
    return `${fixed} kg`;
  }
  function fmtWeightValue(n, digits = 3) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return n.toFixed(digits).replace(/\.?0+$/, '');
  }
  function fmtNumberValue(n, digits = 2) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return n.toFixed(digits).replace(/\.?0+$/, '');
  }
  function normalizeDecimalText(v) {
    return String(v ?? '')
      .replace(/[。．｡，]/g, '.')
      .replace(/[﹣－–—]/g, '-')
      .replace(/[＋]/g, '+')
      .replace(/\s+/g, '');
  }
  function applyNormalizedValue(el, value) {
    if (!el) return;
    const cursor = el.selectionStart;
    el.value = value;
    if (cursor !== null && typeof el.setSelectionRange === 'function') {
      const next = Math.min(cursor, el.value.length);
      el.setSelectionRange(next, next);
    }
  }
  function toNumber(v) {
    const n = parseFloat(normalizeDecimalText(v));
    return isNaN(n) ? 0 : n;
  }
  function setInputValue(el, value) {
    if (!el || document.activeElement === el) return;
    el.value = value;
  }
  function ensureDecimalInputBehavior(el) {
    if (!el || el.dataset.decimalBound === '1') return;
    el.dataset.decimalBound = '1';
    el.addEventListener('beforeinput', e => {
      if (e.isComposing || typeof e.data !== 'string' || !e.data) return;
      const normalized = normalizeDecimalText(e.data);
      if (normalized === e.data) return;
      e.preventDefault();
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      el.setRangeText(normalized, start, end, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    el.addEventListener('compositionend', () => {
      const normalized = normalizeDecimalText(el.value);
      if (normalized === el.value) return;
      applyNormalizedValue(el, normalized);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  function setSyncedInputValue(key, value, source = null) {
    const inputKeys = SYNCED_INPUTS[key] || [];
    inputKeys.forEach(name => {
      const el = els[name];
      if (el && el !== source) setInputValue(el, value);
    });
  }
  /* ------------------------------
   * 定价旧：独立逻辑，方便后续直接删除
   * ------------------------------ */
  function calcLegacyRow(origPrice, discount) {
    const feeRate = (state.fee || 0) / 100;
    const cost = state.cost || 0;
    const rate = state.rate || 1;
    const shipping = state.shipping || 0;

    const jpyPrice = origPrice * discount * (1 - feeRate);
    const cnyNet = jpyPrice / rate - shipping;
    const margin = cost > 0 ? cnyNet / cost : NaN;
    return { discount, jpyPrice, cnyNet, margin };
  }
  function deriveLegacyOrigPrice() {
    const feeRate = (state.fee || 0) / 100;
    const cost = state.cost || 0;
    const rate = state.rate || 1;
    const shipping = state.shipping || 0;
    const targetMargin = state.targetMargin || 0;
    const anchor = state.anchor || 0.40;

    if (anchor === 0 || feeRate >= 1) return 0;

    const need = cost * targetMargin + shipping;
    const jpyNeed = need * rate;
    const orig = jpyNeed / (anchor * (1 - feeRate));
    return Math.max(0, orig);
  }
  function renderLegacyAnchorOptions() {
    if (!els.anchor) return;
    els.anchor.innerHTML = '';
    const discounts = state.discounts || [];
    discounts.forEach(discount => {
      const option = document.createElement('option');
      option.value = discount;
      option.textContent = fmtDiscount(discount);
      els.anchor.appendChild(option);
    });
    if (!discounts.length) return;
    const nearest = discounts.reduce((a, b) => Math.abs(b - state.anchor) < Math.abs(a - state.anchor) ? b : a, discounts[0]);
    state.anchor = nearest;
    els.anchor.value = String(nearest);
  }
  function renderLegacyTable() {
    if (!els.tbody) return;
    const rows = (state.discounts || []).slice().sort((a, b) => a - b).map(discount => calcLegacyRow(state.origPrice || 0, discount));
    els.tbody.innerHTML = rows.map(row => {
      const isAnchor = Math.abs(row.discount - state.anchor) < 1e-9;
      return `<tr class="${isAnchor ? 'anchor' : ''}">
        <td>${fmtDiscount(row.discount)}${isAnchor ? ' ★' : ''}</td>
        <td>${fmtMoney(row.jpyPrice, 0)} 円</td>
        <td>${fmtCny(row.cnyNet, 2)}</td>
        <td>${fmtMargin(row.margin)}</td>
      </tr>`;
    }).join('');
  }
  function syncLegacyPricingInputs() {
    setInputValue(els.fee, state.fee);
    setInputValue(els.rate, state.rate);
    setInputValue(els.shipping, state.shipping);
    setInputValue(els.discounts, (state.discounts || []).join(','));
    setInputValue(els.cost, state.cost);
    setInputValue(els.targetMargin, state.targetMargin);
    renderLegacyAnchorOptions();
    if (state.origPrice == null) state.origPrice = deriveLegacyOrigPrice();
    setInputValue(els.origPrice, Math.round(state.origPrice));
  }
  function rerenderLegacyPricing({ derive = true } = {}) {
    if (derive) state.origPrice = deriveLegacyOrigPrice();
    renderLegacyAnchorOptions();
    setInputValue(els.origPrice, state.origPrice ? Math.round(state.origPrice) : '');
    renderLegacyTable();
    save();
  }
  function bindLegacyNumber(el, key, { derive = true } = {}) {
    if (!el) return;
    ensureDecimalInputBehavior(el);
    el.addEventListener('input', () => {
      const normalized = normalizeDecimalText(el.value);
      if (normalized !== el.value) applyNormalizedValue(el, normalized);
      state[key] = toNumber(normalized);
      rerenderLegacyPricing({ derive });
    });
  }
  function bindLegacyPricing() {
    bindLegacyNumber(els.fee, 'fee');
    bindLegacyNumber(els.rate, 'rate');
    bindLegacyNumber(els.shipping, 'shipping');
    bindLegacyNumber(els.cost, 'cost');
    bindLegacyNumber(els.targetMargin, 'targetMargin');

    if (els.discounts) {
      els.discounts.addEventListener('input', () => {
        const arr = parseDiscounts(els.discounts.value);
        if (!arr.length) return;
        state.discounts = arr;
        rerenderLegacyPricing();
      });
    }
    if (els.anchor) {
      els.anchor.addEventListener('change', () => {
        state.anchor = parseFloat(els.anchor.value);
        rerenderLegacyPricing();
      });
    }
    if (els.origPrice) {
      ensureDecimalInputBehavior(els.origPrice);
      els.origPrice.addEventListener('input', () => {
        const normalized = normalizeDecimalText(els.origPrice.value);
        if (normalized !== els.origPrice.value) applyNormalizedValue(els.origPrice, normalized);
        const value = parseFloat(normalized);
        if (isNaN(value)) return;
        state.origPrice = value;
        renderLegacyTable();
        save();
      });
    }
  }
  /* ------------------------------
   * 定价新 + 利润复盘：新版逻辑
   * ------------------------------ */
  function getShippingMultiplierNew() {
    return Math.max(1, state.shippingMultiplierNew || 1);
  }
  function getManualShippingCostNew() {
    return state.overseasShippingNew || 0;
  }
  function getCalculatedShippingCostNew(quote = computePricingNewShipping()) {
    if (!quote || quote.cnyFee === null) return null;
    const multiplier = getShippingMultiplierNew();
    const labelFee = state.labelFeeNew || 0;
    const shippingCny = quote.cnyFee * multiplier + labelFee;
    return Number(shippingCny.toFixed(2));
  }
  function applyCalculatedShippingCostNew(quote = computePricingNewShipping(), { markSource = false } = {}) {
    const calculated = getCalculatedShippingCostNew(quote);
    if (calculated === null) return null;
    state.overseasShippingNew = calculated;
    if (markSource) state.shippingSourceNew = 'calculator';
    setInputValue(els.overseasShippingNew, calculated);
    setInputValue(els.shippingReview, calculated);
    return calculated;
  }
  function computeTotalCostNew() {
    const cost = state.costNew || 0;
    return cost + getManualShippingCostNew();
  }
  function rerenderAll({ derive = true, autoFillShipping = false } = {}) {
    const quote = computePricingNewShipping();
    if (autoFillShipping) applyCalculatedShippingCostNew(quote);
    renderPricingNewShipping(quote);
    if (derive) state.origPriceNew = deriveOrigPrice('pricingNew');
    if (els.origPriceNew) setInputValue(els.origPriceNew, state.origPriceNew ? Math.round(state.origPriceNew) : '');
    if (els.totalCostNew) setInputValue(els.totalCostNew, computeTotalCostNew().toFixed(2));
    renderAnchorOptions('pricingNew');
    renderTable('pricingNew');
    renderSalePrice();
    renderShippingCalc();
    save();
  }

  function calcRow(viewKey, origPrice, d) {
    const view = PRICING_VIEWS[viewKey];
    const feeRate = (state[view.fee] || 0) / 100;
    const cost = computeTotalCostNew();
    const rate = state[view.rate] || 1; // 避免除以 0
    const shipping = 0;

    const jpyPrice = origPrice * d * (1 - feeRate);
    const cnyNet = jpyPrice / rate - shipping;
    const profit = cnyNet - cost;
    const margin = cost > 0 ? cnyNet / cost : NaN;
    return { d, jpyPrice, cnyNet, profit, margin };
  }
  function deriveOrigPrice(viewKey = 'pricingNew') {
    const view = PRICING_VIEWS[viewKey];
    const feeRate = (state[view.fee] || 0) / 100;
    const cost = computeTotalCostNew();
    const rate = state[view.rate] || 1;
    const shipping = 0;
    const targetMargin = state[view.targetMarginState] || 0;
    const anchor = state[view.anchorState] || 0.40;

    if (anchor === 0 || feeRate >= 1) return 0;

    const need = cost * targetMargin + shipping;
    const jpyNeed = need * rate;
    const orig = jpyNeed / (anchor * (1 - feeRate));
    return Math.max(0, orig);
  }
  function calcSalePrice() {
    const salePrice = state.salePrice || 0;
    const cost = computeTotalCostNew();
    const rate = state.rateNew || 1;

    if (salePrice <= 0) return null;

    const jpyNet = salePrice;
    const cnyNet = jpyNet / rate;
    const profit = cnyNet - cost;
    const margin = cost > 0 ? cnyNet / cost : NaN;
    return { salePrice, jpyNet, cnyNet, profit, margin };
  }
  function getPricingNewShippingTargets() {
    return [
      {
        actualKg: els.shipActualKgNew,
        actualRule: els.shipActualRuleNew,
        volWeight: els.shipVolWeightNew,
        volFormula: els.shipVolFormulaNew,
        chargeWeight: els.shipChargeWeightNew,
        chargeRule: els.shipChargeRuleNew,
        band: els.shipBandNew,
        feeCny: els.shipFeeCnyNew,
        feeFormula: els.shipFeeFormulaNew,
        alert: els.shipChargeReasonNew,
        importTrigger: els.importShippingNew
      },
      {
        actualKg: els.shipActualKgReview,
        actualRule: els.shipActualRuleReview,
        volWeight: els.shipVolWeightReview,
        volFormula: els.shipVolFormulaReview,
        chargeWeight: els.shipChargeWeightReview,
        chargeRule: els.shipChargeRuleReview,
        band: els.shipBandReview,
        feeCny: els.shipFeeCnyReview,
        feeFormula: els.shipFeeFormulaReview,
        alert: els.shipChargeReasonReview,
        importTrigger: els.importShippingReview
      }
    ];
  }
  function renderPricingNewShippingTarget(target, quote, finalCnyFee, multiplier, labelFee) {
    if (!target.actualKg) return;
    target.actualKg.textContent = quote.actualWeightKg > 0 ? fmtWeight(quote.actualWeightKg) : '-';
    target.actualRule.textContent = '按输入重量换算';
    target.volWeight.textContent = quote.volumeWeightKg !== null ? fmtWeight(quote.volumeWeightKg) : '-';
    target.volFormula.textContent = '长 × 宽 × 高 ÷ 8000';
    target.chargeWeight.textContent = quote.chargeWeightKg !== null ? fmtWeight(quote.chargeWeightKg) : '-';

    if (quote.actualWeightKg <= 0) {
      target.chargeRule.textContent = '输入实重和尺寸后显示计费依据';
    } else if (quote.volumeWeightKg === null) {
      target.chargeRule.textContent = '尺寸未填完整，暂按实重计费';
    } else {
      const useVolumeWeight = quote.volumeWeightKg > quote.actualWeightKg * VOLUME_TRIGGER_MULTIPLIER;
      const operator = useVolumeWeight ? '>' : '<=';
      const method = useVolumeWeight ? '按体积重计费' : '按实重计费';
      target.chargeRule.textContent = `${fmtWeightValue(quote.volumeWeightKg)} ${operator} ${fmtWeightValue(quote.actualWeightKg)} × 1.5，${method}`;
    }

    target.band.value = quote.band ? quote.band.range : '-';
    target.feeCny.textContent = finalCnyFee !== null ? fmtCny(finalCnyFee, 2) : '-';
    if (target.importTrigger) {
      target.importTrigger.classList.toggle('is-disabled', finalCnyFee === null);
    }
    target.feeFormula.textContent = (quote.band && quote.chargeWeightKg !== null)
      ? `海外运费 =（基础费 ${quote.band.parcel} + 每千克重量费 ${quote.band.perKg} × 计费重 ${fmtWeightValue(quote.chargeWeightKg)} - 用户承担 ${CUSTOMER_SHIPPING_JPY}）× 运费倍率 ${fmtMoney(multiplier, 2)} / 汇率 ${fmtNumberValue(state.rateNew || 0, 2)} + 贴单费 ${fmtNumberValue(labelFee, 2)}`
      : '海外运费 =（基础费 + 每千克重量费 × 计费重 - 用户承担）× 运费倍率 / 汇率 + 贴单费';

    target.alert.textContent = quote.alerts.length ? quote.alerts[0].text : '';
  }
  function getShippingBand(type, weightKg) {
    const rule = SHIPPING_RULES[type] || SHIPPING_RULES.general;
    return rule.bands.find(band => weightKg <= band.max) || null;
  }
  function buildAlert(type, text) {
    return `<div class="ship-alert ${type}">${text}</div>`;
  }
  function buildReason(lines) {
    return lines.map(line => `<span class="ship-reason-line">${line}</span>`).join('');
  }
  function computeShippingQuote({ cargoType, actualWeight, length, width, height, rate }) {
    const type = SHIPPING_RULES[cargoType] ? cargoType : 'general';
    const actualWeightG = Math.max(0, toNumber(actualWeight));
    const dims = [
      Math.max(0, toNumber(length)),
      Math.max(0, toNumber(width)),
      Math.max(0, toNumber(height))
    ];
    const hasAllDims = dims.every(n => n > 0);
    const actualWeightKg = actualWeightG / 1000;
    const volumeWeightKg = hasAllDims ? (dims[0] * dims[1] * dims[2]) / VOLUME_DIVISOR : null;
    const useVolumeWeight = !!(hasAllDims && actualWeightKg > 0 && volumeWeightKg > actualWeightKg * VOLUME_TRIGGER_MULTIPLIER);
    const floorApplied = actualWeightKg > 0 && actualWeightKg < MIN_BILLABLE_WEIGHT_KG;

    let chargeWeightKg = actualWeightKg > 0
      ? (useVolumeWeight ? volumeWeightKg : actualWeightKg)
      : null;
    if (chargeWeightKg !== null) chargeWeightKg = Math.max(chargeWeightKg, MIN_BILLABLE_WEIGHT_KG);

    const sortedDims = hasAllDims ? dims.slice().sort((a, b) => b - a) : [];
    const sizeExceeded = hasAllDims && sortedDims.some((edge, index) => edge > SIZE_LIMITS[index]);
    const actualWeightExceeded = actualWeightKg > MAX_WEIGHT_KG;
    const chargeWeightExceeded = chargeWeightKg !== null && chargeWeightKg > MAX_WEIGHT_KG;
    const hasError = actualWeightKg <= 0 || actualWeightExceeded || chargeWeightExceeded || sizeExceeded;
    const band = chargeWeightKg !== null && !chargeWeightExceeded ? getShippingBand(type, chargeWeightKg) : null;
    const grossJpyFee = (!hasError && band) ? band.parcel + band.perKg * chargeWeightKg : null;
    const jpyFee = grossJpyFee !== null ? grossJpyFee - CUSTOMER_SHIPPING_JPY : null;
    const cnyFee = (jpyFee !== null && rate > 0) ? jpyFee / rate : null;

    const alerts = [];
    if (actualWeightKg <= 0) alerts.push({ type: 'error', text: '请输入实重后再计算运费。' });
    if (actualWeightKg > 0 && actualWeightKg < MIN_BILLABLE_WEIGHT_KG) {
      alerts.push({ type: 'warn', text: '实重低于 50g，系统已按 50g 起计。' });
    }
    if (!hasAllDims) {
      alerts.push({ type: 'warn', text: '尺寸未填写完整，当前仅按实重预估，未校验体积重。' });
    }
    if (sizeExceeded) {
      alerts.push({
        type: 'error',
        text: `尺寸限制为 60 × 50 × 40 cm。按边长排序后，你当前包裹为 ${sortedDims.map(n => n.toFixed(1).replace(/\.0$/, '')).join(' × ')} cm。`
      });
    }
    if (actualWeightExceeded) {
      alerts.push({ type: 'error', text: `单包裹实重不能超过 ${MAX_WEIGHT_KG} kg。` });
    }
    if (chargeWeightExceeded) {
      alerts.push({ type: 'error', text: `计费重为 ${fmtWeight(chargeWeightKg)}，已超过 ${MAX_WEIGHT_KG} kg 上限。` });
    }
    if (jpyFee !== null && cnyFee === null) {
      alerts.push({ type: 'warn', text: '汇率未填写或为 0，暂时无法折算人民币。' });
    }
    let chargeReason = '最低按 0.05 kg';
    if (actualWeightKg <= 0) {
      chargeReason = '输入实重和尺寸后显示计费依据';
    } else if (!hasAllDims) {
      chargeReason = floorApplied
        ? '尺寸未填完整，暂按实重计费，且已按 0.05 kg 起计'
        : '尺寸未填完整，暂按实重计费';
    } else if (useVolumeWeight) {
      chargeReason = buildReason([
        `${fmtWeightValue(volumeWeightKg)} > ${fmtWeightValue(actualWeightKg)} × 1.5`,
        '按体积重计费'
      ]);
    } else if (floorApplied) {
      chargeReason = buildReason([
        `${fmtWeightValue(volumeWeightKg)} <= ${fmtWeightValue(actualWeightKg)} × 1.5`,
        '按实重计算'
      ]);
    } else {
      chargeReason = buildReason([
        `${fmtWeightValue(volumeWeightKg)} <= ${fmtWeightValue(actualWeightKg)} × 1.5`,
        '按实重计算'
      ]);
    }

    return {
      type,
      actualWeightKg,
      volumeWeightKg,
      chargeWeightKg,
      grossJpyFee,
      chargeReason,
      band,
      jpyFee,
      cnyFee,
      alerts,
      hasError
    };
  }
  function computeShipping() {
    return computeShippingQuote({
      cargoType: state.shipCargoType,
      actualWeight: state.shipActualWeight,
      length: state.shipLength,
      width: state.shipWidth,
      height: state.shipHeight,
      rate: state.rate
    });
  }
  function computePricingNewShipping() {
    return computeShippingQuote({
      cargoType: state.shipCargoTypeNew,
      actualWeight: state.shipActualWeightNew,
      length: state.shipLengthNew,
      width: state.shipWidthNew,
      height: state.shipHeightNew,
      rate: state.rateNew
    });
  }
  function renderAnchorOptions(viewKey = 'pricingNew') {
    const view = PRICING_VIEWS[viewKey];
    const anchorEl = els[view.anchor];
    if (!anchorEl) return;

    anchorEl.innerHTML = '';
    const discounts = state[view.discountsState] || [];
    discounts.forEach(d => {
      const o = document.createElement('option');
      o.value = d; o.textContent = fmtDiscount(d);
      anchorEl.appendChild(o);
    });
    if (!discounts.length) return;
    const want = state[view.anchorState];
    const nearest = discounts.reduce((a, b) => Math.abs(b - want) < Math.abs(a - want) ? b : a, discounts[0]);
    state[view.anchorState] = nearest;
    anchorEl.value = String(nearest);
  }
  function renderCalcTab() {
    const tab = Object.prototype.hasOwnProperty.call(els.calcPanels, state.calcTab) ? state.calcTab : 'pricingNew';
    state.calcTab = tab;
    els.calcTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.calcTab === tab));
    Object.entries(els.calcPanels).forEach(([key, panel]) => {
      panel.classList.toggle('active', key === tab);
    });
  }
  function renderTable(viewKey = 'pricingNew') {
    const view = PRICING_VIEWS[viewKey];
    const tbodyEl = els[view.tbody];
    if (!tbodyEl) return;

    const discounts = (state[view.discountsState] || []).slice().sort((a, b) => a - b);
    const origPrice = state[view.origPriceState] || 0;
    const origBase = calcRow(viewKey, origPrice, 1);
    const rows = discounts.map(d => calcRow(viewKey, origPrice, d));
    const origRow = `<tr class="orig-row">
        <td>原价</td>
        <td class="orig-price-cell">${fmtMoney(origPrice, 0)} 円</td>
        <td>${fmtCny(origBase.cnyNet, 2)}</td>
        <td class="${origBase.profit > 0 ? 'profit-pos' : (origBase.profit < 0 ? 'profit-neg' : '')}">${fmtCny(origBase.profit, 2)}</td>
        <td>${fmtMargin(origBase.margin)}</td>
      </tr>`;
    tbodyEl.innerHTML = origRow + rows.map(r => {
      const isAnchor = Math.abs(r.d - state[view.anchorState]) < 1e-9;
      const profitClass = r.profit > 0 ? 'profit-pos' : (r.profit < 0 ? 'profit-neg' : '');
      return `<tr class="${isAnchor ? 'anchor' : ''}">
        <td>${fmtDiscount(r.d)}${isAnchor ? ' ★' : ''}</td>
        <td>${fmtMoney(r.jpyPrice, 0)} 円</td>
        <td>${fmtCny(r.cnyNet, 2)}</td>
        <td class="${profitClass}">${fmtCny(r.profit, 2)}</td>
        <td>${fmtMargin(r.margin)}</td>
      </tr>`;
    }).join('');
  }
  function renderSalePrice() {
    const result = calcSalePrice();
    if (!result) {
      els.saleNet.textContent = '-';
      els.saleProfit.textContent = '-';
      els.saleMargin.textContent = '-';
      els.saleProfit.className = 'value mono';
      els.saleMargin.className = 'value mono';
      return;
    }

    const profitClass = result.profit > 0 ? 'profit-pos' : (result.profit < 0 ? 'profit-neg' : '');
    els.saleNet.textContent = fmtCny(result.cnyNet, 2);
    els.saleProfit.textContent = fmtCny(result.profit, 2);
    els.saleMargin.textContent = fmtMargin(result.margin);
    els.saleProfit.className = `value mono ${profitClass}`.trim();
    els.saleMargin.className = `value mono ${profitClass}`.trim();
  }
  function renderPricingNewShipping(quote = computePricingNewShipping()) {
    const multiplier = getShippingMultiplierNew();
    const labelFee = state.labelFeeNew || 0;
    const finalCnyFee = getCalculatedShippingCostNew(quote);
    getPricingNewShippingTargets().forEach(target => {
      renderPricingNewShippingTarget(target, quote, finalCnyFee, multiplier, labelFee);
    });
    return quote;
  }
  function renderShippingCalc() {
    if (!els.shipActualKg || !els.shipVolWeight || !els.shipChargeWeight || !els.shipAlerts) {
      return null;
    }
    const quote = computeShipping();

    els.shipActualKg.textContent = quote.actualWeightKg > 0 ? fmtWeight(quote.actualWeightKg) : '-';
    els.shipVolWeight.textContent = quote.volumeWeightKg !== null ? fmtWeight(quote.volumeWeightKg) : '-';
    els.shipChargeWeight.textContent = quote.chargeWeightKg !== null ? fmtWeight(quote.chargeWeightKg) : '-';
    els.shipChargeReason.innerHTML = quote.chargeReason;
    els.shipBand.textContent = quote.band ? quote.band.range : '-';
    els.shipRateLine.textContent = quote.band ? `${quote.band.parcel} 円/票 + ${quote.band.perKg} 円/kg` : '-';
    els.shipFeeJpy.textContent = quote.jpyFee !== null ? fmtMoney(quote.jpyFee, 2) : '-';
    els.shipFeeCny.textContent = quote.cnyFee !== null ? fmtMoney(quote.cnyFee, 2) : '-';
    els.shipFormula.textContent = (quote.band && quote.chargeWeightKg !== null)
      ? `挂号费 ${quote.band.parcel} + ${quote.band.perKg} × ${fmtWeightValue(quote.chargeWeightKg)} - 用户承担 ${CUSTOMER_SHIPPING_JPY}`
      : '-';
    els.shipCnyFormula.textContent = quote.jpyFee !== null
      ? (state.rate > 0 ? `已按当前汇率 ${state.rate} 折算` : '汇率未填写，暂无法折算人民币')
      : '-';
    els.shipAlerts.innerHTML = quote.alerts.map(alert => buildAlert(alert.type, alert.text)).join('');
    return quote;
  }
  function syncInputsFromState() {
    syncLegacyPricingInputs();
    if (state.origPriceNew == null) state.origPriceNew = deriveOrigPrice('pricingNew');
    setInputValue(els.costNew, state.costNew);
    setInputValue(els.costReview, state.costNew);
    setInputValue(els.overseasShippingNew, state.overseasShippingNew);
    setInputValue(els.shippingReview, state.overseasShippingNew);
    setInputValue(els.labelFeeNew, state.labelFeeNew);
    setInputValue(els.shippingMultiplierNew, getShippingMultiplierNew());
    setInputValue(els.totalCostNew, computeTotalCostNew().toFixed(2));
    setInputValue(els.totalCostReview, computeTotalCostNew().toFixed(2));
    setInputValue(els.feeNew, state.feeNew);
    setInputValue(els.rateNew, state.rateNew);
    setInputValue(els.labelFeeReview, state.labelFeeNew);
    setInputValue(els.shippingMultiplierReview, getShippingMultiplierNew());
    setInputValue(els.discountsNew, state.discountsNew.map(d => d).join(','));
    setInputValue(els.targetMarginNew, state.targetMarginNew);
    setInputValue(els.origPriceNew, Math.round(state.origPriceNew));
    if (document.activeElement !== els.shipCargoTypeNew) els.shipCargoTypeNew.value = state.shipCargoTypeNew;
    if (document.activeElement !== els.shipCargoTypeReview) els.shipCargoTypeReview.value = state.shipCargoTypeNew;
    setInputValue(els.shipActualWeightNew, state.shipActualWeightNew);
    setInputValue(els.shipActualWeightReviewCalc, state.shipActualWeightNew);
    setInputValue(els.shipLengthNew, state.shipLengthNew || '');
    setInputValue(els.shipLengthReviewCalc, state.shipLengthNew || '');
    setInputValue(els.shipWidthNew, state.shipWidthNew || '');
    setInputValue(els.shipWidthReviewCalc, state.shipWidthNew || '');
    setInputValue(els.shipHeightNew, state.shipHeightNew || '');
    setInputValue(els.shipHeightReviewCalc, state.shipHeightNew || '');
    renderAnchorOptions('pricingNew');
    setInputValue(els.salePrice, state.salePrice || '');
    if (els.shipCargoType && document.activeElement !== els.shipCargoType) els.shipCargoType.value = state.shipCargoType;
    setInputValue(els.shipActualWeight, state.shipActualWeight);
    setInputValue(els.shipLength, state.shipLength);
    setInputValue(els.shipWidth, state.shipWidth);
    setInputValue(els.shipHeight, state.shipHeight);
  }
  function bindNumber(el, key, { derive = true, sync = false, autoFillShipping = false, shippingSource = null } = {}) {
    if (!el) return;
    ensureDecimalInputBehavior(el);
    el.addEventListener('input', () => {
      const normalized = normalizeDecimalText(el.value);
      if (normalized !== el.value) {
        applyNormalizedValue(el, normalized);
      }
      state[key] = toNumber(normalized);
      if (shippingSource) state.shippingSourceNew = shippingSource;
      if (sync) setSyncedInputValue(key, state[key], el);
      rerenderAll({
        derive,
        autoFillShipping: typeof autoFillShipping === 'function' ? autoFillShipping() : autoFillShipping
      });
    });
  }
  bindLegacyPricing();
  bindNumber(els.costReview, 'costNew');
  bindNumber(els.shippingReview, 'overseasShippingNew', { shippingSource: 'manual' });
  bindNumber(els.feeNew, 'feeNew');
  bindNumber(els.rateNew, 'rateNew', { autoFillShipping: () => state.shippingSourceNew === 'calculator' });
  bindNumber(els.costNew, 'costNew');
  bindNumber(els.overseasShippingNew, 'overseasShippingNew', { shippingSource: 'manual' });
  bindNumber(els.labelFeeNew, 'labelFeeNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.labelFeeReview, 'labelFeeNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.shippingMultiplierNew, 'shippingMultiplierNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.shippingMultiplierReview, 'shippingMultiplierNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.targetMarginNew, 'targetMarginNew');
  bindNumber(els.shipActualWeightNew, 'shipActualWeightNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.shipActualWeightReviewCalc, 'shipActualWeightNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.shipLengthNew, 'shipLengthNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.shipLengthReviewCalc, 'shipLengthNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.shipWidthNew, 'shipWidthNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.shipWidthReviewCalc, 'shipWidthNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.shipHeightNew, 'shipHeightNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.shipHeightReviewCalc, 'shipHeightNew', { autoFillShipping: true, shippingSource: 'calculator' });
  bindNumber(els.salePrice, 'salePrice', { derive: false });
  bindNumber(els.shipActualWeight, 'shipActualWeight', { derive: false });
  bindNumber(els.shipLength, 'shipLength', { derive: false });
  bindNumber(els.shipWidth, 'shipWidth', { derive: false });
  bindNumber(els.shipHeight, 'shipHeight', { derive: false });

  function bindDiscounts(el, stateKey, syncKey = null) {
    if (!el) return;
    el.addEventListener('input', () => {
      const arr = parseDiscounts(el.value);
      if (arr.length) {
        state[stateKey] = arr;
        if (syncKey) setSyncedInputValue(syncKey, arr.join(','), el);
        rerenderAll();
      }
    });
  }
  bindDiscounts(els.discountsNew, 'discountsNew');

  function bindAnchor(el, stateKey) {
    if (!el) return;
    el.addEventListener('change', () => {
      state[stateKey] = parseFloat(el.value);
      rerenderAll();
    });
  }
  bindAnchor(els.anchorNew, 'anchorNew');

  function bindOrigPrice(el, stateKey, syncKey = null) {
    if (!el) return;
    ensureDecimalInputBehavior(el);
    el.addEventListener('input', () => {
      const normalized = normalizeDecimalText(el.value);
      if (normalized !== el.value) {
        applyNormalizedValue(el, normalized);
      }
      const v = parseFloat(normalized);
      if (!isNaN(v)) {
        state[stateKey] = v;
        if (syncKey) setSyncedInputValue(syncKey, v, el);
        Object.keys(PRICING_VIEWS).forEach(viewKey => renderTable(viewKey));
        renderSalePrice();
        renderShippingCalc();
        save();
      }
    });
  }
  bindOrigPrice(els.origPriceNew, 'origPriceNew');

  if (els.shipCargoTypeNew) {
    els.shipCargoTypeNew.addEventListener('change', () => {
      state.shipCargoTypeNew = els.shipCargoTypeNew.value;
      state.shippingSourceNew = 'calculator';
      rerenderAll({ autoFillShipping: true });
    });
  }
  if (els.shipCargoTypeReview) {
    els.shipCargoTypeReview.addEventListener('change', () => {
      state.shipCargoTypeNew = els.shipCargoTypeReview.value;
      state.shippingSourceNew = 'calculator';
      rerenderAll({ autoFillShipping: true });
    });
  }
  if (els.importShippingNew) {
    els.importShippingNew.addEventListener('click', () => {
      const calculated = applyCalculatedShippingCostNew(computePricingNewShipping(), { markSource: true });
      if (calculated === null) return;
      rerenderAll();
    });
  }
  if (els.importShippingReview) {
    els.importShippingReview.addEventListener('click', () => {
      const calculated = applyCalculatedShippingCostNew(computePricingNewShipping(), { markSource: true });
      if (calculated === null) return;
      rerenderAll();
    });
  }
  if (els.shipCargoType) {
    els.shipCargoType.addEventListener('change', () => {
      state.shipCargoType = els.shipCargoType.value;
      renderShippingCalc();
      save();
    });
  }
  els.calcTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      state.calcTab = btn.dataset.calcTab;
      renderCalcTab();
      save();
    });
  });
  els.calcHelpBtn.addEventListener('click', () => els.calcHelpModal.classList.add('show'));
  els.calcHelpClose.addEventListener('click', () => els.calcHelpModal.classList.remove('show'));
  els.calcHelpModal.addEventListener('click', e => {
    if (e.target.id === 'calc-help-modal') els.calcHelpModal.classList.remove('show');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && els.calcHelpModal.classList.contains('show')) {
      els.calcHelpModal.classList.remove('show');
    }
  });

  syncInputsFromState();
  rerenderLegacyPricing({ derive: false });
  renderCalcTab();
  rerenderAll();
})();
