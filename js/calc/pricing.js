/* ============================================================
 * 利润计算器：定价新 + 利润复盘 + 通用交互
 * ============================================================ */
const CalcPricing = (function () {
  function create({ state, els, helpers, shipping, save }) {
    const {
      parseDiscounts,
      fmtCny,
      fmtDiscount,
      fmtMargin,
      fmtMoney,
      normalizeDecimalText,
      applyNormalizedValue,
      toNumber,
      setInputValue,
      ensureDecimalInputBehavior
    } = helpers;
    const {
      getShippingMultiplierNew,
      getCalculatedShippingCostNew,
      applyCalculatedShippingCostNew,
      computeTotalCostNew,
      computePricingNewShipping,
      renderPricingNewShipping,
      renderShippingCalc
    } = shipping;

    const SYNCED_INPUTS = {
      cost: ['cost'],
      fee: ['fee'],
      rate: ['rate'],
      creatorRateNew: ['creatorRateNew', 'creatorRateReview'],
      shipping: ['shipping']
    };

    const PRICING_VIEWS = {
      pricingNew: {
        fee: 'feeNew',
        rate: 'rateNew',
        discountsState: 'discountsNew',
        targetMarginState: 'targetMarginNew',
        anchorState: 'anchorNew',
        origPriceState: 'origPriceNew',
        anchor: 'anchorNew',
        tbody: 'tbodyNew'
      }
    };

    function setSyncedInputValue(key, value, source = null) {
      const inputKeys = SYNCED_INPUTS[key] || [];
      inputKeys.forEach(name => {
        const el = els[name];
        if (el && el !== source) setInputValue(el, value);
      });
    }

    function calcRow(viewKey, origPrice, discount) {
      const view = PRICING_VIEWS[viewKey];
      const feeRate = (state[view.fee] || 0) / 100;
      const creatorRate = (state.creatorRateNew || 0) / 100;
      const cost = computeTotalCostNew();
      const rate = state[view.rate] || 1;
      const jpyPrice = origPrice * discount * (1 - feeRate);
      const cnyGross = jpyPrice / rate;
      const creatorCommission = cnyGross * creatorRate;
      const cnyNet = cnyGross - creatorCommission;
      const profit = cnyNet - cost;
      const margin = cost > 0 ? cnyNet / cost : NaN;
      return { discount, jpyPrice, cnyNet, creatorCommission, profit, margin };
    }

    function deriveOrigPrice(viewKey = 'pricingNew') {
      const view = PRICING_VIEWS[viewKey];
      const feeRate = (state[view.fee] || 0) / 100;
      const creatorRate = (state.creatorRateNew || 0) / 100;
      const cost = computeTotalCostNew();
      const rate = state[view.rate] || 1;
      const targetMargin = state[view.targetMarginState] || 0;
      const anchor = state[view.anchorState] || 0.40;
      if (anchor === 0 || feeRate >= 1 || creatorRate >= 1) return 0;
      return Math.max(0, (cost * targetMargin * rate) / (anchor * (1 - feeRate) * (1 - creatorRate)));
    }

    function calcSalePrice() {
      const salePrice = state.salePrice || 0;
      const cost = computeTotalCostNew();
      const rate = state.rateNew || 1;
      const creatorRate = (state.creatorRateNew || 0) / 100;
      if (salePrice <= 0) return null;
      const cnyGross = salePrice / rate;
      const creatorCommission = cnyGross * creatorRate;
      const cnyNet = cnyGross - creatorCommission;
      const profit = cnyNet - cost;
      const margin = cost > 0 ? cnyNet / cost : NaN;
      return { cnyNet, creatorCommission, profit, margin };
    }

    function renderAnchorOptions(viewKey = 'pricingNew') {
      const view = PRICING_VIEWS[viewKey];
      const anchorEl = els[view.anchor];
      if (!anchorEl) return;

      anchorEl.innerHTML = '';
      const discounts = state[view.discountsState] || [];
      discounts.forEach(discount => {
        const option = document.createElement('option');
        option.value = discount;
        option.textContent = fmtDiscount(discount);
        anchorEl.appendChild(option);
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
      const rows = discounts.map(discount => calcRow(viewKey, origPrice, discount));
      const origRow = `<tr class="orig-row">
          <td>原价</td>
          <td class="orig-price-cell">${fmtMoney(origPrice, 0)} 円</td>
          <td>${fmtCny(origBase.cnyNet, 2)}</td>
          <td class="${origBase.profit > 0 ? 'profit-pos' : (origBase.profit < 0 ? 'profit-neg' : '')}">${fmtCny(origBase.profit, 2)}</td>
          <td>${fmtMargin(origBase.margin)}</td>
        </tr>`;
      tbodyEl.innerHTML = origRow + rows.map(row => {
        const isAnchor = Math.abs(row.discount - state[view.anchorState]) < 1e-9;
        const profitClass = row.profit > 0 ? 'profit-pos' : (row.profit < 0 ? 'profit-neg' : '');
        return `<tr class="${isAnchor ? 'anchor' : ''}">
          <td>${fmtDiscount(row.discount)}${isAnchor ? ' ★' : ''}</td>
          <td>${fmtMoney(row.jpyPrice, 0)} 円</td>
          <td>${fmtCny(row.cnyNet, 2)}</td>
          <td class="${profitClass}">${fmtCny(row.profit, 2)}</td>
          <td>${fmtMargin(row.margin)}</td>
        </tr>`;
      }).join('');
    }

    function renderSalePrice() {
      const result = calcSalePrice();
      if (!result) {
        els.saleNet.textContent = '-';
        if (els.saleCommission) els.saleCommission.textContent = '-';
        if (els.saleCommissionReview) setInputValue(els.saleCommissionReview, '');
        els.saleProfit.textContent = '-';
        els.saleMargin.textContent = '-';
        els.saleProfit.className = 'value mono';
        els.saleMargin.className = 'value mono';
        return;
      }

      const profitClass = result.profit > 0 ? 'profit-pos' : (result.profit < 0 ? 'profit-neg' : '');
      els.saleNet.textContent = fmtCny(result.cnyNet, 2);
      if (els.saleCommission) els.saleCommission.textContent = fmtCny(result.creatorCommission, 2);
      if (els.saleCommissionReview) setInputValue(els.saleCommissionReview, result.creatorCommission.toFixed(2));
      els.saleProfit.textContent = fmtCny(result.profit, 2);
      els.saleMargin.textContent = fmtMargin(result.margin);
      els.saleProfit.className = `value mono ${profitClass}`.trim();
      els.saleMargin.className = `value mono ${profitClass}`.trim();
    }

    function syncInputsFromState() {
      if (state.origPriceNew == null) state.origPriceNew = deriveOrigPrice('pricingNew');
      setInputValue(els.costNew, state.costNew);
      setInputValue(els.costReview, state.costNew);
      setInputValue(els.overseasShippingNew, state.overseasShippingNew);
      setInputValue(els.shippingReview, state.overseasShippingNew);
      setInputValue(els.labelFeeNew, state.labelFeeNew);
      setInputValue(els.labelFeeReview, state.labelFeeNew);
      setInputValue(els.shippingMultiplierNew, getShippingMultiplierNew());
      setInputValue(els.shippingMultiplierReview, getShippingMultiplierNew());
      setInputValue(els.totalCostNew, computeTotalCostNew().toFixed(2));
      setInputValue(els.totalCostReview, computeTotalCostNew().toFixed(2));
      setInputValue(els.feeNew, state.feeNew);
      setInputValue(els.creatorRateNew, state.creatorRateNew);
      setInputValue(els.creatorRateReview, state.creatorRateNew);
      setInputValue(els.rateNew, state.rateNew);
      setInputValue(els.discountsNew, state.discountsNew.map(discount => discount).join(','));
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

    function rerenderAll({ derive = true, autoFillShipping = false } = {}) {
      const quote = computePricingNewShipping();
      if (autoFillShipping) applyCalculatedShippingCostNew(quote);
      if (derive) state.origPriceNew = deriveOrigPrice('pricingNew');
      syncInputsFromState();
      renderPricingNewShipping(quote);
      renderTable('pricingNew');
      renderSalePrice();
      renderShippingCalc();
      save(state);
    }

    function bindNumber(el, key, { derive = true, sync = false, autoFillShipping = false, shippingSource = null } = {}) {
      if (!el) return;
      ensureDecimalInputBehavior(el);
      el.addEventListener('input', () => {
        const normalized = normalizeDecimalText(el.value);
        if (normalized !== el.value) applyNormalizedValue(el, normalized);
        state[key] = toNumber(normalized);
        if (shippingSource) state.shippingSourceNew = shippingSource;
        if (sync) setSyncedInputValue(key, state[key], el);
        rerenderAll({
          derive,
          autoFillShipping: typeof autoFillShipping === 'function' ? autoFillShipping() : autoFillShipping
        });
      });
    }

    function bindDiscounts(el, stateKey, syncKey = null) {
      if (!el) return;
      el.addEventListener('input', () => {
        const arr = parseDiscounts(el.value);
        if (!arr.length) return;
        state[stateKey] = arr;
        if (syncKey) setSyncedInputValue(syncKey, arr.join(','), el);
        rerenderAll();
      });
    }

    function bindAnchor(el, stateKey) {
      if (!el) return;
      el.addEventListener('change', () => {
        state[stateKey] = parseFloat(el.value);
        rerenderAll();
      });
    }

    function bindOrigPrice(el, stateKey, syncKey = null) {
      if (!el) return;
      ensureDecimalInputBehavior(el);
      el.addEventListener('input', () => {
        const normalized = normalizeDecimalText(el.value);
        if (normalized !== el.value) applyNormalizedValue(el, normalized);
        const value = parseFloat(normalized);
        if (isNaN(value)) return;
        state[stateKey] = value;
        if (syncKey) setSyncedInputValue(syncKey, value, el);
        renderTable('pricingNew');
        renderSalePrice();
        renderShippingCalc();
        save(state);
      });
    }

    function bindPricing() {
      bindNumber(els.costReview, 'costNew');
      bindNumber(els.shippingReview, 'overseasShippingNew', { shippingSource: 'manual' });
      bindNumber(els.feeNew, 'feeNew');
      bindNumber(els.creatorRateNew, 'creatorRateNew', { sync: true });
      bindNumber(els.creatorRateReview, 'creatorRateNew', { sync: true });
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

      bindDiscounts(els.discountsNew, 'discountsNew');
      bindAnchor(els.anchorNew, 'anchorNew');
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
          save(state);
        });
      }

      els.calcTabs.forEach(btn => {
        btn.addEventListener('click', () => {
          state.calcTab = btn.dataset.calcTab;
          renderCalcTab();
          save(state);
        });
      });

      if (els.calcHelpBtn && els.calcHelpModal && els.calcHelpClose) {
        els.calcHelpBtn.addEventListener('click', () => els.calcHelpModal.classList.add('show'));
        els.calcHelpClose.addEventListener('click', () => els.calcHelpModal.classList.remove('show'));
        els.calcHelpModal.addEventListener('click', event => {
          if (event.target.id === 'calc-help-modal') els.calcHelpModal.classList.remove('show');
        });
        document.addEventListener('keydown', event => {
          if (event.key === 'Escape' && els.calcHelpModal.classList.contains('show')) {
            els.calcHelpModal.classList.remove('show');
          }
        });
      }
    }

    return {
      calcRow,
      deriveOrigPrice,
      calcSalePrice,
      syncInputsFromState,
      renderCalcTab,
      rerenderAll,
      bindPricing
    };
  }

  return {
    create
  };
})();
