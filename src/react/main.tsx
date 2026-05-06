import { createRoot } from 'react-dom/client';
import {
  App,
  getModuleMap,
  getModules,
  getRouteKey,
  loadAnalyticsRoute
} from './app/App';
import './styles.css';

function mountApp(documentRef: Document = document) {
  const root = documentRef.getElementById('root');
  if (!root || root.dataset.reactMounted === 'true') return false;
  createRoot(root).render(<App />);
  root.dataset.reactMounted = 'true';
  return true;
}

if (typeof document !== 'undefined') {
  const start = () => {
    mountApp();
  };
  if (document.readyState === 'complete') {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
}

export {
  App,
  getModuleMap,
  getModules,
  getRouteKey,
  loadAnalyticsRoute,
  mountApp
};
