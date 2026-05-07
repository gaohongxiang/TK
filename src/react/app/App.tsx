import { useEffect, useMemo, useState } from 'react';
import { AppRuntime } from './AppRuntime';
import { CalculatorApp } from '../features/calculator/CalculatorApp';
import { OrdersPage } from '../features/orders/OrdersPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { AppShell } from '../layouts/AppShell';
import { TKAppConfig } from '../../app-config.mjs';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';

type ModuleItem = {
  key: string;
  label?: string;
};

type AnalyticsRouteModule = typeof import('../features/analytics/AnalyticsRoute');

const fallbackModules = Object.freeze([
  Object.freeze({ key: 'calc', label: '利润计算器' }),
  Object.freeze({ key: 'products', label: '商品管理' }),
  Object.freeze({ key: 'orders', label: '订单管理' }),
  Object.freeze({ key: 'analytics', label: '数据分析' })
]);

let analyticsRoutePromise: Promise<AnalyticsRouteModule> | null = null;

function getModules(config = TKAppConfig): ModuleItem[] {
  return ((config && Array.isArray(config.modules)) ? config.modules : fallbackModules) as ModuleItem[];
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
  return active === key ? 'relative z-0 block' : 'relative z-0 hidden';
}

function AnalyticsStatus({
  state,
  onRetry
}: {
  state: 'loading' | 'error';
  onRetry?: () => void;
}) {
  const isError = state === 'error';
  return (
    <Card className={`analytics-react-status ${isError ? 'is-error' : 'is-loading'}`} data-analytics-lazy-state={state}>
      <div className="analytics-react-status-mark" aria-hidden="true" />
      <div>
        <CardTitle>{isError ? '数据分析加载失败' : '正在加载数据分析'}</CardTitle>
        <p>{isError ? '图表模块没有加载成功，请检查网络后重试。' : '正在按需加载图表模块，稍等片刻。'}</p>
      </div>
      {isError ? <Button size="sm" data-analytics-retry onClick={onRetry}>重试</Button> : null}
    </Card>
  );
}

function AnalyticsPane({ active }: { active: boolean }) {
  const [Route, setRoute] = useState<null | (() => JSX.Element)>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!active || Route) return undefined;
    let cancelled = false;
    setState('loading');
    loadAnalyticsRoute()
      .then(module => {
        if (cancelled) return;
        setRoute(() => module.AnalyticsRoute);
        setState('ready');
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [active, Route, retryKey]);

  if (!active) return null;
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
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <div className="wrap">
        <AppShell modules={modules} active={active} docsUrl={config.docsUrl} />
        <main id="main-content" className="app-main" tabIndex={-1}>
          <div id="view-calc" className={viewClass(active, 'calc')}>
            <CalculatorApp />
          </div>
          <div id="view-orders" className={viewClass(active, 'orders')}>
            <OrdersPage />
          </div>
          <div id="view-products" className={viewClass(active, 'products')}>
            <ProductsPage />
          </div>
          <div id="view-analytics" className={viewClass(active, 'analytics')}>
            <AnalyticsPane active={active === 'analytics'} />
          </div>
        </main>
        <footer>
          <span>本地参数保存在浏览器（localStorage），订单与商品资料同步到你自己的 Firebase Firestore，并使用 Firestore 自带的离线缓存</span>
          <span className="footer-links">
            <a href="/privacy.html">隐私与数据边界</a>
            <a href="/terms.html">使用条款</a>
            <a href="https://tk-evu-docs.pages.dev/guide/database" target="_blank" rel="noopener">数据库说明</a>
          </span>
          <span>TK 电商工具箱 © <span id="yr">{year}</span></span>
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
