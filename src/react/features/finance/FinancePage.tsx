import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormRow } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ModuleListState } from '@/components/ui/module-list-state';
import { ModuleHeader, ModuleWorkspace } from '@/components/ui/module-workspace';
import { Select } from '@/components/ui/select';
import { refreshButtonClass, statusStripClass, statusStripLeftClass, syncStatusClass } from '@/components/ui/status-strip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableFrame, TablePager, TableSearch, TableSortButton, TableToolbar, TableViewport } from '@/components/ui/table-tools';
import { Textarea } from '@/components/ui/textarea';
import { showAppToast } from '@/app/toast';
import { cn } from '@/lib/utils';
import { useStaleAutoRefresh } from '@/lib/stale-auto-refresh';
import { AccountTabsBar } from '@/components/ui/account-tabs-bar';
import { TKFirestoreConnection } from '../../../firestore-connection.ts';
import { buildFirestoreSyncStatus } from '../../../firestore-sync-status.ts';
import {
  formatFirestoreRulesUpdateMessage,
  isPermissionDenied
} from '../../../firestore-rules-compatibility.ts';
import { SETTINGS_CHANGED_EVENT, ensureGlobalSettingsStore } from '../../../global-settings.ts';
import { FinanceProviderFirestore } from '../../../finance/provider-firestore.ts';
import {
  ACTUAL_INCOME_CATEGORIES,
  COST_CATEGORIES,
  PUBLIC_ACCOUNT_KEY,
  PUBLIC_ACCOUNT_LABEL,
  createFinanceRecordDraft,
  deriveFinanceSummary,
  filterFinanceRecords,
  financeRecordToDraft,
  formatCompactFinanceMoney,
  formatFinanceMoney,
  getFinanceAccountingKind,
  getDefaultCategory,
  normalizeKind,
  parseMoneyAmount,
  todayStr
} from '../../../finance/summary.ts';
import {
  getFinanceAccountLabel,
  getRecordKindLabel
} from '../../../finance/export.ts';
import { CalendarDays, HelpCircle, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FinanceRecord, FinanceRecordDraft, FinanceRecordKind } from '../../../finance/types.ts';
import type { OrderRecord } from '../../../orders/types.ts';

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
const ACCOUNT_UPDATED_EVENT = 'tk-accounts-changed';
const LS_KEY = 'tk.finance.runtime.v1';
const financeSummarySurfaceClass = 'finance-summary-surface mb-4 rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(110,168,255,.07),rgba(138,255,207,.04))] px-0 py-[18px] max-[768px]:p-4';
const financeSummaryGridClass = 'finance-summary-grid relative grid grid-cols-2 gap-0 after:pointer-events-none after:absolute after:bottom-1.5 after:left-1/2 after:top-1.5 after:w-px after:-translate-x-1/2 after:bg-[color-mix(in_srgb,var(--border)_86%,white)] max-[768px]:grid-cols-1 max-[768px]:gap-3.5 max-[768px]:after:hidden max-[640px]:gap-3';
const financeSummarySectionClass = 'finance-summary-section min-w-0 px-[38px] pb-0.5 pt-1 max-[768px]:px-0 max-[768px]:py-0 [&+&]:border-l-0 max-[768px]:[&+&]:border-t max-[768px]:[&+&]:border-[color-mix(in_srgb,var(--border)_86%,white)] max-[768px]:[&+&]:pt-4';
const financeSummaryHeadClass = 'finance-summary-head flex items-start justify-between gap-3 max-[768px]:flex-col max-[768px]:gap-1';
const financeSummaryLabelClass = 'finance-summary-label text-[11.5px] font-semibold uppercase tracking-[.7px] text-[var(--muted)]';
const financeSummaryMetaClass = 'finance-summary-meta-inline text-right text-xs leading-[1.45] text-[var(--muted)] max-[768px]:text-left';
const financeSummaryHeroClass = 'finance-summary-hero mt-[18px] flex items-end justify-between gap-4 border-l-[3px] border-[color-mix(in_srgb,var(--accent)_50%,var(--border))] pl-4';
const financeSummaryHeroTitleClass = 'finance-summary-hero-title flex min-w-0 flex-wrap items-center gap-1.5';
const financeSummaryHeroLabelClass = 'finance-summary-hero-label block flex-1 text-[13px] leading-normal text-[color-mix(in_srgb,var(--muted)_86%,var(--text))]';
const financeSummaryHeroValueClass = 'finance-summary-hero-value block flex-none text-right text-3xl font-extrabold leading-[1.05] tracking-normal text-[var(--text)] max-[640px]:text-[22px]';
const financeSummaryDepositSwitchClass = 'relative inline-flex h-6 w-[70px] items-center rounded-full border px-[8px] text-[10.5px] font-semibold leading-none shadow-[inset_0_0_0_1px_rgba(255,255,255,.38)] transition-[background,border-color,color,box-shadow] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(110,168,255,.22)]';
const financeSummaryDepositDividerClass = 'pointer-events-none absolute bottom-[4px] left-[34px] top-[4px] w-px transition-[background]';
const financeSummaryDepositKnobClass = 'pointer-events-none absolute top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,.22)] transition-[left]';
const financeSummaryLedgerClass = 'finance-summary-ledger mt-[18px] grid grid-cols-3 gap-x-9 gap-y-3 border-t border-[color-mix(in_srgb,var(--border)_82%,white)] pt-3.5 max-[1100px]:gap-x-5 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1';
const financeSummaryLedgerItemClass = 'finance-summary-ledger-item min-w-0';
const financeSummaryLedgerLabelClass = 'finance-summary-ledger-label block text-[10.5px] uppercase tracking-[.18em] text-[var(--muted)]';
const financeSummaryLedgerValueClass = 'finance-summary-ledger-value mt-[7px] block text-lg font-bold leading-[1.15] text-[var(--text)]';
const financeSummaryLedgerNoteClass = 'finance-summary-ledger-note mt-[7px] block whitespace-nowrap text-[10.5px] leading-[1.35] tracking-normal text-[var(--muted)]';
const financeSummaryCashLedgerClass = 'finance-summary-ledger finance-summary-cash-ledger mt-[18px] grid grid-cols-4 gap-x-5 gap-y-3 border-t border-[color-mix(in_srgb,var(--border)_82%,white)] pt-3.5 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1';
const financeSummaryCashLedgerLabelClass = 'finance-summary-ledger-label block text-[10px] uppercase tracking-[.14em] text-[var(--muted)]';
const financeSummaryCashLedgerValueClass = 'finance-summary-ledger-value mt-[6px] block text-[16px] font-bold leading-[1.12] text-[var(--text)]';
const financeSummaryCashLedgerNoteClass = 'finance-summary-ledger-note mt-[5px] block text-[10px] leading-[1.3] tracking-normal text-[var(--muted)]';
const financeActionsClass = 'inline-flex min-w-[78px] items-center justify-end gap-3';
const financeContentClass = 'finance-content mt-4';
const financeTableFrameClass = 'finance-table-frame block w-full pl-0.5 pr-0.5';
const financeTableClass = 'finance-react-table mt-1.5 w-full min-w-[920px] table-fixed text-[13px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap [&_tbody_tr:hover]:bg-[rgba(110,168,255,.05)] max-[768px]:text-[13px] max-[768px]:[&_td]:px-1.5 max-[768px]:[&_td]:py-[9px] max-[768px]:[&_th]:px-1.5 max-[768px]:[&_th]:py-[9px] max-[768px]:[&_th]:text-[10.5px]';
const amountPositiveClass = 'font-semibold text-[color-mix(in_srgb,var(--ok)_90%,var(--text))]';
const amountNegativeClass = 'font-semibold text-[color-mix(in_srgb,var(--danger)_88%,var(--text))]';
const financeSetupCardClass = 'min-h-[300px]';
const modalCopyClass = 'mb-4 text-[13px] leading-[1.75] text-[var(--muted)]';
type FinanceDateInputProps = ComponentProps<typeof Input>;

