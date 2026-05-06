const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'src', 'orders', 'index.mjs');
const source = fs.readFileSync(sourcePath, 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.match(
  source,
  /function createOrderTracker\(options = \{\}\)/,
  '订单 ESM 入口需要导出可注入依赖的创建函数'
);

assert.match(
  source,
  /function getOrderTracker\(options = \{\}\)/,
  '订单 ESM 入口需要懒初始化，避免旧 defer 子模块时序问题'
);

assert.match(
  source,
  /window\.OrderTracker = OrderTracker/,
  '订单 ESM 入口需要挂回 OrderTracker 全局供旧路由调用'
);

assert.match(
  source,
  /import \{ OrderTrackerShared \} from '\.\/shared\.mjs'/,
  '订单 ESM 入口需要直接导入共享 helper ESM'
);

assert.match(
  source,
  /import \{ OrderTrackerProviderFirestore \} from '\.\/provider-firestore\.mjs'/,
  '订单 ESM 入口需要直接导入订单 Firestore provider ESM'
);

assert.match(
  source,
  /import \{ OrderTrackerExport \} from '\.\/export\.mjs'/,
  '订单 ESM 入口需要直接导入导出 helper ESM'
);

assert.match(
  source,
  /import \{ OrderTrackerTabs \} from '\.\/tabs\.mjs'/,
  '订单 ESM 入口需要直接导入账号标签 helper ESM'
);

assert.match(
  source,
  /import \{ OrderTrackerSync \} from '\.\/sync\.mjs'/,
  '订单 ESM 入口需要直接导入同步 helper ESM'
);

assert.match(
  source,
  /import \{ OrderTrackerCrud \} from '\.\/crud\.mjs'/,
  '订单 ESM 入口需要直接导入 CRUD helper ESM'
);

assert.match(
  source,
  /import \{ OrderTrackerSession \} from '\.\/session\.mjs'/,
  '订单 ESM 入口需要直接导入会话 helper ESM'
);

assert.match(
  source,
  /import \{ OrderTrackerProducts \} from '\.\/products\.mjs'/,
  '订单 ESM 入口需要直接导入商品桥接 helper ESM'
);

assert.match(
  source,
  /addEventListener\?\.\('tk-products-changed'[\s\S]*resetProductCache\(\)[\s\S]*loadProductsForModal\(\{ silent: true, force: true \}\)/,
  '商品管理新增或删除商品后，订单入口需要清理并强制刷新关联商品缓存'
);

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再加载旧订单 DOM 入口'
);

assert.match(
  ordersPageSource,
  /OrderTrackerProviderFirestore[\s\S]*deriveDisplayedOrders[\s\S]*id="ot-modal"[\s\S]*id="ot-add-acc-modal"[\s\S]*id="ot-export-modal"/,
  '完整 React SPA 重建后订单页需要由 React 组件直接接管数据、表格和弹窗'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 不应再加载旧订单 index 普通脚本'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/(?:provider-firestore|export|tabs|session|shared|products|sync)\.js" defer><\/script>/,
  'index.html 不应再加载已由订单 ESM 入口接管的订单 helper 普通脚本'
);

(async () => {
  const module = await import(pathToFileURL(sourcePath).href);
  assert.equal(typeof module.createOrderTracker, 'function', '订单 ESM 入口需要可被直接 import');
  assert.equal(typeof module.getOrderTracker, 'function', '订单 ESM 入口需要导出懒初始化入口');
  assert.equal(typeof module.OrderTracker.onEnter, 'function', '订单 ESM 入口需要保留 OrderTracker.onEnter');

  console.log('orders index module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
