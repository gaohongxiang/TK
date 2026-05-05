import {
  computeOrderCreatorCommission,
  computeOrderEstimatedProfit,
  escapeHtml,
  isOrderRefunded,
  normalizeAccountName,
  parseOrderMoneyValue
} from './shared.mjs';

function formatProductSize(product = {}) {
  const values = [product?.lengthCm, product?.widthCm, product?.heightCm]
    .map(value => String(value ?? '').trim())
    .filter(Boolean);
  return values.length === 3 ? values.join('×') : '';
}

function buildProductLabel(product = {}) {
  const tkId = String(product?.tkId || '').trim();
  const name = String(product?.name || '').trim();
  if (tkId && name) return `${tkId} - ${name}`;
  return tkId || name || '';
}

function getProductSkus(product = {}) {
  return Array.isArray(product?.skus)
    ? product.skus.filter(sku => String(sku?.skuId || '').trim())
    : [];
}

function buildSkuLabel(sku = {}) {
  const skuId = String(sku?.skuId || '').trim();
  const skuName = String(sku?.skuName || '').trim();
  if (skuId && skuName) return `${skuName} - ${skuId}`;
  return skuName || skuId || '未命名SKU';
}

function createOrderItemDraft(seed = {}, { uid = null } = {}) {
  const nextUid = typeof uid === 'function'
    ? uid
    : () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const quantityRaw = Number.parseInt(String(seed.quantity ?? seed['数量'] ?? '').trim(), 10);
  const rawUseOrderCourier = seed.useOrderCourier ?? seed['跟随订单默认快递'];
  const hasUseOrderCourier = rawUseOrderCourier !== undefined
    && rawUseOrderCourier !== null
    && String(rawUseOrderCourier).trim() !== '';
  return {
    lineId: String(seed.lineId || nextUid()),
    productTkId: String(seed.productTkId || seed['商品TK ID'] || '').trim(),
    productSkuId: String(seed.productSkuId || seed['商品SKU ID'] || '').trim(),
    productSkuName: String(seed.productSkuName || seed['商品SKU名称'] || '').trim(),
    productName: String(seed.productName || seed['产品名称'] || '').trim(),
    quantity: Number.isFinite(quantityRaw) && quantityRaw > 0 ? String(quantityRaw) : '1',
    unitSalePrice: String(seed.unitSalePrice ?? seed['单件售价'] ?? seed['售价'] ?? '').trim(),
    unitPurchasePrice: String(seed.unitPurchasePrice ?? seed['单件采购价'] ?? seed['采购价格'] ?? '').trim(),
    unitWeightG: String(seed.unitWeightG ?? seed['单件重量'] ?? seed['重量'] ?? '').trim(),
    unitSizeText: String(seed.unitSizeText ?? seed['单件尺寸'] ?? seed['尺寸'] ?? '').trim(),
    useOrderCourier: hasUseOrderCourier
      ? !['0', 'false', 'no', 'n'].includes(String(rawUseOrderCourier).trim().toLowerCase())
      : null,
    courierCompany: String(seed.courierCompany ?? seed['快递公司'] ?? '').trim(),
    trackingNo: String(seed.trackingNo ?? seed['快递单号'] ?? '').trim()
  };
}

function buildOrderItemLabel(item = {}) {
  const productName = String(item?.productName || '').trim();
  const skuName = String(item?.productSkuName || '').trim();
  if (productName && skuName) return `${productName} - ${skuName}`;
  return productName || skuName || '';
}

function buildOrderItemsSummary(items = []) {
  const lines = (Array.isArray(items) ? items : []).filter(item => buildOrderItemLabel(item));
  return lines.map(buildOrderItemLabel).join(' / ');
}

