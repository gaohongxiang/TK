import { createRoot } from 'react-dom/client';
import { ReactIsland } from './app/ReactIsland';
import { mountAnalyticsReact } from './features/analytics/mountAnalytics';

function mountReactIsland(documentRef: Document = document) {
  const root = documentRef.getElementById('react-island-root');
  if (!root || root.dataset.reactMounted === 'true') return false;
  createRoot(root).render(<ReactIsland />);
  root.dataset.reactMounted = 'true';
  return true;
}

function mountReactApps(documentRef: Document = document) {
  return {
    island: mountReactIsland(documentRef),
    analytics: mountAnalyticsReact(documentRef)
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountReactApps(), { once: true });
  } else {
    mountReactApps();
  }
}

export { mountReactApps, mountReactIsland };
