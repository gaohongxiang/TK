/* ============================================================
 * 全局 & 简单 hash 路由
 * ============================================================ */
document.getElementById('yr').textContent = new Date().getFullYear();

const MODULES = {
  calc: { title: '/ 利润计算器', sub: 'TikTok Shop 日本跨境店 · 采购价 + 目标利润率 反推原价' },
  orders: { title: '/ 订单跟踪器', sub: 'TikTok Shop 日本跨境店 · 采购 / 物流 / 入仓 进度追踪' }
};

function switchView(key) {
  if (!MODULES[key]) key = 'calc';
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + key).classList.add('active');
  document.querySelectorAll('nav.modules a[data-view]').forEach(a => {
    a.classList.toggle('active', a.dataset.view === key);
  });
  document.getElementById('module-title').textContent = MODULES[key].title;
  document.getElementById('module-sub').textContent = MODULES[key].sub;
  if (key === 'orders' && typeof OrderTracker !== 'undefined') OrderTracker.onEnter();
}
window.addEventListener('hashchange', () => {
  const key = (location.hash || '#calc').slice(1);
  switchView(key);
});

