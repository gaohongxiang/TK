/* ============================================================
 * 商品库：CSV 导出纯函数
 * ============================================================ */

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getProductDefaults(product = {}) {
  return product?.defaults && typeof product.defaults === 'object'
    ? product.defaults
    : product;
}

function getProductSkus(product = {}) {
  return Array.isArray(product?.skus)
    ? product.skus.filter(sku => String(sku?.skuId || sku?.skuName || '').trim())
    : [];
}

function skuUsesProductDefaults(sku = {}) {
  if (sku?.useProductDefaults === true) return true;
  if (sku?.useProductDefaults === false) return false;
  const hasOwnSpec = !!String(sku?.weightG || '').trim()
    || !!String(sku?.sizeText || '').trim()
    || !!String(sku?.lengthCm || '').trim()
    || !!String(sku?.widthCm || '').trim()
    || !!String(sku?.heightCm || '').trim()
    || !!String(sku?.estimatedShippingFee || '').trim();
  return !hasOwnSpec;
}

function toNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSizeText(record = {}) {
  const direct = String(record?.sizeText || '').trim();
  if (direct) return direct.replace(/\*/g, '×');
  const values = [record?.lengthCm, record?.widthCm, record?.heightCm]
    .map(toNumber)
    .filter(value => value !== null);
  return values.length === 3 ? values.join('×') : '';
}

function mergeProductSku(product = {}, sku = {}) {
  const defaults = getProductDefaults(product);
  if (!skuUsesProductDefaults(sku)) return sku;
  return {
    ...defaults,
    ...sku,
    weightG: sku?.weightG || defaults?.weightG || '',
    lengthCm: sku?.lengthCm || defaults?.lengthCm || '',
    widthCm: sku?.widthCm || defaults?.widthCm || '',
    heightCm: sku?.heightCm || defaults?.heightCm || '',
    estimatedShippingFee: sku?.estimatedShippingFee || defaults?.estimatedShippingFee || '',
    sizeText: sku?.sizeText || defaults?.sizeText || ''
  };
}

function defaultNormalizeAccountName(value) {
  return String(value || '').trim();
}

function defaultUniqueAccounts(values = []) {
  return [...new Set(values.map(defaultNormalizeAccountName).filter(Boolean))];
}

function defaultToAccountSlot(value) {
  return defaultNormalizeAccountName(value) || '__unassigned__';
}

function create({
  state = {},
  helpers = {}
} = {}) {
  const getDisplayedProducts = helpers.getDisplayedProducts || (() => []);
  const normalizeAccountName = helpers.normalizeAccountName || defaultNormalizeAccountName;
  const uniqueAccounts = helpers.uniqueAccounts || defaultUniqueAccounts;
  const toAccountSlot = helpers.toAccountSlot || defaultToAccountSlot;

  function getProductExportAccountOptions() {
    const products = getDisplayedProducts({ activeAccount: '__all__' });
    const accounts = uniqueAccounts([
      ...(state.accounts || []),
      ...products.map(product => product?.accountName)
    ]);
    const options = accounts.map(account => ({
      key: account,
      label: account,
      count: products.filter(product => normalizeAccountName(product?.accountName) === account).length
    }));
    const unassignedCount = products.filter(product => !normalizeAccountName(product?.accountName)).length;
    if (unassignedCount > 0) {
      options.push({
        key: toAccountSlot(''),
        label: '未关联',
        count: unassignedCount
      });
    }
    return options;
  }

  function buildProductExportFilename(selectedOptions) {
    const names = (selectedOptions || []).map(option => option.label).filter(Boolean);
    const suffix = names.length === 1
      ? names[0]
      : names.length > 1
        ? `${names[0]}等${names.length}个账号`
        : '空';
    return `商品数据导出_${suffix}_${todayStr()}.csv`;
  }

  function buildProductExportRows(selectedSet) {
    const selectedKeys = selectedSet instanceof Set ? selectedSet : new Set(selectedSet || []);
    const products = getDisplayedProducts({ activeAccount: '__all__' })
      .filter(product => selectedKeys.has(toAccountSlot(product?.accountName)));
    return products.flatMap(product => {
      const defaults = getProductDefaults(product);
      const skus = getProductSkus(product);
      const base = [
        product?.accountName || '',
        product?.tkId || '',
        product?.name || '',
        defaults?.cargoType === 'special' ? '特货' : '普货'
      ];
      if (!skus.length) {
        return [[
          ...base,
          '',
          '',
          defaults?.weightG || '',
          formatSizeText(defaults),
          defaults?.estimatedShippingFee || '',
          product?.link1688 || '',
          product?.imageUrl || '',
          product?.createdAt || '',
          product?.updatedAt || ''
        ]];
      }
      return skus.map(sku => {
        const record = mergeProductSku(product, sku);
        return [
          ...base,
          sku?.skuName || '',
          sku?.skuId || '',
          record?.weightG || '',
          formatSizeText(record),
          record?.estimatedShippingFee || '',
          product?.link1688 || '',
          product?.imageUrl || '',
          product?.createdAt || '',
          product?.updatedAt || ''
        ];
      });
    });
  }

  return {
    buildProductExportFilename,
    buildProductExportRows,
    getProductExportAccountOptions
  };
}

const ProductLibraryExport = {
  create,
  csvEscape,
  formatSizeText,
  getProductDefaults,
  getProductSkus,
  mergeProductSku,
  skuUsesProductDefaults,
  todayStr
};

export {
  ProductLibraryExport,
  create,
  csvEscape,
  formatSizeText,
  getProductDefaults,
  getProductSkus,
  mergeProductSku,
  skuUsesProductDefaults,
  todayStr
};
