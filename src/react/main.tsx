import { createRoot } from 'react-dom/client';
import { ReactIsland } from './app/ReactIsland';

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

async function mountAnalyticsWhenNeeded(documentRef: Document = document) {
  const root = documentRef.getElementById('analytics-react-root');
  if (!root || root.dataset.reactMounted === 'true' || !isAnalyticsRoute(documentRef)) return false;
  root.dataset.reactLoading = 'true';
  try {
    const { mountAnalyticsReact } = await loadAnalyticsMount();
    return mountAnalyticsReact(documentRef);
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
