import { AccountDeleteDialog, AccountEditDialog } from '@/components/ui/account-manage-dialogs';
import { AccountTabsBar } from '@/components/ui/account-tabs-bar';
import { AddAccountDialog } from '@/components/ui/add-account-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleListState } from '@/components/ui/module-list-state';
import { PageHero } from '@/components/ui/page-hero';
import { SearchHelpButton } from '@/components/ui/search-help';
import { TableFrame, TablePager, TableSearch, TableSortButton, TableToolbar, TableViewport } from '@/components/ui/table-tools';
import { refreshButtonClass, statusStripClass, statusStripLeftClass, statusStripRightClass, syncStatusClass } from '@/components/ui/status-strip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showAppToast } from '@/app/toast';
import { cn } from '@/lib/utils';
import { TKFirestoreConnection } from '../../../firestore-connection.ts';
import {
  formatFirestoreRulesUpdateMessage,
  isPermissionDenied
} from '../../../firestore-rules-compatibility.ts';
import { CollectionProviderFirestore } from '../../../collection/provider-firestore.ts';
import { deriveDisplayedCollectionRows } from '../../../collection/table.ts';
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  FileDown,
  PencilLine,
  Plus,
  RefreshCw,
  SearchCheck,
  XCircle
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type CsvRow = Record<string, string>;
type DatasetKey = 'records';
type CollectStatus = '已采集' | '失败' | '';
type CollectionSortOrder = 'asc' | 'desc';

type CollectionDataset = {
  filename: string;
  headers: string[];
  rows: CsvRow[];
};

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
const STATUS_OPTIONS: CollectStatus[] = ['已采集', '失败'];
const ALL_ACCOUNTS_KEY = '__all__';
const ACCOUNT_UPDATED_EVENT = 'tk-accounts-changed';

const selectionSkillUrl = 'https://github.com/gaohongxiang/TK/tree/main/skills/tk-product-selection';
const editorSkillUrl = 'https://github.com/gaohongxiang/TK/tree/main/skills/tk-product-editor';
const selectionInstallCommand = `请安装这个 Codex skill：${selectionSkillUrl}`;
const editorInstallCommand = `请安装这个 Codex skill：${editorSkillUrl}`;
const collectCommand = '使用 $tk-product-selection 为【账号名】账号采集20个符合条件商品';
const editCommand = '使用 $tk-product-editor 编辑【店小秘商品链接】并保存到待发布';

const skillCards = [
  {
    title: '商品采集',
    icon: SearchCheck,
    copy: '按 FastMoss 日本站条件找品、筛选合格商品，采集到店小秘待编辑商品，并把采集状态同步到采编记录。',
    installCommand: selectionInstallCommand,
    command: collectCommand,
    commandLabel: '复制采集命令'
  },
  {
    title: '商品编辑',
    icon: PencilLine,
    copy: '从店小秘 TikTok 采集箱或商品编辑页开始，核验 1688 货源，补齐分类属性、日语标题描述、图片和物流信息。',
    installCommand: editorInstallCommand,
    command: editCommand,
    commandLabel: '复制编辑命令'
  }
] as const;

const usageSteps = [
  {
    title: '先采集',
    copy: '对指定账号发采集命令。Codex 使用当前已连接的 Chrome 扩展会话处理 FastMoss、TikTok Shop 和店小秘采集箱。'
  },
  {
    title: '再编辑',
    copy: '对店小秘采集箱商品或编辑页链接发编辑命令。编辑技能只处理店小秘编辑字段，不覆盖采集判断。'
  },
  {
    title: '看回写',
    copy: '采编记录同时显示采集状态和店小秘编辑状态；编辑完成、失败或跳过后都会回写到同一条商品记录。'
  }
] as const;

const datasetMeta: Record<DatasetKey, {
  label: string;
  filename: string;
  emptyTitle: string;
  emptyDescription: string;
}> = {
  records: {
    label: '采编记录',
    filename: 'collection_records.csv',
    emptyTitle: '还没有采编记录',
    emptyDescription: 'Codex 采集到符合条件商品后会自动写入；每一行都包含采集和编辑状态。'
  }
};

