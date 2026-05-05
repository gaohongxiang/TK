const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const registrySource = fs.readFileSync(path.join(root, 'js', 'data-sources', 'registry.js'), 'utf8');
const srcRegistrySource = fs.readFileSync(path.join(root, 'src', 'data-sources', 'registry.mjs'), 'utf8');
const srcMainSource = fs.readFileSync(path.join(root, 'src', 'main.mjs'), 'utf8');
const orderFirestoreSource = fs.readFileSync(path.join(root, 'js', 'orders', 'provider-firestore.js'), 'utf8');
const srcOrderFirestoreSource = fs.readFileSync(path.join(root, 'src', 'orders', 'provider-firestore.mjs'), 'utf8');
const productFirestoreSource = fs.readFileSync(path.join(root, 'js', 'products', 'provider-firestore.js'), 'utf8');
const srcProductFirestoreSource = fs.readFileSync(path.join(root, 'src', 'products', 'provider-firestore.mjs'), 'utf8');
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
  srcRegistrySource,
  /const TKDataSourceRegistry = \{[\s\S]*registerProvider[\s\S]*getProvider[\s\S]*listProviders/,
  '路线二需要提供数据源注册表 ESM 导出'
);

assert.match(
  srcMainSource,
  /import '\.\/data-sources\/registry\.mjs'/,
  'ESM 主入口需要先导入数据源注册表以挂回全局'
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
  orderFirestoreSource,
  /TKDataSourceRegistry\.registerProvider\('orders'[\s\S]*key:\s*'firestore'[\s\S]*storesUserData:\s*false[\s\S]*localFirst:\s*true/,
  '订单 Firestore provider 需要登记为用户自有、本地优先的数据源'
);

assert.match(
  srcOrderFirestoreSource,
  /TKDataSourceRegistry\.registerProvider\('orders'[\s\S]*key:\s*'firestore'[\s\S]*storesUserData:\s*false[\s\S]*localFirst:\s*true/,
  '订单 Firestore ESM provider 需要登记为用户自有、本地优先的数据源'
);

assert.match(
  productFirestoreSource,
  /TKDataSourceRegistry\.registerProvider\('products'[\s\S]*key:\s*'firestore'[\s\S]*storesUserData:\s*false[\s\S]*localFirst:\s*true/,
  '商品 Firestore provider 需要登记为用户自有、本地优先的数据源'
);

assert.match(
  srcProductFirestoreSource,
  /TKDataSourceRegistry\.registerProvider\('products'[\s\S]*key:\s*'firestore'[\s\S]*storesUserData:\s*false[\s\S]*localFirst:\s*true/,
  '商品 Firestore ESM provider 需要登记为用户自有、本地优先的数据源'
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
