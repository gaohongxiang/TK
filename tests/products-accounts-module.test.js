const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'products', 'accounts.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'js', 'products', 'index.js'), 'utf8');

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

console.log('products accounts module contract ok');
