const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const registryPath = path.join(root, 'src', 'data-sources', 'registry.mjs');
const srcOrderFirestoreSource = fs.readFileSync(path.join(root, 'src', 'orders', 'provider-firestore.mjs'), 'utf8');
const srcProductFirestoreSource = fs.readFileSync(path.join(root, 'src', 'products', 'provider-firestore.mjs'), 'utf8');
const reactAnalyticsRouteSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'AnalyticsRoute.tsx'), 'utf8');
const reactOrdersSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const reactProductsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(
  !fs.existsSync(registryPath),
  '完整 React SPA 重建后旧数据源注册表应删除，正式路径直接 import Firestore provider'
);

assert.doesNotMatch(
  srcOrderFirestoreSource + srcProductFirestoreSource,
  /TKDataSourceRegistry|registerProvider\(/,
  '订单和商品 Firestore provider 不应再通过注册表产生运行时副作用'
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
  reactAnalyticsRouteSource,
  /TKAnalyticsAnalyzer[\s\S]*TKAnalyticsParser[\s\S]*getXlsx=\{\(\) => window\.XLSX\}/,
  'React 数据分析需要直接接入本地 Excel parser/analyzer，不通过旧 DOM provider'
);

assert.match(
  reactOrdersSource,
  /import \{ OrderTrackerProviderFirestore \} from '\.\.\/\.\.\/\.\.\/orders\/provider-firestore\.mjs'[\s\S]*OrderTrackerProviderFirestore\.create/,
  'React 订单页需要直接使用 Firestore provider'
);

assert.doesNotMatch(
  reactOrdersSource,
  /OrderTrackerProviderSupabase|providerSupabase|mode === 'supabase'|TKDataSourceRegistry/,
  '订单模块正式路径不应创建或选择 Supabase provider，也不应走旧数据源注册表'
);

assert.match(
  reactProductsSource,
  /import \{ ProductLibraryProviderFirestore \} from '\.\.\/\.\.\/\.\.\/products\/provider-firestore\.mjs'[\s\S]*ProductLibraryProviderFirestore\.create/,
  'React 商品页需要直接使用 Firestore provider'
);

console.log('data source registry removal contract ok');
