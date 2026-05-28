import {
  PUBLIC_ACCOUNT_KEY,
  PUBLIC_ACCOUNT_LABEL,
  filterFinanceRecords,
  getFinanceAccountingKind,
  todayStr
} from './summary.ts';
import type { FinanceFilters, FinanceRecord, FinanceRecordKind } from './types.ts';

const FINANCE_CSV_HEADERS = ['日期', '类型', '账号', '类别', '金额(¥)', '备注', '创建时间', '更新时间'];

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizeAccountName(value: unknown): string {
  return String(value || '').trim();
}

function formatInputAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return amount.toFixed(2).replace(/\.?0+$/, '');
}

function getFinanceAccountLabel(value: unknown): string {
  return normalizeAccountName(value) || PUBLIC_ACCOUNT_LABEL;
}

function getRecordKindLabel(kind: FinanceRecordKind) {
  const labels: Record<FinanceRecordKind, string> = {
    actual_income: '回款',
    cost: '成本'
  };
  return labels[kind] || '成本';
}

function buildFinanceExportRows(records: FinanceRecord[] = [], filters: FinanceFilters = {}) {
  return filterFinanceRecords(records, filters).map(record => [
    record.occurredAt || '',
    getRecordKindLabel(getFinanceAccountingKind(record)),
    getFinanceAccountLabel(record.accountName),
    record.category || '',
    formatInputAmount(record.amount),
    record.note || '',
    record.createdAt || '',
    record.updatedAt || ''
  ]);
}

function buildFinanceCsv(rows: unknown[][] = [], { includeBom = false } = {}) {
  const csv = [FINANCE_CSV_HEADERS, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
  return includeBom ? `\uFEFF${csv}` : csv;
}

function buildFinanceExportFilename(activeAccount = '__all__', monthOrQuery = '') {
  const accountPart = activeAccount === '__all__'
    ? '全部'
    : activeAccount === PUBLIC_ACCOUNT_KEY
      ? PUBLIC_ACCOUNT_LABEL
      : activeAccount;
  const monthPart = String(monthOrQuery || '').trim().replace(/[\\/:*?"<>|]+/g, '_') || '全部月份';
  return `收支记录_${accountPart}_${monthPart}_${todayStr()}.csv`;
}

export {
  FINANCE_CSV_HEADERS,
  buildFinanceCsv,
  buildFinanceExportFilename,
  buildFinanceExportRows,
  csvEscape,
  formatInputAmount,
  getFinanceAccountLabel,
  getRecordKindLabel
};
