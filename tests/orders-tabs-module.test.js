const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'tabs.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'index.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerTabs = \(function \(\) \{/,
  '需要新的订单账号标签栏模块'
);

assert.match(
  source,
  /function create\(/,
  '订单账号标签栏模块需要暴露 create 工厂'
);

assert.match(
  source,
  /function getUniqueAccounts\(/,
  '订单账号标签栏模块需要包含账号归并逻辑'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTrackerTabs = OrderTrackerTabs;`, sandbox);

const tabsTools = sandbox.OrderTrackerTabs.create({
  state: {
    orders: [
      { '账号': 'A' },
      { '账号': 'B' },
      { '账号': 'A' },
      { '账号': '' }
    ],
    accounts: ['C', 'A', '', 'B']
  },
  helpers: {
    escapeHtml: value => String(value),
    normalizeAccountName: value => String(value || '').trim()
  },
  ui: {}
});

assert.deepEqual(
  tabsTools.getUniqueAccounts(),
  ['A', 'B', 'C'],
  '账号标签栏模块应合并订单账号与历史账号并去重'
);

assert.match(
  indexSource,
  /OrderTrackerTabs\.create\(/,
  'js/orders/index.js 需要通过 OrderTrackerTabs.create 接入账号标签栏模块'
);

assert.match(
  htmlSource,
  /<script src="js\/orders\/table\.js" defer><\/script>\s*<script src="js\/orders\/sync\.js" defer><\/script>\s*<script src="js\/orders\/export\.js" defer><\/script>\s*<script src="js\/orders\/tabs\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>\s*<script src="js\/orders\/session\.js" defer><\/script>\s*<script src="js\/orders\/shared\.js" defer><\/script>\s*<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 需要在 index.js 前先加载 tabs.js、crud.js、session.js、shared.js'
);

console.log('orders tabs module contract ok');
