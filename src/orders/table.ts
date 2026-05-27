import {
  computeOrderCreatorCommission,
  computeOrderEstimatedProfit,
  computeOrderPlatformFee,
  computeOrderSaleCny,
  escapeHtml,
  normalizeOrderPricingContext,
  isOrderRefunded,
  parseCreatorCommissionRateValue,
  parseOrderMoneyValue
} from './shared.ts';
import {
  getCurrentSearchYear,
  matchesParsedSearchQuery,
  normalizeSearchValue,
  parseSearchQuery
} from '../search-query.ts';
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

type BuildCurrentFilterTitleOptions = {
  accounts?: unknown[];
  currentYear?: number;
};

const ORDER_DATE_ALIASES = {
  'xd': '下单时间',
  '下单': '下单时间',
  '下单时间': '下单时间',
  'cg': '采购日期',
  '采购': '采购日期',
  '采购日期': '采购日期',
  'dc': '最晚到仓时间',
  '到仓': '最晚到仓时间',
  '最晚到仓': '最晚到仓时间',
  '最晚到仓时间': '最晚到仓时间'
};

const ORDER_DATE_TITLE_LABELS: Record<string, string> = {
  '下单时间': '下单时间',
  '采购日期': '采购时间',
  '最晚到仓时间': '到仓时间'
};

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
  const context = normalizeOrderPricingContext(value);
  if (context.exchangeRate !== null) return context.exchangeRate;
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
  return computeOrderSaleCny(order, exchangeRate);
}

function computeOrderCreatorCommissionAmount(order: OrderRecord, exchangeRate: unknown = null): number | null {
  return computeOrderCreatorCommission(order, exchangeRate);
}

function computeOrderPlatformFeeAmount(order: OrderRecord, exchangeRate: unknown = null): number | null {
  return computeOrderPlatformFee(order, exchangeRate);
}

