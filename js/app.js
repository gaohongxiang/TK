/* ============================================================
 * 全局 & 简单 hash 路由
 * ============================================================ */
document.getElementById('yr').textContent = new Date().getFullYear();

const MODULES = {
  calc: {},
  orders: {},
  products: {}
};

function switchView(key) {
  if (!MODULES[key]) key = 'calc';
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + key).classList.add('active');
  document.querySelectorAll('nav.modules a[data-view]').forEach(a => {
    a.classList.toggle('active', a.dataset.view === key);
  });
  if (key === 'orders' && typeof OrderTracker !== 'undefined') OrderTracker.onEnter();
  if (key === 'products' && typeof ProductLibrary !== 'undefined') ProductLibrary.onEnter();
}

document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('hashchange', () => {
    const key = (location.hash || '#calc').slice(1);
    switchView(key);
  });

  switchView((location.hash || '#calc').slice(1));
});
