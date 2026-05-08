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
  /OrderTrackerProviderFirestore[\s\S]*ProductLibraryProviderFirestore[\s\S]*deriveDisplayedOrders[\s\S]*id="ot-modal"[\s\S]*id="ot-add-acc-modal"[\s\S]*id="ot-export-modal"[\s\S]*tk-products-changed/,
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

console.log('orders index module contract ok');