function computeOrderProfitAmount(order: OrderRecord, exchangeRate: unknown = null): number | null {
  return computeOrderEstimatedProfit(order, exchangeRate);
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

function getOrderSearchText(order: OrderRecord): unknown[] {
  return [
    order?.['账号'],
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
    order?.['订单预警'],
    order?.['快递公司'],
    order?.['快递单号'],
    order?.['备注'],
    buildOrderCourierSummary(order, 'company', 'full'),
    buildOrderCourierSummary(order, 'tracking', 'full')
  ];
}

function getOrderSearchDate(order: OrderRecord, field: string): unknown {
  return order?.[field] || '';
}

function deriveDisplayedOrders({ orders = [], activeAccount = '__all__', searchQuery = '', sortOrder = 'asc' }: DeriveDisplayedOrdersOptions = {}): DeriveDisplayedOrdersResult {
  const list = Array.isArray(orders) ? orders : [];
  const isAll = activeAccount === '__all__';
  const accountFiltered = isAll
    ? list
    : activeAccount
      ? list.filter(order => String(order?.['账号'] || '').trim() === activeAccount)
      : list;
  const query = parseSearchQuery(searchQuery, {
    currentYear: getCurrentSearchYear(),
    defaultDateField: '下单时间',
    dateAliases: ORDER_DATE_ALIASES
  });
  const filtered = query.textTokens.length || query.dateFilters.length
    ? accountFiltered.filter(order => matchesParsedSearchQuery({
      query,
      record: order,
      getText: getOrderSearchText,
      getDate: getOrderSearchDate
    }))
    : accountFiltered;
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
  computeOrderCreatorCommission,
  computeOrderPlatformFee
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
  const resolvePlatformFee = (order: OrderRecord) => {
    if (typeof computeOrderPlatformFee === 'function') return computeOrderPlatformFee(order, exchangeRate);
    return computeOrderPlatformFeeAmount(order, exchangeRate);
  };
  const filteredPlatformFee = sumResolvedMoneyAmount(sorted, resolvePlatformFee);
  const allPlatformFee = sumResolvedMoneyAmount(list, resolvePlatformFee);
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
  const filteredExpenseCount = (filteredPurchase.count || 0) + (filteredShipping.count || 0) + (filteredPlatformFee.count || 0) + (filteredCreatorCommission.count || 0);
  const allExpenseCount = (allPurchase.count || 0) + (allShipping.count || 0) + (allPlatformFee.count || 0) + (allCreatorCommission.count || 0);
  const filteredProfit = {
    total: roundMoney(filteredSale.total - (filteredPurchase.total + filteredShipping.total + filteredPlatformFee.total + filteredCreatorCommission.total)) ?? 0,
    count: Math.max(filteredSale.count || 0, filteredExpenseCount)
  };
  const allProfit = {
    total: roundMoney(allSale.total - (allPurchase.total + allShipping.total + allPlatformFee.total + allCreatorCommission.total)) ?? 0,
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
    filteredPlatformFeeTotal: filteredPlatformFee.total,
    allPlatformFeeTotal: allPlatformFee.total,
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
    filteredPlatformFeeMetric: filteredPlatformFee,
    allPlatformFeeMetric: allPlatformFee,
    filteredCreatorCommissionMetric: filteredCreatorCommission,
    allCreatorCommissionMetric: allCreatorCommission,
    filteredRefundMetric: filteredRefund,
    allRefundMetric: allRefund,
    filteredProfitMetric: filteredProfit,
    allProfitMetric: allProfit
  };
}

function normalizeTitleAccountList(accounts: unknown[] = []): string[] {
  return accounts
    .map(account => String(account || '').trim())
    .filter(Boolean);
}

function findTitleAccount(token: string, accounts: unknown[] = []): string {
  const needle = normalizeSearchValue(token);
  if (!needle) return '';
  return normalizeTitleAccountList(accounts).find(account => normalizeSearchValue(account) === needle) || '';
}

function getSearchTokenExpression(token: string): string {
  const colonIndex = token.indexOf(':');
  const fullWidthColonIndex = token.indexOf('：');
  const delimiterIndex = colonIndex > 0
    ? colonIndex
    : fullWidthColonIndex > 0
      ? fullWidthColonIndex
      : -1;
  return delimiterIndex > 0 ? token.slice(delimiterIndex + 1).trim() : token.trim();
}

function formatDateTitlePart(field: string, expression: string): string {
  const label = ORDER_DATE_TITLE_LABELS[field] || field;
  return expression ? `${label}：${expression}` : label;
}

function buildSearchTitleParts(activeAccount: string, searchQuery: string, options: BuildCurrentFilterTitleOptions = {}): string[] {
  const parts: string[] = [];
  const textTokens: string[] = [];
  const query = String(searchQuery || '').trim();
  if (!query) return parts;

  function flushTextTokens() {
    if (!textTokens.length) return;
    parts.push(`搜索：${textTokens.join(' ')}`);
    textTokens.length = 0;
  }

  query.split(/\s+/).filter(Boolean).forEach(token => {
    const parsed = parseSearchQuery(token, {
      currentYear: options.currentYear || getCurrentSearchYear(),
      defaultDateField: '下单时间',
      dateAliases: ORDER_DATE_ALIASES
    });
    if (parsed.dateFilters.length === 1 && parsed.textTokens.length === 0) {
      flushTextTokens();
      const [filter] = parsed.dateFilters;
      parts.push(formatDateTitlePart(filter.field, getSearchTokenExpression(token)));
      return;
    }

    const account = findTitleAccount(token, options.accounts);
    if (account) {
      flushTextTokens();
      if (normalizeSearchValue(account) !== normalizeSearchValue(activeAccount)) {
        parts.push(`账号：${account}`);
      }
      return;
    }

    textTokens.push(token);
  });
  flushTextTokens();
  return parts;
}

function buildCurrentFilterTitle(activeAccount = '__all__', searchQuery = '', options: BuildCurrentFilterTitleOptions = {}): string {
  const conditions = [];
  const account = String(activeAccount || '').trim();
  if (account && account !== '__all__') conditions.push(`账号：${account}`);
  conditions.push(...buildSearchTitleParts(account, searchQuery, options));
  return conditions.length
    ? `当前筛选 · ${conditions.join(' · ')}`
    : '当前筛选';
}

const OrderTableView = {
  ORDER_DATE_ALIASES,
  buildCurrentFilterTitle,
  buildOrderCourierSummary,
  buildOrderNoCellMarkup,
  buildSaleCellMarkup,
  computeOrderCreatorCommissionAmount,
  computeOrderPlatformFeeAmount,
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
  getOrderSearchDate,
  getOrderSearchText,
  getProfitCellToneClass,
  getSummaryTone,
  isCreatorOrder,
  parseMoneyAmount,
  parseOrderSeq,
  parseOrderSortTime
};

export {
  ORDER_DATE_ALIASES,
  ORDER_DATE_TITLE_LABELS,
  OrderTableView,
  buildCurrentFilterTitle,
  buildOrderCourierSummary,
  buildOrderNoCellMarkup,
  buildSaleCellMarkup,
  computeOrderCreatorCommissionAmount,
  computeOrderPlatformFeeAmount,
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
  getOrderSearchDate,
  getOrderSearchText,
  getProfitCellToneClass,
  getSummaryTone,
  isCreatorOrder,
  normalizeSearchValue,
  parseMoneyAmount,
  parseOrderSeq,
  parseOrderSortTime
};
