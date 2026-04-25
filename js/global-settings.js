/* ============================================================
 * 全局设置：独立于业务模块的共享参数
 * ============================================================ */
const TKGlobalSettings = (function () {
  const DEFAULT_STORAGE_KEY = 'tk.global-settings.v1';
  const LEGACY_PROFIT_STORAGE_KEY = 'tk.profit.v1';

  function parseExchangeRate(value) {
    const raw = String(value ?? '').replace(/,/g, '').trim();
    if (!raw) return null;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(4)) : null;
  }

  function create({
    storageKey = DEFAULT_STORAGE_KEY,
    legacyProfitStorageKey = LEGACY_PROFIT_STORAGE_KEY
  } = {}) {
    function readJson(key) {
      try {
        return typeof localStorage !== 'undefined'
          ? JSON.parse(localStorage.getItem(key) || 'null')
          : null;
      } catch (error) {
        return null;
      }
    }

    function writeJson(key, value) {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(value));
    }

    function loadState() {
      const saved = readJson(storageKey);
      const savedRate = parseExchangeRate(saved?.exchangeRate);
      if (savedRate !== null) {
        return { exchangeRate: savedRate };
      }

      const legacy = readJson(legacyProfitStorageKey);
      const legacyRate = parseExchangeRate(legacy?.rateNew);
      if (legacyRate !== null) {
        const migrated = { exchangeRate: legacyRate };
        writeJson(storageKey, migrated);
        return migrated;
      }

      return { exchangeRate: null };
    }

    let state = loadState();

    function readLegacyProfitState() {
      return readJson(legacyProfitStorageKey) || {};
    }

    function getExchangeRate() {
      return parseExchangeRate(state.exchangeRate);
    }

    function setExchangeRate(value) {
      state = { exchangeRate: parseExchangeRate(value) };
      writeJson(storageKey, state);
      return state.exchangeRate;
    }

    function getState() {
      return { ...state };
    }

    function getPricingContext() {
      const legacy = readLegacyProfitState();
      const rate = getExchangeRate();
      const shippingMultiplierRaw = Number(legacy?.shippingMultiplierNew || 1.1);
      const labelFeeRaw = Number(legacy?.labelFeeNew || 1.2);
      return {
        rate,
        shippingMultiplier: Number.isFinite(shippingMultiplierRaw) && shippingMultiplierRaw >= 1 ? shippingMultiplierRaw : 1.1,
        labelFee: Number.isFinite(labelFeeRaw) && labelFeeRaw >= 0 ? labelFeeRaw : 1.2
      };
    }

    return {
      getExchangeRate,
      setExchangeRate,
      getState,
      getPricingContext
    };
  }

  return {
    DEFAULT_STORAGE_KEY,
    LEGACY_PROFIT_STORAGE_KEY,
    create
  };
})();

if (typeof window !== 'undefined') {
  window.__tkGlobalSettingsStore = window.__tkGlobalSettingsStore || TKGlobalSettings.create();
}
