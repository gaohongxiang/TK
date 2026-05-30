import { Copy, Database, ExternalLink, FileArchive, LockKeyhole, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { AppRuntime } from './AppRuntime';
import { TopbarActionsContext } from './TopbarActionsContext';
import { CalculatorApp } from '../features/calculator/CalculatorApp';
import { CollectionPage } from '../features/collection/CollectionPage';
import { FinancePage } from '../features/finance/FinancePage';
import { OrdersPage } from '../features/orders/OrdersPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { AccountManagementPage, PermissionManagementPage, ProjectSettingsPage } from '../features/admin/AdminPages';
import { AppShell } from '../layouts/AppShell';
import { TKAppConfig } from '../../app-config.ts';
import {
  ALL_PERMISSION_MODULES,
  bootstrapOwner,
  canAccessModule,
  getAuthErrorMessage,
  getAuthSessionSnapshot,
  getRestrictedModuleMessage,
  initializeAuthSession,
  readProjectInitialized,
  readOwnerEmail,
  sendPasswordReset,
  signInWithEmailPassword,
  signOutAuthSession,
  subscribeAuthSession,
  type ModulePermissionKey,
  type AuthSessionState
} from '../../auth-permissions.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ExportOptions } from '@/components/ui/export-options';
import { TKFirestoreConnection } from '../../firestore-connection.ts';
import {
  ALL_ACCOUNT_KEY,
  buildExportFiles,
  downloadExportFiles,
  getExportAccountOptionsFromSnapshot,
  getModuleOptionsForPermissions,
  loadExportCenterSnapshot,
  type ExportCenterSnapshot,
  type ExportModuleKey,
  type ExportOption
} from '../../app-export-center.ts';
import { ensureGlobalSettingsStore } from '../../global-settings.ts';

type ModuleItem = {
  key: string;
  label: string;
};

type AnalyticsRouteModule = typeof import('../features/analytics/AnalyticsRoute');

const fallbackModules = Object.freeze([
  Object.freeze({ key: 'calc', label: '利润计算器' }),
  Object.freeze({ key: 'products', label: '商品管理' }),
  Object.freeze({ key: 'orders', label: '订单管理' }),
  Object.freeze({ key: 'finance', label: '收支管理' }),
  Object.freeze({ key: 'collection', label: '商品采编' }),
  Object.freeze({ key: 'analytics', label: '数据分析' })
]) as readonly ModuleItem[];
const loginModule = Object.freeze({ key: 'login', label: '项目登录' }) as ModuleItem;
const projectSettingsModule = Object.freeze({ key: 'project-settings', label: '数据库管理' }) as ModuleItem;
const accountModule = Object.freeze({ key: 'accounts', label: '账号管理' }) as ModuleItem;
const permissionModule = Object.freeze({ key: 'permissions', label: '权限管理' }) as ModuleItem;
const protectedModuleKeys = new Set(ALL_PERMISSION_MODULES);
const ownerOnlyModuleKeys = new Set(['project-settings', 'accounts', 'permissions']);

let analyticsRoutePromise: Promise<AnalyticsRouteModule> | null = null;

function getModules(config = TKAppConfig): ModuleItem[] {
  const modules = (config && Array.isArray(config.modules)) ? config.modules : fallbackModules;
  return modules
    .map(module => ({
      key: String(module?.key || '').trim(),
      label: String(module?.label || '').trim()
    }))
    .filter(module => module.key && module.label);
}

function getModuleMap(config = TKAppConfig) {
  return Object.fromEntries([...getModules(config), loginModule, projectSettingsModule, accountModule, permissionModule].map(module => [module.key, module]));
}

function getRouteKey(locationRef: Location | { hash?: string } = globalThis.location, config = TKAppConfig) {
  const moduleMap = getModuleMap(config);
  const key = String(locationRef?.hash || '#calc').replace(/^#/, '').split('?')[0];
  return moduleMap[key] ? key : 'calc';
}

function loadAnalyticsRoute() {
  if (!analyticsRoutePromise) {
    analyticsRoutePromise = import('../features/analytics/AnalyticsRoute');
  }
  return analyticsRoutePromise;
}

function viewClass(active: string, key: string) {
  return active === key ? 'relative block' : 'relative hidden';
}

const appFooterClass = 'relative mt-[30px] grid justify-items-center gap-2 text-center text-xs leading-[1.65] text-[var(--muted)]';
const appFooterCopyClass = 'max-w-[860px]';
const appFooterLinksClass = 'inline-flex flex-wrap justify-center gap-2.5';
const appFooterLinkClass = 'relative z-[3] inline-flex min-h-7 items-center font-bold text-[var(--accent)] hover:underline';
const appFooterCopyrightClass = 'text-[11.5px]';
const skipLinkClass = 'skip-link fixed left-2.5 top-2.5 z-[10000] -translate-y-[140%] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[var(--text)] shadow-[var(--shadow)] transition-transform focus:translate-y-0 focus:outline-[3px] focus:outline-[rgba(110,168,255,.35)] focus:outline-offset-2';
const appWrapClass = 'app-layout-content min-w-0';
const appWorkspaceClass = 'app-workspace';
const appMainClass = 'app-main min-w-0 outline-none';
const appTopbarClass = 'app-topbar -mx-[18px] mb-4 grid h-[74px] grid-cols-[minmax(0,460px)_minmax(360px,1fr)] items-center gap-12 overflow-visible border-b border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-white px-7 py-2 max-[1100px]:grid-cols-[minmax(0,1fr)_auto] max-[760px]:h-auto max-[760px]:min-h-[74px] max-[760px]:grid-cols-1 max-[760px]:gap-2 max-[760px]:px-5';
const appTopbarLeftClass = 'grid min-w-0 content-center gap-1';
const appTopbarTitleRowClass = 'flex min-w-0 flex-nowrap items-start gap-2 overflow-hidden';
const appTopbarTitleClass = 'm-0 shrink-0 text-[17px] font-bold leading-[1.08] text-[var(--text)]';
const appTopbarDescriptionClass = 'm-0 mt-0.5 max-w-[900px] truncate text-[11.5px] leading-[1.45] text-[var(--muted)]';
const appTopbarActionsClass = 'app-topbar-actions flex min-w-0 flex-wrap items-center justify-end gap-2 max-[760px]:justify-start';
const appTopbarRightClass = 'app-topbar-right relative flex min-w-0 items-center justify-end gap-2';
const appGlobalStatusClass = 'app-global-status inline-flex min-w-0 max-w-[310px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-[12px] font-semibold text-[var(--text)] shadow-[0_10px_24px_rgba(14,20,44,.06)]';
const appGlobalStatusTextClass = 'min-w-0 truncate';
const appAccountMenuClass = 'app-account-menu relative min-w-0';
const appAccountButtonClass = 'app-account-button inline-flex max-w-[300px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel2)] px-2.5 py-1.5 text-left text-[12px] font-semibold text-[var(--text)] shadow-[0_10px_24px_rgba(14,20,44,.06)] hover:border-[color-mix(in_srgb,var(--accent)_42%,var(--border))]';
const appAccountAvatarClass = 'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,white)] text-[var(--accent)]';
const appAccountTextClass = 'grid min-w-0 leading-tight';
const appAccountEmailClass = 'min-w-0 max-w-[190px] truncate';
const appAccountDropdownClass = 'app-account-dropdown absolute right-0 top-[calc(100%+8px)] z-[130] grid min-w-[230px] gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-2 shadow-[var(--shadow)]';
const appConnectionDropdownClass = 'app-account-dropdown absolute left-0 top-[calc(100%+8px)] z-[130] grid w-full min-w-full gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-2 shadow-[var(--shadow)]';
const appAccountMenuButtonClass = 'inline-flex min-h-9 w-full items-center gap-2 rounded-xl border border-transparent bg-transparent px-3 text-left text-[12px] font-semibold text-[var(--text)] hover:border-[var(--border)] hover:bg-[var(--panel2)]';
const appAccountDangerButtonClass = `${appAccountMenuButtonClass} text-[var(--danger)]`;
const appExportDialogClass = 'max-w-[760px]';
const appExportCopyClass = 'm-0 mb-4 text-[12.5px] leading-[1.65] text-[var(--muted)]';
const appExportGridClass = 'grid grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] gap-4 max-[760px]:grid-cols-1';
const appExportPanelClass = 'grid min-w-0 content-start gap-3 rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--panel2)_48%,transparent)] p-3';
const appExportPanelTitleClass = 'text-[12px] font-semibold text-[var(--muted)]';
const appExportModuleGridClass = 'grid gap-2';
const appExportModuleOptionClass = 'flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,.025)] px-3 py-2.5';
const appExportModuleLabelClass = 'inline-flex min-w-0 items-center gap-2.5 text-[13px] font-semibold text-[var(--text)]';
const appExportModuleMetaClass = 'whitespace-nowrap text-[11.5px] text-[var(--muted)]';
const appExportHintClass = 'rounded-xl border border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_6%,var(--panel))] px-3 py-2 text-[12px] leading-[1.55] text-[var(--muted)]';
const appExportEmptyClass = 'rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-[12px] leading-[1.55] text-[var(--muted)]';
const analyticsStatusClass = 'analytics-react-status mb-4 grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3.5 max-[640px]:grid-cols-[32px_minmax(0,1fr)]';
const analyticsStatusMarkClass = 'analytics-react-status-mark h-[38px] w-[38px] rounded-xl border border-[color-mix(in_srgb,var(--accent2)_45%,var(--border))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent2)_56%,transparent),transparent),color-mix(in_srgb,var(--panel2)_48%,transparent)]';
const analyticsStatusLoadingClass = '[&_.analytics-react-status-mark]:animate-pulse';
const analyticsStatusErrorClass = '[&_.analytics-react-status-mark]:border-[color-mix(in_srgb,var(--danger)_56%,var(--border))] [&_.analytics-react-status-mark]:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--danger)_48%,transparent),transparent),color-mix(in_srgb,var(--panel2)_48%,transparent)]';
const analyticsStatusTitleClass = 'mb-1 mt-0 text-[15px]';
const analyticsStatusCopyClass = 'm-0 text-[12.5px] text-[var(--muted)]';
const analyticsStatusRetryClass = 'max-[640px]:col-start-2 max-[640px]:justify-self-start';
const moduleAccessCardClass = 'module-access-card mx-auto grid max-w-[520px] gap-4 rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel2)_62%,white),var(--panel))] p-6 text-center shadow-[var(--shadow)]';
const moduleAccessIconClass = 'mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_34%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel))] text-[var(--accent)]';
const moduleAccessCopyClass = 'm-0 text-[13px] leading-[1.65] text-[var(--muted)]';
const moduleAccessActionsClass = 'flex justify-center gap-2';
const moduleAccessErrorClass = 'm-0 text-[12px] leading-normal text-[var(--danger)]';
const loginSingleLayoutClass = 'mx-auto mt-12 grid max-w-[600px] items-start max-[640px]:mt-7';
const loginPageLayoutClass = 'mx-auto mt-3 grid max-w-[900px] items-start';
const loginSetupCardClass = 'overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel2)_64%,white),var(--panel))] shadow-[var(--shadow)]';
const loginSetupHeaderClass = 'grid gap-2 border-b border-[var(--border)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_8%,transparent),transparent)] px-5 py-5 max-[640px]:px-4';
const loginSetupBodyClass = 'grid gap-0 px-5 py-4 max-[640px]:px-4';
const loginAuthCardClass = 'grid content-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)] max-[640px]:p-4';
const loginPageHeaderClass = 'grid gap-2 text-left';
const loginPageTitleClass = 'm-0 text-[22px] font-semibold tracking-0 text-[var(--text)] max-[640px]:text-[19px]';
const loginPageCopyClass = 'm-0 text-[13px] leading-[1.7] text-[var(--muted)]';
const loginPageFormClass = 'grid gap-3';
const loginPageInlineClass = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[12px] leading-none max-[640px]:grid-cols-1 max-[640px]:items-start';
const loginPageInlineCopyClass = 'min-w-0 truncate whitespace-nowrap text-[var(--muted)]';
const loginPageInlineActionsClass = 'inline-flex flex-none items-center justify-end gap-4 whitespace-nowrap max-[640px]:justify-start';
const loginPageActionsClass = 'flex flex-wrap justify-end gap-2';
const loginSubmitActionsClass = 'flex justify-center pt-1';
const loginSubmitButtonClass = 'min-w-[180px] justify-center px-9';
const loginResetButtonClass = 'min-w-[86px] justify-center font-semibold text-[var(--accent)] hover:text-[var(--accent2)]';
const loginInitializedCardClass = 'grid min-w-0 gap-4 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--ok)_28%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--ok)_8%,var(--panel)),var(--panel))] p-5 shadow-[var(--shadow)] max-[640px]:p-4';
const loginInitializedBadgeClass = 'inline-flex w-fit items-center rounded-full border border-[color-mix(in_srgb,var(--ok)_34%,var(--border))] bg-[color-mix(in_srgb,var(--ok)_10%,var(--panel))] px-3 py-1 text-[12px] font-semibold text-[color-mix(in_srgb,var(--ok)_84%,var(--text))]';
const loginConnectionLinkBoxClass = 'mt-2 min-w-0 max-w-full rounded-[12px] border border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_6%,var(--panel))] px-3 py-2 text-[12px] leading-[1.6] text-[var(--muted)]';
const loginConnectionLinkTextClass = 'mt-1 block min-w-0 max-w-full overflow-hidden truncate whitespace-nowrap text-[11.5px]';
const setupStepClass = 'relative grid grid-cols-[34px_minmax(0,1fr)] gap-3 border-b border-[var(--border)] py-4 text-left last:border-b-0 max-[640px]:grid-cols-[30px_minmax(0,1fr)]';
const setupStepDoneClass = '[&_.setup-step-mark]:border-[color-mix(in_srgb,var(--ok)_38%,var(--border))] [&_.setup-step-mark]:bg-[color-mix(in_srgb,var(--ok)_12%,var(--panel))] [&_.setup-step-mark]:text-[color-mix(in_srgb,var(--ok)_86%,var(--text))]';
const setupStepAttentionClass = '[&_.setup-step-mark]:border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] [&_.setup-step-mark]:bg-[var(--panel)] [&_.setup-step-mark]:text-[var(--accent)]';
const setupStepMarkClass = 'setup-step-mark mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border text-[12px] font-semibold max-[640px]:h-7 max-[640px]:w-7';
const setupStepTitleClass = 'mb-1 flex min-w-0 flex-wrap items-center gap-2 text-[14px] font-semibold text-[var(--text)]';
const setupStepProjectClass = 'rounded-full border border-[color-mix(in_srgb,var(--ok)_30%,var(--border))] bg-[color-mix(in_srgb,var(--ok)_9%,var(--panel))] px-2 py-0.5 text-[11px] font-semibold text-[color-mix(in_srgb,var(--ok)_82%,var(--text))]';
const setupStepCopyClass = 'm-0 text-[12px] leading-[1.6] text-[var(--muted)]';
const setupStepActionsClass = 'mt-2 flex flex-wrap gap-2';
const setupConfigTextareaClass = 'min-h-[150px] font-mono text-[12px] leading-[1.45]';
const setupStepFormClass = 'mt-3 grid gap-3';
const setupStepFormGridClass = 'grid grid-cols-3 gap-3 max-[820px]:grid-cols-1';
const setupStepHintClass = 'mt-2 rounded-[12px] border border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_6%,var(--panel))] px-3 py-2 text-[12px] leading-[1.6] text-[var(--muted)]';

const moduleTopbarMeta: Record<string, { description?: string }> = {
  calc: {
    description: '根据各项参数统一测算售价、利润，以及确定售价复盘实际利润'
  },
  products: {
    description: '沉淀商品资料、预估运费和采购链接，录一次基础资料，后续订单直接复用。'
  },
  orders: {
    description: '集中管理采购、物流和入仓进度，并汇总销售额、支出与预估利润。'
  },
  finance: {
    description: '把订单利润作为预估收入，单独记录 TK 提现回款、成本支出和押金占用，避免回款滞后影响订单口径。'
  },
  collection: {
    description: '商品采编串联商品采集和商品编辑流程，集中查看采集、编辑判断和同步状态。'
  },
  analytics: {
    description: '本地解析 TikTok Shop 商品流量导出表，生成渠道表现、商品排行和运营诊断；数据不上传到本站服务器。'
  },
  login: {
    description: '登录后按账号权限显示订单、商品、收支、采编和数据分析模块。利润计算器不需要登录。'
  },
  'project-settings': {
    description: '查看当前项目连接、项目连接链接和 Firestore 规则。'
  },
  accounts: {
    description: '创建和维护项目成员账号。'
  },
  permissions: {
    description: '按成员配置可访问的业务模块。'
  }
};

function AnalyticsStatus({
  state,
  onRetry
}: {
  state: 'loading' | 'error';
  onRetry?: () => void;
}) {
  const isError = state === 'error';
  return (
    <Card className={`${analyticsStatusClass} ${isError ? analyticsStatusErrorClass : analyticsStatusLoadingClass}`} data-analytics-lazy-state={state}>
      <div className={analyticsStatusMarkClass} aria-hidden="true" />
      <div>
        <CardTitle className={analyticsStatusTitleClass}>{isError ? '数据分析加载失败' : '正在加载数据分析'}</CardTitle>
        <p className={analyticsStatusCopyClass}>{isError ? '图表模块没有加载成功，请检查网络后重试。' : '正在按需加载图表模块，稍等片刻。'}</p>
      </div>
      {isError ? <Button className={analyticsStatusRetryClass} size="sm" data-analytics-retry onClick={onRetry}>重试</Button> : null}
    </Card>
  );
}

function AnalyticsPane({ active }: { active: boolean }) {
  const [Route, setRoute] = useState<null | ComponentType>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [retryKey, setRetryKey] = useState(0);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    if (!active || Route) return undefined;
    let cancelled = false;
    setState('loading');
    loadAnalyticsRoute()
      .then(module => {
        if (cancelled) return;
        setRoute(() => module.AnalyticsRoute);
        setState('ready');
        setLoadedOnce(true);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [active, Route, retryKey]);

  if (!active && !loadedOnce) return null;
  if (Route) return <Route />;
  return (
    <AnalyticsStatus
      state={state === 'error' ? 'error' : 'loading'}
      onRetry={() => {
        analyticsRoutePromise = null;
        setState('idle');
        setRoute(null);
        setRetryKey(value => value + 1);
      }}
    />
  );
}

function getModuleLabel(modules: ModuleItem[], key: string) {
  return modules.find(module => module.key === key)?.label || key;
}

function ModuleAccessGate({
  moduleLabel,
  state
}: {
  moduleLabel: string;
  state: AuthSessionState;
}) {
  const isRestoringLogin = state.connected && !state.ready && !state.user;
  const isResolving = !!state.user && !state.ready && !state.member;
  const message = isRestoringLogin
    ? '正在恢复登录状态，马上回到当前模块。'
    : isResolving
    ? '正在读取当前账号权限，马上切换到可访问模块。'
    : state.user
    ? getRestrictedModuleMessage(moduleLabel)
    : '请先在项目登录页登录账号。';
  return (
    <Card className={moduleAccessCardClass} data-module-permission-gate>
      <div className={moduleAccessIconClass} aria-hidden="true">
        <LockKeyhole size={20} strokeWidth={2} />
      </div>
      <div>
        <CardTitle className="mb-2 text-base">{isRestoringLogin ? '正在恢复登录' : isResolving ? '正在读取权限' : `${moduleLabel}需要权限`}</CardTitle>
        <p className={moduleAccessCopyClass}>{message}</p>
        {state.error ? <p className={moduleAccessErrorClass}>{state.error}</p> : null}
      </div>
      <div className={moduleAccessActionsClass}>
        {!state.user && !isRestoringLogin ? <Button type="button" variant="primary" onClick={() => { window.location.hash = '#login'; }}>去项目登录</Button> : null}
      </div>
    </Card>
  );
}

function UnifiedExportDialog({
  accountOptions,
  exporting,
  loading,
  moduleOptions,
  open,
  selectedAccounts,
  selectedModules,
  onExport,
  onOpenChange,
  onReload,
  onSelectedAccountsChange,
  onSelectedModulesChange
}: {
  accountOptions: ExportOption[];
  exporting: boolean;
  loading: boolean;
  moduleOptions: ExportOption[];
  open: boolean;
  selectedAccounts: Set<string>;
  selectedModules: Set<ExportModuleKey>;
  onExport: () => void;
  onOpenChange: (open: boolean) => void;
  onReload: () => void;
  onSelectedAccountsChange: (value: Set<string>) => void;
  onSelectedModulesChange: (value: Set<ExportModuleKey>) => void;
}) {
  const allModulesChecked = moduleOptions.length > 0 && moduleOptions.every(option => selectedModules.has(option.key as ExportModuleKey));
  const selectedAccountCount = selectedAccounts.size;
  const selectedModuleCount = selectedModules.size;

  function toggleModule(moduleKey: ExportModuleKey, checked: boolean) {
    const next = new Set(selectedModules);
    if (checked) next.add(moduleKey);
    else next.delete(moduleKey);
    onSelectedModulesChange(next);
  }

  return (
    <Dialog open={open} titleId="app-export-title" onOpenChange={onOpenChange}>
      <DialogContent className={appExportDialogClass}>
        <DialogTitle id="app-export-title" className="mb-2">数据导出</DialogTitle>
        <p className={appExportCopyClass}>按店铺和模块统一导出 CSV。只选一个模块会直接下载 CSV；同时选择多个模块时会打包成 ZIP。</p>
        <div className={appExportGridClass}>
          <div className={appExportPanelClass}>
            <div className={appExportPanelTitleClass}>店铺</div>
            {loading ? (
              <div className={appExportEmptyClass}>正在读取店铺和数据量...</div>
            ) : accountOptions.length ? (
              <ExportOptions
                allCheckboxId="app-export-all-accounts"
                allLabel="全部店铺"
                checkboxClassName="app-export-account-checkbox"
                countLabel={count => `${count} 条`}
                options={accountOptions}
                optionsId="app-export-account-options"
                selected={selectedAccounts}
                onSelectedChange={onSelectedAccountsChange}
              />
            ) : (
              <div className={appExportEmptyClass}>还没有可导出的店铺数据。</div>
            )}
          </div>
          <div className={appExportPanelClass}>
            <div className={appExportPanelTitleClass}>模块</div>
            {moduleOptions.length ? (
              <div className={appExportModuleGridClass} id="app-export-module-options">
                <label className={appExportModuleOptionClass}>
                  <span className={appExportModuleLabelClass}>
                    <Checkbox
                      id="app-export-all-modules"
                      checked={allModulesChecked}
                      onChange={event => onSelectedModulesChange(event.target.checked ? new Set(moduleOptions.map(option => option.key as ExportModuleKey)) : new Set())}
                    />
                    <span>全部模块</span>
                  </span>
                  <span className={appExportModuleMetaClass}>{moduleOptions.length} 个</span>
                </label>
                {moduleOptions.map(option => {
                  const moduleKey = option.key as ExportModuleKey;
                  return (
                    <label className={appExportModuleOptionClass} key={option.key}>
                      <span className={appExportModuleLabelClass}>
                        <Checkbox
                          className="app-export-module-checkbox"
                          value={option.key}
                          checked={selectedModules.has(moduleKey)}
                          onChange={event => toggleModule(moduleKey, event.target.checked)}
                        />
                        <span>{option.label}</span>
                      </span>
                      <span className={appExportModuleMetaClass}>CSV</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className={appExportEmptyClass}>当前账号没有可导出的业务模块权限。</div>
            )}
            <div className={appExportHintClass}>
              已选 {selectedAccountCount} 个店铺、{selectedModuleCount} 个模块。导出使用各模块现有公共计算和 CSV 生成逻辑。
            </div>
          </div>
        </div>
        <DialogActions>
          <Button variant="ghost" onClick={onReload} disabled={loading || exporting}>刷新数据</Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={exporting}>取消</Button>
          <Button variant="primary" id="app-export-confirm" onClick={onExport} disabled={loading || exporting || !selectedAccountCount || !selectedModuleCount}>
            <FileArchive aria-hidden="true" />
            {exporting ? '导出中...' : '导出'}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

function SetupGuideStep({
  children,
  done = false,
  mark,
  project,
  title
}: {
  children: ReactNode;
  done?: boolean;
  mark: string;
  project?: string;
  title: string;
}) {
  return (
    <div className={`${setupStepClass} ${done ? setupStepDoneClass : setupStepAttentionClass}`}>
      <span className={setupStepMarkClass}>{done ? '✓' : mark}</span>
      <div className="min-w-0">
        <div className={setupStepTitleClass}>
          <span>{title}</span>
          {project ? <span className={setupStepProjectClass}>{project}</span> : null}
        </div>
        <div className={setupStepCopyClass}>{children}</div>
      </div>
    </div>
  );
}

function ProjectSetupGuide({
  authSession,
  configText,
  copyingRules,
  busy,
  email,
  password,
  confirmPassword,
  savingConfig,
  inlineError,
  onAuthSubmit,
  onConfigTextChange,
  onCopyRules,
  onEmailChange,
  onConfirmPasswordChange,
  onPasswordChange,
  onSaveConfig,
  onSignInMode
}: {
  authSession: AuthSessionState;
  configText: string;
  copyingRules: boolean;
  busy: boolean;
  email: string;
  password: string;
  confirmPassword: string;
  savingConfig: boolean;
  inlineError: string;
  onAuthSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onConfigTextChange: (value: string) => void;
  onCopyRules: () => void;
  onEmailChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSaveConfig: () => void;
  onSignInMode: () => void;
}) {
  const connected = !!authSession.connected && !!authSession.projectId;
  return (
    <Card className={loginSetupCardClass}>
      <div className={loginSetupHeaderClass}>
        <CardTitle className={loginPageTitleClass}>项目管理员初始化</CardTitle>
        <p className={loginPageCopyClass}>初始化只需要做一次。已经做过的步骤可以跳过；后续管理员和员工都用项目连接链接登录。</p>
      </div>
      <div className={loginSetupBodyClass}>
        <SetupGuideStep mark="1" title="创建 Firestore 数据库">
          <span>{'Firebase Console 左侧进入“Firestore Database”，创建数据库。建议选“生产模式”和离你最近的区域。'}</span>
          <div className={setupStepActionsClass}>
            <Button size="sm" onClick={() => TKFirestoreConnection.openConsole('firestore')}>
              <ExternalLink aria-hidden="true" />
              打开 Firestore
            </Button>
          </div>
        </SetupGuideStep>
        <SetupGuideStep mark="2" title="开启 Firebase Auth" done={false}>
          <span>{'Firebase Console 左侧点“安全 > Authentication > 登录方法”，启用“电子邮件地址/密码”。'}</span>
          <div className={setupStepActionsClass}>
            <Button size="sm" onClick={() => TKFirestoreConnection.openConsole(connected ? 'auth' : undefined)}>
              <ExternalLink aria-hidden="true" />
              {connected ? '打开 Authentication' : '打开 Firebase'}
            </Button>
          </div>
        </SetupGuideStep>
        <SetupGuideStep mark="3" title="保存项目连接" done={connected} project={connected ? authSession.projectId : ''}>
          <span>在 Firebase 项目里添加“网页应用”，把 firebaseConfig 粘贴到这里。这个配置只用来找到你的项目。</span>
          <div className={setupStepActionsClass}>
            <Button size="sm" onClick={() => TKFirestoreConnection.openConsole()}>
              <ExternalLink aria-hidden="true" />
              打开 Firebase
            </Button>
          </div>
          <Textarea
            className={setupConfigTextareaClass}
            rows={7}
            value={configText}
            placeholder={`{
  "apiKey": "AIza...",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "appId": "1:1234567890:web:abcdef"
}`}
            autoComplete="off"
            onChange={event => onConfigTextChange(event.target.value)}
          />
          <div className={setupStepActionsClass}>
            <Button size="sm" variant="primary" disabled={savingConfig || !configText.trim()} onClick={onSaveConfig}>
              {savingConfig ? '保存中…' : '保存项目连接'}
            </Button>
          </div>
        </SetupGuideStep>
        <SetupGuideStep mark="4" title="发布数据库规则">
          <span>先发布最新 Firestore 规则。规则发布后，管理员账号才能写入成员和权限资料。</span>
          <div className={setupStepActionsClass}>
            <Button size="sm" disabled={copyingRules} onClick={onCopyRules}>
              <Copy aria-hidden="true" />
              {copyingRules ? '复制中…' : '复制最新规则'}
            </Button>
            <Button size="sm" disabled={!connected} onClick={() => TKFirestoreConnection.openConsole('rules')}>
              <ExternalLink aria-hidden="true" />
              打开 Rules
            </Button>
          </div>
        </SetupGuideStep>
        <SetupGuideStep mark="5" title="创建管理员账号" done={authSession.isOwner}>
          <span>规则发布后，用管理员邮箱和密码创建第一个管理员账号。</span>
          <form className={setupStepFormClass} onSubmit={onAuthSubmit}>
            {!authSession.connected ? (
              <Alert variant="warning" className="text-[12px] leading-[1.65]">
                <AlertDescription>先完成第 3 步，保存 Firebase 连接后再创建管理员账号。</AlertDescription>
              </Alert>
            ) : null}
            <div className={setupStepFormGridClass}>
              <Input type="email" value={email} placeholder="管理员邮箱" autoComplete="email" onChange={event => onEmailChange(event.target.value)} />
              <Input type="password" value={password} placeholder="密码" autoComplete="new-password" onChange={event => onPasswordChange(event.target.value)} />
              <Input type="password" value={confirmPassword} placeholder="确认密码" autoComplete="new-password" onChange={event => onConfirmPasswordChange(event.target.value)} />
            </div>
            {inlineError ? (
              <Alert variant="danger" className="text-[12px] leading-[1.65]">
                <AlertDescription>{inlineError}</AlertDescription>
              </Alert>
            ) : null}
            <div className={setupStepActionsClass}>
              <Button type="submit" size="sm" variant="primary" disabled={busy || !email.trim() || !password || !confirmPassword || !authSession.connected}>
                {busy ? '处理中…' : '创建管理员账号'}
              </Button>
              <Button type="button" size="sm" onClick={onSignInMode}>返回登录</Button>
            </div>
          </form>
        </SetupGuideStep>
        <SetupGuideStep mark="6" title="管理员后台" done={authSession.isOwner}>
          <span>管理员登录后，在账号管理里创建员工账号，在权限管理里给账号勾选模块权限。</span>
          <div className={setupStepHintClass}>普通登录页不会显示这些初始化步骤，员工只看到登录入口。</div>
        </SetupGuideStep>
      </div>
    </Card>
  );
}

function ProjectInitializedCard({
  authSession,
  onSignInMode
}: {
  authSession: AuthSessionState;
  onSignInMode: () => void;
}) {
  const [copiedLink, setCopiedLink] = useState('');

  async function copyProjectConnectionLink() {
    try {
      const link = TKFirestoreConnection.createConnectionLink();
      await TKFirestoreConnection.copyText(link);
      setCopiedLink(link);
      TKFirestoreConnection.showToast('项目连接链接已复制');
    } catch (error) {
      TKFirestoreConnection.showToast(error instanceof Error ? error.message : '项目连接链接复制失败', 'error');
    }
  }

  return (
    <Card className={loginInitializedCardClass}>
      <div className={loginPageHeaderClass}>
        <span className={loginInitializedBadgeClass}>已初始化</span>
        <CardTitle className={loginPageTitleClass}>项目管理员已设置</CardTitle>
        <p className={loginPageCopyClass}>
          这个项目已经完成初始化。以后管理员换电脑、员工第一次使用，都打开同一个项目连接链接，再登录自己的账号。
        </p>
      </div>
      <div className={loginConnectionLinkBoxClass}>
        <strong>项目连接链接</strong>
        <div className={loginConnectionLinkTextClass}>{copiedLink || '点击下方按钮复制。链接会把当前项目连接导入浏览器，不会自动登录账号。'}</div>
      </div>
      <div className={loginPageActionsClass}>
        <Button type="button" onClick={() => void copyProjectConnectionLink()}><Copy aria-hidden="true" />复制项目连接链接</Button>
        <Button type="button" onClick={onSignInMode}>返回登录</Button>
        {authSession.isOwner ? (
          <>
            <Button type="button" onClick={() => { window.location.hash = '#project-settings'; }}>打开数据库管理</Button>
            <Button type="button" onClick={() => { window.location.hash = '#accounts'; }}>打开账号管理</Button>
            <Button type="button" variant="primary" onClick={() => { window.location.hash = '#permissions'; }}>打开权限管理</Button>
          </>
        ) : null}
      </div>
    </Card>
  );
}

function ProjectLoginPage({
  authSession
}: {
  authSession: AuthSessionState;
}) {
  const [authMode, setAuthMode] = useState<'signin' | 'setup'>('signin');
  const [configText, setConfigText] = useState(() => TKFirestoreConnection.getConfig()?.configText || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSentOnce, setResetSentOnce] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [savingConfig, setSavingConfig] = useState(false);
  const [copyingRules, setCopyingRules] = useState(false);
  const [initializedOwnerEmail, setInitializedOwnerEmail] = useState(() => readOwnerEmail(authSession.projectId || TKFirestoreConnection.getConfig()?.projectId || ''));
  const [projectInitializedRemote, setProjectInitializedRemote] = useState(false);
  const isSetup = authMode === 'setup';
  const projectId = authSession.projectId || TKFirestoreConnection.getConfig()?.projectId || '';
  const projectInitialized = !!initializedOwnerEmail || projectInitializedRemote || authSession.isOwner;
  const showAdminSetup = isSetup && !projectInitialized;
  const showInitialized = isSetup && projectInitialized;
  const displayedError = inlineError || (authSession.error ? getAuthErrorMessage(authSession.error, authSession.error) : '');

  useEffect(() => {
    const syncConfig = () => {
      const cfg = TKFirestoreConnection.getConfig();
      setConfigText(cfg?.configText || '');
      setInitializedOwnerEmail(readOwnerEmail(cfg?.projectId || ''));
    };
    window.addEventListener('tk-firestore-config-changed', syncConfig);
    return () => window.removeEventListener('tk-firestore-config-changed', syncConfig);
  }, []);

  useEffect(() => {
    setInitializedOwnerEmail(readOwnerEmail(projectId));
    setProjectInitializedRemote(false);
  }, [projectId, authSession.isOwner]);

  useEffect(() => {
    if (!projectId || !authSession.connected) return undefined;
    let cancelled = false;
    readProjectInitialized()
      .then(initialized => {
        if (!cancelled) setProjectInitializedRemote(initialized);
      })
      .catch(() => {
        if (!cancelled) setProjectInitializedRemote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, authSession.connected, authSession.isOwner]);

  useEffect(() => {
    if (!resetCooldown) return undefined;
    const timer = window.setInterval(() => {
      setResetCooldown(value => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  function saveConnectionFromPage() {
    if (savingConfig) return;
    setSavingConfig(true);
    setInlineError('');
    try {
      const next = TKFirestoreConnection.saveConfig(configText);
      TKFirestoreConnection.dispatchConfigChanged({ connected: true, ...next });
      initializeAuthSession(next.configText);
      setConfigText(next.configText);
      TKFirestoreConnection.showToast('已保存连接');
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : '连接失败');
    } finally {
      setSavingConfig(false);
    }
  }

  async function copyRules() {
    setCopyingRules(true);
    setInlineError('');
    try {
      await TKFirestoreConnection.copyRules();
      TKFirestoreConnection.showToast('规则已复制');
    } catch (error) {
      const message = error instanceof Error ? error.message : '复制失败';
      setInlineError(message);
      TKFirestoreConnection.showToast(message, 'error');
    } finally {
      setCopyingRules(false);
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setInlineError('');
    try {
      if (isSetup) {
        if (password !== confirmPassword) {
          setInlineError('两次输入的密码不一致');
          return;
        }
        await bootstrapOwner(email, password);
        setInitializedOwnerEmail(email.trim().toLowerCase());
        TKFirestoreConnection.showToast('管理员账号已设置');
        setAuthMode('signin');
      } else {
        await signInWithEmailPassword(email, password, 'signin');
        TKFirestoreConnection.showToast('已登录');
      }
      setPassword('');
      setConfirmPassword('');
      window.location.hash = '#calc';
    } catch (error) {
      const message = getAuthErrorMessage(error, isSetup ? '管理员账号创建失败' : '登录失败');
      setInlineError(message);
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset() {
    if (resetBusy || resetCooldown) return;
    if (!email.trim()) {
      setInlineError('请输入邮箱后再发送重置密码邮件');
      return;
    }
    if (!authSession.connected) {
      setInlineError('请先打开管理员发来的连接链接，再发送重置密码邮件');
      return;
    }
    setResetBusy(true);
    setInlineError('');
    try {
      await sendPasswordReset(email);
      setResetSentOnce(true);
      setResetCooldown(60);
      TKFirestoreConnection.showToast('重置密码邮件已发送，请检查邮箱');
    } catch (error) {
      setInlineError(getAuthErrorMessage(error, '重置密码邮件发送失败'));
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <section className={showAdminSetup ? loginPageLayoutClass : loginSingleLayoutClass} data-project-login-page>
      {showInitialized ? (
        <ProjectInitializedCard
          authSession={authSession}
          onSignInMode={() => {
            setInlineError('');
            setAuthMode('signin');
          }}
        />
      ) : showAdminSetup ? (
        <ProjectSetupGuide
          authSession={authSession}
          configText={configText}
          copyingRules={copyingRules}
          busy={busy}
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          savingConfig={savingConfig}
          inlineError={displayedError}
          onAuthSubmit={submitAuth}
          onConfigTextChange={setConfigText}
                  onCopyRules={() => void copyRules()}
          onEmailChange={setEmail}
          onConfirmPasswordChange={setConfirmPassword}
          onPasswordChange={setPassword}
          onSaveConfig={saveConnectionFromPage}
          onSignInMode={() => {
            setInlineError('');
            setAuthMode('signin');
          }}
        />
      ) : (
        <Card className={loginAuthCardClass}>
        <div className={loginPageHeaderClass}>
          <CardTitle className={loginPageTitleClass}>{isSetup ? '创建管理员账号' : '项目登录'}</CardTitle>
          <p className={loginPageCopyClass}>
            {isSetup
              ? '完成左侧前两步后，在这里创建第一个管理员账号。'
              : '登录后按账号权限显示订单、商品、收支、采编和数据分析模块。利润计算器不需要登录。'}
          </p>
        </div>

        {authSession.user ? (
          <Alert variant="success" className="text-[13px] leading-[1.65]">
            <AlertDescription>
              当前已登录：{authSession.user.email || authSession.user.uid}。{authSession.member?.role === 'owner' ? '管理员账号拥有全部模块权限。' : '导航会显示当前账号已授权的模块。'}
            </AlertDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={() => { window.location.hash = '#calc'; }}>返回利润计算器</Button>
              <Button size="sm" onClick={() => void signOutAuthSession()}>退出登录</Button>
            </div>
          </Alert>
        ) : (
          <form className={loginPageFormClass} onSubmit={submitAuth}>
            {!authSession.connected ? (
              <Alert variant="warning" className="text-[12px] leading-[1.65]">
                <AlertDescription>{isSetup ? '先按左侧流程保存 Firebase 连接后再创建管理员账号。' : '第一次使用请打开管理员发来的连接链接；本机已导入连接后再登录。'}</AlertDescription>
              </Alert>
            ) : null}
            {isSetup ? (
              <Alert variant="info" className="text-[12px] leading-[1.65]">
                <AlertDescription>{'先确认已在“安全 > Authentication > 登录方法”启用“电子邮件地址/密码”。如果创建后权限初始化失败，再按左侧发布最新规则。'}</AlertDescription>
              </Alert>
            ) : null}
            <Input type="email" value={email} placeholder={isSetup ? '管理员邮箱' : '邮箱'} autoComplete="email" onChange={event => setEmail(event.target.value)} />
            <Input type="password" value={password} placeholder="密码" autoComplete={isSetup ? 'new-password' : 'current-password'} onChange={event => setPassword(event.target.value)} />
            <div className={loginPageInlineClass}>
              <span className={loginPageInlineCopyClass}>{isSetup ? '初始化后用普通登录入口进入项目。' : '无账号或未导入连接，请联系管理员。'}</span>
              <span className={loginPageInlineActionsClass}>
                {!isSetup ? (
                  <Button
                    type="button"
                    variant="plain"
                    className={loginResetButtonClass}
                    disabled={resetBusy || resetCooldown > 0}
                    onClick={() => void requestPasswordReset()}
                  >
                    {resetBusy ? '发送中...' : resetCooldown > 0 ? `${resetCooldown}s 后重试` : resetSentOnce ? '重新发送' : '忘记密码'}
                  </Button>
                ) : null}
                <Button
                  variant="plain"
                  className="font-semibold text-[var(--accent)] hover:text-[var(--accent2)]"
                  onClick={() => {
                    setInlineError('');
                    setAuthMode(isSetup ? 'signin' : 'setup');
                  }}
                >
                  {isSetup ? '返回登录' : '项目管理员设置'}
                </Button>
              </span>
            </div>
            {displayedError ? (
              <Alert variant="danger" className="text-[12px] leading-[1.65]">
                <AlertDescription>{displayedError}</AlertDescription>
              </Alert>
            ) : null}
            <div className={loginSubmitActionsClass}>
              <Button type="submit" variant="primary" className={loginSubmitButtonClass} disabled={busy || !email.trim() || !password || !authSession.connected}>
                {busy ? '处理中…' : isSetup ? '创建管理员账号' : '登录'}
              </Button>
            </div>
          </form>
        )}
      </Card>
      )}
    </section>
  );
}

function TopbarGlobalStatus({
  authEmail,
  connectionLabel,
  connectionMenuOpen,
  isConnected,
  roleText,
  accountMenuOpen,
  onConnectionMenuOpenChange,
  onAccountMenuOpenChange,
  onOpenConnection,
  onOpenProjectSettings,
  onOpenAccounts,
  onOpenPermissions,
  onOpenExport,
  onSignOut
}: {
  authEmail: string;
  connectionLabel: string;
  connectionMenuOpen: boolean;
  isConnected: boolean;
  roleText: string;
  accountMenuOpen: boolean;
  onConnectionMenuOpenChange: (next: boolean) => void;
  onAccountMenuOpenChange: (next: boolean) => void;
  onOpenConnection: () => void;
  onOpenProjectSettings: () => void;
  onOpenAccounts: () => void;
  onOpenPermissions: () => void;
  onOpenExport: () => void;
  onSignOut: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!connectionMenuOpen && !accountMenuOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && root.contains(event.target)) return;
      onConnectionMenuOpenChange(false);
      onAccountMenuOpenChange(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [accountMenuOpen, connectionMenuOpen, onAccountMenuOpenChange, onConnectionMenuOpenChange]);

  return (
    <div className={appTopbarRightClass} ref={rootRef}>
      {authEmail ? (
        <div className={appAccountMenuClass} data-app-topbar-connection>
          <button
            type="button"
            className={appGlobalStatusClass}
            title={connectionLabel}
            aria-expanded={connectionMenuOpen}
            aria-haspopup="menu"
            onClick={() => onConnectionMenuOpenChange(!connectionMenuOpen)}
          >
            <Database size={15} strokeWidth={2} aria-hidden="true" />
            <span className={appGlobalStatusTextClass}>{connectionLabel}</span>
          </button>
          {connectionMenuOpen ? (
            <div className={appConnectionDropdownClass} role="menu">
              {isConnected ? (
                <>
                  <button type="button" className={appAccountMenuButtonClass} onClick={onOpenExport}><FileArchive size={14} strokeWidth={2} aria-hidden="true" />数据导出</button>
                  <button type="button" className={appAccountMenuButtonClass} onClick={onOpenProjectSettings}><Settings size={14} strokeWidth={2} aria-hidden="true" />数据库管理</button>
                </>
              ) : (
                <button type="button" className={appAccountMenuButtonClass} onClick={onOpenConnection}><Settings size={14} strokeWidth={2} aria-hidden="true" />项目登录</button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={appAccountMenuClass} data-app-topbar-auth>
        {authEmail ? (
          <button
            type="button"
            className={appAccountButtonClass}
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
            onClick={() => onAccountMenuOpenChange(!accountMenuOpen)}
          >
            <span className={appAccountAvatarClass} aria-hidden="true"><UserRound size={15} strokeWidth={2} /></span>
            <span className={appAccountTextClass}>
              <span className={appAccountEmailClass}>{authEmail}</span>
            </span>
          </button>
        ) : (
          <a className={appAccountButtonClass} href="#login">
            <span className={appAccountAvatarClass} aria-hidden="true"><UserRound size={15} strokeWidth={2} /></span>
            <span className={appAccountTextClass}>
              <span className={appAccountEmailClass}>未登录</span>
            </span>
          </a>
        )}
        {authEmail && accountMenuOpen ? (
          <div className={appAccountDropdownClass} role="menu">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-[12px] font-semibold text-[var(--text)]">
              {roleText}
            </div>
            <button type="button" className={appAccountMenuButtonClass} onClick={onOpenAccounts}><UserRound size={14} strokeWidth={2} aria-hidden="true" />账号管理</button>
            <button type="button" className={appAccountMenuButtonClass} onClick={onOpenPermissions}><ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />权限管理</button>
            <button type="button" className={appAccountDangerButtonClass} onClick={onSignOut}><LogOut size={14} strokeWidth={2} aria-hidden="true" />退出登录</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function App({
  config = TKAppConfig,
  now = new Date()
}: {
  config?: typeof TKAppConfig;
  now?: Date;
}) {
  const modules = useMemo(() => getModules(config), [config]);
  const [active, setActive] = useState(() => getRouteKey(globalThis.location, config));
  const [authSession, setAuthSession] = useState<AuthSessionState>(() => {
    const snapshot = getAuthSessionSnapshot();
    const savedConfig = TKFirestoreConnection.getConfig();
    if (!snapshot.connected && savedConfig?.configText) {
      return {
        ...snapshot,
        ready: false,
        connected: true,
        projectId: savedConfig.projectId || ''
      };
    }
    return snapshot;
  });
  const [shellCollapsed, setShellCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [topbarActions, setTopbarActions] = useState<ReactNode | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportSnapshot, setExportSnapshot] = useState<ExportCenterSnapshot | null>(null);
  const [selectedExportAccounts, setSelectedExportAccounts] = useState<Set<string>>(() => new Set());
  const [selectedExportModules, setSelectedExportModules] = useState<Set<ExportModuleKey>>(() => new Set());
  const year = now.getFullYear();
  const connected = !!authSession.connected && !!authSession.projectId;
  const hasSavedFirestoreConfig = !!TKFirestoreConnection.getConfig()?.configText;
  const calculatorModule = modules.find(module => module.key === 'calc') || (fallbackModules[0] as ModuleItem);
  const visibleModules = useMemo(() => {
    if (!authSession.user) {
      if (hasSavedFirestoreConfig && !authSession.ready) return modules;
      return [calculatorModule, loginModule];
    }
    if (!authSession.ready && !authSession.member) return modules;
    if (!authSession.member) return [calculatorModule, loginModule];
    const allowedModules = modules.filter(module => module.key === 'calc' || canAccessModule(module.key, authSession));
    return authSession.isOwner ? [...allowedModules, projectSettingsModule, accountModule, permissionModule] : allowedModules;
  }, [authSession, calculatorModule, hasSavedFirestoreConfig, modules]);
  const activeModuleLabel = active === 'login'
    ? loginModule.label
    : active === 'project-settings'
      ? projectSettingsModule.label
      : active === 'accounts'
        ? accountModule.label
        : active === 'permissions'
          ? permissionModule.label
          : getModuleLabel(modules, active);
  const isResolvingPermissions = connected && !!authSession.user && !authSession.ready && !authSession.member;
  const isBlockedByPermission = (moduleKey: string) => isResolvingPermissions || (!authSession.ready && authSession.member ? !canAccessModule(moduleKey, authSession) : authSession.ready ? !canAccessModule(moduleKey, authSession) : false);
  const shouldShowLoginPage = active === 'login' || (!(hasSavedFirestoreConfig && !authSession.ready) && !authSession.user && (protectedModuleKeys.has(active as ModulePermissionKey) || ownerOnlyModuleKeys.has(active)));
  const renderedActive = shouldShowLoginPage ? 'login' : active;
  const renderedModuleLabel = getModuleLabel(visibleModules, renderedActive);
  const renderedModuleMeta = moduleTopbarMeta[renderedActive] || {};
  const connectionLabel = connected && authSession.projectId
    ? `已连接 · ${authSession.projectId}`
    : '未连接数据库';
  const authEmail = authSession.user?.email || authSession.user?.uid || '';
  const roleText = authSession.isOwner ? '管理员' : authSession.user ? '成员' : '未登录';
  const exportAccountOptions = useMemo(
    () => getExportAccountOptionsFromSnapshot(exportSnapshot).filter(option => option.key !== ALL_ACCOUNT_KEY),
    [exportSnapshot]
  );
  const exportModuleOptions = useMemo(
    () => getModuleOptionsForPermissions(moduleKey => canAccessModule(moduleKey, authSession)),
    [authSession]
  );

  async function refreshExportSnapshot({ resetSelection = true } = {}) {
    setExportLoading(true);
    try {
      const modulesForUser = getModuleOptionsForPermissions(moduleKey => canAccessModule(moduleKey, authSession));
      const snapshot = await loadExportCenterSnapshot({ modules: modulesForUser.map(option => option.key as ExportModuleKey) });
      const accounts = getExportAccountOptionsFromSnapshot(snapshot).filter(option => option.key !== ALL_ACCOUNT_KEY);
      setExportSnapshot(snapshot);
      if (resetSelection) {
        setSelectedExportAccounts(new Set(accounts.map(option => option.key)));
        setSelectedExportModules(new Set(modulesForUser.map(option => option.key as ExportModuleKey)));
      }
    } catch (error) {
      console.error(error);
      TKFirestoreConnection.showToast(error instanceof Error ? error.message : '读取导出数据失败', 'error');
    } finally {
      setExportLoading(false);
    }
  }

  function openExportCenter() {
    setConnectionMenuOpen(false);
    setAccountMenuOpen(false);
    setExportDialogOpen(true);
    void refreshExportSnapshot({ resetSelection: true });
  }

  async function runUnifiedExport() {
    if (!selectedExportAccounts.size) {
      TKFirestoreConnection.showToast('请选择至少一个店铺', 'error');
      return;
    }
    if (!selectedExportModules.size) {
      TKFirestoreConnection.showToast('请选择至少一个模块', 'error');
      return;
    }
    setExporting(true);
    try {
      const pricingContext = ensureGlobalSettingsStore().getPricingContext();
      const result = await buildExportFiles({
        selectedAccounts: selectedExportAccounts,
        selectedModules: selectedExportModules,
        snapshot: exportSnapshot,
        pricingContext
      });
      if (!result.files.length) {
        TKFirestoreConnection.showToast('当前选择下没有可导出的数据', 'error');
        return;
      }
      const downloaded = await downloadExportFiles(result.files, selectedExportAccounts, selectedExportModules);
      TKFirestoreConnection.showToast(downloaded.kind === 'zip' ? `已打包导出 ${result.files.length} 个 CSV` : 'CSV 已开始导出', 'success');
      setExportDialogOpen(false);
    } catch (error) {
      console.error(error);
      TKFirestoreConnection.showToast(error instanceof Error ? error.message : '导出失败', 'error');
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    const syncRoute = () => setActive(getRouteKey(window.location, config));
    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, [config]);

  useEffect(() => {
    initializeAuthSession(TKFirestoreConnection.getConfig()?.configText || '');
    const unsubscribe = subscribeAuthSession(setAuthSession);
    const handleConnectionChanged = () => initializeAuthSession(TKFirestoreConnection.getConfig()?.configText || '');
    window.addEventListener('tk-firestore-config-changed', handleConnectionChanged);
    return () => {
      unsubscribe();
      window.removeEventListener('tk-firestore-config-changed', handleConnectionChanged);
    };
  }, []);

  useEffect(() => {
    setConnectionMenuOpen(false);
    setAccountMenuOpen(false);
  }, [renderedActive, authEmail]);

  return (
    <>
      <a className={skipLinkClass} href="#main-content">跳到主要内容</a>
      <div className="app-layout" data-shell-collapsed={shellCollapsed ? 'true' : 'false'}>
        <AppShell
          modules={visibleModules}
          active={renderedActive}
          docsUrl={config.docsUrl}
          authEmail={authEmail}
          authIsOwner={authSession.isOwner}
          authRoleLabel={roleText}
          collapsed={shellCollapsed}
          mobileOpen={mobileNavOpen}
          onCollapsedChange={setShellCollapsed}
          onMobileOpenChange={setMobileNavOpen}
        />
        <div className={appWrapClass}>
          <div className={appWorkspaceClass}>
            <div className={appTopbarClass} data-app-topbar>
              <div className={appTopbarLeftClass}>
                <div className={appTopbarTitleRowClass}>
                  <p className={appTopbarTitleClass}>{renderedModuleLabel}</p>
                </div>
                {renderedModuleMeta.description ? <p className={appTopbarDescriptionClass}>{renderedModuleMeta.description}</p> : null}
              </div>
              <div className={appTopbarActionsClass}>
                {topbarActions}
                <TopbarGlobalStatus
                  authEmail={authEmail}
                  connectionLabel={connectionLabel}
                  connectionMenuOpen={connectionMenuOpen}
                  isConnected={connected}
                  roleText={roleText}
                  accountMenuOpen={accountMenuOpen}
                  onConnectionMenuOpenChange={next => {
                    setConnectionMenuOpen(next);
                    if (next) setAccountMenuOpen(false);
                  }}
                  onAccountMenuOpenChange={next => {
                    setAccountMenuOpen(next);
                    if (next) setConnectionMenuOpen(false);
                  }}
                  onOpenConnection={() => {
                    setConnectionMenuOpen(false);
                    setAccountMenuOpen(false);
                    window.location.hash = '#login';
                  }}
                  onOpenProjectSettings={() => {
                    setConnectionMenuOpen(false);
                    setAccountMenuOpen(false);
                    window.location.hash = '#project-settings';
                  }}
                  onOpenAccounts={() => {
                    setConnectionMenuOpen(false);
                    setAccountMenuOpen(false);
                    window.location.hash = '#accounts';
                  }}
                  onOpenPermissions={() => {
                    setConnectionMenuOpen(false);
                    setAccountMenuOpen(false);
                    window.location.hash = '#permissions';
                  }}
                  onOpenExport={openExportCenter}
                  onSignOut={() => {
                    setConnectionMenuOpen(false);
                    setAccountMenuOpen(false);
                    void signOutAuthSession();
                    window.location.hash = '#login';
                  }}
                />
              </div>
            </div>
            <TopbarActionsContext.Provider value={setTopbarActions}>
              <main id="main-content" className={appMainClass} tabIndex={-1}>
                <div id="view-calc" className={viewClass(renderedActive, 'calc')}>
                  <CalculatorApp />
                </div>
              <div id="view-login" className={viewClass(renderedActive, 'login')}>
                <ProjectLoginPage authSession={authSession} />
              </div>
              <div id="view-orders" className={viewClass(renderedActive, 'orders')}>
                {isBlockedByPermission('orders') ? active === 'orders' ? (
                  <ModuleAccessGate moduleLabel={activeModuleLabel} state={authSession} />
                ) : null : (
                  <OrdersPage active={active === 'orders'} />
                )}
              </div>
              <div id="view-products" className={viewClass(renderedActive, 'products')}>
                {isBlockedByPermission('products') ? active === 'products' ? (
                  <ModuleAccessGate moduleLabel={activeModuleLabel} state={authSession} />
                ) : null : (
                  <ProductsPage active={active === 'products'} />
                )}
              </div>
              <div id="view-finance" className={viewClass(renderedActive, 'finance')}>
                {isBlockedByPermission('finance') ? active === 'finance' ? (
                  <ModuleAccessGate moduleLabel={activeModuleLabel} state={authSession} />
                ) : null : (
                  <FinancePage active={active === 'finance'} />
                )}
              </div>
              <div id="view-collection" className={viewClass(renderedActive, 'collection')}>
                {isBlockedByPermission('collection') ? active === 'collection' ? (
                  <ModuleAccessGate moduleLabel={activeModuleLabel} state={authSession} />
                ) : null : (
                  <CollectionPage active={active === 'collection'} />
                )}
              </div>
              <div id="view-analytics" className={viewClass(renderedActive, 'analytics')}>
                {isBlockedByPermission('analytics') ? active === 'analytics' ? (
                  <ModuleAccessGate moduleLabel={activeModuleLabel} state={authSession} />
                ) : null : (
                  <AnalyticsPane active={active === 'analytics'} />
                )}
              </div>
              <div id="view-project-settings" className={viewClass(renderedActive, 'project-settings')}>
                {!authSession.isOwner ? active === 'project-settings' ? (
                  <ModuleAccessGate moduleLabel="数据库管理" state={authSession} />
                ) : null : (
                  <ProjectSettingsPage active={active === 'project-settings'} onOpenExport={openExportCenter} />
                )}
              </div>
              <div id="view-accounts" className={viewClass(renderedActive, 'accounts')}>
                {!authSession.isOwner ? active === 'accounts' ? (
                  <ModuleAccessGate moduleLabel="账号管理" state={authSession} />
                ) : null : (
                  <AccountManagementPage active={active === 'accounts'} />
                )}
              </div>
              <div id="view-permissions" className={viewClass(renderedActive, 'permissions')}>
                {!authSession.isOwner ? active === 'permissions' ? (
                  <ModuleAccessGate moduleLabel="权限管理" state={authSession} />
                ) : null : (
                  <PermissionManagementPage active={active === 'permissions'} />
                )}
              </div>
            </main>
            </TopbarActionsContext.Provider>
            <footer className={appFooterClass}>
              <span className={appFooterCopyClass}>本地参数保存在浏览器（localStorage），订单与商品资料同步到你自己的 Firebase Firestore，并使用 Firestore 自带的离线缓存</span>
              <span className={appFooterLinksClass}>
                <a className={appFooterLinkClass} href="/privacy.html">隐私与数据边界</a>
                <a className={appFooterLinkClass} href="/terms.html">使用条款</a>
                <a className={appFooterLinkClass} href="https://tk-evu-docs.pages.dev/guide/database" target="_blank" rel="noopener">数据库说明</a>
              </span>
              <span className={appFooterCopyrightClass}>TK 电商工具箱 © <span id="yr">{year}</span></span>
            </footer>
          </div>
        </div>
      </div>
      <UnifiedExportDialog
        accountOptions={exportAccountOptions}
        exporting={exporting}
        loading={exportLoading}
        moduleOptions={exportModuleOptions}
        open={exportDialogOpen}
        selectedAccounts={selectedExportAccounts}
        selectedModules={selectedExportModules}
        onExport={() => void runUnifiedExport()}
        onOpenChange={setExportDialogOpen}
        onReload={() => void refreshExportSnapshot({ resetSelection: false })}
        onSelectedAccountsChange={setSelectedExportAccounts}
        onSelectedModulesChange={setSelectedExportModules}
      />
      <AppRuntime />
    </>
  );
}

export {
  App,
  getModuleMap,
  getModules,
  getRouteKey,
  loadAnalyticsRoute
};
