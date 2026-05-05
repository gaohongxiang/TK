const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'products', 'accounts.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'js', 'products', 'index.js'), 'utf8');
const srcSource = fs.readFileSync(path.join(root, 'src', 'products', 'accounts.mjs'), 'utf8');
const srcIndexSource = fs.readFileSync(path.join(root, 'src', 'products', 'index.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  source,
  /const ProductLibraryAccounts = \(function \(\) \{/,
  '商品库需要独立的账号筛选模块'
);

assert.match(
  source,
  /function getAllProductAccounts\(/,
  '账号模块需要负责汇总商品账号'
);

assert.match(
  source,
  /function populateAccountSelect\(/,
  '账号模块需要负责商品弹窗账号下拉'
);

assert.match(
  source,
  /function renderAccountTabs\(/,
  '账号模块需要负责商品页账号标签'
);

assert.match(
  indexSource,
  /ProductLibraryAccounts\.create\(/,
  '商品库入口需要接入账号模块'
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
  indexSource,
  /function getAllProductAccounts\(|function renderAccountTabs\(/,
  '商品库入口不应继续内联账号筛选实现'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.ProductLibraryAccounts = ProductLibraryAccounts;`, sandbox);

assert.deepStrictEqual(
  Array.from(sandbox.ProductLibraryAccounts.uniqueAccounts(['A', ' B ', 'A', '', 'B'])),
  ['A', 'B'],
  '账号去重需要保留首次出现顺序并过滤空账号'
);

assert.strictEqual(
  sandbox.ProductLibraryAccounts.toAccountSlot('  '),
  '__unassigned__',
  '空账号需要映射到未关联账号槽'
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
