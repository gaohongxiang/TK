const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'table.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /function derivePurchaseSummary\(/,
  '订单表格视图模块需要暴露采购金额统计纯函数'
);

assert.match(
  source,
  /function formatCurrencyAmount\(/,
  '订单表格视图模块需要暴露金额格式化函数'
);

assert.match(
  source,
  /ot-th-help/,
  '订单表头需要包含帮助提示图标结构'
);

assert.match(
  indexSource,
  /id="ot-storage-help-btn"/,
  '订单主面板需要提供数据存储说明入口按钮'
);

assert.match(
  indexSource,
  /id="ot-summary-container"/,
  '订单主面板需要提供采购统计卡片容器'
);

assert.match(
  indexSource,
  /id="ot-storage-help-modal"/,
  '订单主面板需要提供数据存储说明弹窗'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTableView = OrderTableView;`, sandbox);

const orders = [
  { id: '1', '账号': 'A', '产品名称': '红色杯子', '采购价格': '12.5' },
  { id: '2', '账号': 'B', '产品名称': '蓝色盘子', '采购价格': '7' },
  { id: '3', '账号': 'B', '产品名称': '蓝色盒子', '采购价格': '8.25' },
  { id: '4', '账号': 'B', '产品名称': '异常价格', '采购价格': 'abc' }
];

const summary = sandbox.OrderTableView.derivePurchaseSummary({
  orders,
  activeAccount: 'B',
  searchQuery: '蓝色',
  currentPage: 2,
  pageSize: 1
});

assert.equal(summary.filteredCount, 2, '当前筛选条数应按账号和搜索条件统计');
assert.equal(summary.filteredTotal, 15.25, '当前筛选总额应按筛选结果统计，且不受分页影响');
assert.equal(summary.allTotal, 27.75, '全部订单总额应按全量订单统计，非法价格按 0 处理');
assert.equal(
  sandbox.OrderTableView.formatCurrencyAmount(summary.filteredTotal),
  '¥ 15.25',
  '金额格式化结果不正确'
);

console.log('orders summary ui contract ok');
