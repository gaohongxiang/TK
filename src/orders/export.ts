import {
  computeOrderActualProfit,
  computeOrderCreatorCommission,
  computeOrderEstimatedProfit,
  computeOrderPlatformFee,
  computeWarning,
  normalizeOrderPricingContext,
  todayStr
} from './shared.ts';
import type {
  BuildExportFilenameOptions,
  BuildOrderExportRowsOptions,
  BuildOrdersCsvOptions,
  GetExportAccountOptionsInput,
  OrderExportAccountOption,
  OrderExportConstants,
  OrderExportRow,
  OrderRecord,
  SelectOrdersForExportOptions
} from './types.ts';

const DEFAULT_CONSTANTS = {
  UNASSIGNED_ACCOUNT_SLOT: '__unassigned__'
};

const CSV_HEADERS = [
  '账号',
  '下单时间',
  '采购日期',
  '最晚到仓时间',
  '订单预警',
  '订单号',
  '产品名称',
  '数量',
  '售价口径',
  '采购价格',
  '售价(日元)',
  '平台手续费率(%)',
  '平台手续费(人民币)',
  '达人佣金率(%)',
  '达人佣金(人民币)',
  '预估运费(人民币)',
  '预估利润(人民币)',
  '结算金额(日元)',
  '实际利润(人民币)',
  '重量',
  '尺寸',
  '订单状态',
  '快递公司',
  '快递单号',
  '备注'
];

function normalizeAccountName(account: unknown): string {
  return String(account || '').trim();
}

function uniqueAccounts(accounts: unknown[] = []): string[] {
  return [...new Set((accounts || []).map(normalizeAccountName).filter(Boolean))];
}

function toAccountSlot(account: unknown, constants: OrderExportConstants = DEFAULT_CONSTANTS): string {
  const normalized = normalizeAccountName(account);
  return normalized || constants.UNASSIGNED_ACCOUNT_SLOT;
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function getExportAccountOptions({
  accounts = [],
  orders = [],
  constants = DEFAULT_CONSTANTS
}: GetExportAccountOptionsInput = {}): OrderExportAccountOption[] {
  const safeConstants = { ...DEFAULT_CONSTANTS, ...(constants || {}) };
  const safeOrders = Array.isArray(orders) ? orders : [];
  const accountOptions = uniqueAccounts([
    ...(Array.isArray(accounts) ? accounts : []),
    ...safeOrders.map(order => order?.['账号'])
  ]).map(account => ({
    key: account,
    label: account,
    count: safeOrders.filter(order => normalizeAccountName(order?.['账号']) === account).length
  }));
  const unassignedCount = safeOrders.filter(order => !normalizeAccountName(order?.['账号'])).length;
  if (unassignedCount > 0) {
    accountOptions.push({
      key: safeConstants.UNASSIGNED_ACCOUNT_SLOT,
      label: '未关联',
      count: unassignedCount
    });
  }
  return accountOptions;
}

function buildExportFilename(selectedOptions: OrderExportAccountOption[] = [], { today = todayStr }: BuildExportFilenameOptions = {}): string {
  const names = (selectedOptions || []).map(option => option.label).filter(Boolean);
  const suffix = names.length === 1
    ? names[0]
    : names.length > 1
      ? `${names[0]}等${names.length}个账号`
      : '空';
  return `订单数据导出_${suffix}_${today()}.csv`;
}

function selectOrdersForExport({
  orders = [],
  selectedKeys = [],
  constants = DEFAULT_CONSTANTS
}: SelectOrdersForExportOptions = {}): OrderRecord[] {
  const safeConstants = { ...DEFAULT_CONSTANTS, ...(constants || {}) };
  const selectedSet = new Set(selectedKeys || []);
  return (Array.isArray(orders) ? orders : []).filter(order => {
    const slot = toAccountSlot(order?.['账号'], safeConstants);
    return selectedSet.has(slot);
  });
}

function buildExportRows({
  orders = [],
  exchangeRate = null,
  computeWarningFn = computeWarning,
  computeOrderPlatformFeeFn = computeOrderPlatformFee,
  computeOrderCreatorCommissionFn = computeOrderCreatorCommission,
  computeOrderEstimatedProfitFn = computeOrderEstimatedProfit,
  computeOrderActualProfitFn = computeOrderActualProfit
}: BuildOrderExportRowsOptions = {}): OrderExportRow[] {
  const pricingContext = normalizeOrderPricingContext(exchangeRate);
  return (Array.isArray(orders) ? orders : []).map(order => {
    const warning = computeWarningFn(order).text;
    const platformFee = typeof computeOrderPlatformFeeFn === 'function'
      ? computeOrderPlatformFeeFn(order, exchangeRate)
      : order?.['平台手续费'];
    const creatorCommission = typeof computeOrderCreatorCommissionFn === 'function'
      ? computeOrderCreatorCommissionFn(order, exchangeRate)
      : order?.['达人佣金'];
    const estimatedProfit = typeof computeOrderEstimatedProfitFn === 'function'
      ? computeOrderEstimatedProfitFn(order, exchangeRate)
      : order?.['预估利润'];
    const actualProfit = typeof computeOrderActualProfitFn === 'function'
      ? computeOrderActualProfitFn(order, exchangeRate)
      : order?.['实际利润'];
    return [
      order?.['账号'] || '',
      order?.['下单时间'] || '',
      order?.['采购日期'] || '',
      order?.['最晚到仓时间'] || '',
      warning,
      order?.['订单号'] || '',
      order?.['产品名称'] || '',
      order?.['数量'] || '',
      order?.['售价口径'] === 'free_shipping_transfer' || order?.salePricingMode === 'free_shipping_transfer' ? '包邮转嫁' : '不包邮',
      order?.['采购价格'] || '',
      order?.['售价'] || '',
      pricingContext.platformFeeRate || '',
      platformFee ?? '',
      order?.['达人佣金率'] || '',
      creatorCommission ?? '',
      order?.['预估运费'] || '',
      estimatedProfit ?? '',
      order?.['结算金额'] || '',
      actualProfit ?? '',
      order?.['重量'] || '',
      order?.['尺寸'] || '',
      order?.['订单状态'] || '',
      order?.['快递公司'] || '',
      order?.['快递单号'] || '',
      order?.['备注'] || ''
    ];
  });
}

function buildOrdersCsv({
  rows = [],
  headers = CSV_HEADERS,
  includeBom = false
}: BuildOrdersCsvOptions = {}): string {
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
  return includeBom ? `\uFEFF${csv}` : csv;
}

const OrderTrackerExport = {
  CSV_HEADERS,
  buildExportFilename,
  buildExportRows,
  buildOrdersCsv,
  csvEscape,
  getExportAccountOptions,
  selectOrdersForExport,
  toAccountSlot
};

export {
  OrderTrackerExport,
  CSV_HEADERS,
  buildExportFilename,
  buildExportRows,
  buildOrdersCsv,
  csvEscape,
  getExportAccountOptions,
  selectOrdersForExport,
  toAccountSlot
};
