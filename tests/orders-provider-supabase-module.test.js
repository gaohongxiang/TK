const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'provider-supabase.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerProviderSupabase = \(function \(\) \{/,
  '需要新的 Supabase provider 模块'
);

assert.match(
  source,
  /function create\(/,
  'Supabase provider 需要暴露 create 工厂'
);

assert.match(
  source,
  /createClient/,
  'Supabase provider 需要创建浏览器 client'
);

assert.doesNotMatch(
  source,
  /signInWithOtp/,
  'Supabase provider 不应再依赖邮箱 magic link 登录'
);

assert.match(
  source,
  /pullSnapshot/,
  'Supabase provider 需要暴露 pullSnapshot'
);

assert.match(
  source,
  /pushChanges/,
  'Supabase provider 需要暴露 pushChanges'
);

const sandbox = {
  window: {
    supabase: {
      createClient(url, key) {
        return {
          url,
          key,
          from() {
            return {
              select() { return this; },
              gt() { return this; },
              order() { return Promise.resolve({ data: [], error: null }); },
              upsert() { return Promise.resolve({ data: [], error: null }); }
            };
          }
        };
      }
    },
    location: { href: 'https://example.com/#orders' }
  }
};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTrackerProviderSupabase = OrderTrackerProviderSupabase;`, sandbox);

const provider = sandbox.OrderTrackerProviderSupabase.create({
  state: {
    supabaseUrl: '',
    supabaseAnonKey: '',
    user: ''
  },
  helpers: {
    nowIso: () => '2026-04-20T10:00:00.000Z',
    normalizeOrderList: list => Array.isArray(list) ? list : [],
    uniqueAccounts: list => Array.isArray(list) ? [...new Set(list.filter(Boolean))] : []
  }
});

assert.equal(provider.key, 'supabase', 'Supabase provider 需要暴露 supabase key');
assert.equal(typeof provider.init, 'function', 'Supabase provider 需要暴露 init');
assert.equal(typeof provider.pullSnapshot, 'function', 'Supabase provider 需要暴露 pullSnapshot');
assert.equal(typeof provider.pushChanges, 'function', 'Supabase provider 需要暴露 pushChanges');

assert.match(
  htmlSource,
  /<script src="js\/orders\/provider-supabase\.js" defer><\/script>/,
  'index.html 需要在订单模块中加载 Supabase provider'
);

console.log('orders supabase provider contract ok');
