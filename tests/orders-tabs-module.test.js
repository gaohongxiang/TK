const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const { pathToFileURL } = require('url');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'tabs.js'), 'utf8');
const esmPath = path.join(__dirname, '..', 'src', 'orders', 'tabs.mjs');
const esmSource = fs.readFileSync(esmPath, 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders', 'index.mjs'), 'utf8');
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

assert.match(
  esmSource,
  /const OrderTrackerTabs = \{/,
  'ESM 订单账号标签栏模块需要保留 OrderTrackerTabs 命名导出'
);

assert.match(
  esmSource,
  /function getUniqueAccounts\(/,
  'ESM 订单账号标签栏模块需要包含账号归并逻辑'
);

assert.match(
  esmSource,
  /export \{[\s\S]*OrderTrackerTabs[\s\S]*buildAccountTabsMarkup[\s\S]*getUniqueAccounts[\s\S]*resolveActiveAccount[\s\S]*\}/,
  'ESM 订单账号标签栏模块需要导出命名空间和账号标签纯函数'
);

assert.match(
  esmSource,
  /window\.OrderTrackerTabs = OrderTrackerTabs/,
  'ESM 订单账号标签栏模块需要挂回旧全局命名空间'
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
  /tabsFactory\.create\(/,
  '订单 ESM 入口需要通过账号标签栏工厂接入账号标签模块'
);

assert.match(
  indexSource,
  /import \{ OrderTrackerTabs \} from '\.\/tabs\.mjs'/,
  '订单 ESM 入口需要直接导入账号标签 ESM helper'
);

assert.match(
  htmlSource,
  /<script src="js\/orders\/sync\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>\s*<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  'index.html 需要在订单 ESM 入口前保留尚未迁移的订单旧 helper'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/tabs\.js" defer><\/script>/,
  'index.html 不应再加载旧订单账号标签普通脚本'
);

(async () => {
  const tabsModule = await import(pathToFileURL(esmPath).href);
  const state = {
    orders: [
      { '账号': 'A' },
      { '账号': 'B' },
      { '账号': 'A' },
      { '账号': '' }
    ],
    accounts: ['C', 'A', '', 'B']
  };

  assert.deepEqual(
    tabsModule.OrderTrackerTabs.create({
      state,
      helpers: {
        escapeHtml: value => String(value),
        normalizeAccountName: value => String(value || '').trim()
      },
      ui: {}
    }).getUniqueAccounts(),
    tabsTools.getUniqueAccounts(),
    'ESM 账号标签栏模块的账号归并结果应和旧模块一致'
  );

  assert.deepEqual(
    tabsModule.getUniqueAccounts(state),
    ['A', 'B', 'C'],
    'ESM 账号标签栏纯函数应合并订单账号与历史账号并去重'
  );

  assert.deepEqual(
    tabsModule.buildAccountCountMap(state.orders),
    { A: 2, B: 1 },
    'ESM 账号标签栏纯函数应统计账号订单数量'
  );

  assert.equal(
    tabsModule.resolveActiveAccount('missing', ['A', 'B']),
    '__all__',
    'ESM 账号标签栏纯函数应把不存在的激活账号兜底为全部'
  );

  assert.match(
    tabsModule.buildAccountTabsMarkup({
      accounts: ['A'],
      activeAccount: 'A',
      countMap: { A: 2 }
    }),
    /class="tab active"[\s\S]*data-tab-acc="A"[\s\S]*\(2\)[\s\S]*data-tab-edit="A"[\s\S]*data-tab-del="A"/,
    'ESM 账号标签栏纯函数应生成账号标签、数量和编辑删除按钮'
  );

  assert.equal(
    tabsModule.getDeleteAccountMessage('A', 2),
    '确定删除账号「A」？\n该账号下的 2 条订单数据将变为未关联（落入“全部”中）。',
    'ESM 账号标签栏纯函数应保留有订单账号删除提示'
  );

  console.log('orders tabs module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
