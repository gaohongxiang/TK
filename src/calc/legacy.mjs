import {
  calcLegacyRow as calcLegacyRowFormula,
  deriveLegacyOrigPrice as deriveLegacyOrigPriceFormula
} from './formulas.mjs';

function create({ state, els, helpers, save, document: rootDocument = globalThis.document }) {
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

  function calcLegacyRow(origPrice, discount) {
    return calcLegacyRowFormula(state, origPrice, discount);
  }

  function deriveLegacyOrigPrice() {
    return deriveLegacyOrigPriceFormula(state);
  }

  function renderLegacyAnchorOptions() {
    if (!els.anchor) return;
    els.anchor.innerHTML = '';
    const discounts = state.discounts || [];
    discounts.forEach(discount => {
      const option = rootDocument.createElement('option');
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
    const rows = (state.discounts || [])
      .slice()
      .sort((a, b) => a - b)
      .map(discount => calcLegacyRow(state.origPrice || 0, discount));
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

  function syncInputsFromState() {
    setInputValue(els.fee, state.fee);
    setInputValue(els.rate, state.rate);
    setInputValue(els.shipping, state.shipping);
    setInputValue(els.creatorRate, state.creatorRate);
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
    save(state);
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
    bindLegacyNumber(els.creatorRate, 'creatorRate');
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
        save(state);
      });
    }
  }

  return {
    calcLegacyRow,
    deriveLegacyOrigPrice,
    bindLegacyPricing,
    syncInputsFromState,
    rerenderLegacyPricing
  };
}

const CalcLegacyPricing = {
  create
};

export {
  CalcLegacyPricing,
  create
};
