const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const srcSource = fs.readFileSync(path.join(root, 'src', 'products', 'accounts.mjs'), 'utf8');
const srcIndexSource = fs.readFileSync(path.join(root, 'src', 'products', 'index.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  srcSource,
  /function getAllProductAccounts\(/,
  '商品账号 ESM 模块需要负责汇总商品账号'
);

assert.match(
  srcSource,
  /function populateAccountSelect\(/,
  '商品账号 ESM 模块需要负责商品弹窗账号下拉'
);

assert.match(
  srcSource,
  /function renderAccountTabs\(/,
  '商品账号 ESM 模块需要负责商品页账号标签'
);

assert.match(
  srcIndexSource,
  /accountsFactory\.create\(/,
  '商品 ESM 入口需要接入账号模块'
);

assert.match(
  srcSource,
  /const ProductLibraryAccounts = \{/,
  '商品账号 ESM 模块需要保留 ProductLibraryAccounts 命名导出'
);

assert.match(
  srcSource,
  /window\.ProductLibraryAccounts = ProductLibraryAccounts/,
  '商品账号 ESM 模块需要挂回旧全局命名空间'
);

assert.match(
  srcIndexSource,
  /import \{ ProductLibraryAccounts \} from '\.\/accounts\.mjs'/,
  '商品 ESM 入口需要直接导入账号 ESM 模块'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/products\/accounts\.js" defer><\/script>/,
  'index.html 不应再加载旧商品账号普通脚本'
);

assert.doesNotMatch(
  srcIndexSource,
  /function getAllProductAccounts\(|function renderAccountTabs\(/,
  '商品 ESM 入口不应继续内联账号筛选实现'
);

(async () => {
  const module = await import(`file://${path.join(root, 'src', 'products', 'accounts.mjs')}`);
  assert.deepStrictEqual(
    module.uniqueAccounts(['A', ' B ', 'A', '', 'B']),
    ['A', 'B'],
    '商品账号 ESM 模块需要保留账号去重逻辑'
  );
  assert.strictEqual(module.toAccountSlot('  '), '__unassigned__', '商品账号 ESM 模块需要保留未关联账号槽');
  assert.equal(typeof module.ProductLibraryAccounts.create, 'function', '商品账号 ESM 模块需要保留 create 工厂');

  console.log('products accounts module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
