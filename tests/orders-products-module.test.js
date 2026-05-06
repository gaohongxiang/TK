const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const srcSource = fs.readFileSync(path.join(root, 'src', 'orders', 'products.mjs'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'src', 'orders', 'index.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.match(
  srcSource,
  /ProductLibraryProviderFirestore[\s\S]*pullProducts/,
  '订单商品桥接模块需要复用商品库 Firestore provider 拉取商品资料'
);

assert.match(
  srcSource,
  /function getProductsForAccount\(/,
  '订单商品桥接模块需要提供按账号筛选商品'
);

assert.match(
  srcSource,
  /function getProductByTkId\(/,
  '订单商品桥接模块需要提供按 TK ID 查商品'
);

assert.match(
  srcSource,
  /async function loadProductsForModal\(/,
  '订单商品桥接模块需要负责订单弹窗商品预加载'
);

assert.match(
  srcSource,
  /function resetProductCache\(/,
  '订单商品桥接模块需要在全局 Firestore 配置变化时清理商品缓存'
);

assert.match(
  ordersPageSource,
  /ProductLibraryProviderFirestore[\s\S]*pullProducts[\s\S]*tk-products-changed/,
  'React 订单页需要直接读取商品资料并监听商品变更事件'
);

assert.match(
  srcSource,
  /import \{ ProductLibraryProviderFirestore \} from '\.\.\/products\/provider-firestore\.mjs'/,
  '订单商品桥接 ESM 需要直接导入商品 Firestore provider ESM'
);

assert.match(
  srcSource,
  /const OrderTrackerProducts = \{/,
  '路线二 M5 需要提供订单商品桥接 ESM 模块'
);

assert.match(
  srcSource,
  /window\.OrderTrackerProducts = OrderTrackerProducts/,
  '订单商品桥接 ESM 模块需要挂回旧全局命名空间'
);

assert.match(
  srcSource,
  /export\s+\{[\s\S]*OrderTrackerProducts[\s\S]*create[\s\S]*\}/,
  '订单商品桥接 ESM 模块需要导出 create 工厂'
);

assert.doesNotMatch(
  indexSource,
  /function getProductsForAccount\(|function getProductByTkId\(|async function loadProductsForModal\(/,
  '订单入口不应继续内联商品读取桥接实现'
);

assert.match(
  ordersPageSource,
  /ProductLibraryProviderFirestore/,
  'React 订单页需要直接导入商品 Firestore provider'
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

function createFakeProductProviderFactory() {
  return {
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
  };
}

(async () => {
  const module = await import(pathToFileURL(path.join(root, 'src', 'orders', 'products.mjs')).href);
  const esmState = { products: [] };
  const esmTools = module.OrderTrackerProducts.create({
    state: esmState,
    helpers: {
      nowIso: () => '2026-05-05T00:00:00.000Z',
      normalizeAccountName: value => String(value || '').trim(),
      getConfig: () => ({ configText: '{"projectId":"demo-project"}', projectId: 'demo-project' }),
      notifyRulesUpdateNeeded: () => {},
      productProviderFactory: createFakeProductProviderFactory()
    },
    ui: {
      toast: () => {}
    }
  });
  const esmProducts = await esmTools.loadProductsForModal();
  assert.strictEqual(esmProducts.length, 3, '订单商品桥接 ESM 需要能加载商品资料');
  assert.deepStrictEqual(
    esmTools.getProductsForAccount('A').map(product => product.tkId),
    ['TK-1', 'TK-2'],
    '订单商品桥接 ESM 按账号筛商品时需要按 TK ID 排序'
  );
  assert.strictEqual(
    esmTools.getProductByTkId('TK-3').accountName,
    'B',
    '订单商品桥接 ESM 按 TK ID 查商品需要返回对应商品'
  );
  esmTools.resetProductCache();
  assert.strictEqual(esmState.products.length, 0, '订单商品桥接 ESM 重置缓存需要清空订单内的商品列表');
  console.log('orders products module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
