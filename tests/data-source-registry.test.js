const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const registrySource = fs.readFileSync(path.join(root, 'js', 'data-sources', 'registry.js'), 'utf8');
const orderFirestoreSource = fs.readFileSync(path.join(root, 'js', 'orders', 'provider-firestore.js'), 'utf8');
const productFirestoreSource = fs.readFileSync(path.join(root, 'js', 'products', 'provider-firestore.js'), 'utf8');
const analyticsSource = fs.readFileSync(path.join(root, 'js', 'analytics', 'index.js'), 'utf8');
const orderIndexSource = fs.readFileSync(path.join(root, 'js', 'orders', 'index.js'), 'utf8');
const productIndexSource = fs.readFileSync(path.join(root, 'js', 'products', 'index.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  registrySource,
  /const TKDataSourceRegistry = \(function \(\) \{/,
  '需要全局数据源注册表'
);

assert.match(
  registrySource,
  /orders:\s*new Map\(\)[\s\S]*products:\s*new Map\(\)[\s\S]*analytics:\s*new Map\(\)/,
  '数据源注册表需要覆盖订单、商品和分析三个数据域'
);

assert.match(
  indexHtml,
  /<script src="js\/data-sources\/registry\.js" defer><\/script>[\s\S]*<script src="js\/orders\/provider-firestore\.js" defer><\/script>/,
  '数据源注册表需要在业务 provider 前加载'
);

assert.doesNotMatch(
  indexHtml,
  /provider-supabase\.js/,
  '正式路径不应加载 Supabase provider'
);

assert.match(
  orderFirestoreSource,
  /TKDataSourceRegistry\.registerProvider\('orders'[\s\S]*key:\s*'firestore'[\s\S]*storesUserData:\s*false[\s\S]*localFirst:\s*true/,
  '订单 Firestore provider 需要登记为用户自有、本地优先的数据源'
);

assert.match(
  productFirestoreSource,
  /TKDataSourceRegistry\.registerProvider\('products'[\s\S]*key:\s*'firestore'[\s\S]*storesUserData:\s*false[\s\S]*localFirst:\s*true/,
  '商品 Firestore provider 需要登记为用户自有、本地优先的数据源'
);

assert.match(
  analyticsSource,
  /TKDataSourceRegistry\.registerProvider\('analytics'[\s\S]*key:\s*'browser-excel'[\s\S]*storesUserData:\s*false[\s\S]*offline:\s*'memory-only'/,
  '数据分析 Excel provider 需要登记为只在浏览器内存处理'
);

assert.match(
  orderIndexSource,
  /TKDataSourceRegistry\.getProvider\('orders', mode\)[\s\S]*mode === 'firestore'/,
  '订单模块选择 Firestore provider 时需要接入数据源注册表'
);

assert.doesNotMatch(
  orderIndexSource,
  /OrderTrackerProviderSupabase|providerSupabase|mode === 'supabase'/,
  '订单模块正式路径不应创建或选择 Supabase provider'
);

assert.match(
  productIndexSource,
  /TKDataSourceRegistry\.getProvider\('products', provider\.key\)/,
  '商品模块需要从数据源注册表读取 provider 元信息'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${registrySource}\nthis.TKDataSourceRegistry = TKDataSourceRegistry;`, sandbox);

const provider = sandbox.TKDataSourceRegistry.registerProvider('orders', {
  key: 'local-file',
  label: '本地文件',
  storesUserData: false
});

assert.strictEqual(provider.ownership, 'user-owned', '默认数据源归属应是用户自有');
assert.strictEqual(provider.localFirst, true, '默认数据源应是本地优先');
assert.strictEqual(
  sandbox.TKDataSourceRegistry.getProvider('orders', 'local-file').label,
  '本地文件',
  '需要能按域和 key 取回 provider'
);
assert.strictEqual(
  sandbox.TKDataSourceRegistry.listProviders('orders').length,
  1,
  '需要能列出某个数据域下的 provider'
);

console.log('data source registry contract ok');