function formatMoneyValue(value) {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function formatNumericValue(value) {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function getCourierOptions() {
  return [
    '',
    '韵达快递',
    '中通快递',
    '圆通快递',
    '申通快递',
    '极兔快递',
    '顺丰快递',
    '邮政快递',
    '景光物流',
    '安能物流'
  ];
}

function buildCourierSelectOptionsMarkup(selectedValue = '') {
  const selected = String(selectedValue || '').trim();
  return getCourierOptions().map(value => {
    const normalized = String(value || '').trim();
    const label = normalized
      ? (normalized === '邮政快递' ? '邮政 / EMS' : normalized)
      : '- 请选择 -';
    return `<option value="${escapeHtml(normalized)}"${normalized === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function buildItemProductOptions({
  accountName = '',
  selectedTkId = '',
  products = []
} = {}) {
  const normalizedSelected = String(selectedTkId || '').trim();
  const normalizedAccount = normalizeAccountName(accountName);
  const availableProducts = normalizedAccount ? (Array.isArray(products) ? products : []) : [];
  const options = [{ value: '', label: '- 不关联商品 -', searchText: '' }];
  availableProducts.forEach(product => {
    const tkId = String(product?.tkId || '').trim();
    if (!tkId) return;
    options.push({
      value: tkId,
      label: buildProductLabel(product),
      searchText: [
        product?.tkId,
        product?.name,
        ...getProductSkus(product).flatMap(sku => [sku?.skuId, sku?.skuName])
      ].join(' ')
    });
  });
  if (normalizedSelected && !options.some(option => option.value === normalizedSelected)) {
    options.push({
      value: normalizedSelected,
      label: `${normalizedSelected}（已不存在）`,
      searchText: normalizedSelected
    });
  }
  return options;
}

function buildItemSkuOptions(product = null, selectedSkuId = '') {
  const normalizedSelected = String(selectedSkuId || '').trim();
  if (!product) return [];
  const skus = getProductSkus(product);
  const options = [{ value: '', label: skus.length ? '- 请选择 SKU -' : '- 该商品没有 SKU -', searchText: '' }];
  skus.forEach(sku => {
    const skuId = String(sku?.skuId || '').trim();
    if (!skuId) return;
    options.push({
      value: skuId,
      label: buildSkuLabel(sku),
      searchText: [sku?.skuId, sku?.skuName].join(' ')
    });
  });
  if (normalizedSelected && !options.some(option => option.value === normalizedSelected)) {
    options.push({
      value: normalizedSelected,
      label: `${normalizedSelected}（已不存在）`,
      searchText: normalizedSelected
    });
  }
  return options;
}

function cloneOrderItemDrafts(items = [], options = {}) {
  return (Array.isArray(items) ? items : []).map(item => createOrderItemDraft(item, options));
}

function mergeOrderItemDraftCache(items = [], cachedItems = [], options = {}) {
  const drafts = cloneOrderItemDrafts(items, options);
  const cachedDrafts = cloneOrderItemDrafts(cachedItems, options);
  if (!cachedDrafts.length) return drafts;
  const cachedByLineId = new Map(cachedDrafts.map(item => [String(item.lineId || ''), item]));
  return drafts.map(draft => {
    const cached = cachedByLineId.get(String(draft.lineId || ''));
    if (!cached) return draft;
    const next = { ...draft };
    Object.entries(cached).forEach(([key, value]) => {
      if (key === 'lineId') return;
      if (String(next[key] ?? '').trim()) return;
      if (value === null || value === undefined || String(value).trim() === '') return;
      next[key] = value;
    });
    return createOrderItemDraft(next, options);
  });
}

function deriveOrderItemSummaryFields(items = []) {
  const drafts = cloneOrderItemDrafts(items);
  const quantityTotal = drafts.reduce((sum, item) => (
    sum + (Number.parseInt(String(item.quantity || '').trim(), 10) || 0)
  ), 0);
  const totalWeight = drafts.reduce((sum, item) => {
    const quantity = Number.parseInt(String(item.quantity || '').trim(), 10) || 0;
    const unitWeight = parseOrderMoneyValue(item.unitWeightG);
    return sum + ((unitWeight || 0) * quantity);
  }, 0);
  const onlyItem = drafts.length === 1 ? drafts[0] : null;
  return {
    items: drafts,
    quantityTotal,
    productName: buildOrderItemsSummary(drafts),
    productTkId: onlyItem?.productTkId || '',
    productSkuId: onlyItem?.productSkuId || '',
    productSkuName: onlyItem?.productSkuName || '',
    weight: totalWeight ? formatNumericValue(totalWeight) : '',
    size: onlyItem?.unitSizeText || ''
  };
}

function resolveCourierAutodetectState({
  trackingNo = '',
  currentCompany = '',
  autoDetectedCourier = '',
  detectCourierCompany = () => ''
} = {}) {
  const tracking = String(trackingNo || '').trim();
  const current = String(currentCompany || '').trim();
  const autoDetected = String(autoDetectedCourier || '').trim();
  if (!tracking) {
    if (autoDetected && current === autoDetected) {
      return { courierCompany: '', autoDetectedCourier: '' };
    }
    return { courierCompany: current, autoDetectedCourier: autoDetected };
  }
  if (current && current !== autoDetected) {
    return { courierCompany: current, autoDetectedCourier: autoDetected };
  }
  const detected = String(detectCourierCompany(tracking) || '').trim();
  return { courierCompany: detected, autoDetectedCourier: detected };
}

function computeCreatorCommissionValue({
  salePrice = '',
  creatorCommissionRate = '',
  isRefunded = '',
  exchangeRate = null
} = {}) {
  const refunded = isOrderRefunded({ '是否退款': isRefunded });
  const sharedCommission = computeOrderCreatorCommission({
    '售价': salePrice,
    '达人佣金率': creatorCommissionRate,
    '是否退款': refunded ? '1' : ''
  }, exchangeRate);
  if (sharedCommission !== null) return formatMoneyValue(sharedCommission);
  return '';
}

function computeEstimatedProfitValue({
  salePrice = '',
  purchasePrice = '',
  estimatedShippingFee = '',
  creatorCommissionRate = '',
  isRefunded = '',
  exchangeRate = null
} = {}) {
  const refunded = isOrderRefunded({ '是否退款': isRefunded });
  const sharedProfit = computeOrderEstimatedProfit({
    '售价': salePrice,
    '采购价格': purchasePrice,
    '预估运费': estimatedShippingFee,
    '达人佣金率': creatorCommissionRate,
    '是否退款': refunded ? '1' : ''
  }, exchangeRate);
  if (sharedProfit !== null) return formatMoneyValue(sharedProfit);
  return '';
}

function create() {
  return {
    buildCourierSelectOptionsMarkup,
    buildItemProductOptions,
    buildItemSkuOptions,
    computeCreatorCommissionValue,
    computeEstimatedProfitValue,
    deriveOrderItemSummaryFields,
    getCourierOptions,
    mergeOrderItemDraftCache,
    resolveCourierAutodetectState
  };
}

const OrderTrackerCrud = {
  create
};

export {
  OrderTrackerCrud,
  buildCourierSelectOptionsMarkup,
  buildItemProductOptions,
  buildItemSkuOptions,
  computeCreatorCommissionValue,
  create,
  createOrderItemDraft,
  deriveOrderItemSummaryFields,
  computeEstimatedProfitValue,
  getCourierOptions,
  mergeOrderItemDraftCache,
  resolveCourierAutodetectState
};
