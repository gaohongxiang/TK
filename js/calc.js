/* ============================================================
 * 模块 1：利润计算器
 * ============================================================ */
(function () {
  const DEFAULTS = {
    fee: 7, rate: 23.5, shipping: 17,
    discounts: [0.35, 0.38, 0.40, 0.42, 0.45, 0.48, 0.50],
    cost: 30, targetMargin: 1.4, anchor: 0.40, origPrice: null
  };
  const LS_KEY = 'tk.profit.v1';
  const $ = id => document.getElementById(id);
  const state = load();

  const els = {
    fee: $('fee'), rate: $('rate'), shipping: $('shipping'), discounts: $('discounts'),
    cost: $('cost'), targetMargin: $('targetMargin'),
    anchor: $('anchor'), origPrice: $('origPrice'), tbody: $('tbody')
  };

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!s) return { ...DEFAULTS };
      return { ...DEFAULTS, ...s };
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
  function fmtMargin(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return n.toFixed(2);
  }

  function calcRow(origPrice, d) {
    const feeRate = (state.fee || 0) / 100;
    const cost = state.cost || 0;
    const rate = state.rate || 1; // 避免除以 0
    const shipping = state.shipping || 0;

    const jpyPrice = origPrice * d * (1 - feeRate);
    const cnyNet = jpyPrice / rate - shipping;
    const margin = cost > 0 ? cnyNet / cost : NaN;
    return { d, jpyPrice, cnyNet, margin };
  }
  function deriveOrigPrice() {
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
  function renderAnchorOptions() {
    els.anchor.innerHTML = '';
    state.discounts.forEach(d => {
      const o = document.createElement('option');
      o.value = d; o.textContent = fmtDiscount(d);
      els.anchor.appendChild(o);
    });
    const want = state.anchor;
    const nearest = state.discounts.reduce((a, b) => Math.abs(b - want) < Math.abs(a - want) ? b : a, state.discounts[0]);
    state.anchor = nearest;
    els.anchor.value = String(nearest);
  }
  function renderTable() {
    const rows = state.discounts.slice().sort((a, b) => a - b).map(d => calcRow(state.origPrice || 0, d));
    els.tbody.innerHTML = rows.map(r => {
      const isAnchor = Math.abs(r.d - state.anchor) < 1e-9;
      return `<tr class="${isAnchor ? 'anchor' : ''}">
        <td>${fmtDiscount(r.d)}${isAnchor ? ' ★' : ''}</td>
        <td>${fmtMoney(r.jpyPrice, 0)} 円</td>
        <td>¥${fmtMoney(r.cnyNet, 2)}</td>
        <td>${fmtMargin(r.margin)}</td>
      </tr>`;
    }).join('');
  }
  function syncInputsFromState() {
    els.fee.value = state.fee;
    els.rate.value = state.rate;
    els.shipping.value = state.shipping;
    els.discounts.value = state.discounts.map(d => d).join(',');
    els.cost.value = state.cost;
    els.targetMargin.value = state.targetMargin;
    renderAnchorOptions();
    if (state.origPrice == null) state.origPrice = deriveOrigPrice();
    els.origPrice.value = Math.round(state.origPrice);
  }
  function bindNumber(el, key, { derive = true } = {}) {
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      state[key] = isNaN(v) ? 0 : v;
      if (derive) {
        state.origPrice = deriveOrigPrice();
        els.origPrice.value = state.origPrice ? Math.round(state.origPrice) : '';
      }
      renderTable(); save();
    });
  }
  bindNumber(els.fee, 'fee');
  bindNumber(els.rate, 'rate');
  bindNumber(els.shipping, 'shipping');
  bindNumber(els.cost, 'cost');
  bindNumber(els.targetMargin, 'targetMargin');

  els.discounts.addEventListener('input', () => {
    const arr = parseDiscounts(els.discounts.value);
    if (arr.length) {
      state.discounts = arr;
      renderAnchorOptions();
      state.origPrice = deriveOrigPrice();
      els.origPrice.value = Math.round(state.origPrice);
      renderTable(); save();
    }
  });
  els.anchor.addEventListener('change', () => {
    state.anchor = parseFloat(els.anchor.value);
    state.origPrice = deriveOrigPrice();
    els.origPrice.value = Math.round(state.origPrice);
    renderTable(); save();
  });
  els.origPrice.addEventListener('input', () => {
    const v = parseFloat(els.origPrice.value);
    if (!isNaN(v)) {
      state.origPrice = v;
      renderTable(); save();
    }
  });

  syncInputsFromState();
  renderTable();
})();
