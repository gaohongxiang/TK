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
  /function formatSummaryMetric\(/,
  '订单表格视图模块需要暴露汇总金额显示格式化函数'
);

assert.match(
  source,
  /function getSummaryTone\(/,
  '订单表格视图模块需要暴露汇总颜色判断函数'
);

assert.match(
  source,
  /function buildCurrentFilterTitle\(/,
  '订单表格视图模块需要根据账号和搜索条件拼出当前筛选标题'
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
  { id: '1', '账号': 'A', '产品名称': '红色杯子', '采购价格': '12.5', '售价': '598', '预估运费': '10', '预估利润': '999' },
  { id: '2', '账号': 'B', '产品名称': '蓝色盘子', '采购价格': '7', '售价': '360', '预估运费': '5.5', '预估利润': '999' },
  { id: '3', '账号': 'B', '产品名称': '蓝色盒子', '采购价格': '8.25', '售价': '420', '预估运费': '6.5', '预估利润': '999' },
  { id: '4', '账号': 'B', '产品名称': '异常价格', '采购价格': 'abc', '售价': '', '预估运费': '', '预估利润': '' }
];

const summary = sandbox.OrderTableView.derivePurchaseSummary({
  orders,
  activeAccount: 'B',
  searchQuery: '蓝色',
  exchangeRate: 20,
  currentPage: 2,
  pageSize: 1
});

assert.equal(summary.filteredCount, 2, '当前筛选条数应按账号和搜索条件统计');
assert.equal(summary.filteredTotal, 15.25, '当前筛选总额应按筛选结果统计，且不受分页影响');
assert.equal(summary.allTotal, 27.75, '全部订单总额应按全量订单统计，非法价格按 0 处理');
assert.equal(summary.filteredSaleTotal, 39, '当前筛选总销售额应按汇率折算后统计');
assert.equal(summary.allSaleTotal, 68.9, '全部总销售额应按汇率折算后统计');
assert.equal(summary.filteredShippingTotal, 12, '当前筛选预估运费总额应按筛选结果统计');
assert.equal(summary.allShippingTotal, 22, '全部预估运费总额应按全量订单统计');
assert.equal(summary.filteredProfitTotal, 11.75, '当前筛选预估总利润应按汇率折算后统计');
assert.equal(summary.allProfitTotal, 19.15, '全部预估总利润应按汇率折算后统计');
assert.equal(
  sandbox.OrderTableView.formatSummaryMetric(summary.filteredProfitMetric),
  '¥ 11.75',
  '有数据时汇总金额应正常格式化'
);
assert.equal(
  sandbox.OrderTableView.formatSummaryMetric({ total: 0, count: 1 }),
  '¥ 0.00',
  '有真实数据且结果为 0 时应显示 0'
);
assert.equal(
  sandbox.OrderTableView.formatSummaryMetric({ total: 0, count: 0 }),
  '-',
  '无数据时汇总金额应显示为 -'
);
assert.equal(
  sandbox.OrderTableView.formatSummaryMetric({ total: Number.NaN, count: 1 }),
  '-',
  '无效金额不应被兜底显示为 0'
);
assert.equal(
  sandbox.OrderTableView.getSummaryTone(summary.filteredSaleMetric, 'income'),
  'income',
  '收入汇总应使用收入色'
);
assert.equal(
  sandbox.OrderTableView.getSummaryTone(summary.filteredProfitMetric, 'profit'),
  'profit-positive',
  '正利润汇总应使用绿色'
);
assert.equal(
  sandbox.OrderTableView.getSummaryTone({ total: -5, count: 1 }, 'profit'),
  'profit-negative',
  '负利润汇总应使用红色'
);
assert.equal(
  sandbox.OrderTableView.formatCurrencyAmount(summary.filteredTotal),
  '¥ 15.25',
  '金额格式化结果不正确'
);

assert.equal(
  sandbox.OrderTableView.buildCurrentFilterTitle('B', '蓝色'),
  '当前筛选 · 账号：B · 搜索：蓝色',
  '当前筛选标题应同步显示账号和搜索条件'
);

assert.equal(
  sandbox.OrderTableView.buildCurrentFilterTitle('__all__', ''),
  '当前筛选',
  '没有筛选条件时不应额外拼接说明'
);

assert.match(
  source,
  /收入[\s\S]*支出[\s\S]*总采购额[\s\S]*预估总海外运费/,
  '统计卡片需要按收入和支出组织汇总信息'
);

assert.match(
  source,
  /ot-summary-hero[\s\S]*预估总利润/,
  '统计卡片需要把预估利润总额放进独立主区'
);

assert.match(
  source,
  /formatSummaryMetric\(summary\.filteredProfitMetric\)[\s\S]*formatSummaryMetric\(summary\.filteredSaleMetric\)/,
  '统计卡片中的预估总利润和总销售额应直接按有效数据渲染'
);

const zeroSaleSummary = sandbox.OrderTableView.derivePurchaseSummary({
  orders: [
    { id: 'zero-sale', '账号': 'A', '售价': '0', '采购价格': '', '预估运费': '' }
  ],
  activeAccount: '__all__',
  searchQuery: '',
  exchangeRate: 20
});

assert.equal(
  sandbox.OrderTableView.formatSummaryMetric(zeroSaleSummary.allSaleMetric),
  '-',
  '售价为 0 时应按未录入处理，汇总收入应显示为 -'
);

assert.equal(
  sandbox.OrderTableView.formatSummaryMetric(zeroSaleSummary.allProfitMetric),
  '-',
  '售价为 0 时应按未录入处理，汇总利润应显示为 -'
);

const expenseOnlySummary = sandbox.OrderTableView.derivePurchaseSummary({
  orders: [
    { id: 'expense-only', '账号': 'A', '售价': '', '采购价格': '10', '预估运费': '2' }
  ],
  activeAccount: '__all__',
  searchQuery: '',
  exchangeRate: 20
});

assert.equal(
  expenseOnlySummary.allProfitTotal,
  -12,
  '摘要区总利润应按总收入减总支出计算'
);

assert.equal(
  sandbox.OrderTableView.formatSummaryMetric(expenseOnlySummary.allProfitMetric),
  '¥ -12.00',
  '只有支出时，总利润应反映为负数'
);

console.log('orders summary ui contract ok');
