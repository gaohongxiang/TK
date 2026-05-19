import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const accountsPath = path.join(root, 'src', 'products', 'accounts.ts');
const srcSource = fs.readFileSync(accountsPath, 'utf8');
const reactProductsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  srcSource,
  /function uniqueAccounts\(/,
  '商品账号 ESM 模块需要保留账号名称规范化和去重纯函数'
);

assert.doesNotMatch(
  srcSource,
  /function populateAccountSelect\(|function renderAccountTabs\(|document\.|querySelector|innerHTML|classList|addEventListener|window\.ProductLibraryAccounts/,
  '商品账号模块应保持纯 ESM，不应再包含旧 DOM 渲染或全局暴露'
);

assert.match(
  reactProductsSource,
  /const allAccounts = accounts[\s\S]*activeAccount[\s\S]*id="pl-acc-tabs"/,
  'React 商品页账号标签只能来自 order_accounts 共享账号表'
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
  /function getAllProductAccounts\(|function renderAccountTabs\(|function normalizeAccountName\(|function uniqueAccounts\(|products\.map\(product => product\.accountName\)[\s\S]*allAccounts/,
  'React 商品页不应继续内联旧账号工厂、重复账号纯函数，或从商品数据反推账号标签'
);

(async () => {
  const module = await import(pathToFileURL(accountsPath).href);
  assert.deepStrictEqual(
    module.uniqueAccounts(['A', ' B ', 'A', '', 'B']),
    ['A', 'B'],
    '商品账号 ESM 模块需要保留账号去重逻辑'
  );
  assert.strictEqual(module.toAccountSlot('  '), '__unassigned__', '商品账号 ESM 模块需要保留未关联账号槽');
  assert.equal(typeof module.ProductLibraryAccounts.uniqueAccounts, 'function', '商品账号 ESM 模块需要保留纯函数命名空间');

  console.log('products accounts module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
