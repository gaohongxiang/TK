const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const srcRegistrySource = fs.readFileSync(path.join(root, 'src', 'data-sources', 'registry.mjs'), 'utf8');
const srcOrderFirestoreSource = fs.readFileSync(path.join(root, 'src', 'orders', 'provider-firestore.mjs'), 'utf8');
const srcProductFirestoreSource = fs.readFileSync(path.join(root, 'src', 'products', 'provider-firestore.mjs'), 'utf8');
const analyticsSource = fs.readFileSync(path.join(root, 'src', 'analytics', 'index.mjs'), 'utf8');
const orderIndexSource = fs.readFileSync(path.join(root, 'src', 'orders', 'index.mjs'), 'utf8');
const productIndexSource = fs.readFileSync(path.join(root, 'src', 'products', 'index.mjs'), 'utf8');
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
  analyticsSource,
  /registerProvider\('analytics'[\s\S]*key:\s*'browser-excel'[\s\S]*storesUserData:\s*false[\s\S]*offline:\s*'memory-only'/,
  '数据分析 Excel provider 需要登记为只在浏览器内存处理'
);

assert.match(
  orderIndexSource,
  /registry\?\.getProvider\?\.\('orders', mode\)[\s\S]*mode === 'firestore'/,
  '订单模块选择 Firestore provider 时需要接入数据源注册表'
);

assert.doesNotMatch(
  orderIndexSource,
  /OrderTrackerProviderSupabase|providerSupabase|mode === 'supabase'/,
  '订单模块正式路径不应创建或选择 Supabase provider'
);

assert.match(
  productIndexSource,
  /registry\?\.getProvider\?\.\('products', provider\.key\)/,
  '商品模块需要从数据源注册表读取 provider 元信息'
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
