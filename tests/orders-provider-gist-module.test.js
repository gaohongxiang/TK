const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'provider-gist.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerProviderGist = \(function \(\) \{/,
  '需要新的 Gist provider 模块'
);

assert.match(
  source,
  /function create\(/,
  'Gist provider 需要暴露 create 工厂'
);

assert.match(
  source,
  /verifyToken/,
  'Gist provider 需要包含 Token 校验逻辑'
);

assert.match(
  source,
  /createGist/,
  'Gist provider 需要包含 Gist 创建逻辑'
);

assert.match(
  source,
  /pullSnapshot/,
  'Gist provider 需要暴露 pullSnapshot'
);

assert.match(
  source,
  /pushChanges/,
  'Gist provider 需要暴露 pushChanges'
);

const sandbox = {
  fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '{}' })
};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTrackerProviderGist = OrderTrackerProviderGist;`, sandbox);

const provider = sandbox.OrderTrackerProviderGist.create({
  state: { token: '', gistId: '' },
  constants: {
    GIST_FILENAME: 'tk-order-tracker.json',
    META_FILENAME: 'tk-order-tracker-meta.json',
    REMOTE_DATA_VERSION: 2,
    UNASSIGNED_ACCOUNT_SLOT: '__unassigned__'
  },
  helpers: {
    nowIso: () => '2026-04-20T10:00:00.000Z',
    normalizeOrderList: list => Array.isArray(list) ? list : [],
    uniqueAccounts: list => Array.isArray(list) ? [...new Set(list.filter(Boolean))] : [],
    listOrderAccounts: list => Array.isArray(list) ? [...new Set(list.map(order => order['账号']).filter(Boolean))] : [],
    groupOrdersByAccountSlot: () => ({}),
    flattenOrdersByAccountSlot: () => [],
    toAccountSlot: value => value || '__unassigned__',
    fromAccountSlot: value => value === '__unassigned__' ? '' : value,
    getAccountFileName: value => `${value || '__unassigned__'}.json`,
    parseAccountSlotFromFileName: () => null
  }
});

assert.equal(provider.key, 'gist', 'Gist provider 需要暴露 gist key');
assert.equal(typeof provider.init, 'function', 'Gist provider 需要暴露 init');
assert.equal(typeof provider.pullSnapshot, 'function', 'Gist provider 需要暴露 pullSnapshot');
assert.equal(typeof provider.pushChanges, 'function', 'Gist provider 需要暴露 pushChanges');

assert.match(
  htmlSource,
  /<script src="js\/orders\/provider-gist\.js" defer><\/script>/,
  'index.html 需要在订单模块中加载 Gist provider'
);

console.log('orders gist provider contract ok');