const financeDateInputWrapClass = 'relative w-full';
const financeDateInputClass = 'cursor-pointer pr-11 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:my-auto [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0';
const financeDateInputIconClass = 'pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text)]';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getRuntimeClientId() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (saved?.clientId) return String(saved.clientId);
    const clientId = uid();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...(saved || {}), clientId }));
    return clientId;
  } catch (error) {
    return uid();
  }
}

function nowIso() {
  return new Date().toISOString();
}

function readGlobalConfig() {
  return TKFirestoreConnection.getConfig() || null;
}

function showToast(message: string, type: 'ok' | 'error' = 'ok') {
  showAppToast(message, type);
}

function showNativeDatePicker(input: HTMLInputElement) {
  const showPicker = (input as HTMLInputElement & { showPicker?: () => void }).showPicker;
  if (typeof showPicker !== 'function') {
    input.focus();
    return;
  }
  try {
    showPicker.call(input);
  } catch {
    input.focus();
  }
}

function FinanceDateInput({ className, onClick, ...props }: FinanceDateInputProps) {
  return (
    <div className={financeDateInputWrapClass}>
      <Input
        {...props}
        type="date"
        className={cn(financeDateInputClass, className)}
        onClick={event => {
          onClick?.(event);
          if (event.defaultPrevented || event.currentTarget.readOnly || event.currentTarget.disabled) return;
          showNativeDatePicker(event.currentTarget);
        }}
      />
      <CalendarDays className={financeDateInputIconClass} size={18} strokeWidth={2} aria-hidden="true" />
    </div>
  );
}

function normalizeAccountName(value: unknown) {
  return String(value || '').trim();
}

function uniqueAccounts(values: unknown[] = []) {
  return [...new Set(values.map(normalizeAccountName).filter(Boolean))];
}

function clampPage(currentPage: number, pageSize: number, totalItems: number) {
  const safePageSize = Math.max(1, Number(pageSize) || 50);
  const totalPages = Math.max(1, Math.ceil((totalItems || 0) / safePageSize));
  const nextCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
  return { currentPage: nextCurrentPage, totalPages, pageSize: safePageSize };
}

function getFinanceDisplaySeq(absoluteIndex: number, total: number, sortOrder: string): number {
  return sortOrder === 'asc' ? absoluteIndex + 1 : total - absoluteIndex;
}

function getRecordKindTone(kind: FinanceRecordKind) {
  if (kind === 'actual_income') return 'success';
  return 'danger';
}

function getAmountToneClass(kind: FinanceRecordKind) {
  return kind === 'actual_income' ? amountPositiveClass : amountNegativeClass;
}

function buildRecordPayload({
  draft,
  previous,
  id
}: {
  draft: FinanceRecordDraft;
  previous?: FinanceRecord | null;
  id?: string;
}): FinanceRecord {
  const kind = normalizeKind(draft.kind);
  const amount = parseMoneyAmount(draft.amount);
  const updatedAt = nowIso();
  return {
    id: previous?.id || id || uid(),
    kind,
    accountName: normalizeAccountName(draft.accountName),
    category: draft.category || getDefaultCategory(kind),
    amount: amount ?? 0,
    occurredAt: draft.occurredAt || todayStr(),
    note: String(draft.note || '').trim(),
    createdAt: previous?.createdAt || updatedAt,
    updatedAt
  };
}