const collectionShellClass = 'collection-page space-y-4';
const skillGridClass = 'grid grid-cols-2 gap-2.5 max-[860px]:grid-cols-1';
const skillPanelClass = 'flex min-h-[156px] flex-col rounded-[12px] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--panel2)_34%,transparent)] px-3.5 py-3.5';
const skillHeadClass = 'mb-2 flex items-center gap-3';
const skillIconClass = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--accent)_34%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_12%,var(--panel))] text-[var(--accent)]';
const skillTitleWrapClass = 'min-w-0 flex-1';
const skillTitleClass = 'text-[14px] font-bold leading-tight text-[var(--text)]';
const skillCopyClass = 'text-[12.5px] leading-[1.6] text-[var(--muted)]';
const skillActionClass = 'mt-2 flex min-h-8 flex-wrap items-end gap-2';
const workflowGridClass = 'mt-3 grid grid-cols-3 gap-2.5 max-[860px]:grid-cols-1';
const stepCardClass = 'flex min-h-[96px] flex-col rounded-[12px] border border-[color-mix(in_srgb,var(--border)_72%,transparent)] bg-[color-mix(in_srgb,var(--panel2)_22%,transparent)] px-3.5 py-3';
const stepHeadClass = 'mb-1.5 flex items-center gap-2';
const stepNumberClass = 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent2)_42%,var(--border))] bg-[color-mix(in_srgb,var(--accent2)_12%,var(--panel))] text-[10px] font-bold text-[var(--accent2)]';
const stepTitleClass = 'text-[13px] font-bold text-[var(--text)]';
const stepCopyClass = 'flex-1 text-[12px] leading-[1.55] text-[var(--muted)]';
const policyGridClass = 'grid gap-2.5';
const metricGridClass = 'grid grid-cols-4 gap-2.5 max-[760px]:grid-cols-2 max-[460px]:grid-cols-1';
const metricClass = 'rounded-[12px] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--panel2)_42%,transparent)] px-3 py-3';
const metricLabelClass = 'text-[11.5px] leading-none text-[var(--muted)]';
const metricValueClass = 'mt-2 text-[20px] font-bold leading-none tabular-nums text-[var(--text)]';
const tableClass = 'collection-table min-w-[1580px] text-[12.5px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap [&_tbody_tr:hover]:bg-[rgba(110,168,255,.05)]';
const productCellClass = 'min-w-[240px] max-w-[340px]';
const truncateClass = 'block max-w-full truncate';
const productNameWrapClass = 'flex min-w-0 items-center gap-2';
const productNameTextClass = 'block min-w-0 flex-1 truncate';
const productNameActionsClass = 'inline-flex shrink-0 items-center gap-1';
const statusBadgeClass = 'inline-flex items-center gap-1';

function showToast(message: string, type: 'ok' | 'error' = 'ok') {
  showAppToast(message, type);
}

function formatFirestoreError(error: unknown, fallback = '数据库操作失败') {
  const err = error as { code?: string; message?: string };
  const message = String(err?.message || '').trim() || (error instanceof Error ? error.message : String(error || ''));
  if (isPermissionDenied(error)) {
    return formatFirestoreRulesUpdateMessage('collection', ['collection_records.read', 'collection_records.write']);
  }
  return message || fallback;
}

