function toPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function runLooseObjectParser(text) {
  try {
    return Function(`"use strict"; return (${text});`)();
  } catch (error) {
    return null;
  }
}

function sanitizeConfig(raw) {
  const cfg = toPlainObject(raw);
  if (!cfg) return null;
  const next = {};
  ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId', 'measurementId'].forEach(key => {
    const value = String(cfg[key] || '').trim();
    if (value) next[key] = value;
  });
  if (!next.apiKey || !next.projectId || !next.appId) return null;
  if (!next.authDomain) next.authDomain = `${next.projectId}.firebaseapp.com`;
  return next;
}

function parseConfigInput(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return sanitizeConfig(raw);
  const text = String(raw || '').trim();
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  const body = text.slice(start, end + 1);
  try {
    return sanitizeConfig(JSON.parse(body));
  } catch (error) {}
  return sanitizeConfig(runLooseObjectParser(body));
}

function hydrateConfig(raw) {
  const parsed = parseConfigInput(raw?.configText || raw?.firestoreConfigText || raw?.firebaseConfig || raw);
  return {
    config: parsed,
    configText: parsed ? JSON.stringify(parsed, null, 2) : '',
    projectId: parsed?.projectId || String(raw?.projectId || raw?.firestoreProjectId || '').trim(),
    user: String(raw?.user || '').trim()
  };
}

function getDisplayName(config = {}) {
  const next = hydrateConfig(config);
  if (next.user) return `${next.user} · Firestore`;
  if (next.projectId) return `${next.projectId} · Firestore`;
  return 'Firebase Firestore';
}

function toNullableText(value) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function toNullableDecimal(value) {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function toNullableInteger(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoString(value, fallback = '') {
  if (!value && fallback) return fallback;
  if (!value) return '';
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
  }
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return fallback || '';
}

function normalizePulledSku(data) {
  const hasOwnSpec = data?.weightG != null
    || data?.lengthCm != null
    || data?.widthCm != null
    || data?.heightCm != null
    || data?.estimatedShippingFee != null
    || data?.chargeWeightKg != null
    || !!String(data?.shippingNote || '').trim();
  return {
    skuId: String(data?.skuId || '').trim(),
    skuName: data?.skuName || '',
    useProductDefaults: data?.useProductDefaults == null ? !hasOwnSpec : data.useProductDefaults !== false,
    weightG: data?.weightG == null ? '' : String(data.weightG),
    lengthCm: data?.lengthCm == null ? '' : String(data.lengthCm),
    widthCm: data?.widthCm == null ? '' : String(data.widthCm),
    heightCm: data?.heightCm == null ? '' : String(data.heightCm),
    estimatedShippingFee: data?.estimatedShippingFee == null ? '' : String(data.estimatedShippingFee),
    chargeWeightKg: data?.chargeWeightKg == null ? '' : String(data.chargeWeightKg),
    shippingNote: data?.shippingNote || ''
  };
}

function buildSkuDoc(sku) {
  return {
    skuId: String(sku?.skuId || '').trim(),
    skuName: toNullableText(sku?.skuName),
    useProductDefaults: sku?.useProductDefaults !== false,
    weightG: toNullableInteger(sku?.weightG),
    lengthCm: toNullableDecimal(sku?.lengthCm),
    widthCm: toNullableDecimal(sku?.widthCm),
    heightCm: toNullableDecimal(sku?.heightCm),
    estimatedShippingFee: toNullableDecimal(sku?.estimatedShippingFee),
    chargeWeightKg: toNullableDecimal(sku?.chargeWeightKg),
    shippingNote: toNullableText(sku?.shippingNote)
  };
}

function normalizeProductDefaults(data) {
  const defaults = toPlainObject(data?.defaults) || data || {};
  return {
    cargoType: defaults?.cargoType || 'general',
    weightG: defaults?.weightG == null ? '' : String(defaults.weightG),
    lengthCm: defaults?.lengthCm == null ? '' : String(defaults.lengthCm),
    widthCm: defaults?.widthCm == null ? '' : String(defaults.widthCm),
    heightCm: defaults?.heightCm == null ? '' : String(defaults.heightCm),
    estimatedShippingFee: defaults?.estimatedShippingFee == null ? '' : String(defaults.estimatedShippingFee),
    chargeWeightKg: defaults?.chargeWeightKg == null ? '' : String(defaults.chargeWeightKg),
    shippingNote: defaults?.shippingNote || ''
  };
}

function buildProductDefaultsDoc(defaults) {
  return {
    cargoType: toNullableText(defaults?.cargoType) || 'general',
    weightG: toNullableInteger(defaults?.weightG),
    lengthCm: toNullableDecimal(defaults?.lengthCm),
    widthCm: toNullableDecimal(defaults?.widthCm),
    heightCm: toNullableDecimal(defaults?.heightCm),
    estimatedShippingFee: toNullableDecimal(defaults?.estimatedShippingFee),
    chargeWeightKg: toNullableDecimal(defaults?.chargeWeightKg),
    shippingNote: toNullableText(defaults?.shippingNote)
  };
}

function normalizePulledProduct(data) {
  const defaults = normalizeProductDefaults(data);
  return {
    tkId: String(data?.tkId || '').trim(),
    accountName: data?.accountName || '',
    name: data?.name || '',
    imageUrl: data?.imageUrl || '',
    link1688: data?.link1688 || '',
    defaults,
    skus: Array.isArray(data?.skus) ? data.skus.map(normalizePulledSku).filter(sku => sku.skuId) : [],
    createdAt: toIsoString(data?.createdAt || ''),
    updatedAt: toIsoString(data?.updatedAt || '')
  };
}

function buildProductDoc(product, { nowIso = () => new Date().toISOString() } = {}) {
  const createdAt = toIsoString(product?.createdAt || '', nowIso()) || nowIso();
  const updatedAt = toIsoString(product?.updatedAt || '', createdAt) || nowIso();
  const defaults = buildProductDefaultsDoc(product?.defaults || product);
  return {
    tkId: String(product?.tkId || '').trim(),
    accountName: toNullableText(product?.accountName),
    name: toNullableText(product?.name),
    imageUrl: toNullableText(product?.imageUrl),
    link1688: toNullableText(product?.link1688),
    defaults,
    skus: Array.isArray(product?.skus) ? product.skus.map(buildSkuDoc).filter(sku => sku.skuId) : [],
    createdAt,
    updatedAt
  };
}

const ProductLibraryProviderFirestoreUtils = {
  buildProductDefaultsDoc,
  buildProductDoc,
  buildSkuDoc,
  getDisplayName,
  hydrateConfig,
  normalizeProductDefaults,
  normalizePulledProduct,
  normalizePulledSku,
  parseConfigInput,
  sanitizeConfig,
  toIsoString,
  toNullableDecimal,
  toNullableInteger,
  toNullableText
};

export {
  ProductLibraryProviderFirestoreUtils,
  parseConfigInput,
  normalizePulledProduct,
  buildProductDefaultsDoc,
  buildProductDoc,
  buildSkuDoc,
  getDisplayName,
  hydrateConfig,
  normalizeProductDefaults,
  normalizePulledSku,
  sanitizeConfig,
  toIsoString,
  toNullableDecimal,
  toNullableInteger,
  toNullableText
};