function FinanceSummaryView({
  records,
  orders,
  activeAccount,
  month,
  query,
  exchangeRate
}: {
  records: FinanceRecord[];
  orders: OrderRecord[];
  activeAccount: string;
  month: string;
  query: string;
  exchangeRate: number | null;
}) {
  const pricingContext = ensureGlobalSettingsStore().getPricingContext();
  const summary = useMemo(() => deriveFinanceSummary({
    records,
    orders,
    activeAccount,
    month,
    query,
    exchangeRate,
    platformFeeRate: pricingContext.platformFeeRate,
    labelFee: pricingContext.labelFee
  }), [activeAccount, exchangeRate, month, orders, pricingContext.labelFee, pricingContext.platformFeeRate, query, records]);
  const rangeText = query.trim() ? '按搜索筛选' : '全部月份';
  const [includeDeposit, setIncludeDeposit] = useState(false);
  const estimatedNetValue = includeDeposit
    ? summary.estimatedNetProfit - summary.depositBalance
    : summary.estimatedNetProfit;
  const cashNetValue = includeDeposit
    ? summary.cashNetProfit - summary.depositBalance
    : summary.cashNetProfit;

  function heroClass(value: number) {
    if (value > 0) return cn(financeSummaryHeroClass, 'border-[color-mix(in_srgb,var(--ok)_82%,var(--border))]');
    if (value < 0) return cn(financeSummaryHeroClass, 'border-[color-mix(in_srgb,var(--expense)_84%,var(--border))]');
    return financeSummaryHeroClass;
  }

  function heroValueClass(value: number) {
    if (value > 0) return cn(financeSummaryHeroValueClass, 'text-[var(--ok)]');
    if (value < 0) return cn(financeSummaryHeroValueClass, 'text-[var(--expense)]');
    return financeSummaryHeroValueClass;
  }

  function ledgerValueClass(
    value: number,
    tone: 'income' | 'expense' | 'neutral' = 'neutral',
    baseClass = financeSummaryLedgerValueClass
  ) {
    if (tone === 'income') return cn(baseClass, 'text-[var(--ok)]');
    if (tone === 'expense') return cn(baseClass, 'text-[var(--expense)]');
    if (value > 0) return cn(baseClass, 'text-[var(--ok)]');
    if (value < 0) return cn(baseClass, 'text-[var(--expense)]');
    return baseClass;
  }

  const costNote = `运营成本 · ${summary.costs.count} 条`;
  const cashOrderCostNote = `采购价 ${formatCompactFinanceMoney(summary.orderPurchaseCost.total)} / 贴单费 ${formatCompactFinanceMoney(summary.orderLabelFee.total)}`;
  const depositNote = `支${formatCompactFinanceMoney(summary.depositsPaid.total)} / 退${formatCompactFinanceMoney(summary.depositsReturned.total)}`;
  function renderDepositSwitch() {
    return (
      <button
        type="button"
        className={cn(
          financeSummaryDepositSwitchClass,
          includeDeposit
            ? 'border-[color-mix(in_srgb,var(--danger)_44%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--panel))] text-[var(--danger)]'
            : 'border-[var(--border)] bg-[var(--panel2)] text-[var(--muted)]'
        )}
        role="switch"
        aria-checked={includeDeposit}
        aria-label={includeDeposit ? '当前净额包含押金占用，点击切换为不含押金' : '当前净额不包含押金占用，点击切换为含押金'}
        onClick={() => setIncludeDeposit(value => !value)}
      >
        <span>押金</span>
        <span className={cn(financeSummaryDepositDividerClass, includeDeposit ? 'bg-[color-mix(in_srgb,var(--danger)_38%,white)]' : 'bg-[color-mix(in_srgb,var(--muted)_28%,white)]')} aria-hidden="true" />
        <span className={cn(financeSummaryDepositKnobClass, includeDeposit ? 'left-[48px]' : 'left-[37px]')} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className={financeSummarySurfaceClass} data-finance-summary>
      <div className={financeSummaryGridClass}>
        <section className={financeSummarySectionClass}>
          <div className={financeSummaryHeadClass}>
            <div className={financeSummaryLabelClass}>预估口径</div>
            <div className={financeSummaryMetaClass}>来自订单管理预估利润 · {summary.orderCount} 单 · {rangeText}</div>
          </div>
          <div className={heroClass(estimatedNetValue)}>
            <span className={financeSummaryHeroTitleClass}>
              <span className={financeSummaryHeroLabelClass}>预估净利润</span>
              {renderDepositSwitch()}
            </span>
            <strong className={heroValueClass(estimatedNetValue)}>{formatFinanceMoney(estimatedNetValue)}</strong>
          </div>
          <div className={financeSummaryLedgerClass}>
            <div className={financeSummaryLedgerItemClass}>
              <span className={financeSummaryLedgerLabelClass}>预估收入</span>
              <strong className={ledgerValueClass(summary.estimatedIncome.total, 'income')}>{formatFinanceMoney(summary.estimatedIncome.total)}</strong>
              <span className={financeSummaryLedgerNoteClass}>订单管理预估利润</span>
            </div>
            <div className={financeSummaryLedgerItemClass}>
              <span className={financeSummaryLedgerLabelClass}>运营成本</span>
              <strong className={ledgerValueClass(summary.costs.total, 'expense')}>{formatFinanceMoney(summary.costs.total)}</strong>
              <span className={financeSummaryLedgerNoteClass}>{costNote}</span>
            </div>
            <div className={financeSummaryLedgerItemClass}>
              <span className={financeSummaryLedgerLabelClass}>押金占用</span>
              <strong className={ledgerValueClass(summary.depositBalance, 'expense')}>{formatFinanceMoney(summary.depositBalance)}</strong>
              <span className={financeSummaryLedgerNoteClass}>{depositNote}</span>
            </div>
          </div>
        </section>
        <section className={financeSummarySectionClass}>
          <div className={financeSummaryHeadClass}>
            <div className={financeSummaryLabelClass}>真实口径</div>
            <div className={financeSummaryMetaClass}>按实际到账计算，押金可切换计入净额</div>
          </div>
          <div className={heroClass(cashNetValue)}>
            <span className={financeSummaryHeroTitleClass}>
              <span className={financeSummaryHeroLabelClass}>实际净额</span>
              {renderDepositSwitch()}
            </span>
            <strong className={heroValueClass(cashNetValue)}>{formatFinanceMoney(cashNetValue)}</strong>
          </div>
          <div className={financeSummaryCashLedgerClass}>
            <div className={financeSummaryLedgerItemClass}>
              <span className={financeSummaryCashLedgerLabelClass}>回款</span>
              <strong className={ledgerValueClass(summary.repaymentIncome.total, 'income', financeSummaryCashLedgerValueClass)}>{formatFinanceMoney(summary.repaymentIncome.total)}</strong>
              <span className={financeSummaryCashLedgerNoteClass}>TK 结算已扣运费 · {summary.repaymentIncome.count} 条</span>
            </div>
            <div className={financeSummaryLedgerItemClass}>
              <span className={financeSummaryCashLedgerLabelClass}>订单成本</span>
              <strong className={ledgerValueClass(summary.cashOrderCost.total, 'expense', financeSummaryCashLedgerValueClass)}>{formatFinanceMoney(summary.cashOrderCost.total)}</strong>
              <span className={financeSummaryCashLedgerNoteClass}>{cashOrderCostNote}</span>
            </div>
            <div className={financeSummaryLedgerItemClass}>
              <span className={financeSummaryCashLedgerLabelClass}>运营成本</span>
              <strong className={ledgerValueClass(summary.costs.total, 'expense', financeSummaryCashLedgerValueClass)}>{formatFinanceMoney(summary.costs.total)}</strong>
              <span className={financeSummaryCashLedgerNoteClass}>{costNote}</span>
            </div>
            <div className={financeSummaryLedgerItemClass}>
              <span className={financeSummaryCashLedgerLabelClass}>押金占用</span>
              <strong className={ledgerValueClass(summary.depositBalance, 'expense', financeSummaryCashLedgerValueClass)}>{formatFinanceMoney(summary.depositBalance)}</strong>
              <span className={financeSummaryCashLedgerNoteClass}>{depositNote}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FinancePager({
  pageSize,
  currentPage,
  totalPages,
  onPageSizeChange,
  onPageChange
}: {
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onPageSizeChange: (value: number) => void;
  onPageChange: (delta: number) => void;
}) {
  return (
    <TablePager
      className="finance-pager max-[640px]:w-full max-[640px]:justify-start"
      pageSize={pageSize}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageSizeChange={onPageSizeChange}
      onPageChange={onPageChange}
    />
  );
}

function FinanceTable({
  records,
  activeAccount,
  month,
  searchQuery,
  sortOrder,
  pageSize,
  currentPage,
  onSearchChange,
  onPageSizeChange,
  onPageChange,
  onSortToggle,
  onEdit,
  onDelete
}: {
  records: FinanceRecord[];
  activeAccount: string;
  month: string;
  searchQuery: string;
  sortOrder: string;
  pageSize: number;
  currentPage: number;
  onSearchChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  onPageChange: (delta: number) => void;
  onSortToggle: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const filtered = useMemo(() => {
    const next = filterFinanceRecords(records, { activeAccount, month, query: searchQuery });
    return sortOrder === 'asc' ? next : [...next].reverse();
  }, [activeAccount, month, records, searchQuery, sortOrder]);
  const pageState = clampPage(currentPage, pageSize, filtered.length);
  const startIndex = (pageState.currentPage - 1) * pageState.pageSize;
  const paged = filtered.slice(startIndex, startIndex + pageState.pageSize);
  const sortIcon = sortOrder === 'asc' ? '↑' : '↓';
  const sortTitle = sortOrder === 'asc' ? '按输入顺序正序，点击切换为倒序' : '按输入顺序倒序，点击切换为正序';

  return (
    <>
      <TableToolbar
        left={(
          <div className="inline-flex min-w-0 flex-wrap items-center gap-2 max-[768px]:w-full">
            <TableSearch
              id="finance-search"
              hint="搜索日期 / 类别 / 备注 / 金额"
              value={searchQuery}
              onChange={onSearchChange}
            />
          </div>
        )}
        right={(
          <div className="inline-flex flex-wrap items-center gap-4 max-[768px]:gap-3">
            <TableSortButton id="finance-sort-btn" className="finance-sort" title={sortTitle} onClick={onSortToggle}>
              排序 {sortIcon}
            </TableSortButton>
            <FinancePager pageSize={pageState.pageSize} currentPage={pageState.currentPage} totalPages={pageState.totalPages} onPageSizeChange={onPageSizeChange} onPageChange={onPageChange} />
          </div>
        )}
      />
      <TableViewport>
        {!filtered.length ? (
          <ModuleListState
            tone="empty"
            title={searchQuery ? '没有匹配的收支记录' : '还没有收支记录'}
            description={searchQuery ? '试试更换关键词' : '点击右上角新增收支记录'}
          />
        ) : (
          <TableFrame className={financeTableFrameClass}>
            <Table className={financeTableClass}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[64px]">#</TableHead>
                  <TableHead className="w-[150px]">账号</TableHead>
                  <TableHead className="w-[150px]">日期</TableHead>
                  <TableHead className="w-[140px]">金额(¥)</TableHead>
                  <TableHead className="w-[128px]">类型</TableHead>
                  <TableHead className="w-[160px]">类别</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="w-[150px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((record, index) => {
                  const absoluteIndex = startIndex + index;
                  const seqNum = getFinanceDisplaySeq(absoluteIndex, filtered.length, sortOrder);
                  const accountingKind = getFinanceAccountingKind(record);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="text-[var(--muted)]">{seqNum}</TableCell>
                      <TableCell><Badge>{getFinanceAccountLabel(record.accountName)}</Badge></TableCell>
                      <TableCell>{record.occurredAt || '-'}</TableCell>
                      <TableCell className={getAmountToneClass(accountingKind)}>{formatCompactFinanceMoney(record.amount)}</TableCell>
                      <TableCell><Badge variant={getRecordKindTone(accountingKind)}>{getRecordKindLabel(accountingKind)}</Badge></TableCell>
                      <TableCell>{record.category || '-'}</TableCell>
                      <TableCell className="max-w-[260px] truncate" title={record.note}>{record.note || '-'}</TableCell>
                      <TableCell>
                        <div className={financeActionsClass}>
                          <Button size="smIcon" data-edit={record.id} title="编辑记录" aria-label="编辑记录" onClick={() => onEdit(record.id)}>
                            <Pencil size={14} strokeWidth={2} />
                          </Button>
                          <Button size="smIcon" variant="danger" data-del={record.id} title="删除记录" aria-label="删除记录" onClick={() => onDelete(record.id)}>
                            <Trash2 size={14} strokeWidth={2} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableFrame>
        )}
      </TableViewport>
    </>
  );
}

function RecordDialog({
  accounts,
  draft,
  editingId,
  open,
  onDraftChange,
  onOpenChange,
  onSubmit
}: {
  accounts: string[];
  draft: FinanceRecordDraft;
  editingId: string;
  open: boolean;
  onDraftChange: (patch: Partial<FinanceRecordDraft>) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  const kind = normalizeKind(draft.kind);
  const categories = kind === 'actual_income' ? ACTUAL_INCOME_CATEGORIES : COST_CATEGORIES;
  return (
    <Dialog id="finance-record-modal" open={open} titleId="finance-record-title" onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px]">
        <DialogTitle id="finance-record-title">{editingId ? '编辑收支记录' : '新增收支记录'}</DialogTitle>
        <p className={modalCopyClass}>预估收入来自订单利润。成本类别里的押金表示占用，不算运营成本；押金扣除表示罚扣或损失，会算入运营成本。</p>
        <FormRow columns={2}>
          <FormField label="类型" htmlFor="finance-record-kind">
            <Select
              id="finance-record-kind"
              value={kind}
              onChange={event => {
                const nextKind = normalizeKind(event.target.value);
                onDraftChange({
                  kind: nextKind,
                  category: getDefaultCategory(nextKind)
                });
              }}
            >
              <option value="cost">成本</option>
              <option value="actual_income">回款</option>
            </Select>
          </FormField>
          <FormField label="账号" htmlFor="finance-record-account" hint="公共账只计入全部，不归属任何账号">
            <Select id="finance-record-account" value={draft.accountName} onChange={event => onDraftChange({ accountName: event.target.value })}>
              <option value="">{PUBLIC_ACCOUNT_LABEL}</option>
              {accounts.map(account => <option value={account} key={account}>{account}</option>)}
            </Select>
          </FormField>
          <FormField label="日期" htmlFor="finance-record-date">
            <FinanceDateInput id="finance-record-date" value={draft.occurredAt} onChange={event => onDraftChange({ occurredAt: event.target.value })} />
          </FormField>
          <FormField label="金额（¥）" htmlFor="finance-record-amount">
            <Input
              id="finance-record-amount"
              inputMode="decimal"
              value={draft.amount}
              onChange={event => onDraftChange({ amount: event.target.value })}
            />
          </FormField>
          <FormField label="类别" htmlFor="finance-record-category">
            <Select id="finance-record-category" value={draft.category} onChange={event => onDraftChange({ category: event.target.value })}>
              {categories.map(category => <option value={category} key={category}>{category}</option>)}
            </Select>
          </FormField>
          <FormField label="备注" htmlFor="finance-record-note" full>
            <Textarea
              id="finance-record-note"
              rows={4}
              value={draft.note}
              placeholder="例如：5 月广告投流、店铺押金、押金扣除、押金退回、平台提现到账"
              onChange={event => onDraftChange({ note: event.target.value })}
            />
          </FormField>
        </FormRow>
        <DialogActions>
          <Button onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="primary" onClick={onSubmit}>{editingId ? '保存修改' : '新增记录'}</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

function FinanceHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog id="finance-help-modal" open={open} titleId="finance-help-title" onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px]">
        <DialogTitle id="finance-help-title">收支口径说明</DialogTitle>
        <div className="space-y-3 text-[13px] leading-[1.75] text-[var(--muted)]">
          <p><strong className="text-[var(--text)]">预估收入</strong> 直接取订单管理当前筛选范围内的预估利润，口径等同于订单页利润汇总。</p>
          <p><strong className="text-[var(--text)]">运营成本</strong> 是订单外真实成本，例如开店成本、IP 成本、投流成本、手续费、押金扣除和其他；押金本身只是占用，不算运营成本。</p>
          <p><strong className="text-[var(--text)]">押金占用</strong> = 成本里的押金 - 回款里的押金退回 - 成本里的押金扣除，用来观察仍被占用的押金金额。</p>
          <p><strong className="text-[var(--text)]">真实口径</strong> = TK 提现回款 - 订单成本 - 运营成本；订单成本由采购价和当前全局贴单费组成，不再扣订单预估运费。</p>
          <p><strong className="text-[var(--text)]">回款</strong> 是你实际到账或提现后的金额，允许滞后补录。它只影响真实口径，不会修改订单。</p>
        </div>
        <DialogActions>
          <Button variant="primary" onClick={() => onOpenChange(false)}>知道了</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

function FinancePage({ active = true }: { active?: boolean }) {
  const providerRef = useRef(FinanceProviderFirestore.create({
    state: {},
    helpers: { nowIso, todayStr }
  }));
  const unsubscribeSnapshotRef = useRef<(() => void) | null>(null);
  const markRemoteStaleRef = useRef<() => void>(() => {});
  const clientIdRef = useRef('');
  const syncRevisionRef = useRef('');
  const initialConfig = readGlobalConfig();
  const [connected, setConnected] = useState(() => !!initialConfig?.configText);
  const [loading, setLoading] = useState(() => !!initialConfig?.configText);
  const [syncText, setSyncText] = useState(() => {
    const status = buildFirestoreSyncStatus(initialConfig?.configText ? 'refreshing' : 'unconnected');
    return status.text;
  });
  const [syncClass, setSyncClass] = useState(() => {
    const status = buildFirestoreSyncStatus(initialConfig?.configText ? 'refreshing' : 'unconnected');
    return status.className;
  });
  const [projectId, setProjectId] = useState(() => initialConfig?.projectId || '');
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [activeAccount, setActiveAccount] = useState('__all__');
  const [month] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<FinanceRecordDraft>(() => createFinanceRecordDraft('cost'));
  const [helpOpen, setHelpOpen] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [copyingRules, setCopyingRules] = useState(false);
  const [pricingContext, setPricingContext] = useState(() => ensureGlobalSettingsStore().getPricingContext());
  const exchangeRate = pricingContext.rate;

  const allAccounts = accounts;
  const publicRecordCount = useMemo(() => records.filter(record => !normalizeAccountName(record.accountName)).length, [records]);
  const accountTabItems = useMemo(() => [
    {
      key: PUBLIC_ACCOUNT_KEY,
      label: PUBLIC_ACCOUNT_LABEL,
      count: publicRecordCount
    },
    ...allAccounts.map(account => ({
      key: account,
      label: account,
      count: records.filter(record => normalizeAccountName(record.accountName) === account).length
    }))
  ], [allAccounts, publicRecordCount, records]);

  const notifyAccountsChanged = useCallback((detail: Record<string, unknown> = {}) => {
    window.dispatchEvent(new CustomEvent(ACCOUNT_UPDATED_EVENT, {
      detail: {
        source: 'finance',
        projectId,
        ...detail
      }
    }));
  }, [projectId]);

  const formatFirestoreError = useCallback((error: unknown, fallback = '收支管理操作失败') => {
    const err = error as { message?: string };
    const message = String(err?.message || '').trim();
    if (isPermissionDenied(error)) {
      return formatFirestoreRulesUpdateMessage('finance', ['finance_records.read', 'finance_records.write', 'orders.read', 'order_accounts.read']);
    }
    return message || fallback;
  }, []);

  const stopSnapshot = useCallback(() => {
    if (!unsubscribeSnapshotRef.current) return;
    unsubscribeSnapshotRef.current();
    unsubscribeSnapshotRef.current = null;
  }, []);

  const markPermissionBlocked = useCallback(() => {
    stopSnapshot();
    setConnected(true);
    setPermissionBlocked(true);
    setRecords([]);
    setOrders([]);
    setAccounts([]);
    setSyncText('');
    setSyncClass('error');
  }, [stopSnapshot]);

  const connectUsingGlobalConfig = useCallback(async () => {
    const cfg = readGlobalConfig();
    if (!cfg?.configText) {
      stopSnapshot();
      setConnected(false);
      setPermissionBlocked(false);
      const status = buildFirestoreSyncStatus('unconnected');
      setSyncText(status.text);
      setSyncClass(status.className);
      return false;
    }
    setLoading(true);
    const refreshingStatus = buildFirestoreSyncStatus('refreshing');
    setSyncText(refreshingStatus.text);
    setSyncClass(refreshingStatus.className);
    try {
      await providerRef.current.init({ configText: cfg.configText });
      setProjectId(cfg.projectId || '');
      setConnected(true);
      stopSnapshot();
      const snapshot = await providerRef.current.pullSnapshot();
      syncRevisionRef.current = snapshot.syncRevision || '';
      setRecords(snapshot.records || []);
      setOrders(snapshot.orders || []);
      setAccounts(snapshot.accounts || []);
      setConnected(true);
      setPermissionBlocked(false);
      setLoading(false);
      const status = buildFirestoreSyncStatus(snapshot.hasPendingWrites ? 'queueing' : 'confirmed', {
        action: '收支更改',
        count: (snapshot.records || []).length,
        unit: '条'
      });
      setSyncText(status.text);
      setSyncClass(status.className);
      unsubscribeSnapshotRef.current = providerRef.current.subscribeSnapshot(snapshot => {
        if (!snapshot.hasExternalChanges) return;
        syncRevisionRef.current = snapshot.syncRevision || syncRevisionRef.current;
        setConnected(true);
        setPermissionBlocked(false);
        setLoading(false);
        const staleStatus = buildFirestoreSyncStatus('stale');
        setSyncText(staleStatus.text);
        setSyncClass(staleStatus.className);
        markRemoteStaleRef.current();
      }, error => {
        setLoading(false);
        if (isPermissionDenied(error)) {
          setProjectId(cfg.projectId || '');
          markPermissionBlocked();
          return;
        }
        const status = buildFirestoreSyncStatus('failed', { error: formatFirestoreError(error, '收支实时同步失败') });
        setSyncText(status.text);
        setSyncClass(status.className);
        showToast(status.text, 'error');
      }, {
        clientId: clientIdRef.current,
        currentRevision: syncRevisionRef.current
      });
      return true;
    } catch (error) {
      if (isPermissionDenied(error)) {
        setProjectId(cfg.projectId || '');
        markPermissionBlocked();
        return false;
      }
      setConnected(false);
      const status = buildFirestoreSyncStatus('failed', { error: formatFirestoreError(error, '恢复连接失败') });
      setSyncText(status.text);
      setSyncClass(status.className);
      showToast(status.text, 'error');
      return false;
    } finally {
      if (!unsubscribeSnapshotRef.current) setLoading(false);
    }
  }, [formatFirestoreError, markPermissionBlocked, stopSnapshot]);

  const remoteStaleRefresh = useStaleAutoRefresh({
    canRefresh: connected && !permissionBlocked && !loading && !modalOpen,
    onRefresh: connectUsingGlobalConfig,
    onRefreshError: error => {
      if (isPermissionDenied(error)) {
        markPermissionBlocked();
        return;
      }
      const status = buildFirestoreSyncStatus('failed', {
        error: formatFirestoreError(error, '自动刷新失败')
      });
      setSyncText(status.text);
      setSyncClass(status.className);
      showToast(status.text, 'error');
    }
  });

  useEffect(() => {
    markRemoteStaleRef.current = remoteStaleRefresh.markStale;
    return () => {
      markRemoteStaleRef.current = () => {};
    };
  }, [remoteStaleRefresh.markStale]);

  const displaySyncText = useMemo(() => {
    if (syncClass !== 'stale') return syncText;
    return buildFirestoreSyncStatus('stale', {
      autoRefreshSeconds: remoteStaleRefresh.remainingSeconds
    }).text;
  }, [remoteStaleRefresh.remainingSeconds, syncClass, syncText]);

  useEffect(() => {
    clientIdRef.current = getRuntimeClientId();
    void connectUsingGlobalConfig();
  }, [connectUsingGlobalConfig]);

  useEffect(() => {
    const store = ensureGlobalSettingsStore();
    setPricingContext(store.getPricingContext());
    const refreshPricingContext = () => setPricingContext(store.getPricingContext());
    const unsubscribe = store.subscribe(refreshPricingContext);
    window.addEventListener(SETTINGS_CHANGED_EVENT, refreshPricingContext);
    return () => {
      unsubscribe();
      window.removeEventListener(SETTINGS_CHANGED_EVENT, refreshPricingContext);
    };
  }, []);

  useEffect(() => {
    const handleConnectionChange = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean }>).detail || {};
      if (detail.connected === false || !readGlobalConfig()?.configText) {
        stopSnapshot();
        setConnected(false);
        setPermissionBlocked(false);
        setRecords([]);
        setOrders([]);
        setAccounts([]);
        setProjectId('');
        const status = buildFirestoreSyncStatus('unconnected');
        setSyncText(status.text);
        setSyncClass(status.className);
        return;
      }
      void connectUsingGlobalConfig();
    };
    const handleAccountsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string; action?: string; oldAccount?: string; account?: string; accounts?: string[] }>).detail || {};
      if (detail.source === 'finance' || !readGlobalConfig()?.configText) return;
      if (Array.isArray(detail.accounts)) {
        const nextAccounts = uniqueAccounts(detail.accounts);
        setAccounts(nextAccounts);
        setActiveAccount(current => current === '__all__' || current === PUBLIC_ACCOUNT_KEY || nextAccounts.includes(current) ? current : '__all__');
        setCurrentPage(1);
      }
      if (detail.action === 'rename' && detail.oldAccount && detail.account) {
        const oldName = normalizeAccountName(detail.oldAccount);
        const newName = normalizeAccountName(detail.account);
        setRecords(previous => previous.map(record => (
          normalizeAccountName(record.accountName) === oldName ? { ...record, accountName: newName } : record
        )));
        setOrders(previous => previous.map(order => (
          normalizeAccountName(order['账号']) === oldName ? { ...order, '账号': newName } : order
        )));
      }
      if (detail.action === 'reorder' || detail.action === 'upsert' || detail.action === 'rename' || detail.action === 'delete') return;
      void connectUsingGlobalConfig();
    };
    window.addEventListener('tk-firestore-config-changed', handleConnectionChange);
    window.addEventListener(ACCOUNT_UPDATED_EVENT, handleAccountsChanged);
    return () => {
      window.removeEventListener('tk-firestore-config-changed', handleConnectionChange);
      window.removeEventListener(ACCOUNT_UPDATED_EVENT, handleAccountsChanged);
    };
  }, [connectUsingGlobalConfig, stopSnapshot]);

  useEffect(() => {
    if (!active || !readGlobalConfig()?.configText || unsubscribeSnapshotRef.current) return;
    void connectUsingGlobalConfig();
  }, [active, connectUsingGlobalConfig]);

  useEffect(() => () => stopSnapshot(), [stopSnapshot]);

  useEffect(() => {
    if (activeAccount === '__all__' || activeAccount === PUBLIC_ACCOUNT_KEY || allAccounts.includes(activeAccount)) return;
    setActiveAccount('__all__');
    setCurrentPage(1);
  }, [activeAccount, allAccounts]);

  async function copyFirestoreRules() {
    setCopyingRules(true);
    try {
      await TKFirestoreConnection.copyRules();
      showToast('Firestore 规则已复制');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '规则复制失败', 'error');
    } finally {
      setCopyingRules(false);
    }
  }

  function openRecordModal(kind: FinanceRecordKind = 'cost', id = '') {
    const record = id ? records.find(item => item.id === id) || null : null;
    const defaultAccount = activeAccount !== '__all__' && activeAccount !== PUBLIC_ACCOUNT_KEY ? activeAccount : '';
    setEditingId(id);
    setDraft(record ? financeRecordToDraft(record) : createFinanceRecordDraft(kind, { accountName: defaultAccount }));
    setModalOpen(true);
  }

  function updateDraft(patch: Partial<FinanceRecordDraft>) {
    setDraft(previous => ({ ...previous, ...patch }));
  }

  async function submitRecord() {
    const amount = parseMoneyAmount(draft.amount);
    if (amount === null || amount < 0) {
      showToast('金额需要填写大于等于 0 的数字', 'error');
      return;
    }
    if (!draft.occurredAt) {
      showToast('请选择日期', 'error');
      return;
    }
    const previous = editingId ? records.find(record => record.id === editingId) || null : null;
    const payload = buildRecordPayload({ draft, previous });
    const nextRecords = previous
      ? records.map(record => record.id === previous.id ? payload : record)
      : [payload, ...records];
    setRecords(nextRecords);
    setModalOpen(false);
    setEditingId('');
    setSyncText('已保存到 Firestore 本地队列…');
    setSyncClass('saving');
    try {
      const result = await providerRef.current.upsertRecord(payload, { clientId: clientIdRef.current, waitForCommit: false });
      result.commitPromise?.then(() => {
        setSyncText(`已同步 · ${nextRecords.length} 条`);
        setSyncClass('saved');
        setPermissionBlocked(false);
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        setSyncText('Firestore 写入失败，已保留本地视图');
        setSyncClass('error');
        showToast(formatFirestoreError(error, '写入失败'), 'error');
      });
      showToast('收支记录已保存');
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '写入失败'), 'error');
    }
  }

  async function deleteRecord(id: string) {
    if (!window.confirm('确定删除这条收支记录？删除后如需恢复，需要从你的 Firestore 历史记录或备份手动恢复。')) return;
    const nextRecords = records.filter(record => record.id !== id);
    setRecords(nextRecords);
    setSyncText('已删除，本地已更新，等待同步…');
    setSyncClass('saving');
    try {
      const result = await providerRef.current.deleteRecord(id, { clientId: clientIdRef.current, waitForCommit: false });
      result.commitPromise?.then(() => {
        setSyncText(`已同步 · ${nextRecords.length} 条`);
        setSyncClass('saved');
        setPermissionBlocked(false);
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        setSyncText('Firestore 写入失败，已保留本地视图');
        setSyncClass('error');
        showToast(formatFirestoreError(error, '删除失败'), 'error');
      });
      showToast('已删除');
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '删除失败'), 'error');
    }
  }

  return (
    <>
      <ModuleWorkspace className="finance-page" data-react-finance-page-ready="true">
        <ModuleHeader
          title="收支管理"
          description="把订单预估利润和实际回款分开看，单独记录运营成本、押金占用和押金扣除，方便判断真实口径。"
        />

        <Card id="finance-main" className={!connected ? financeSetupCardClass : undefined}>
        <div className={statusStripClass}>
          <div className={statusStripLeftClass}>
            {connected && !permissionBlocked ? <Badge id="finance-sync" className={syncStatusClass(syncClass)}>{displaySyncText}</Badge> : null}
            <Button id="finance-refresh" variant="plain" className={refreshButtonClass(loading)} aria-label="刷新收支数据" title="刷新收支数据" disabled={loading} aria-busy={loading ? 'true' : 'false'} onClick={() => void remoteStaleRefresh.refreshNow()}>
              <RefreshCw size={15} strokeWidth={2} aria-hidden="true" className={loading ? 'is-spinning' : ''} />
            </Button>
            <Button id="finance-help-btn" variant="plain" className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[var(--border)] bg-transparent p-0 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]" aria-controls="finance-help-modal" aria-haspopup="dialog" aria-label="收支口径说明" title="收支口径说明" onClick={() => setHelpOpen(true)}>
              <HelpCircle size={15} strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {!connected ? (
          <ModuleListState
            tone="connect"
            title="连接数据库"
            description="收支管理、订单管理和商品管理共用同一个 Firestore 项目。先连接一次，模块会直接复用。"
            actions={[{ id: 'finance-open-connection', label: '连接 Firebase', variant: 'primary', onClick: () => TKFirestoreConnection.open() }]}
          />
        ) : permissionBlocked ? (
          <ModuleListState
            tone="permission"
            title="数据库权限不足"
            description="当前数据库权限不足，收支管理保存不可用。复制最新 Firestore 规则发布后刷新页面。"
            actions={[
              { label: '打开 Firebase Console', onClick: () => TKFirestoreConnection.openConsole() },
              { label: copyingRules ? '复制中…' : '复制 Firestore 规则', variant: 'primary', disabled: copyingRules, onClick: () => void copyFirestoreRules() }
            ]}
          />
        ) : (
          <div className={financeContentClass}>
            <FinanceSummaryView
              records={records}
              orders={orders}
              activeAccount={activeAccount}
              month={month}
              query={searchQuery}
              exchangeRate={exchangeRate}
            />
            <AccountTabsBar
              id="finance-acc-tabs"
              activeKey={activeAccount}
              allCount={records.length}
              allTabsId="finance-acc-tabs-all"
              scrollId="finance-acc-tabs-scroll"
              actionsId="finance-acc-actions"
              items={accountTabItems}
              emptyText="暂无账号"
              onChange={account => { setActiveAccount(account); setCurrentPage(1); }}
              actions={(
                <Button id="finance-add-record" variant="primary" onClick={() => openRecordModal('cost')}><Plus size={14} strokeWidth={2} aria-hidden="true" />新增收支</Button>
              )}
            />
            <FinanceTable
              records={records}
              activeAccount={activeAccount}
              month={month}
              searchQuery={searchQuery}
              sortOrder={sortOrder}
              pageSize={pageSize}
              currentPage={currentPage}
              onSearchChange={value => { setSearchQuery(value); setCurrentPage(1); }}
              onPageSizeChange={value => { setPageSize(Math.max(1, Number(value) || 50)); setCurrentPage(1); }}
              onPageChange={delta => setCurrentPage(page => Math.max(1, page + delta))}
              onSortToggle={() => { setSortOrder(value => value === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
              onEdit={id => openRecordModal('cost', id)}
              onDelete={deleteRecord}
            />
          </div>
        )}
        </Card>
      </ModuleWorkspace>

      <RecordDialog
        accounts={allAccounts}
        draft={draft}
        editingId={editingId}
        open={modalOpen}
        onDraftChange={updateDraft}
        onOpenChange={open => {
          setModalOpen(open);
          if (!open) setEditingId('');
        }}
        onSubmit={() => void submitRecord()}
      />
      <FinanceHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

export { FinancePage };