function CollectionPage({ active = true }: { active?: boolean }) {
  const [datasets, setDatasets] = useState<Record<DatasetKey, CollectionDataset | null>>({
    records: null
  });
  const activeDataset: DatasetKey = 'records';
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHelpOpen, setSearchHelpOpen] = useState(false);
  const [activeAccount, setActiveAccount] = useState(ALL_ACCOUNTS_KEY);
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<CollectionSortOrder>('asc');
  const [syncText, setSyncText] = useState('等待连接 Firebase');
  const [syncClass, setSyncClass] = useState<'local' | 'saved' | 'saving' | 'error'>('local');
  const [loading, setLoading] = useState(false);
  const [copyingRules, setCopyingRules] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [editingAccountName, setEditingAccountName] = useState('');
  const [editingAccountValue, setEditingAccountValue] = useState('');
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
  const [deletingAccountName, setDeletingAccountName] = useState('');
  const [projectId, setProjectId] = useState('');
  const activeRef = useRef(active);
  const providerRef = useRef(CollectionProviderFirestore.create({
    state: {},
    helpers: { nowIso: () => new Date().toISOString() }
  }));

  const activeData = datasets[activeDataset];
  const indexedRows = useMemo(() => {
    const rows = activeData?.rows || [];
    return rows.map((row, index) => ({ row, sourceIndex: index }));
  }, [activeData]);
  const allAccounts = accounts;
  const accountCounts = useMemo(() => {
    const counts = new Map<string, number>();
    indexedRows.forEach(item => {
      const account = normalizeAccountName(item.row['账号']);
      if (!account) return;
      counts.set(account, (counts.get(account) || 0) + 1);
    });
    return counts;
  }, [indexedRows]);
  const accountTabItems = useMemo(() => allAccounts.map(account => ({
    key: account,
    label: account,
    count: accountCounts.get(account) || 0,
    dataAttrs: { 'data-collection-acc': account }
  })), [accountCounts, allAccounts]);
  const accountScopedRows = useMemo(() => {
    if (activeAccount === ALL_ACCOUNTS_KEY) return indexedRows;
    return indexedRows.filter(item => normalizeAccountName(item.row['账号']) === activeAccount);
  }, [activeAccount, indexedRows]);
  const sortedRows = useMemo(() => deriveDisplayedCollectionRows({
    rows: indexedRows,
    activeAccount,
    searchQuery,
    sortOrder,
    allAccountsKey: ALL_ACCOUNTS_KEY
  }), [activeAccount, indexedRows, searchQuery, sortOrder]);
  const pageState = clampPage(currentPage, pageSize, sortedRows.length);
  const startIndex = (pageState.currentPage - 1) * pageState.pageSize;
  const pagedRows = sortedRows.slice(startIndex, startIndex + pageState.pageSize);
  const summary = buildSummaryRows(accountScopedRows.map(item => item.row));
  const sortIcon = sortOrder === 'asc' ? '↑' : '↓';
  const sortTitle = sortOrder === 'asc' ? '当前正序，点击切换为倒序' : '当前倒序，点击切换为正序';

  const notifyAccountsChanged = useCallback((detail: Record<string, unknown> = {}) => {
    window.dispatchEvent(new CustomEvent(ACCOUNT_UPDATED_EVENT, {
      detail: {
        source: 'collection',
        projectId,
        ...detail
      }
    }));
  }, [projectId]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (activeAccount === ALL_ACCOUNTS_KEY) return;
    if (!allAccounts.includes(activeAccount)) setActiveAccount(ALL_ACCOUNTS_KEY);
  }, [activeAccount, allAccounts]);

  const markPermissionBlocked = useCallback(() => {
    setPermissionBlocked(true);
    setDatasets({ records: null });
    setSyncText('');
    setSyncClass('error');
  }, []);

  const loadRemoteDatasets = useCallback(async () => {
    const cfg = TKFirestoreConnection.getConfig();
    if (!cfg?.configText) {
      setProjectId('');
      setPermissionBlocked(false);
      setAccounts([]);
      setSyncText('未连接，自动同步结果会在连接后显示');
      setSyncClass('local');
      return false;
    }
    setLoading(true);
    setSyncText('正在刷新云端数据…');
    setSyncClass('saving');
    try {
      const next = await providerRef.current.init({ firestoreConfigText: cfg.configText });
      setProjectId(next.projectId);
      let remoteDatasets: { records: CollectionDataset | null } = { records: null };
      let remoteAccounts: string[] = [];
      let recordsPermissionBlocked = false;
      try {
        [remoteAccounts, remoteDatasets] = await Promise.all([
          providerRef.current.pullAccounts(),
          providerRef.current.pullDatasets({ includeRejects: false }).catch(error => {
            if (isPermissionDenied(error)) {
              recordsPermissionBlocked = true;
              return { records: null };
            }
            throw error;
          })
        ]);
      } catch (error) {
        if (isPermissionDenied(error)) {
          markPermissionBlocked();
          return false;
        }
        throw error;
      }
      setAccounts(remoteAccounts);
      if (recordsPermissionBlocked) {
        markPermissionBlocked();
        return false;
      }
      setPermissionBlocked(false);
      setDatasets({ records: remoteDatasets.records });
      setSyncText(`已同步 · ${remoteDatasets.records?.rows.length || 0} 条`);
      setSyncClass('saved');
      return true;
    } catch (error) {
      if (isPermissionDenied(error)) {
        markPermissionBlocked();
        return false;
      }
      setSyncText(formatFirestoreError(error, '数据库同步失败'));
      setSyncClass('error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [markPermissionBlocked]);

  useEffect(() => {
    if (!active) return undefined;
    void loadRemoteDatasets();
    return undefined;
  }, [active, loadRemoteDatasets]);

  useEffect(() => {
    const handler = () => {
      if (activeRef.current) void loadRemoteDatasets();
    };
    const handleAccountsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string; action?: string; oldAccount?: string; account?: string; accounts?: string[] }>).detail || {};
      if (detail.source === 'collection') return;
      if (Array.isArray(detail.accounts)) {
        const nextAccounts = uniqueAccounts(detail.accounts);
        setAccounts(nextAccounts);
        setActiveAccount(current => current === ALL_ACCOUNTS_KEY || nextAccounts.includes(current) ? current : ALL_ACCOUNTS_KEY);
        setCurrentPage(1);
      }
      if (detail.action === 'rename' && detail.oldAccount && detail.account) {
        const oldName = normalizeAccountName(detail.oldAccount);
        const newName = normalizeAccountName(detail.account);
        setDatasets(previous => renameDatasetsAccount(previous, oldName, newName));
      }
      if (detail.action === 'reorder' || detail.action === 'upsert' || detail.action === 'rename' || detail.action === 'delete') return;
      if (activeRef.current) void loadRemoteDatasets();
    };
    window.addEventListener('tk-firestore-config-changed', handler);
    window.addEventListener(ACCOUNT_UPDATED_EVENT, handleAccountsChanged);
    return () => {
      window.removeEventListener('tk-firestore-config-changed', handler);
      window.removeEventListener(ACCOUNT_UPDATED_EVENT, handleAccountsChanged);
    };
  }, [loadRemoteDatasets]);

  async function refreshRemote() {
    const ok = await loadRemoteDatasets();
    if (ok) showToast('采编记录已刷新');
  }

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

  async function addAccount() {
    const name = newAccountName.trim();
    if (!name) return;
    if (allAccounts.includes(name)) {
      showToast('该账号已存在', 'error');
      return;
    }
    try {
      const nextAccounts = uniqueAccounts([...allAccounts, name]);
      const result = await providerRef.current.upsertAccount(name, { sortIndex: nextAccounts.indexOf(name), waitForCommit: false });
      setAccounts(nextAccounts);
      setActiveAccount(name);
      setCurrentPage(1);
      setNewAccountName('');
      setAccountModalOpen(false);
      setPermissionBlocked(false);
      setSyncText('账号已保存到 Firestore 本地队列…');
      setSyncClass('saving');
      notifyAccountsChanged({ action: 'upsert', account: name, accounts: nextAccounts });
      if (typeof result === 'object' && result?.commitPromise) result.commitPromise.then(() => {
        setSyncText(`已同步 · ${activeData?.rows.length || 0} 条`);
        setSyncClass('saved');
        notifyAccountsChanged({ action: 'commit', account: name, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        showToast(formatFirestoreError(error, '账号保存失败'), 'error');
      });
      showToast('账号已添加');
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '账号保存失败'), 'error');
    }
  }

  async function reorderAccounts(nextOrder: string[]) {
    const nextAccounts = uniqueAccounts(nextOrder);
    if (!nextAccounts.length) return;
    setAccounts(nextAccounts);
    notifyAccountsChanged({ action: 'reorder', accounts: nextAccounts });
    try {
      const result = await providerRef.current.saveAccountOrder(nextAccounts, { waitForCommit: false });
      if (typeof result === 'object' && result?.commitPromise) result.commitPromise.catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        showToast(formatFirestoreError(error, '账号排序保存失败'), 'error');
      });
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '账号排序保存失败'), 'error');
    }
  }

  function openEditAccount(account: string) {
    setEditingAccountName(account);
    setEditingAccountValue(account);
    setAccountEditOpen(true);
  }

  function openDeleteAccount(account: string) {
    setDeletingAccountName(account);
    setAccountDeleteOpen(true);
  }

  function renameDatasetAccount(dataset: CollectionDataset | null, oldName: string, newName: string) {
    if (!dataset) return dataset;
    return {
      ...dataset,
      rows: dataset.rows.map(row => (
        normalizeAccountName(row['账号']) === oldName ? { ...row, '账号': newName } : row
      ))
    };
  }

  function renameDatasetsAccount(previous: { records: CollectionDataset | null }, oldName: string, newName: string) {
    return { records: renameDatasetAccount(previous.records, oldName, newName) };
  }

  async function renameAccount() {
    const oldName = editingAccountName.trim();
    const newName = editingAccountValue.trim();
    if (!oldName || !newName) return;
    if (oldName === newName) {
      setAccountEditOpen(false);
      return;
    }
    if (allAccounts.some(account => account !== oldName && account === newName)) {
      showToast('该账号已存在', 'error');
      return;
    }
    const nextAccounts = allAccounts.map(account => account === oldName ? newName : account);
    const nextDatasets = renameDatasetsAccount(datasets, oldName, newName);
    setAccounts(nextAccounts);
    setDatasets(nextDatasets);
    if (activeAccount === oldName) setActiveAccount(newName);
    setCurrentPage(1);
    setAccountEditOpen(false);
    setEditingAccountName('');
    setEditingAccountValue('');
    setPermissionBlocked(false);
    setSyncText('账号名已保存到 Firestore 本地队列…');
    setSyncClass('saving');
    notifyAccountsChanged({ action: 'rename', oldAccount: oldName, account: newName, accounts: nextAccounts });
    try {
      const result = await providerRef.current.renameAccount(oldName, newName, { accountOrder: allAccounts, waitForCommit: false });
      if (result?.commitPromise) result.commitPromise.then(() => {
        setSyncText(`已同步 · ${nextDatasets.records?.rows.length || 0} 条`);
        setSyncClass('saved');
        notifyAccountsChanged({ action: 'commit', account: newName, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        showToast(formatFirestoreError(error, '账号名保存失败'), 'error');
      });
      showToast('账号名已更新');
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '账号名保存失败'), 'error');
    }
  }

  async function deleteAccount() {
    const name = deletingAccountName.trim();
    if (!name) return;
    const nextAccounts = allAccounts.filter(account => account !== name);
    setAccounts(nextAccounts);
    setActiveAccount(current => current === name ? ALL_ACCOUNTS_KEY : current);
    setCurrentPage(1);
    setAccountDeleteOpen(false);
    setDeletingAccountName('');
    setPermissionBlocked(false);
    setSyncText('账号名已删除，数据保留在全部…');
    setSyncClass('saving');
    notifyAccountsChanged({ action: 'delete', account: name, accounts: nextAccounts });
    try {
      const result = await providerRef.current.deleteAccount(name, { accountOrder: allAccounts, waitForCommit: false });
      if (result?.commitPromise) result.commitPromise.then(() => {
        setSyncText(`已同步 · ${activeData?.rows.length || 0} 条`);
        setSyncClass('saved');
        notifyAccountsChanged({ action: 'commit-delete', account: name, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        showToast(formatFirestoreError(error, '账号名删除失败'), 'error');
      });
      showToast('账号名已删除，数据仍在全部里');
    } catch (error) {
      if (isPermissionDenied(error)) markPermissionBlocked();
      showToast(formatFirestoreError(error, '账号名删除失败'), 'error');
    }
  }

  function exportActiveDataset() {
    if (!activeData?.rows.length) {
      showToast('当前没有可导出的 CSV', 'error');
      return;
    }
    const csv = stringifyCsv(activeData.headers, activeData.rows);
    const baseName = activeData.filename.replace(/\.csv$/i, '') || datasetMeta[activeDataset].filename.replace(/\.csv$/i, '');
    downloadCsv(`${baseName}.edited.csv`, csv);
    showToast('CSV 已开始导出');
  }

  return (
    <section className={collectionShellClass} data-react-collection-page-ready="true">
      <PageHero
        variant="collection"
        title="商品采编"
        kicker="Codex Skills / GitHub / FastMoss / 店小秘"
        description="商品采编由两个 Codex skill 串起来：商品采集负责 FastMoss 筛选、店小秘采集箱录入和 Firestore 同步；商品编辑负责店小秘编辑、1688 货源核验和编辑状态回写。"
      />

      <Card>
        <CardHeader className="mb-2">
          <CardTitle className="mb-0"><ClipboardList size={14} strokeWidth={2} aria-hidden="true" />使用说明</CardTitle>
          <Badge variant="info">Codex Skill</Badge>
        </CardHeader>
        <CardContent className={policyGridClass}>
          <div className={skillGridClass}>
            {skillCards.map(skill => {
              const Icon = skill.icon;
              return (
                <div className={skillPanelClass} key={skill.title}>
                  <div className={skillHeadClass}>
                    <span className={skillIconClass}><Icon size={18} strokeWidth={2} aria-hidden="true" /></span>
                    <div className={skillTitleWrapClass}>
                      <div className={skillTitleClass}>{skill.title}</div>
                    </div>
                  </div>
                  <div className={skillCopyClass}>{skill.copy}</div>
                  <div className={skillActionClass}>
                    <Button size="sm" variant="accentSoft" onClick={() => void copyText(skill.installCommand)}><Copy size={14} strokeWidth={2} aria-hidden="true" />复制安装命令</Button>
                    <Button size="sm" onClick={() => void copyText(skill.command)}><Copy size={14} strokeWidth={2} aria-hidden="true" />{skill.commandLabel}</Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className={workflowGridClass}>
            {usageSteps.map((step, index) => (
              <div className={stepCardClass} key={step.title}>
                <div className={stepHeadClass}>
                  <span className={stepNumberClass}>{index + 1}</span>
                  <div className={stepTitleClass}>{step.title}</div>
                </div>
                <div className={stepCopyClass}>
                  {step.copy}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className={metricGridClass}>
        <SummaryMetric label="采集商品" value={summary.recordCount} />
        <SummaryMetric label="已采集到店小秘" value={summary.collectedCount} />
        <SummaryMetric label="已编辑" value={summary.editedCount} />
        <SummaryMetric label="需要处理/失败" value={summary.actionNeededCount} />
      </div>

      <Card>
        <div className={cn('mb-3', statusStripClass)}>
          <div className={cn(statusStripLeftClass, 'min-w-0 flex-wrap')}>
            <Badge id="collection-user" className="min-h-[30px] min-w-0 max-w-full truncate text-[var(--text)] font-semibold">
              {projectId ? `已连接 · ${projectId}` : '未连接 Firebase'}
            </Badge>
            {permissionBlocked ? null : <Badge id="collection-sync" className={syncStatusClass(syncClass)}>{syncText}</Badge>}
            <Button
              id="collection-refresh"
              variant="plain"
              className={refreshButtonClass(loading)}
              disabled={loading}
              aria-label="刷新采编记录"
              title="刷新采编记录"
              aria-busy={loading ? 'true' : 'false'}
              onClick={() => void refreshRemote()}
            >
              <RefreshCw size={15} strokeWidth={2} aria-hidden="true" className={loading ? 'is-spinning' : ''} />
            </Button>
          </div>
          <div className={statusStripRightClass}>
            {projectId ? (
              <>
                <Button id="collection-export" size="sm" className="inline-flex items-center justify-center gap-1.5" onClick={exportActiveDataset}><FileDown size={14} strokeWidth={2} aria-hidden="true" />导出 CSV</Button>
                <Button id="collection-disconnect-firestore" size="sm" variant="danger" data-firestore-disconnect onClick={() => TKFirestoreConnection.requestDisconnect()}>退出数据库</Button>
              </>
            ) : <Button size="sm" onClick={() => TKFirestoreConnection.open()}>连接 Firebase</Button>}
          </div>
        </div>
        {!projectId ? (
          <ModuleListState
            tone="connect"
            title="连接数据库"
            description="连接你的 Firebase Firestore 后，Codex 采集和编辑结果会自动同步到这里。"
            actions={[{ id: 'collection-open-connection', label: '连接 Firebase', variant: 'primary', onClick: () => TKFirestoreConnection.open() }]}
          />
        ) : (
          <>
            <AccountTabsBar
              id="collection-acc-tabs"
              allTabsId="collection-acc-tabs-all"
              scrollId="collection-acc-tabs-scroll"
              actionsId="collection-acc-actions"
              className="mb-3"
              activeKey={activeAccount}
              allCount={indexedRows.length}
              allDataAttrs={{ 'data-collection-acc': ALL_ACCOUNTS_KEY }}
              items={accountTabItems}
              emptyText="暂无账号，点击 + 添加账号"
              addAccountButton={{ id: 'collection-tab-add', title: '添加账号', label: <Plus size={14} strokeWidth={2} aria-hidden="true" />, onClick: () => setAccountModalOpen(true) }}
              onEditAccount={openEditAccount}
              onDeleteAccount={openDeleteAccount}
              onReorder={reorderAccounts}
              onChange={key => {
                setActiveAccount(key);
                setCurrentPage(1);
              }}
            />

            {permissionBlocked ? (
              <ModuleListState
                tone="permission"
                title="数据库权限不足"
                description="当前数据库权限不足，商品采编保存不可用。复制最新 Firestore 规则发布后刷新页面。"
                actions={[
                  { label: '打开 Firebase Console', onClick: () => TKFirestoreConnection.openConsole() },
                  { label: copyingRules ? '复制中…' : '复制 Firestore 规则', variant: 'primary', disabled: copyingRules, onClick: () => void copyFirestoreRules() }
                ]}
              />
            ) : (
              <>
                <TableToolbar
                  className="mb-3"
                  left={(
                    <TableSearch
                      id="collection-search"
                      hint="搜索商品 / 店铺 / 状态；日期如 05-01 或 bj:05-01"
                      value={searchQuery}
                      onChange={value => {
                        setSearchQuery(value);
                        setCurrentPage(1);
                      }}
                      after={(
                        <SearchHelpButton
                          id="collection-search-help-btn"
                          modalId="collection-search-help-modal"
                          title="采集搜索说明"
                          open={searchHelpOpen}
                          onOpenChange={setSearchHelpOpen}
                          items={[
                            { label: '裸文本', children: 'NOMA、雨衣、店铺名、已采集、编辑失败、原因关键词。会搜索账号、商品、店铺、状态、判断、原因等字段。' },
                            { label: '裸日期', children: '05-18 等于 采集:2026-05-18。' },
                            { label: '定语日期', children: '采集:05-18、编辑:05-25；也可用英文键盘别名 cj:05-18、bj:05-25。' },
                            { label: '别名', children: 'cj=采集，bj=编辑。' },
                            { label: '符号兼容', children: '别名大小写不敏感，支持中文冒号、~ 或 ～、05/01 或 05.01、全角 ＞＝ / ＜＝。' },
                            { label: '范围', children: '采集:05-01～05-18，或 cj:05-01~05-18。' },
                            { label: '比较', children: '采集:>=05-01、编辑:<=05-18，或 cj:>=05-01、bj:<=05-18。' },
                            { label: '组合', children: 'NOMA 雨衣 cj:05-01~05-18 bj:>=05-18。' }
                          ]}
                        />
                      )}
                    />
                  )}
                  right={(
                    <div className="inline-flex flex-wrap items-center gap-4 max-[768px]:gap-3">
                      <TableSortButton
                        id="collection-sort-btn"
                        className="collection-sort"
                        title={sortTitle}
                        onClick={() => {
                          setSortOrder(value => value === 'asc' ? 'desc' : 'asc');
                          setCurrentPage(1);
                        }}
                      >
                        排序 {sortIcon}
                      </TableSortButton>
                      <TablePager
                        pageSize={pageState.pageSize}
                        pageSizeOptions={PAGE_SIZE_OPTIONS}
                        currentPage={pageState.currentPage}
                        totalPages={pageState.totalPages}
                        onPageSizeChange={value => {
                          setPageSize(value);
                          setCurrentPage(1);
                        }}
                        onPageChange={delta => setCurrentPage(value => value + delta)}
                      />
                    </div>
                  )}
                />

                {!activeData?.rows.length ? (
                  <ModuleListState
                    tone="empty"
                    title={datasetMeta[activeDataset].emptyTitle}
                    description={datasetMeta[activeDataset].emptyDescription}
                  />
                ) : !sortedRows.length ? (
                  <ModuleListState
                    tone="empty"
                    title={searchQuery ? '没有匹配的采集记录' : `账号「${activeAccount}」下还没有采集记录`}
                    description={searchQuery ? '换个关键词试试。' : '切回全部账号，或让 Codex 为这个账号执行一次采集。'}
                  />
                ) : (
                  <TableViewport>
                    <TableFrame>
                      <CollectionTable
                        datasetKey={activeDataset}
                        rows={pagedRows}
                        headers={activeData.headers}
                        startIndex={startIndex}
                      />
                    </TableFrame>
                  </TableViewport>
                )}
              </>
            )}
          </>
        )}
      </Card>
      <AddAccountDialog
        modalId="collection-add-acc-modal"
        formId="collection-add-acc-form"
        inputId="collection-new-acc-input"
        open={accountModalOpen}
        value={newAccountName}
        onValueChange={setNewAccountName}
        onOpenChange={setAccountModalOpen}
        onConfirm={addAccount}
      />
      <AccountEditDialog
        modalId="collection-edit-acc-modal"
        formId="collection-edit-acc-form"
        inputId="collection-edit-acc-input"
        open={accountEditOpen}
        accountName={editingAccountName}
        value={editingAccountValue}
        onValueChange={setEditingAccountValue}
        onOpenChange={setAccountEditOpen}
        onConfirm={renameAccount}
      />
      <AccountDeleteDialog
        modalId="collection-delete-acc-modal"
        open={accountDeleteOpen}
        accountName={deletingAccountName}
        onOpenChange={setAccountDeleteOpen}
        onConfirm={deleteAccount}
      />
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className={metricClass}>
      <div className={metricLabelClass}>{label}</div>
      <div className={metricValueClass}>{value}</div>
    </div>
  );
}

function CollectionTable({
  datasetKey,
  headers,
  rows,
  startIndex
}: {
  datasetKey: DatasetKey;
  headers: string[];
  rows: { row: CsvRow; sourceIndex: number }[];
  startIndex: number;
}) {
  const visibleHeaders = getVisibleHeaders(datasetKey, headers);
  return (
    <Table className={tableClass}>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          {visibleHeaders.map(header => <TableHead key={header} title={getHeaderHelp(header)}>{getHeaderLabel(header)}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ row, sourceIndex }, index) => {
          const seqNum = startIndex + index + 1;
          return (
            <TableRow key={`${sourceIndex}-${getRowValue(row, ['商品名称', '商品链接'])}`}>
              <TableCell className="text-[var(--muted)] tabular-nums">{seqNum}</TableCell>
              {visibleHeaders.map(header => (
                <TableCell className={header.includes('商品名') || header === '编辑标题' ? productCellClass : undefined} key={header}>
                  {renderCell(header, row)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function renderCell(header: string, row: CsvRow) {
  const value = row[header] || '';
  if (header === '商品名称') return <ProductNameCell value={value} row={row} />;
  if (header === '采集状态') return <StatusBadge status={normalizeStatus(value)} />;
  if (header === '店小秘编辑状态') return <EditStatusBadge status={normalizeEditStatus(row)} />;
  if (header === '采集时间' || header === '编辑时间') return <span className="tabular-nums">{formatDateTimeCell(value) || '-'}</span>;
  if (header === '选品判断') return <span className={truncateClass} title={buildSelectionJudgement(row)}>{buildSelectionJudgement(row) || '-'}</span>;
  if (header === '编辑判断') return <span className={truncateClass} title={buildEditJudgement(row)}>{buildEditJudgement(row) || '-'}</span>;
  if (header.includes('拒绝原因') && value) return <Badge variant="danger">{value}</Badge>;
  if (header === '选品分' && value) return <Badge variant={Number(value) >= 78 ? 'success' : Number(value) >= 65 ? 'info' : 'default'}>{value}</Badge>;
  if (header.includes('销量') || header.includes('销售额') || header === '排名') return <span className="tabular-nums">{value || '-'}</span>;
  return <span className={truncateClass} title={value || ''}>{value || '-'}</span>;
}

function ProductNameCell({ value, row }: { value: string; row: CsvRow }) {
  const text = value;
  const productUrl = getRowValue(row, ['核心 TK 链接', '商品链接', 'product_url', 'tk_product_url', '链接']);
  if (!text) return <span className="text-[var(--muted)]">-</span>;
  return (
    <span className={productNameWrapClass}>
      <span className={productNameTextClass} title={text}>{text}</span>
      {productUrl ? (
        <span className={productNameActionsClass}>
          <Button asChild size="smIcon" title="打开商品链接">
            <a href={productUrl} target="_blank" rel="noopener"><ExternalLink size={14} strokeWidth={2} aria-hidden="true" /></a>
          </Button>
          <Button size="smIcon" title="复制商品链接" onClick={() => void copyText(productUrl)}>
            <Copy size={14} strokeWidth={2} aria-hidden="true" />
          </Button>
        </span>
      ) : null}
    </span>
  );
}

function getHeaderLabel(header: string) {
  return header;
}

function getHeaderHelp(header: string) {
  if (header === '选品分') return '加分制选品分，基准 50 分，不是百分制；商品销量、店铺动销、目标销售额、类目偏好、小件属性、组合装机会、场景词等会加分，硬风险品先剔除。';
  if (header === '选品判断') return '采集成功时写成功选品逻辑；采集失败时写采集失败原因。';
  if (header === '店小秘编辑状态') return '表示该商品在店小秘商品详情页的编辑进度。';
  if (header === '编辑判断') return '编辑成功时写编辑结论；编辑失败或不合格时写决定性原因。';
  if (header === '商品名称') return '采集时记录的原始商品标题，用于和编辑后的标题对照。';
  if (header === '编辑标题') return '店小秘编辑完成后回写的最终日语标题。';
  return undefined;
}

function StatusBadge({ status }: { status: CollectStatus }) {
  if (status === '已采集') {
    return <Badge variant="success" className={statusBadgeClass}><CheckCircle2 size={13} strokeWidth={2} aria-hidden="true" />已采集</Badge>;
  }
  if (status === '失败') {
    return <Badge variant="danger" className={statusBadgeClass}><XCircle size={13} strokeWidth={2} aria-hidden="true" />失败</Badge>;
  }
  return <span className="text-[var(--muted)]">-</span>;
}

function EditStatusBadge({ status }: { status: string }) {
  if (status === '已编辑') return <Badge variant="success" className={statusBadgeClass}><CheckCircle2 size={13} strokeWidth={2} aria-hidden="true" />已编辑</Badge>;
  if (status === '编辑失败') return <Badge variant="danger" className={statusBadgeClass}><XCircle size={13} strokeWidth={2} aria-hidden="true" />编辑失败</Badge>;
  return <Badge variant="default" className={statusBadgeClass}>未编辑</Badge>;
}

function getVisibleHeaders(datasetKey: DatasetKey, headers: string[]) {
  const preferred: Record<DatasetKey, string[]> = {
    records: ['账号', '选品分', '商品名称', '店铺名', '商品价格', '商品近7天销量', '采集时间', '采集状态', '选品判断', '店小秘编辑状态', '编辑时间', '编辑标题', '编辑判断']
  };
  const available = preferred[datasetKey].filter(header => header === '选品判断' || header === '编辑判断' || header === '店小秘编辑状态' || headers.includes(header));
  return available.length ? available : headers.slice(0, 10);
}

function buildSelectionJudgement(row: CsvRow) {
  const explicit = String(row['选品判断'] || '').trim();
  return explicit;
}

function normalizeEditStatus(row: CsvRow) {
  const status = String(row['店小秘编辑状态'] || '').trim();
  if (String(row['编辑标题'] || '').trim()) return '已编辑';
  if (status === '已编辑') return '已编辑';
  if (status === '编辑失败') return '编辑失败';
  return '未编辑';
}

function buildEditJudgement(row: CsvRow) {
  return String(row['编辑判断'] || '').trim();
}

function buildSummary(datasets: Record<DatasetKey, CollectionDataset | null>) {
  return buildSummaryRows(datasets.records?.rows || []);
}

function buildSummaryRows(recordRows: CsvRow[]) {
  return {
    recordCount: recordRows.length,
    collectedCount: recordRows.filter(isCollectedRecord).length,
    editedCount: recordRows.filter(isDxmEditedRecord).length,
    pendingCount: 0,
    actionNeededCount: recordRows.filter(row => normalizeStatus(row['采集状态']) === '失败').length
  };
}

function normalizeAccountName(value: unknown): string {
  return String(value || '').trim();
}

function uniqueAccounts(values: unknown[] = []) {
  const seen = new Set<string>();
  const accounts: string[] = [];
  values.forEach(value => {
    const account = normalizeAccountName(value);
    if (!account || seen.has(account)) return;
    seen.add(account);
    accounts.push(account);
  });
  return accounts;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);

  const cleaned = rows.filter(values => values.some(value => value.trim()));
  const headers = (cleaned.shift() || []).map(value => value.trim());
  if (!headers.length) throw new Error('CSV 没有表头');
  return {
    headers,
    rows: cleaned.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])))
  };
}

function stringifyCsv(headers: string[], rows: CsvRow[]) {
  return [
    headers.map(csvCell).join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header] || '')).join(','))
  ].join('\r\n');
}

function csvCell(value: string) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制');
  } catch {
    showToast('复制失败，请手动复制', 'error');
  }
}

function clampPage(currentPage: number, pageSize: number, totalItems: number) {
  const safePageSize = Math.max(1, Number(pageSize) || 50);
  const totalPages = Math.max(1, Math.ceil((totalItems || 0) / safePageSize));
  const nextCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
  return { currentPage: nextCurrentPage, totalPages, pageSize: safePageSize };
}

function normalizeStatus(value: string): CollectStatus {
  const text = String(value || '').trim();
  if (text === '已采集') return '已采集';
  if (text === '采集失败') return '失败';
  return '';
}

function isCollectedRecord(row: CsvRow) {
  return normalizeStatus(row['采集状态']) === '已采集';
}

function isDxmEditedRecord(row: CsvRow) {
  return normalizeEditStatus(row) === '已编辑';
}

function formatDateTimeCell(value: string) {
  const text = String(value || '').trim();
  if (!text) return '';
  const normalizedText = text.replace('T', ' ').replace(/\.\d{3}Z$/i, '').replace(/Z$/i, '');
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalizedText) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
    return normalizedText.slice(0, 16);
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return normalizedText.slice(0, 16);
  return formatDateTimeObject(date);
}

function formatDateTimeObject(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getRowValue(row: CsvRow, names: string[]) {
  for (const name of names) {
    if (row[name]) return row[name];
  }
  return '';
}

export { CollectionPage, parseCsv, stringifyCsv };
