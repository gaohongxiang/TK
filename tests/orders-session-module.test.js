const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const esmPath = path.join(root, 'src', 'orders', 'session.mjs');
const syncSource = fs.readFileSync(path.join(root, 'src', 'orders', 'sync.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.ok(
  !fs.existsSync(esmPath),
  '完整 React SPA 重建后旧订单会话 DOM runtime 应删除'
);

assert.match(
  syncSource,
  /cancelPendingSync/,
  '同步模块需要提供取消待同步任务的接口'
);

assert.match(
  syncSource,
  /orders、order_accounts、sync_state 和 products[\s\S]*notifyRulesUpdateNeeded/,
  '订单同步在 Firestore 权限不足时需要触发全局规则更新提示'
);

assert.ok(!fs.existsSync(path.join(root, 'src', 'orders', 'index.mjs')), '完整 React SPA 重建后旧订单 DOM 入口应删除');

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再通过旧订单 ESM 入口加载会话模块'
);

assert.match(
  ordersPageSource,
  /tk-firestore-config-changed[\s\S]*id="ot-open-connection"[\s\S]*id="ot-refresh"/,
  'React 订单页需要直接接管 Firestore 配置变化、连接按钮和刷新按钮'
);

assert.match(
  ordersPageSource,
  /aria-busy=\{loading \? 'true' : 'false'\}[\s\S]*className=\{loading \? 'is-spinning' : ''\}/,
  'React 订单页需要直接切换刷新按钮 loading 状态'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/session\.js" defer><\/script>/,
  'index.html 不应再加载旧订单会话普通脚本'
);

console.log('orders session runtime removal contract ok');
