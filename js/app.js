/* ============================================================
 * 全局 & 简单 hash 路由
 * ============================================================ */
document.getElementById('yr').textContent = new Date().getFullYear();

const MODULES = Object.fromEntries(
  ((typeof TKAppConfig !== 'undefined' && Array.isArray(TKAppConfig.modules))
    ? TKAppConfig.modules
    : [
      { key: 'calc' },
      { key: 'orders' },
      { key: 'products' },
      { key: 'analytics' }
    ]).map(module => [module.key, {}])
);

const docLink = document.querySelector('.app-doc-link');
if (docLink && typeof TKAppConfig !== 'undefined' && TKAppConfig.docsUrl) {
  docLink.href = TKAppConfig.docsUrl;
}

function switchView(key) {
  if (!MODULES[key]) key = 'calc';
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + key).classList.add('active');
  document.querySelectorAll('nav.modules a[data-view]').forEach(a => {
    const isActive = a.dataset.view === key;
    a.classList.toggle('active', isActive);
    if (isActive) {
      a.setAttribute('aria-current', 'page');
    } else {
      a.removeAttribute('aria-current');
    }
  });
  if (key === 'orders' && typeof OrderTracker !== 'undefined') OrderTracker.onEnter();
  if (key === 'products' && typeof ProductLibrary !== 'undefined') ProductLibrary.onEnter();
  if (key === 'analytics' && typeof TKAnalytics !== 'undefined') TKAnalytics.onEnter();
}

document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('hashchange', () => {
    const key = (location.hash || '#calc').slice(1);
    switchView(key);
  });

  switchView((location.hash || '#calc').slice(1));
});
