import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ReactIsland } from './app/ReactIsland';
import { CalculatorApp } from './features/calculator/CalculatorApp';
import { OrdersPage } from './features/orders/OrdersPage';
import { ProductsPage } from './features/products/ProductsPage';
import { AppShell } from './layouts/AppShell';
import { TKAppConfig } from '../app-config.mjs';
import './styles.css';

type AnalyticsMountModule = typeof import('./features/analytics/mountAnalytics');

let analyticsMountPromise: Promise<AnalyticsMountModule> | null = null;
let appShellMounted = false;

const fallbackModules = Object.freeze([
  Object.freeze({ key: 'calc' }),
  Object.freeze({ key: 'products' }),
  Object.freeze({ key: 'orders' }),
  Object.freeze({ key: 'analytics' })
]);

function getModuleMap(config = TKAppConfig) {
  return Object.fromEntries(
    ((config && Array.isArray(config.modules)) ? config.modules : fallbackModules)
      .map(module => [module.key, {}])
  );
}

function getRouteKey(locationRef: Location | { hash?: string } = globalThis.location, config = TKAppConfig) {
  const moduleMap = getModuleMap(config);
  const key = String(locationRef?.hash || '#calc').replace(/^#/, '');
  return moduleMap[key] ? key : 'calc';
}

function setCurrentYear(documentRef: Document = document, now = new Date()) {
  const year = documentRef.getElementById('yr');
  if (year) year.textContent = String(now.getFullYear());
}

function setDocLink(documentRef: Document = document, config = TKAppConfig) {
  const docLink = documentRef.querySelector<HTMLAnchorElement>('.app-doc-link');
  if (docLink && config?.docsUrl) docLink.href = config.docsUrl;
}

function switchView(key: string, options: {
  document?: Document;
  window?: Window & typeof globalThis;
  config?: typeof TKAppConfig;
} = {}) {
  const documentRef = options.document ?? document;
  const windowRef = options.window ?? window;
  const config = options.config ?? TKAppConfig;
  const moduleMap = getModuleMap(config);
  const resolvedKey = moduleMap[key] ? key : 'calc';

  documentRef.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  documentRef.getElementById(`view-${resolvedKey}`)?.classList.add('active');
  void windowRef;
  return resolvedKey;
}

function initSpaRouter(options: {
  document?: Document;
  window?: Window & typeof globalThis;
  location?: Location | { hash?: string };
  config?: typeof TKAppConfig;
  now?: Date;
} = {}) {
  const documentRef = options.document ?? document;
  const windowRef = options.window ?? window;
  const locationRef = options.location ?? windowRef.location;
  const config = options.config ?? TKAppConfig;
  setCurrentYear(documentRef, options.now ?? new Date());
  setDocLink(documentRef, config);

  const route = () => {
    switchView(getRouteKey(locationRef, config), {
      document: documentRef,
      window: windowRef,
      config
    });
  };

  route();
  windowRef.addEventListener('hashchange', route);
  return route;
}

function mountCalculator(documentRef: Document = document) {
  const root = documentRef.getElementById('view-calc');
  if (!root || root.dataset.reactMounted === 'true') return false;
  createRoot(root).render(<CalculatorApp />);
  root.dataset.reactMounted = 'true';
  return true;
}

function mountProductsPage(documentRef: Document = document) {
  const root = documentRef.getElementById('view-products');
  if (!root || root.dataset.reactMounted === 'true') return false;
  flushSync(() => {
    createRoot(root).render(<ProductsPage />);
  });
  root.dataset.reactMounted = 'true';
  return true;
}

function mountOrdersPage(documentRef: Document = document) {
  const root = documentRef.getElementById('view-orders');
  if (!root || root.dataset.reactMounted === 'true') return false;
  flushSync(() => {
    createRoot(root).render(<OrdersPage />);
  });
  root.dataset.reactMounted = 'true';
  return true;
}

function mountAppShell(documentRef: Document = document) {
  const root = documentRef.getElementById('react-app-shell-root');
  if (!root || root.dataset.reactMounted === 'true') return false;
  createRoot(root).render(<AppShell />);
  root.dataset.reactMounted = 'true';
  appShellMounted = true;
  return true;
}

function mountReactIsland(documentRef: Document = document) {
  const root = documentRef.getElementById('react-island-root');
  if (!root || root.dataset.reactMounted === 'true') return false;
  createRoot(root).render(<ReactIsland />);
  root.dataset.reactMounted = 'true';
  return true;
}

function isAnalyticsRoute(documentRef: Document = document) {
  const hash = globalThis.location?.hash?.replace(/^#/, '') || '';
  return hash === 'analytics' || documentRef.getElementById('view-analytics')?.classList.contains('active') === true;
}

function loadAnalyticsMount() {
  if (!analyticsMountPromise) {
    analyticsMountPromise = import('./features/analytics/mountAnalytics');
  }
  return analyticsMountPromise;
}

function setAnalyticsFallback(root: HTMLElement, state: 'loading' | 'error') {
  const isError = state === 'error';
  root.innerHTML = `
    <section class="card analytics-react-status ${isError ? 'is-error' : 'is-loading'}" data-analytics-lazy-state="${state}">
      <div class="analytics-react-status-mark" aria-hidden="true"></div>
      <div>
        <h2>${isError ? '数据分析加载失败' : '正在加载数据分析'}</h2>
        <p>${isError ? '图表模块没有加载成功，请检查网络后重试。' : '正在按需加载图表模块，稍等片刻。'}</p>
      </div>
      ${isError ? '<button type="button" class="btn sm" data-analytics-retry>重试</button>' : ''}
    </section>
  `;
  root.querySelector('[data-analytics-retry]')?.addEventListener('click', () => {
    analyticsMountPromise = null;
    void mountAnalyticsWhenNeeded(root.ownerDocument);
  });
}

async function mountAnalyticsWhenNeeded(documentRef: Document = document) {
  const root = documentRef.getElementById('view-analytics');
  if (!root || root.dataset.reactMounted === 'true' || !isAnalyticsRoute(documentRef)) return false;
  root.dataset.reactLoading = 'true';
  setAnalyticsFallback(root, 'loading');
  try {
    const { mountAnalyticsReact } = await loadAnalyticsMount();
    return mountAnalyticsReact(documentRef);
  } catch (error) {
    console.error(error);
    setAnalyticsFallback(root, 'error');
    return false;
  } finally {
    root.dataset.reactLoading = 'false';
  }
}

function mountReactApps(documentRef: Document = document) {
  const analytics = mountAnalyticsWhenNeeded(documentRef);
  return {
    shell: mountAppShell(documentRef),
    calculator: mountCalculator(documentRef),
    orders: mountOrdersPage(documentRef),
    products: mountProductsPage(documentRef),
    island: mountReactIsland(documentRef),
    analytics
  };
}

if (typeof document !== 'undefined') {
  const mountCurrentRoute = () => {
    void mountReactApps();
  };
  const start = () => {
    mountCurrentRoute();
    initSpaRouter();
  };
  if (document.readyState === 'complete') {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
  window.addEventListener('hashchange', mountCurrentRoute);
}

export {
  getModuleMap,
  getRouteKey,
  initSpaRouter,
  isAnalyticsRoute,
  loadAnalyticsMount,
  mountAnalyticsWhenNeeded,
  mountAppShell,
  mountCalculator,
  mountOrdersPage,
  mountProductsPage,
  mountReactApps,
  mountReactIsland,
  setCurrentYear,
  setDocLink,
  switchView
};
