const DEFAULT_STORAGE_KEY = 'tk.global-settings.v1';
const DEFAULT_PRICING_CONTEXT = {
  exchangeRate: null,
  shippingMultiplier: 1.1,
  labelFee: 1.2
};

type GlobalSettingsState = {
  exchangeRate: number | null;
  shippingMultiplier: number;
  labelFee: number;
};

type PricingContextInput = Partial<GlobalSettingsState> & {
  rate?: unknown;
  exchangeRate?: unknown;
  shippingMultiplier?: unknown;
  labelFee?: unknown;
};

type GlobalSettingsCreateOptions = {
  storageKey?: string;
};

function toPlainObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseExchangeRate(value: unknown): number | null {
  const raw = String(value ?? '').replace(/,/g, '').trim();
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(4)) : null;
}

function parsePositiveNumber(value: unknown, fallback: number, minimum = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function normalizeState(raw: unknown = {}): GlobalSettingsState {
  const source = toPlainObject(raw) || {};
  return {
    exchangeRate: parseExchangeRate(source.exchangeRate),
    shippingMultiplier: parsePositiveNumber(source.shippingMultiplier, DEFAULT_PRICING_CONTEXT.shippingMultiplier, 1),
    labelFee: parsePositiveNumber(source.labelFee, DEFAULT_PRICING_CONTEXT.labelFee, 0)
  };
}

function create({ storageKey = DEFAULT_STORAGE_KEY }: GlobalSettingsCreateOptions = {}) {
  function readJson(key: string): unknown {
    try {
      return typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem(key) || 'null')
        : null;
    } catch (error) {
      return null;
    }
  }

  function writeJson(key: string, value: GlobalSettingsState) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  function loadState() {
    const saved = readJson(storageKey);
    return normalizeState(saved || DEFAULT_PRICING_CONTEXT);
  }

  let state = loadState();

  function getExchangeRate() {
    return parseExchangeRate(state.exchangeRate);
  }

  function setExchangeRate(value: unknown) {
    state = normalizeState({ ...state, exchangeRate: value });
    writeJson(storageKey, state);
    return state.exchangeRate;
  }

  function setPricingContext(next: PricingContextInput = {}) {
    state = normalizeState({
      ...state,
      exchangeRate: next.exchangeRate ?? next.rate ?? state.exchangeRate,
      shippingMultiplier: next.shippingMultiplier ?? state.shippingMultiplier,
      labelFee: next.labelFee ?? state.labelFee
    });
    writeJson(storageKey, state);
    return getPricingContext();
  }

  function getState() {
    return { ...state };
  }

  function getPricingContext() {
    return {
      rate: getExchangeRate(),
      shippingMultiplier: state.shippingMultiplier,
      labelFee: state.labelFee
    };
  }

  return {
    getExchangeRate,
    setExchangeRate,
    setPricingContext,
    getState,
    getPricingContext
  };
}

const TKGlobalSettings = {
  DEFAULT_STORAGE_KEY,
  create
};

let sharedStore = null;

function ensureGlobalSettingsStore() {
  sharedStore = sharedStore || create();
  return sharedStore;
}

export {
  DEFAULT_STORAGE_KEY,
  TKGlobalSettings,
  create,
  ensureGlobalSettingsStore,
  parseExchangeRate
};
