import { createRoot } from 'react-dom/client';
import { ReactIsland } from './app/ReactIsland';
import './styles.css';

type AnalyticsMountModule = typeof import('./features/analytics/mountAnalytics');

let analyticsMountPromise: Promise<AnalyticsMountModule> | null = null;

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
  const root = documentRef.getElementById('analytics-react-root');
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
    island: mountReactIsland(documentRef),
    analytics
  };
}

if (typeof document !== 'undefined') {
  const mountCurrentRoute = () => {
    void mountReactApps();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountCurrentRoute, { once: true });
  } else {
    mountCurrentRoute();
  }
  window.addEventListener('hashchange', mountCurrentRoute);
}

export { isAnalyticsRoute, loadAnalyticsMount, mountAnalyticsWhenNeeded, mountReactApps, mountReactIsland };
