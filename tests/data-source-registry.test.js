const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const srcRegistrySource = fs.readFileSync(path.join(root, 'src', 'data-sources', 'registry.mjs'), 'utf8');
const srcOrderFirestoreSource = fs.readFileSync(path.join(root, 'src', 'orders', 'provider-firestore.mjs'), 'utf8');
const srcProductFirestoreSource = fs.readFileSync(path.join(root, 'src', 'products', 'provider-firestore.mjs'), 'utf8');
const reactAnalyticsRouteSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'AnalyticsRoute.tsx'), 'utf8');
const reactOrdersSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const reactProductsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  srcRegistrySource,
  /orders:\s*new Map\(\)[\s\S]*products:\s*new Map\(\)[\s\S]*analytics:\s*new Map\(\)[\s\S]*const TKDataSourceRegistry = \{[\s\S]*registerProvider[\s\S]*getProvider[\s\S]*listProviders/,
  '路线二需要提供数据源注册表 ESM 导出'
);

assert.match(
  srcOrderFirestoreSource,
  /import \{ TKDataSourceRegistry \} from '\.\.\/data-sources\/registry\.mjs'/,
  '订单 Firestore provider 需要显式导入数据源注册表'
);

assert.match(
  srcProductFirestoreSource,
  /import \{ TKDataSourceRegistry \} from '\.\.\/data-sources\/registry\.mjs'/,
  '商品 Firestore provider 需要显式导入数据源注册表'
);

assert.doesNotMatch(
  indexHtml,
  /<script src="js\/data-sources\/registry\.js" defer><\/script>/,
  'index.html 不应再加载旧数据源注册表普通脚本'
);

assert.doesNotMatch(
  indexHtml,
  /provider-supabase\.js/,
  '正式路径不应加载 Supabase provider'
);

assert.match(
  srcOrderFirestoreSource,
  /TKDataSourceRegistry\.registerProvider\('orders'[\s\S]*key:\s*'firestore'[\s\S]*storesUserData:\s*false[\s\S]*localFirst:\s*true/,
  '订单 Firestore ESM provider 需要登记为用户自有、本地优先的数据源'
);

assert.match(
  srcProductFirestoreSource,
  /TKDataSourceRegistry\.registerProvider\('products'[\s\S]*key:\s*'firestore'[\s\S]*storesUserData:\s*false[\s\S]*localFirst:\s*true/,
  '商品 Firestore ESM provider 需要登记为用户自有、本地优先的数据源'
);

assert.match(
  reactAnalyticsRouteSource,
  /TKAnalyticsAnalyzer[\s\S]*TKAnalyticsParser[\s\S]*getXlsx=\{\(\) => window\.XLSX\}/,
  'React 数据分析需要直接接入本地 Excel parser/analyzer，不通过旧 DOM provider'
);

assert.match(
  reactOrdersSource,
  /OrderTrackerProviderFirestore/,
  'React 订单页需要直接使用 Firestore provider'
);

assert.doesNotMatch(
  reactOrdersSource,
  /OrderTrackerProviderSupabase|providerSupabase|mode === 'supabase'/,
  '订单模块正式路径不应创建或选择 Supabase provider'
);

assert.match(
  reactProductsSource,
  /ProductLibraryProviderFirestore/,
  'React 商品页需要直接使用 Firestore provider'
);

(async () => {
  const registryModule = await import(`file://${path.join(root, 'src', 'data-sources', 'registry.mjs')}`);
  registryModule.clear();
  const esmProvider = registryModule.registerProvider('products', {
    key: 'firestore',
    label: 'Firebase Firestore'
  });
  assert.strictEqual(esmProvider.ownership, 'user-owned', 'ESM 数据源默认归属应是用户自有');
  assert.strictEqual(
    registryModule.getProvider('products', 'firestore').label,
    'Firebase Firestore',
    'ESM 数据源注册表需要能按域和 key 取回 provider'
  );
  assert.strictEqual(registryModule.listProviders('products').length, 1, 'ESM 数据源注册表需要能列出 provider');

  console.log('data source registry contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
