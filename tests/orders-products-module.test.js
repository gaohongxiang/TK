const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'orders', 'products.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'js', 'orders', 'index.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerProducts = \(function \(\) \{/,
  '订单模块需要独立的商品资料桥接模块'
);

assert.match(
  source,
  /ProductLibraryProviderFirestore[\s\S]*pullProducts/,
  '订单商品桥接模块需要复用商品库 Firestore provider 拉取商品资料'
);

assert.match(
  source,
  /function getProductsForAccount\(/,
  '订单商品桥接模块需要提供按账号筛选商品'
);

assert.match(
  source,
  /function getProductByTkId\(/,
  '订单商品桥接模块需要提供按 TK ID 查商品'
);

assert.match(
  source,
  /async function loadProductsForModal\(/,
  '订单商品桥接模块需要负责订单弹窗商品预加载'
);

assert.match(
  source,
  /function resetProductCache\(/,
  '订单商品桥接模块需要在全局 Firestore 配置变化时清理商品缓存'
);

assert.match(
  indexSource,
  /OrderTrackerProducts\.create\(/,
  '订单入口需要通过 OrderTrackerProducts.create 接入商品桥接模块'
);

assert.doesNotMatch(
  indexSource,
  /function getProductsForAccount\(|function getProductByTkId\(|async function loadProductsForModal\(/,
  '订单入口不应继续内联商品读取桥接实现'
);

assert.match(
  htmlSource,
  /<script src="js\/products\/provider-firestore\.js" defer><\/script>\s*<script src="js\/orders\/provider-firestore\.js" defer><\/script>[\s\S]*<script src="js\/orders\/products\.js" defer><\/script>\s*<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 需要先加载商品 Firestore provider 和订单商品桥接模块，再加载订单入口'
);

const sandbox = {
  ProductLibraryProviderFirestore: {
    create({ state }) {
      return {
        init({ configText }) {
          state.firestoreConfigText = configText;
          state.firestoreProjectId = 'demo-project';
          return Promise.resolve();
        },
        pullProducts() {
          return Promise.resolve({
            products: [
              { tkId: 'TK-2', accountName: 'A' },
              { tkId: 'TK-1', accountName: 'A' },
              { tkId: 'TK-3', accountName: 'B' }
            ]
          });
        }
      };
    }
  }
};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTrackerProducts = OrderTrackerProducts;`, sandbox);

const state = { products: [] };
const tools = sandbox.OrderTrackerProducts.create({
  state,
  helpers: {
    nowIso: () => '2026-05-05T00:00:00.000Z',
    normalizeAccountName: value => String(value || '').trim(),
    getConfig: () => ({ configText: '{"projectId":"demo-project"}', projectId: 'demo-project' }),
    notifyRulesUpdateNeeded: () => {}
  },
  ui: {
    toast: () => {}
  }
});

(async () => {
  const products = await tools.loadProductsForModal();
  assert.strictEqual(products.length, 3, '订单弹窗需要能加载商品资料');
  assert.deepStrictEqual(
    tools.getProductsForAccount('A').map(product => product.tkId),
    ['TK-1', 'TK-2'],
    '按账号筛商品时需要按 TK ID 排序'
  );
  assert.strictEqual(
    tools.getProductByTkId('TK-3').accountName,
    'B',
    '按 TK ID 查商品需要返回对应商品'
  );
  tools.resetProductCache();
  assert.strictEqual(state.products.length, 0, '重置商品缓存需要清空订单内的商品列表');
  console.log('orders products module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
