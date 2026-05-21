import { derivePurchaseSummary } from '../orders/table.ts';
import type { OrderRecord } from '../orders/types.ts';
import type {
  FinanceFilters,
  FinanceRecord,
  FinanceRecordDraft,
  FinanceRecordKind,
  FinanceSummary,
  FinanceSummaryMetric
} from './types.ts';

const ACTUAL_INCOME_CATEGORY = 'TK提现';
const ACTUAL_INCOME_CATEGORIES = [
  ACTUAL_INCOME_CATEGORY,
  '其他回款',
  '押金退回'
] as const;
const DEPOSIT_HOLD_CATEGORY = '押金';
const DEPOSIT_PAID_CATEGORY = '押金扣除';
const DEPOSIT_RETURN_CATEGORY = '押金退回';
const PUBLIC_ACCOUNT_KEY = '__public__';
const PUBLIC_ACCOUNT_LABEL = '公共账';
const COST_CATEGORIES = [
  '开店成本',
  'IP成本',
  '投流成本',
  '软件订阅',
  '样品费',
  '手续费',
  DEPOSIT_HOLD_CATEGORY,
  DEPOSIT_PAID_CATEGORY,
  '其他'
] as const;
const FINANCE_RECORD_KINDS: FinanceRecordKind[] = ['actual_income', 'cost'];

type LooseRecord = Record<string, unknown>;

function toPlainObject(value: unknown): LooseRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as LooseRecord : {};
}

