import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'src', 'orders', 'index.mjs');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.ok(!fs.existsSync(sourcePath), '完整 React SPA 重建后旧订单 DOM 入口应删除');

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再加载旧订单 DOM 入口'
);

assert.match(
  ordersPageSource,
  /OrderTrackerProviderFirestore[\s\S]*ProductLibraryProviderFirestore[\s\S]*deriveDisplayedOrders/,
  '完整 React SPA 重建后订单页需要由 React 组件直接接管数据、表格和弹窗'
);

assert.match(ordersPageSource, /id="ot-modal"/, '订单编辑弹窗应由 React 订单页渲染');
assert.match(ordersPageSource, /modalId="ot-add-acc-modal"/, '订单新增账号弹窗应由 React 订单页渲染');
assert.match(ordersPageSource, /id="ot-export-modal"/, '订单导出弹层应由 React 订单页渲染');
assert.match(ordersPageSource, /tk-products-changed/, '订单页应监听商品资料变化');

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

console.log('orders index module contract ok');
