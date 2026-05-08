const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const esmPath = path.join(root, 'src', 'orders', 'session.mjs');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const firestoreConnectionSource = fs.readFileSync(path.join(root, 'src', 'firestore-connection.ts'), 'utf8');

assert.ok(
  !fs.existsSync(esmPath),
  '完整 React SPA 重建后旧订单会话 DOM runtime 应删除'
);

assert.ok(!fs.existsSync(path.join(root, 'src', 'orders', 'sync.mjs')), '完整 React SPA 后旧订单同步 runtime 应删除');

assert.match(
  ordersPageSource,
  /orders、order_accounts、sync_state 和 products[\s\S]*notifyRulesUpdateNeeded/,
  'React 订单页在 Firestore 权限不足时需要触发全局规则更新提示'
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
  /providerRef\.current\.pullSnapshot[\s\S]*providerRef\.current\.pushChanges/,
  'React 订单页需要直接接管订单拉取和写入流程'
);

assert.match(
  firestoreConnectionSource,
  /tk-firestore-config-changed[\s\S]*function dispatchConfigChanged\(detail\)[\s\S]*dispatchEvent/,
  'Firestore 连接模块需要继续广播配置变化给 React 订单页'
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
