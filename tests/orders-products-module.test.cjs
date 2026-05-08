const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const esmPath = path.join(root, 'src', 'orders', 'products.mjs');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.ok(
  !fs.existsSync(esmPath),
  '完整 React SPA 重建后旧订单商品桥接 runtime 应删除'
);

assert.match(
  ordersPageSource,
  /import \{ ProductLibraryProviderFirestore \} from '\.\.\/\.\.\/\.\.\/products\/provider-firestore\.ts'/,
  'React 订单页需要直接导入商品 Firestore provider'
);

assert.match(
  ordersPageSource,
  /productProviderRef[\s\S]*pullProducts[\s\S]*tk-products-changed/,
  'React 订单页需要直接读取商品资料并监听商品变更事件'
);

assert.match(
  ordersPageSource,
  /function findProduct\([\s\S]*accountName[\s\S]*tkId[\s\S]*products/,
  'React 订单页需要直接按账号和 TK ID 关联商品资料'
);

assert.doesNotMatch(
  ordersPageSource,
  /OrderTrackerProducts|function getProductsForAccount\(|async function loadProductsForModal\(/,
  'React 订单页不应继续依赖旧订单商品桥接工厂'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/products\.js" defer><\/script>/,
  'index.html 不应再加载旧订单商品桥接普通脚本'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/products\/provider-firestore\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 Firestore provider 普通脚本'
);

console.log('orders products runtime removal contract ok');
