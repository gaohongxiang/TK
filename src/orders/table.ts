import {
  escapeHtml,
  isOrderRefunded,
  parseCreatorCommissionRateValue,
  parseOrderMoneyValue
} from './shared.ts';
import type {
  DeriveDisplayedOrdersOptions,
  DeriveDisplayedOrdersResult,
  DerivePurchaseSummaryOptions,
  OrderItem,
  OrderRecord,
  OrderSortOrder,
  OrderSummaryMetric,
  PurchaseSummary
} from './types.ts';

type ParsedMoneyAmount = {
  amount: number;
  hasValue: boolean;
};

function normalizeSearchValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isDateSearchQuery(value: unknown): boolean {
  const normalized = normalizeSearchValue(value);
  if (!normalized) return false;
  if (!/^[\d\s./-]+$/.test(normalized)) return false;
  const compact = normalized.replace(/\s+/g, '');
  return /^\d{4}[-/.]\d{1,2}([-/.\d]{0,3})?$/.test(compact)
    || /^\d{1,2}[-/.]\d{1,2}$/.test(compact);
}

function parseOrderSortTime(order: OrderRecord): number {
  const createdAt = String(order?.createdAt || order?.created_at || order?.updatedAt || order?.updated_at || '').trim();
  const timestamp = Date.parse(createdAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function parseOrderSeq(order: OrderRecord): number | null {
  const parsed = Number.parseInt(String(order?.seq ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseMoneyAmount(value: unknown): ParsedMoneyAmount {
  const amount = parseOrderMoneyValue(value);
  return {
    amount: amount ?? 0,
    hasValue: amount !== null
  };
}

function parseExchangeRateValue(value: unknown): number | null {
  const parsed = parseMoneyAmount(value);
  return parsed.hasValue && parsed.amount > 0 ? parsed.amount : null;
}

function isCreatorOrder(order: OrderRecord): boolean {
  const creatorCommissionRate = parseCreatorCommissionRateValue(order?.['达人佣金率']);
  if (creatorCommissionRate !== null && creatorCommissionRate > 0) return true;
  const creatorCommission = parseMoneyAmount(order?.['达人佣金']);
  return creatorCommission.hasValue && creatorCommission.amount > 0;
}

function roundMoney(value: number): number | null {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function sumMoneyAmount(orders: OrderRecord[] = [], fieldName = ''): OrderSummaryMetric {
  return (Array.isArray(orders) ? orders : []).reduce<OrderSummaryMetric>((acc, order) => {
    const parsed = parseMoneyAmount(order?.[fieldName]);
    return {
      total: acc.total + parsed.amount,
      count: acc.count + (parsed.hasValue ? 1 : 0)
    };
  }, { total: 0, count: 0 });
}

function normalizeResolvedAmount(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? roundMoney(amount) : null;
}

function sumResolvedMoneyAmount(orders: OrderRecord[] = [], resolver: (order: OrderRecord) => unknown = () => null): OrderSummaryMetric {
  return (Array.isArray(orders) ? orders : []).reduce<OrderSummaryMetric>((acc, order) => {
    const resolved = resolver(order);
    const amount = normalizeResolvedAmount(resolved);
    return {
      total: acc.total + (amount === null ? 0 : amount),
      count: acc.count + (amount === null ? 0 : 1)
    };
  }, { total: 0, count: 0 });
}

function sumRefundSaleAmount(orders: OrderRecord[] = [], exchangeRate: unknown = null): OrderSummaryMetric {
  const rate = parseExchangeRateValue(exchangeRate);
  return (Array.isArray(orders) ? orders : []).reduce<OrderSummaryMetric>((acc, order) => {
    if (rate === null || !isOrderRefunded(order)) return acc;
    const sale = parseMoneyAmount(order?.['售价']);
    if (!sale.hasValue || sale.amount <= 0) return acc;
    return {
      total: acc.total + roundMoney(sale.amount / rate),
      count: acc.count + 1
    };
  }, { total: 0, count: 0 });
}

function sumGrossSaleAmount(orders: OrderRecord[] = [], exchangeRate: unknown = null): OrderSummaryMetric {
  const rate = parseExchangeRateValue(exchangeRate);
  return (Array.isArray(orders) ? orders : []).reduce<OrderSummaryMetric>((acc, order) => {
    if (rate === null) return acc;
    const sale = parseMoneyAmount(order?.['售价']);
    if (!sale.hasValue || sale.amount <= 0) return acc;
    return {
      total: acc.total + roundMoney(sale.amount / rate),
      count: acc.count + 1
    };
  }, { total: 0, count: 0 });
}

function computeOrderSaleCnyAmount(order: OrderRecord, exchangeRate: unknown = null): number | null {
  const sale = parseMoneyAmount(order?.['售价']);
  const rate = parseExchangeRateValue(exchangeRate);
  if (rate === null) return null;
  if (isOrderRefunded(order)) return 0;
  if (!sale.hasValue || sale.amount <= 0) return null;
  return roundMoney(sale.amount / rate);
}

function computeOrderCreatorCommissionAmount(order: OrderRecord, exchangeRate: unknown = null): number | null {
  const sale = parseMoneyAmount(order?.['售价']);
  const rate = parseExchangeRateValue(exchangeRate);
  const creatorCommissionRate = parseCreatorCommissionRateValue(order?.['达人佣金率']);
  if (rate === null) return null;
  if (creatorCommissionRate === null) return 0;
  if (isOrderRefunded(order)) return 0;
  if (!sale.hasValue || sale.amount <= 0) return null;
  return roundMoney((sale.amount / rate) * (creatorCommissionRate / 100));
}

function computeOrderProfitAmount(order: OrderRecord, exchangeRate: unknown = null): number | null {
  const saleCny = computeOrderSaleCnyAmount(order, exchangeRate);
  const purchase = parseMoneyAmount(order?.['采购价格']);
  const shipping = parseMoneyAmount(order?.['预估运费']);
  const creatorCommission = computeOrderCreatorCommissionAmount(order, exchangeRate);
  if (saleCny === null || !purchase.hasValue || !shipping.hasValue || creatorCommission === null) return null;
  return roundMoney(saleCny - purchase.amount - shipping.amount - creatorCommission);
}

function formatTableMoneyValue(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function formatTableCellValue(value: unknown): string {
  const text = String(value ?? '').trim();
  return text || '-';
}

function buildSaleCellMarkup(order: OrderRecord): string {
  const saleText = String(order?.['售价'] ?? '').trim();
  if (!saleText) return '-';
  if (!isOrderRefunded(order)) return escapeHtml(formatTableCellValue(saleText));
  return `
      <span class="ot-sale-cell">
        <span class="ot-sale-current">0</span>
        <span class="ot-sale-original">${escapeHtml(saleText)}</span>
      </span>`;
}

function buildOrderNoCellMarkup(order: OrderRecord): string {
  const orderNo = escapeHtml(formatTableCellValue(order?.['订单号']));
  const tags = [];
  if (isCreatorOrder(order)) {
    tags.push('<span class="ot-order-tag ot-order-tag-creator" title="达人带货订单" aria-label="达人带货订单">达人</span>');
  }
  if (isOrderRefunded(order)) {
    tags.push('<span class="ot-order-tag ot-order-tag-creator" title="退款订单" aria-label="退款订单">退款</span>');
  }
  if (!tags.length) return orderNo;
  return `
      <span class="ot-order-no-cell">
        <span class="ot-order-no-text">${orderNo}</span>
        ${tags.join('')}
      </span>`;
}

function normalizeOrderItems(order: OrderRecord): OrderItem[] {
  return Array.isArray(order?.items) ? order.items : [];
}

function resolveItemCourier(item: OrderItem = {}, order: OrderRecord = {}): { company: string; tracking: string } {
  const orderCompany = String(order?.['快递公司'] || '').trim();
  const orderTracking = String(order?.['快递单号'] || '').trim();
  return {
    company: String(item?.courierCompany || '').trim() || (item?.useOrderCourier === true ? orderCompany : ''),
    tracking: String(item?.trackingNo || '').trim() || (item?.useOrderCourier === true ? orderTracking : '')
  };
}

function getOrderCourierValues(order: OrderRecord, field: 'company' | 'tracking' = 'company'): string[] {
  const items = normalizeOrderItems(order);
  if (!items.length) {
    const fallback = String(field === 'company' ? order?.['快递公司'] : order?.['快递单号'] || '').trim();
    return fallback ? [fallback] : [];
  }
  const values = items
    .map(item => resolveItemCourier(item, order)[field])
    .filter(Boolean);
  const uniqueValues = Array.from(new Set(values));
  if (uniqueValues.length) return uniqueValues;
  const fallback = String(field === 'company' ? order?.['快递公司'] : order?.['快递单号'] || '').trim();
  return fallback ? [fallback] : [];
}

function buildOrderCourierSummary(order: OrderRecord, field: 'company' | 'tracking' = 'company', mode: 'compact' | 'full' = 'full'): string {
  const values = getOrderCourierValues(order, field);
  if (!values.length) return '';
  if (mode === 'compact') {
    if (values.length === 1) return values[0];
    return field === 'company' ? `共${values.length}家` : `共${values.length}个`;
  }
  return values.join(' / ');
}

function formatCurrencyAmount(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return `¥ ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatCompactCurrencyAmount(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return `¥${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatSummaryMetric(metric?: OrderSummaryMetric | null): string {
  if (!metric || !metric.count) return '-';
  return formatCurrencyAmount(metric.total);
}

function getSummaryTone(metric?: OrderSummaryMetric | null, kind = 'neutral'): string {
  if (kind === 'income') return 'income';
  if (kind === 'expense') return 'expense';
  if (!metric || !metric.count) return 'neutral';
  if (metric.total > 0) return 'profit-positive';
  if (metric.total < 0) return 'profit-negative';
  return 'neutral';
}

function getProfitCellToneClass(value: unknown): string {
  if (!Number.isFinite(Number(value))) return 'neutral';
  if (Number(value) > 0) return 'profit-positive';
  if (Number(value) < 0) return 'profit-negative';
  return 'neutral';
}

function deriveDisplayedOrders({ orders = [], activeAccount = '__all__', searchQuery = '', sortOrder = 'asc' }: DeriveDisplayedOrdersOptions = {}): DeriveDisplayedOrdersResult {
  const list = Array.isArray(orders) ? orders : [];
  const isAll = activeAccount === '__all__';
  const accountFiltered = isAll
    ? list
    : activeAccount
      ? list.filter(order => String(order?.['账号'] || '').trim() === activeAccount)
      : list;
  const query = normalizeSearchValue(searchQuery);
  const dateOnlySearch = isDateSearchQuery(query);
  const filtered = !query
    ? accountFiltered
    : accountFiltered.filter(order => {
      const haystack = normalizeSearchValue(dateOnlySearch
        ? [order?.['下单时间']].join(' ')
        : [
          order?.['账号'],
          order?.['下单时间'],
          order?.['采购日期'],
          order?.['最晚到仓时间'],
          order?.['订单号'],
          isOrderRefunded(order) ? '退款 已退款' : '',
          isCreatorOrder(order) ? '达人 达人单' : '',
          order?.['产品名称'],
          order?.['数量'],
          order?.['采购价格'],
          order?.['售价'],
          order?.['达人佣金率'],
          order?.['达人佣金'],
          order?.['预估运费'],
          order?.['预估利润'],
          order?.['重量'],
          order?.['尺寸'],
          order?.['订单状态'],
          order?.['快递公司'],
          order?.['快递单号'],
          buildOrderCourierSummary(order, 'company', 'full'),
          buildOrderCourierSummary(order, 'tracking', 'full')
        ].join(' '));
      return haystack.includes(query);
    });
  const sorted = [...filtered].sort((a, b) => {
    const sa = parseOrderSeq(a);
    const sb = parseOrderSeq(b);
    if (sa !== null || sb !== null) {
      if (sa === null) return 1;
      if (sb === null) return -1;
      if (sa !== sb) return sortOrder === 'asc' ? sa - sb : sb - sa;
    }
    const ta = parseOrderSortTime(a);
    const tb = parseOrderSortTime(b);
    if (ta !== tb) return sortOrder === 'asc' ? ta - tb : tb - ta;
    const ida = String(a?.id || '');
    const idb = String(b?.id || '');
    if (ida === idb) return 0;
    return sortOrder === 'asc'
      ? ida.localeCompare(idb)
      : idb.localeCompare(ida);
  });
  return { isAll, sorted };
}

function derivePurchaseSummary({
  orders = [],
  activeAccount = '__all__',
  searchQuery = '',
  sortOrder = 'asc',
  exchangeRate = null,
  computeOrderSaleCny,
  computeOrderCreatorCommission
}: DerivePurchaseSummaryOptions = {}): PurchaseSummary {
  const list = Array.isArray(orders) ? orders : [];
  const { sorted } = deriveDisplayedOrders({ orders: list, activeAccount, searchQuery, sortOrder });
  const filteredPurchase = sumMoneyAmount(sorted, '采购价格');
  const allPurchase = sumMoneyAmount(list, '采购价格');
  const resolveSale = (order: OrderRecord) => {
    if (typeof computeOrderSaleCny === 'function') return computeOrderSaleCny(order, exchangeRate);
    return computeOrderSaleCnyAmount(order, exchangeRate);
  };
  const filteredSale = sumResolvedMoneyAmount(sorted, resolveSale);
  const allSale = sumResolvedMoneyAmount(list, resolveSale);
  const filteredShipping = sumMoneyAmount(sorted, '预估运费');
  const allShipping = sumMoneyAmount(list, '预估运费');
  const resolveCreatorCommission = (order: OrderRecord) => {
    const creatorCommissionRate = parseCreatorCommissionRateValue(order?.['达人佣金率']);
    if (creatorCommissionRate === null) return null;
    if (typeof computeOrderCreatorCommission === 'function') return computeOrderCreatorCommission(order, exchangeRate);
    return computeOrderCreatorCommissionAmount(order, exchangeRate);
  };
  const filteredCreatorCommission = sumResolvedMoneyAmount(sorted, resolveCreatorCommission);
  const allCreatorCommission = sumResolvedMoneyAmount(list, resolveCreatorCommission);
  const filteredRefund = sumRefundSaleAmount(sorted, exchangeRate);
  const allRefund = sumRefundSaleAmount(list, exchangeRate);
  const filteredGrossSale = sumGrossSaleAmount(sorted, exchangeRate);
  const allGrossSale = sumGrossSaleAmount(list, exchangeRate);
  const filteredExpenseCount = (filteredPurchase.count || 0) + (filteredShipping.count || 0) + (filteredCreatorCommission.count || 0);
  const allExpenseCount = (allPurchase.count || 0) + (allShipping.count || 0) + (allCreatorCommission.count || 0);
  const filteredProfit = {
    total: roundMoney(filteredSale.total - (filteredPurchase.total + filteredShipping.total + filteredCreatorCommission.total)) ?? 0,
    count: Math.max(filteredSale.count || 0, filteredExpenseCount)
  };
  const allProfit = {
    total: roundMoney(allSale.total - (allPurchase.total + allShipping.total + allCreatorCommission.total)) ?? 0,
    count: Math.max(allSale.count || 0, allExpenseCount)
  };
  return {
    filteredCount: sorted.length,
    allCount: list.length,
    filteredTotal: filteredPurchase.total,
    allTotal: allPurchase.total,
    filteredSaleTotal: filteredSale.total,
    allSaleTotal: allSale.total,
    filteredShippingTotal: filteredShipping.total,
    allShippingTotal: allShipping.total,
    filteredCreatorCommissionTotal: filteredCreatorCommission.total,
    allCreatorCommissionTotal: allCreatorCommission.total,
    filteredProfitTotal: filteredProfit.total,
    allProfitTotal: allProfit.total,
    filteredPurchaseMetric: filteredPurchase,
    allPurchaseMetric: allPurchase,
    filteredSaleMetric: filteredSale,
    allSaleMetric: allSale,
    filteredGrossSaleMetric: filteredGrossSale,
    allGrossSaleMetric: allGrossSale,
    filteredShippingMetric: filteredShipping,
    allShippingMetric: allShipping,
    filteredCreatorCommissionMetric: filteredCreatorCommission,
    allCreatorCommissionMetric: allCreatorCommission,
    filteredRefundMetric: filteredRefund,
    allRefundMetric: allRefund,
    filteredProfitMetric: filteredProfit,
    allProfitMetric: allProfit
  };
}

function buildCurrentFilterTitle(activeAccount = '__all__', searchQuery = ''): string {
  const conditions = [];
  const account = String(activeAccount || '').trim();
  const query = String(searchQuery || '').trim();
  if (account && account !== '__all__') conditions.push(`账号：${account}`);
  if (query) conditions.push(`搜索：${query}`);
  return conditions.length
    ? `当前筛选 · ${conditions.join(' · ')}`
    : '当前筛选';
}

const OrderTableView = {
  buildCurrentFilterTitle,
  buildOrderCourierSummary,
  buildOrderNoCellMarkup,
  buildSaleCellMarkup,
  computeOrderCreatorCommissionAmount,
  computeOrderProfitAmount,
  computeOrderSaleCnyAmount,
  deriveDisplayedOrders,
  derivePurchaseSummary,
  formatCompactCurrencyAmount,
  formatCurrencyAmount,
  formatSummaryMetric,
  formatTableCellValue,
  formatTableMoneyValue,
  getOrderCourierValues,
  getProfitCellToneClass,
  getSummaryTone,
  isCreatorOrder,
  isDateSearchQuery,
  parseMoneyAmount,
  parseOrderSeq,
  parseOrderSortTime
};

export {
  OrderTableView,
  buildCurrentFilterTitle,
  buildOrderCourierSummary,
  buildOrderNoCellMarkup,
  buildSaleCellMarkup,
  computeOrderCreatorCommissionAmount,
  computeOrderProfitAmount,
  computeOrderSaleCnyAmount,
  deriveDisplayedOrders,
  derivePurchaseSummary,
  formatCompactCurrencyAmount,
  formatCurrencyAmount,
  formatSummaryMetric,
  formatTableCellValue,
  formatTableMoneyValue,
  getOrderCourierValues,
  getProfitCellToneClass,
  getSummaryTone,
  isCreatorOrder,
  isDateSearchQuery,
  normalizeSearchValue,
  parseMoneyAmount,
  parseOrderSeq,
  parseOrderSortTime
};
