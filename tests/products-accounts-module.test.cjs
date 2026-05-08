const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const accountsPath = path.join(root, 'src', 'products', 'accounts.ts');
const srcSource = fs.readFileSync(accountsPath, 'utf8');
const reactProductsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  srcSource,
  /function getAllProductAccounts\(/,
  '商品账号 ESM 模块需要负责汇总商品账号'
);

assert.doesNotMatch(
  srcSource,
  /function populateAccountSelect\(|function renderAccountTabs\(|document\.|querySelector|innerHTML|classList|addEventListener|window\.ProductLibraryAccounts/,
  '商品账号模块应保持纯 ESM，不应再包含旧 DOM 渲染或全局暴露'
);

assert.match(
  reactProductsSource,
  /from '\.\.\/\.\.\/\.\.\/products\/accounts\.ts'[\s\S]*allAccounts[\s\S]*activeAccount[\s\S]*id="pl-acc-tabs"/,
  'React 商品页需要直接接管账号聚合和账号标签'
);

assert.match(
  srcSource,
  /const ProductLibraryAccounts = \{/,
  '商品账号 ESM 模块需要保留 ProductLibraryAccounts 命名导出'
);

assert.ok(!fs.existsSync(path.join(root, 'src', 'products', 'index.mjs')), '完整 React SPA 重建后旧商品 DOM 入口应删除');

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/products\/accounts\.js" defer><\/script>/,
  'index.html 不应再加载旧商品账号普通脚本'
);

assert.doesNotMatch(
  reactProductsSource,
  /function getAllProductAccounts\(|function renderAccountTabs\(|function normalizeAccountName\(|function uniqueAccounts\(/,
  'React 商品页不应继续内联旧账号工厂或重复账号纯函数'
);

(async () => {
  const module = await import(pathToFileURL(accountsPath).href);
  assert.deepStrictEqual(
    module.uniqueAccounts(['A', ' B ', 'A', '', 'B']),
    ['A', 'B'],
    '商品账号 ESM 模块需要保留账号去重逻辑'
  );
  assert.strictEqual(module.toAccountSlot('  '), '__unassigned__', '商品账号 ESM 模块需要保留未关联账号槽');
  assert.deepStrictEqual(
    module.getAllProductAccounts({
      accounts: ['NOMA', '  ', 'A'],
      products: [{ accountName: 'A' }, { accountName: 'B' }, { accountName: '' }]
    }),
    ['NOMA', 'A', 'B'],
    '商品账号 ESM 模块需要合并配置账号和商品账号'
  );
  assert.equal(typeof module.ProductLibraryAccounts.uniqueAccounts, 'function', '商品账号 ESM 模块需要保留纯函数命名空间');

  console.log('products accounts module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
