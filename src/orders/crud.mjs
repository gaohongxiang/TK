import {
  computeOrderCreatorCommission,
  computeOrderEstimatedProfit,
  escapeHtml,
  isOrderRefunded,
  normalizeAccountName,
  parseOrderMoneyValue
} from './shared.mjs';
import { OrderTrackerFormUtils } from './form-utils.mjs';

const {
  buildOrderItemsSummary,
  buildProductLabel,
  buildSkuLabel,
  formatMoneyValue,
  formatNumericValue,
  getProductSkus
} = OrderTrackerFormUtils;

const createOrderItemDraft = (seed = {}, options = {}) => (
  OrderTrackerFormUtils.createOrderItemDraft(seed, options)
);

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
  return sharedCommission !== null ? formatMoneyValue(sharedCommission) : '';
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
  return sharedProfit !== null ? formatMoneyValue(sharedProfit) : '';
}

const OrderTrackerCrud = Object.freeze({
  buildCourierSelectOptionsMarkup,
  buildItemProductOptions,
  buildItemSkuOptions,
  computeCreatorCommissionValue,
  computeEstimatedProfitValue,
  createOrderItemDraft,
  deriveOrderItemSummaryFields,
  getCourierOptions,
  mergeOrderItemDraftCache,
  resolveCourierAutodetectState
});

export {
  OrderTrackerCrud,
  buildCourierSelectOptionsMarkup,
  buildItemProductOptions,
  buildItemSkuOptions,
  computeCreatorCommissionValue,
  computeEstimatedProfitValue,
  createOrderItemDraft,
  deriveOrderItemSummaryFields,
  getCourierOptions,
  mergeOrderItemDraftCache,
  resolveCourierAutodetectState
};
