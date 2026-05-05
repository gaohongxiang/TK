const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'src', 'orders', 'index.mjs');
const source = fs.readFileSync(sourcePath, 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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
  htmlSource,
  /<script src="js\/orders\/products\.js" defer><\/script>\s*<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  'index.html 需要先加载订单旧 helper，再通过 ESM 入口加载订单管理'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 不应再加载旧订单 index 普通脚本'
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
