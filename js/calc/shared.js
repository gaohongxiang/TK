/* ============================================================
 * 利润计算器：共享状态与工具
 * ============================================================ */
const CalcShared = (function () {
  function create({ storageKey, defaults }) {
    const $ = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);

    function load() {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
        const saved = JSON.parse(raw || 'null');
        if (!saved) return { ...defaults };

        const merged = { ...defaults, ...saved };
        if (!saved.pricingNewDefaultsApplied) {
          if (!Object.prototype.hasOwnProperty.call(saved, 'costNew') || saved.costNew === 30) merged.costNew = defaults.costNew;
          if (!Object.prototype.hasOwnProperty.call(saved, 'labelFeeNew') || saved.labelFeeNew === 0) merged.labelFeeNew = defaults.labelFeeNew;
          if (!Object.prototype.hasOwnProperty.call(saved, 'shippingMultiplierNew') || saved.shippingMultiplierNew === 1) merged.shippingMultiplierNew = defaults.shippingMultiplierNew;
          if (!Object.prototype.hasOwnProperty.call(saved, 'feeNew') || saved.feeNew === defaults.fee) merged.feeNew = defaults.feeNew;
          if (!Object.prototype.hasOwnProperty.call(saved, 'shipActualWeightNew') || saved.shipActualWeightNew === 500) merged.shipActualWeightNew = defaults.shipActualWeightNew;
          merged.pricingNewDefaultsApplied = true;
        }
        if (!saved.pricingNewDimensionsApplied) {
          if (!Object.prototype.hasOwnProperty.call(saved, 'shipLengthNew') || saved.shipLengthNew === '' || saved.shipLengthNew === 20) merged.shipLengthNew = defaults.shipLengthNew;
          if (!Object.prototype.hasOwnProperty.call(saved, 'shipWidthNew') || saved.shipWidthNew === '' || saved.shipWidthNew === 15) merged.shipWidthNew = defaults.shipWidthNew;
          if (!Object.prototype.hasOwnProperty.call(saved, 'shipHeightNew') || saved.shipHeightNew === '') merged.shipHeightNew = defaults.shipHeightNew;
          merged.pricingNewDimensionsApplied = true;
        }
        if (!saved.calcTabDefaultApplied) {
          merged.calcTab = 'pricingNew';
          merged.calcTabDefaultApplied = true;
        }
        return merged;
      } catch (error) {
        return { ...defaults };
      }
    }

    function save(state) {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(storageKey, JSON.stringify(state));
    }

    function parseDiscounts(value) {
      return String(value || '')
        .split(/[,，\s]+/)
        .filter(Boolean)
        .map(item => {
          const normalized = item.trim();
          if (normalized.endsWith('%')) return parseFloat(normalized) / 100;
          const parsed = parseFloat(normalized);
          return parsed > 1 ? parsed / 100 : parsed;
        })
        .filter(parsed => !isNaN(parsed) && parsed > 0 && parsed <= 1);
    }

    function fmtDiscount(discount) {
      return `${+(discount * 10).toFixed(2)}折`;
    }

    function fmtMoney(value, digits = 2) {
      if (value === null || value === undefined || isNaN(value)) return '-';
      return Number(value).toLocaleString('en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
      });
    }

    function fmtCny(value, digits = 2) {
      if (value === null || value === undefined || isNaN(value)) return '-';
      return `${value < 0 ? '-¥' : '¥'}${fmtMoney(Math.abs(value), digits)}`;
    }

    function fmtMargin(value) {
      if (value === null || value === undefined || isNaN(value)) return '-';
      return value.toFixed(2);
    }

    function fmtWeight(value, digits = 3) {
      if (value === null || value === undefined || isNaN(value)) return '-';
      return `${fmtWeightValue(value, digits)} kg`;
    }

    function fmtWeightValue(value, digits = 3) {
      if (value === null || value === undefined || isNaN(value)) return '-';
      return value.toFixed(digits).replace(/\.?0+$/, '');
    }

    function fmtNumberValue(value, digits = 2) {
      if (value === null || value === undefined || isNaN(value)) return '-';
      return value.toFixed(digits).replace(/\.?0+$/, '');
    }

    function normalizeDecimalText(value) {
      return String(value ?? '')
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

    function toNumber(value) {
      const parsed = parseFloat(normalizeDecimalText(value));
      return isNaN(parsed) ? 0 : parsed;
    }

    function setInputValue(el, value) {
      if (!el || (typeof document !== 'undefined' && document.activeElement === el)) return;
      el.value = value;
    }

    function ensureDecimalInputBehavior(el) {
      if (!el || el.dataset.decimalBound === '1') return;
      el.dataset.decimalBound = '1';
      el.addEventListener('beforeinput', event => {
        if (event.isComposing || typeof event.data !== 'string' || !event.data) return;
        const normalized = normalizeDecimalText(event.data);
        if (normalized === event.data) return;
        event.preventDefault();
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

    return {
      $,
      load,
      save,
      parseDiscounts,
      fmtDiscount,
      fmtMoney,
      fmtCny,
      fmtMargin,
      fmtWeight,
      fmtWeightValue,
      fmtNumberValue,
      normalizeDecimalText,
      applyNormalizedValue,
      toNumber,
      setInputValue,
      ensureDecimalInputBehavior
    };
  }

  return {
    create
  };
})();
