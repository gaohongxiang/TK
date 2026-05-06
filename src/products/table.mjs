function normalizeSearchValue(value) {
  return String(value || '').trim().toLowerCase();
}

function toNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatText(value) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatMoney(value) {
  const amount = toNumber(value);
  return amount === null ? '-' : `¥ ${amount.toFixed(2)}`;
}

function getProductSkus(product) {
  return Array.isArray(product?.skus) ? product.skus.filter(sku => String(sku?.skuId || '').trim()) : [];
}

function getProductDefaults(product = {}) {
  return product?.defaults && typeof product.defaults === 'object'
    ? product.defaults
    : product;
}

function skuUsesProductDefaults(sku = {}) {
  if (sku?.useProductDefaults === true) return true;
  if (sku?.useProductDefaults === false) return false;
  const hasOwnSpec = !!String(sku?.weightG || '').trim()
    || !!String(sku?.sizeText || '').trim()
    || !!String(sku?.lengthCm || '').trim()
    || !!String(sku?.widthCm || '').trim()
    || !!String(sku?.heightCm || '').trim()
    || !!String(sku?.estimatedShippingFee || '').trim()
    || !!String(sku?.chargeWeightKg || '').trim()
    || !!String(sku?.shippingNote || '').trim();
  return !hasOwnSpec;
}

function mergeProductSku(product = {}, sku = {}) {
  const defaults = getProductDefaults(product);
  if (!skuUsesProductDefaults(sku)) return sku;
  return {
    ...product,
    ...defaults,
    ...sku,
    weightG: sku?.weightG || defaults?.weightG || '',
    lengthCm: sku?.lengthCm || defaults?.lengthCm || '',
    widthCm: sku?.widthCm || defaults?.widthCm || '',
    heightCm: sku?.heightCm || defaults?.heightCm || '',
    estimatedShippingFee: sku?.estimatedShippingFee || defaults?.estimatedShippingFee || '',
    chargeWeightKg: sku?.chargeWeightKg || defaults?.chargeWeightKg || '',
    shippingNote: sku?.shippingNote || defaults?.shippingNote || '',
    sizeText: sku?.sizeText || defaults?.sizeText || ''
  };
}

function formatSize(product) {
  const direct = String(product?.sizeText || '').trim();
  if (direct) return direct.replace(/\*/g, '×');
  const values = [product?.lengthCm, product?.widthCm, product?.heightCm]
    .map(toNumber)
    .filter(value => value !== null);
  return values.length === 3 ? values.join(' * ') : '-';
}

function formatWeight(value) {
  const amount = toNumber(value);
  return amount === null ? '-' : String(amount);
}

function formatSkuCount(product) {
  const count = getProductSkus(product).length;
  return count > 0 ? `${count} 个` : '-';
}

function formatSkuLabel(sku = {}) {
  const name = formatText(sku?.skuName);
  const skuId = String(sku?.skuId || '').trim();
  return skuId && skuId !== '-' ? `${name} · ${skuId}` : name;
}

function formatSkuShippingFee(product, sku) {
  const record = mergeProductSku(product, sku);
  return formatMoney(record?.estimatedShippingFee);
}

function getCargoTypeLabel(value) {
  return value === 'special' ? '特货' : '普货';
}

function parseProductSortTime(product) {
  const value = String(product?.createdAt || product?.updatedAt || '').trim();
  const timestamp = Date.parse(value || 0);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareProducts(a, b, sortOrder = 'asc') {
  const leftTime = parseProductSortTime(a);
  const rightTime = parseProductSortTime(b);
  if (leftTime !== rightTime) return sortOrder === 'asc' ? leftTime - rightTime : rightTime - leftTime;
  const byTkId = String(a?.tkId ?? '').localeCompare(String(b?.tkId ?? ''), 'zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base'
  });
  return sortOrder === 'asc' ? byTkId : -byTkId;
}

function deriveDisplayedProducts({ products = [], activeAccount = '__all__', searchQuery = '', sortOrder = 'asc' } = {}) {
  const list = Array.isArray(products) ? products : [];
  const accountFiltered = activeAccount && activeAccount !== '__all__'
    ? list.filter(product => String(product?.accountName || '').trim() === activeAccount)
    : list;
  const sortProducts = items => [...items].sort((a, b) => compareProducts(a, b, sortOrder));
  const query = normalizeSearchValue(searchQuery);
  if (!query) {
    return sortProducts(accountFiltered);
  }
  return accountFiltered.filter(product => {
    const haystack = normalizeSearchValue([
      product?.accountName,
      product?.tkId,
      product?.name,
      product?.link1688,
      getCargoTypeLabel(getProductDefaults(product)?.cargoType),
      ...getProductSkus(product).flatMap(sku => [sku?.skuId, sku?.skuName])
    ].join(' '));
    return haystack.includes(query);
  }).sort((a, b) => compareProducts(a, b, sortOrder));
}

const ProductLibraryTable = {
  normalizeSearchValue,
  toNumber,
  formatText,
  formatMoney,
  getProductSkus,
  getProductDefaults,
  skuUsesProductDefaults,
  mergeProductSku,
  formatSize,
  formatWeight,
  formatSkuCount,
  formatSkuLabel,
  formatSkuShippingFee,
  getCargoTypeLabel,
  parseProductSortTime,
  compareProducts,
  deriveDisplayedProducts
};

export {
  ProductLibraryTable,
  compareProducts,
  deriveDisplayedProducts,
  formatMoney,
  formatSize,
  formatSkuCount,
  formatSkuLabel,
  formatSkuShippingFee,
  formatText,
  formatWeight,
  getCargoTypeLabel,
  getProductDefaults,
  getProductSkus,
  mergeProductSku,
  normalizeSearchValue,
  parseProductSortTime,
  skuUsesProductDefaults,
  toNumber
};
