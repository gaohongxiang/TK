const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'table.js'), 'utf8');
const ordersSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'index.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTableView = \(function \(\) \{/,
  '需要新的订单表格视图模块'
);

assert.match(
  source,
  /function deriveDisplayedOrders\(/,
  '需要暴露纯函数 deriveDisplayedOrders'
);

assert.match(
  source,
  /function render\(/,
  '需要暴露 render 入口'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTableView = OrderTableView;`, sandbox);

const orders = [
  {
    id: '1',
    '账号': 'A',
    '订单号': 'AA-1',
    '产品名称': '红色杯子',
    '快递公司': '顺丰快递',
    '快递单号': 'SF123'
  },
  {
    id: '2',
    '账号': 'B',
    '订单号': 'BB-2',
    '产品名称': '蓝色盘子',
    '快递公司': '中通快递',
    '快递单号': 'ZTO456'
  }
];

const result = sandbox.OrderTableView.deriveDisplayedOrders({
  orders,
  activeAccount: '__all__',
  searchQuery: '红色',
  sortOrder: 'asc'
});

assert.equal(result.isAll, true, '全部账号模式下 isAll 应为 true');
assert.equal(result.sorted.length, 1, '搜索应只命中一条记录');
assert.equal(result.sorted[0].id, '1', '应命中包含关键词的订单');

const accountOnlyResult = sandbox.OrderTableView.deriveDisplayedOrders({
  orders,
  activeAccount: 'B',
  searchQuery: '',
  sortOrder: 'asc'
});

assert.equal(accountOnlyResult.sorted.length, 1, '账号筛选应只保留目标账号');
assert.equal(accountOnlyResult.sorted[0].id, '2', '账号筛选结果不正确');

const stableSortResult = sandbox.OrderTableView.deriveDisplayedOrders({
  orders: [
    { id: 'newer', createdAt: '2026-04-22T10:00:00.000Z', '账号': 'A' },
    { id: 'older', createdAt: '2026-04-20T10:00:00.000Z', '账号': 'A' }
  ],
  activeAccount: '__all__',
  searchQuery: '',
  sortOrder: 'asc'
});

assert.equal(stableSortResult.sorted[0].id, 'older', '表格排序应优先按持久化创建时间，而不是当前数组顺序');

const seqPriorityResult = sandbox.OrderTableView.deriveDisplayedOrders({
  orders: [
    { id: 'late-created', seq: 9, createdAt: '2026-04-23T10:00:00.000Z', '账号': 'A' },
    { id: 'early-created', seq: 2, createdAt: '2026-04-20T10:00:00.000Z', '账号': 'A' }
  ],
  activeAccount: '__all__',
  searchQuery: '',
  sortOrder: 'asc'
});

assert.equal(seqPriorityResult.sorted[0].id, 'early-created', '有 seq 时应优先按录入编号排序');

assert.match(
  ordersSource,
  /OrderTableView\.render\(/,
  'js/orders/index.js 需要把表格渲染委托给 OrderTableView.render'
);

assert.match(
  indexSource,
  /<script src="js\/orders\/table\.js" defer><\/script>\s*<script src="js\/orders\/sync\.js" defer><\/script>\s*<script src="js\/orders\/export\.js" defer><\/script>\s*<script src="js\/orders\/tabs\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>\s*<script src="js\/orders\/session\.js" defer><\/script>\s*<script src="js\/orders\/shared\.js" defer><\/script>\s*<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 需要按 table.js -> sync.js -> export.js -> tabs.js -> crud.js -> session.js -> shared.js -> index.js 的顺序加载订单模块'
);

console.log('orders table view contract ok');
