import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { AppRuntime } from './AppRuntime';
import { CalculatorApp } from '../features/calculator/CalculatorApp';
import { CollectionPage } from '../features/collection/CollectionPage';
import { OrdersPage } from '../features/orders/OrdersPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { AppShell } from '../layouts/AppShell';
import { TKAppConfig } from '../../app-config.ts';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';

type ModuleItem = {
  key: string;
  label: string;
};

type AnalyticsRouteModule = typeof import('../features/analytics/AnalyticsRoute');

const fallbackModules = Object.freeze([
  Object.freeze({ key: 'calc', label: '利润计算器' }),
  Object.freeze({ key: 'products', label: '商品管理' }),
  Object.freeze({ key: 'orders', label: '订单管理' }),
  Object.freeze({ key: 'collection', label: '商品采编' }),
  Object.freeze({ key: 'analytics', label: '数据分析' })
]) as readonly ModuleItem[];

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
  return Object.fromEntries(getModules(config).map(module => [module.key, module]));
}

function getRouteKey(locationRef: Location | { hash?: string } = globalThis.location, config = TKAppConfig) {
  const moduleMap = getModuleMap(config);
  const key = String(locationRef?.hash || '#calc').replace(/^#/, '');
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
const appWrapClass = 'wrap mx-auto max-w-[1180px] px-[18px] pb-20 max-[640px]:px-3.5 max-[640px]:pb-[60px]';
const appMainClass = 'app-main min-w-0 outline-none';
const analyticsStatusClass = 'analytics-react-status mb-4 grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3.5 max-[640px]:grid-cols-[32px_minmax(0,1fr)]';
const analyticsStatusMarkClass = 'analytics-react-status-mark h-[38px] w-[38px] rounded-xl border border-[color-mix(in_srgb,var(--accent2)_45%,var(--border))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent2)_56%,transparent),transparent),color-mix(in_srgb,var(--panel2)_48%,transparent)]';
const analyticsStatusLoadingClass = '[&_.analytics-react-status-mark]:animate-pulse';
const analyticsStatusErrorClass = '[&_.analytics-react-status-mark]:border-[color-mix(in_srgb,var(--danger)_56%,var(--border))] [&_.analytics-react-status-mark]:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--danger)_48%,transparent),transparent),color-mix(in_srgb,var(--panel2)_48%,transparent)]';
const analyticsStatusTitleClass = 'mb-1 mt-0 text-[15px]';
const analyticsStatusCopyClass = 'm-0 text-[12.5px] text-[var(--muted)]';
const analyticsStatusRetryClass = 'max-[640px]:col-start-2 max-[640px]:justify-self-start';

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

function App({
  config = TKAppConfig,
  now = new Date()
}: {
  config?: typeof TKAppConfig;
  now?: Date;
}) {
  const modules = useMemo(() => getModules(config), [config]);
  const [active, setActive] = useState(() => getRouteKey(globalThis.location, config));
  const year = now.getFullYear();

  useEffect(() => {
    const syncRoute = () => setActive(getRouteKey(window.location, config));
    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, [config]);

  return (
    <>
      <a className={skipLinkClass} href="#main-content">跳到主要内容</a>
      <div className={appWrapClass}>
        <AppShell modules={modules} active={active} docsUrl={config.docsUrl} />
        <main id="main-content" className={appMainClass} tabIndex={-1}>
          <div id="view-calc" className={viewClass(active, 'calc')}>
            <CalculatorApp />
          </div>
          <div id="view-orders" className={viewClass(active, 'orders')}>
            <OrdersPage active={active === 'orders'} />
          </div>
          <div id="view-products" className={viewClass(active, 'products')}>
            <ProductsPage active={active === 'products'} />
          </div>
          <div id="view-collection" className={viewClass(active, 'collection')}>
            <CollectionPage active={active === 'collection'} />
          </div>
          <div id="view-analytics" className={viewClass(active, 'analytics')}>
            <AnalyticsPane active={active === 'analytics'} />
          </div>
        </main>
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
