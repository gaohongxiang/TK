import { createRoot, type Root } from 'react-dom/client';
import { AnalyticsApp } from './AnalyticsApp';
import { TKAnalyticsAnalyzer } from '../../../analytics/analyzer.mjs';
import { TKAnalyticsParser } from '../../../analytics/parser.mjs';

declare global {
  interface Window {
    XLSX?: any;
  }
}

let analyticsRoot: Root | null = null;

function showToast(message: string, type: 'ok' | 'error' = 'ok') {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

showToast.timer = 0;

function mountAnalyticsReact(documentRef: Document = document) {
  const root = documentRef.getElementById('view-analytics');
  if (!root) return false;
  if (!analyticsRoot) analyticsRoot = createRoot(root);
  analyticsRoot.render(
    <AnalyticsApp
      analyzer={TKAnalyticsAnalyzer}
      parser={TKAnalyticsParser}
      getXlsx={() => window.XLSX}
      onToast={showToast}
    />
  );
  root.dataset.reactMounted = 'true';
  return true;
}

export { mountAnalyticsReact };