function todayStr(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function currentMonth(date = new Date()): string {
  return todayStr(date).slice(0, 7);
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeKind(value: unknown): FinanceRecordKind {
  return String(value || '').trim() === 'actual_income' ? 'actual_income' : 'cost';
}

function parseMoneyAmount(value: unknown): number | null {
  const raw = String(value ?? '').replace(/,/g, '').trim();
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function roundMoney(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}

function parseNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeDateText(value: unknown, fallback = todayStr()): string {
  const text = normalizeText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return text.replace(/\//g, '-');
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : fallback;
}

function getDefaultCategory(kind: FinanceRecordKind): string {
  if (kind === 'actual_income') return ACTUAL_INCOME_CATEGORY;
  return COST_CATEGORIES[0];
}

function normalizeCategory(kind: FinanceRecordKind, value: unknown): string {
  const text = normalizeText(value);
  if (kind === 'actual_income') return text || ACTUAL_INCOME_CATEGORY;
  return text || COST_CATEGORIES[0];
}

function createFinanceRecordDraft(kind: FinanceRecordKind = 'cost', options: Partial<FinanceRecordDraft> = {}): FinanceRecordDraft {
  const normalizedKind = normalizeKind(options.kind || kind);
  return {
    kind: normalizedKind,
    accountName: normalizeText(options.accountName),
    category: normalizeCategory(normalizedKind, options.category),
    amount: normalizeText(options.amount),
    occurredAt: normalizeDateText(options.occurredAt, todayStr()),
    note: normalizeText(options.note)
  };
}

function normalizeFinanceRecord(raw: unknown, options: { nowIso?: () => string; todayStr?: () => string } = {}): FinanceRecord {
  const data = toPlainObject(raw);
  const nowIso = options.nowIso || (() => new Date().toISOString());
  const fallbackToday = options.todayStr || todayStr;
  const kind = normalizeKind(data.kind);
  const amount = parseMoneyAmount(data.amount);
  const id = normalizeText(data.id) || uid();
  const createdAt = normalizeText(data.createdAt) || nowIso();
  return {
    id,
    kind,
    accountName: normalizeText(data.accountName),
    category: normalizeCategory(kind, data.category),
    amount: amount ?? 0,
    occurredAt: normalizeDateText(data.occurredAt, fallbackToday()),
    note: normalizeText(data.note),
    createdAt,
    updatedAt: normalizeText(data.updatedAt) || createdAt,
    deletedAt: normalizeText(data.deletedAt)
  };
}

function financeRecordToDraft(record: FinanceRecord | null, kind: FinanceRecordKind = 'cost'): FinanceRecordDraft {
  if (!record) return createFinanceRecordDraft(kind);
  const normalizedKind = getFinanceAccountingKind(record);
  return createFinanceRecordDraft(normalizedKind, {
    kind: normalizedKind,
    accountName: record.accountName,
    category: record.category,
    amount: String(record.amount || ''),
    occurredAt: record.occurredAt,
    note: record.note
  });
}

function getFinanceAccountingKind(record: Pick<FinanceRecord, 'kind' | 'category'> | Pick<FinanceRecordDraft, 'kind' | 'category'>): FinanceRecordKind {
  return normalizeKind(record?.kind);
}

function normalizeRecordAmount(value: unknown): number {
  return parseMoneyAmount(value) ?? 0;
}

function normalizeMonth(value: unknown): string {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}$/.test(text) ? text : '';
}

function parseLegacyUidTimestamp(id: unknown): number {
  const raw = normalizeText(id).toLowerCase();
  if (!/^[0-9a-z]{7,}$/.test(raw)) return 0;
  const prefix = raw.slice(0, -6);
  if (!prefix) return 0;
  const parsed = Number.parseInt(prefix, 36);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed < Date.parse('2020-01-01T00:00:00.000Z')) return 0;
  if (parsed > Date.parse('2100-01-01T00:00:00.000Z')) return 0;
  return parsed;
}

function getFinanceInputOrderTime(record: FinanceRecord): number {
  const createdAt = Date.parse(normalizeText(record?.createdAt));
  if (Number.isFinite(createdAt)) return createdAt;
  const fromId = parseLegacyUidTimestamp(record?.id);
  if (fromId) return fromId;
  const updatedAt = Date.parse(normalizeText(record?.updatedAt));
  return Number.isFinite(updatedAt) ? updatedAt : 0;
}

function compareFinanceInputOrder(left: FinanceRecord, right: FinanceRecord): number {
  const timeDiff = getFinanceInputOrderTime(left) - getFinanceInputOrderTime(right);
  if (timeDiff) return timeDiff;
  return String(left?.id || '').localeCompare(String(right?.id || ''));
}

function recordMatchesMonth(record: FinanceRecord, month = ''): boolean {
  const normalized = normalizeMonth(month);
  return !normalized || String(record?.occurredAt || '').startsWith(normalized);
}

function orderMatchesMonth(order: OrderRecord, month = ''): boolean {
  const normalized = normalizeMonth(month);
  if (!normalized) return true;
  const orderedAt = normalizeText(order?.['下单时间']);
  return orderedAt.startsWith(normalized);
}

function recordMatchesAccount(record: FinanceRecord, activeAccount = '__all__'): boolean {
  const account = normalizeText(activeAccount);
  if (!account || account === '__all__') return true;
  if (account === PUBLIC_ACCOUNT_KEY) return !normalizeText(record?.accountName);
  return normalizeText(record?.accountName) === account;
}

function orderMatchesAccount(order: OrderRecord, activeAccount = '__all__'): boolean {
  const account = normalizeText(activeAccount);
  if (!account || account === '__all__') return true;
  if (account === PUBLIC_ACCOUNT_KEY) return false;
  return normalizeText(order?.['账号']) === account;
}

function getDateSearchTokens(query = ''): string[] {
  return normalizeText(query)
    .split(/\s+/)
    .map(token => token.replace(/\//g, '-'))
    .filter(token => /^\d{4}-\d{1,2}(?:-\d{1,2})?$/.test(token))
    .map(token => token.split('-').map((part, index) => index === 0 ? part : part.padStart(2, '0')).join('-'));
}

function orderMatchesDateQuery(order: OrderRecord, query = ''): boolean {
  const tokens = getDateSearchTokens(query);
  if (!tokens.length) return true;
  const orderedAt = normalizeText(order?.['下单时间']).replace(/\//g, '-');
  return tokens.every(token => orderedAt.includes(token));
}

function getRecordSearchText(record: FinanceRecord): string {
  const kind = getFinanceAccountingKind(record);
  const kindText = {
    actual_income: '回款 提现 到账 真实收入 收入',
    cost: '成本 支出 押金扣除'
  }[kind] || '成本 支出';
  return [
    kindText,
    record.accountName || PUBLIC_ACCOUNT_LABEL,
    record.category,
    record.amount,
    record.occurredAt,
    record.note
  ].join(' ').toLowerCase();
}

function recordMatchesQuery(record: FinanceRecord, query = ''): boolean {
  const tokens = normalizeText(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = getRecordSearchText(record);
  return tokens.every(token => haystack.includes(token));
}

function filterFinanceRecords(records: FinanceRecord[] = [], filters: FinanceFilters = {}): FinanceRecord[] {
  const source = Array.isArray(records) ? records : [];
  return source
    .filter(record => !record.deletedAt)
    .filter(record => recordMatchesAccount(record, filters.activeAccount))
    .filter(record => recordMatchesMonth(record, filters.month))
    .filter(record => recordMatchesQuery(record, filters.query))
    .sort(compareFinanceInputOrder);
}

function filterFinanceOrders(orders: OrderRecord[] = [], filters: FinanceFilters = {}): OrderRecord[] {
  const source = Array.isArray(orders) ? orders : [];
  return source
    .filter(order => !order.deletedAt)
    .filter(order => orderMatchesAccount(order, filters.activeAccount))
    .filter(order => orderMatchesMonth(order, filters.month))
    .filter(order => orderMatchesDateQuery(order, filters.query));
}

function sumFinanceRecords(records: FinanceRecord[] = [], kind: FinanceRecordKind): FinanceSummaryMetric {
  return records.reduce<FinanceSummaryMetric>((acc, record) => {
    if (getFinanceAccountingKind(record) !== kind) return acc;
    return {
      total: roundMoney(acc.total + normalizeRecordAmount(record.amount)),
      count: acc.count + 1
    };
  }, { total: 0, count: 0 });
}

function sumFinanceRecordCategory(records: FinanceRecord[] = [], kind: FinanceRecordKind, category = ''): FinanceSummaryMetric {
  const normalizedCategory = normalizeText(category);
  return records.reduce<FinanceSummaryMetric>((acc, record) => {
    if (getFinanceAccountingKind(record) !== kind) return acc;
    if (normalizeText(record.category) !== normalizedCategory) return acc;
    return {
      total: roundMoney(acc.total + normalizeRecordAmount(record.amount)),
      count: acc.count + 1
    };
  }, { total: 0, count: 0 });
}

function deriveFinanceSummary({
  records = [],
  orders = [],
  activeAccount = '__all__',
  month = '',
  query = '',
  exchangeRate = null,
  labelFee = 0
}: FinanceFilters & {
  records?: FinanceRecord[];
  orders?: OrderRecord[];
  exchangeRate?: unknown;
  labelFee?: unknown;
} = {}): FinanceSummary {
  const filteredRecords = filterFinanceRecords(records, { activeAccount, month, query });
  const filteredOrders = filterFinanceOrders(orders, { activeAccount, month, query });
  const purchaseSummary = derivePurchaseSummary({
    orders: filteredOrders,
    activeAccount: '__all__',
    exchangeRate
  });
  const actualIncome = sumFinanceRecords(filteredRecords, 'actual_income');
  const rawCosts = sumFinanceRecords(filteredRecords, 'cost');
  const depositsHeld = sumFinanceRecordCategory(filteredRecords, 'cost', DEPOSIT_HOLD_CATEGORY);
  const depositsDeducted = sumFinanceRecordCategory(filteredRecords, 'cost', DEPOSIT_PAID_CATEGORY);
  const depositsReturned = sumFinanceRecordCategory(filteredRecords, 'actual_income', DEPOSIT_RETURN_CATEGORY);
  const depositLosses = depositsDeducted;
  const repaymentIncome = {
    total: roundMoney(actualIncome.total - depositsReturned.total),
    count: Math.max(0, actualIncome.count - depositsReturned.count)
  };
  const costs = {
    total: roundMoney(rawCosts.total - depositsHeld.total),
    count: Math.max(0, rawCosts.count - depositsHeld.count)
  };
  const estimatedIncome = {
    total: roundMoney(purchaseSummary.filteredProfitMetric.total),
    count: purchaseSummary.filteredProfitMetric.count || filteredOrders.length
  };
  const orderPurchaseCost = {
    total: roundMoney(purchaseSummary.filteredPurchaseMetric.total),
    count: purchaseSummary.filteredPurchaseMetric.count
  };
  const orderLabelFee = {
    total: roundMoney(filteredOrders.length * parseNonNegativeNumber(labelFee, 0)),
    count: filteredOrders.length
  };
  const cashOrderCost = {
    total: roundMoney(orderPurchaseCost.total + orderLabelFee.total),
    count: Math.max(orderPurchaseCost.count, orderLabelFee.count)
  };
  const depositBalance = roundMoney(depositsHeld.total - depositsReturned.total - depositsDeducted.total);
  return {
    estimatedIncome,
    actualIncome,
    repaymentIncome,
    costs,
    orderPurchaseCost,
    orderLabelFee,
    cashOrderCost,
    depositsPaid: depositsHeld,
    depositsReturned,
    depositLosses,
    estimatedNetProfit: roundMoney(estimatedIncome.total - costs.total),
    cashNetProfit: roundMoney(repaymentIncome.total - cashOrderCost.total - costs.total),
    pendingIncome: roundMoney(estimatedIncome.total - repaymentIncome.total),
    depositBalance,
    orderCount: filteredOrders.length
  };
}

function formatFinanceMoney(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return `¥${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatCompactFinanceMoney(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return `¥${amount.toFixed(2).replace(/\.?0+$/, '')}`;
}

const FinanceSummaryCore = {
  ACTUAL_INCOME_CATEGORY,
  ACTUAL_INCOME_CATEGORIES,
  COST_CATEGORIES,
  DEPOSIT_HOLD_CATEGORY,
  DEPOSIT_PAID_CATEGORY,
  DEPOSIT_RETURN_CATEGORY,
  FINANCE_RECORD_KINDS,
  PUBLIC_ACCOUNT_KEY,
  PUBLIC_ACCOUNT_LABEL,
  createFinanceRecordDraft,
  currentMonth,
  deriveFinanceSummary,
  filterFinanceOrders,
  filterFinanceRecords,
  financeRecordToDraft,
  formatCompactFinanceMoney,
  formatFinanceMoney,
  getFinanceAccountingKind,
  compareFinanceInputOrder,
  getFinanceInputOrderTime,
  getDefaultCategory,
  sumFinanceRecordCategory,
  normalizeFinanceRecord,
  normalizeKind,
  parseMoneyAmount,
  todayStr
};

export {
  ACTUAL_INCOME_CATEGORY,
  ACTUAL_INCOME_CATEGORIES,
  COST_CATEGORIES,
  DEPOSIT_HOLD_CATEGORY,
  DEPOSIT_PAID_CATEGORY,
  DEPOSIT_RETURN_CATEGORY,
  FINANCE_RECORD_KINDS,
  PUBLIC_ACCOUNT_KEY,
  PUBLIC_ACCOUNT_LABEL,
  FinanceSummaryCore,
  createFinanceRecordDraft,
  currentMonth,
  deriveFinanceSummary,
  filterFinanceOrders,
  filterFinanceRecords,
  financeRecordToDraft,
  formatCompactFinanceMoney,
  formatFinanceMoney,
  getFinanceAccountingKind,
  compareFinanceInputOrder,
  getFinanceInputOrderTime,
  getDefaultCategory,
  sumFinanceRecordCategory,
  normalizeFinanceRecord,
  normalizeKind,
  parseMoneyAmount,
  todayStr
};
