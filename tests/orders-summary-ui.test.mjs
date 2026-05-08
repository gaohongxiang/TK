import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const esmPath = path.join(__dirname, '..', 'src', 'orders', 'table.ts');
const esmSource = fs.readFileSync(esmPath, 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.match(
  esmSource,
  /function derivePurchaseSummary\(/,
  'ESM 订单表格模块需要暴露采购金额统计纯函数'
);

assert.match(
  esmSource,
  /function formatCurrencyAmount\(/,
  '订单表格视图模块需要暴露金额格式化函数'
);

assert.match(
  esmSource,
  /function formatSummaryMetric\(/,
  '订单表格视图模块需要暴露汇总金额显示格式化函数'
);

assert.match(
  esmSource,
  /function getSummaryTone\(/,
  '订单表格视图模块需要暴露汇总颜色判断函数'
);

assert.match(
  esmSource,
  /function buildCurrentFilterTitle\(/,
  '订单表格视图模块需要根据账号和搜索条件拼出当前筛选标题'
);

assert.match(
  ordersPageSource,
  /<TableHead>总售价\(円\)<\/TableHead>[\s\S]*<TableHead>总采购额\(¥\)<\/TableHead>[\s\S]*<TableHead>预估总海外运费\(¥\)<\/TableHead>[\s\S]*<TableHead>预估总利润\(¥\)<\/TableHead>/,
  '订单表头需要保留销售、采购、运费、利润金额列'
);

assert.match(
  ordersPageSource,
  /id="ot-storage-help-btn"/,
  '订单主面板需要提供数据存储说明入口按钮'
);

assert.match(
  ordersPageSource,
  /id="ot-summary-container"/,
  '订单主面板需要提供采购统计卡片容器'
);

assert.doesNotMatch(
  indexSource,
  /id="ot-storage-help-modal"/,
  '完整 React SPA 重建后订单数据存储说明弹窗不应留在静态 HTML'
);

assert.match(
  ordersPageSource,
  /id="ot-storage-help-modal"/,
  '订单主面板需要由 React 提供数据存储说明弹窗'
);

const orders = [
  { id: '1', '账号': 'A', '产品名称': '红色杯子', '采购价格': '12.5', '售价': '598', '预估运费': '10', '预估利润': '999' },
  { id: '2', '账号': 'B', '产品名称': '蓝色盘子', '采购价格': '7', '售价': '360', '预估运费': '5.5', '预估利润': '999' },
  { id: '3', '账号': 'B', '产品名称': '蓝色盒子', '采购价格': '8.25', '售价': '420', '预估运费': '6.5', '预估利润': '999' },
  { id: '4', '账号': 'B', '产品名称': '异常价格', '采购价格': 'abc', '售价': '', '预估运费': '', '预估利润': '' }
];

assert.match(
  ordersPageSource,
  /filteredCreatorCommissionTotal[\s\S]*allCreatorCommissionTotal[\s\S]*采购 · 运费 · 达人/,
  '统计卡片需要按收入和支出组织汇总信息，并把达人佣金计入支出'
);

assert.match(
  ordersPageSource,
  /销售 \$\{formatSummaryMetric\(grossMetric\)\} - 退款 \$\{formatSummaryMetric\(refundMetric\)\}/,
  '有退款时，收入说明需要写成总销售额减总退款额'
);

assert.match(
  ordersPageSource,
  /含 \$\{refundMetric\.count\} 条退款/,
  '统计说明需要补充退款订单条数'
);

assert.match(
  ordersPageSource,
  /ot-summary-hero[\s\S]*预估总利润/,
  '统计卡片需要把预估利润总额放进独立主区'
);

assert.match(
  ordersPageSource,
  /formatSummaryMetric\(profitMetric\)[\s\S]*formatSummaryMetric\(saleMetric\)[\s\S]*summary\.filteredProfitMetric[\s\S]*summary\.filteredSaleMetric/,
  '统计卡片中的预估总利润和总销售额应直接按有效数据渲染'
);

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

(async () => {
  const tableModule = await import(pathToFileURL(esmPath).href);
  const summary = tableModule.OrderTableView.derivePurchaseSummary({
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
  assert.equal(tableModule.formatSummaryMetric(summary.filteredProfitMetric), '¥ 11.75', '有数据时汇总金额应正常格式化');
  assert.equal(tableModule.formatSummaryMetric({ total: 0, count: 1 }), '¥ 0.00', '有真实数据且结果为 0 时应显示 0');
  assert.equal(tableModule.formatSummaryMetric({ total: 0, count: 0 }), '-', '无数据时汇总金额应显示为 -');
  assert.equal(tableModule.formatSummaryMetric({ total: Number.NaN, count: 1 }), '-', '无效金额不应被兜底显示为 0');
  assert.equal(tableModule.getSummaryTone(summary.filteredSaleMetric, 'income'), 'income', '收入汇总应使用收入色');
  assert.equal(tableModule.getSummaryTone(summary.filteredProfitMetric, 'profit'), 'profit-positive', '正利润汇总应使用绿色');
  assert.equal(tableModule.getSummaryTone({ total: -5, count: 1 }, 'profit'), 'profit-negative', '负利润汇总应使用红色');
  assert.equal(tableModule.formatCurrencyAmount(summary.filteredTotal), '¥ 15.25', '金额格式化结果不正确');
  assert.equal(tableModule.buildCurrentFilterTitle('B', '蓝色'), '当前筛选 · 账号：B · 搜索：蓝色', '当前筛选标题应同步显示账号和搜索条件');
  assert.equal(tableModule.buildCurrentFilterTitle('__all__', ''), '当前筛选', '没有筛选条件时不应额外拼接说明');

  const zeroSaleSummary = tableModule.OrderTableView.derivePurchaseSummary({
    orders: [
      { id: 'zero-sale', '账号': 'A', '售价': '0', '采购价格': '', '预估运费': '' }
    ],
    activeAccount: '__all__',
    searchQuery: '',
    exchangeRate: 20
  });

  assert.equal(tableModule.formatSummaryMetric(zeroSaleSummary.allSaleMetric), '-', '售价为 0 时应按未录入处理，汇总收入应显示为 -');
  assert.equal(tableModule.formatSummaryMetric(zeroSaleSummary.allProfitMetric), '-', '售价为 0 时应按未录入处理，汇总利润应显示为 -');

  const expenseOnlySummary = tableModule.OrderTableView.derivePurchaseSummary({
    orders: [
      { id: 'expense-only', '账号': 'A', '售价': '', '采购价格': '10', '预估运费': '2' }
    ],
    activeAccount: '__all__',
    searchQuery: '',
    exchangeRate: 20
  });

  assert.equal(expenseOnlySummary.allProfitTotal, -12, '摘要区总利润应按总收入减总支出计算');
  assert.equal(tableModule.formatSummaryMetric(expenseOnlySummary.allProfitMetric), '¥ -12.00', '只有支出时，总利润应反映为负数');

  const refundedSummary = tableModule.OrderTableView.derivePurchaseSummary({
    orders: [
      { id: 'refunded-1', '账号': 'A', '售价': '500', '是否退款': '1', '采购价格': '10', '预估运费': '2' },
      { id: 'normal-1', '账号': 'A', '售价': '300', '采购价格': '5', '预估运费': '1' }
    ],
    activeAccount: '__all__',
    searchQuery: '',
    exchangeRate: 20
  });

  assert.equal(refundedSummary.allRefundMetric.total, 25, '退款汇总应按退款订单折算后的收入口径统计');
  assert.equal(refundedSummary.allRefundMetric.count, 1, '退款汇总应统计退款订单条数');

  const creatorCommissionSummary = tableModule.OrderTableView.derivePurchaseSummary({
    orders: [
      { id: 'creator-1', '账号': 'A', '售价': '1000', '达人佣金率': '10', '采购价格': '20', '预估运费': '5' }
    ],
    activeAccount: '__all__',
    searchQuery: '',
    exchangeRate: 20
  });

  assert.equal(creatorCommissionSummary.allCreatorCommissionMetric.total, 5, '达人佣金汇总应按订单总售价百分比折算后统计');
  assert.equal(creatorCommissionSummary.allProfitTotal, 20, '摘要区总利润应扣除达人佣金');

  assert.deepEqual(
    toPlain(summary),
    toPlain(tableModule.derivePurchaseSummary({
      orders,
      activeAccount: 'B',
      searchQuery: '蓝色',
      exchangeRate: 20
    })),
    'ESM 订单表格摘要统计应保持稳定'
  );

  assert.equal(
    tableModule.formatSummaryMetric(creatorCommissionSummary.allCreatorCommissionMetric),
    '¥ 5.00',
    'ESM 订单表格应保留摘要金额格式化'
  );

  assert.equal(
    tableModule.buildCurrentFilterTitle('B', '蓝色'),
    '当前筛选 · 账号：B · 搜索：蓝色',
    'ESM 订单表格应保留当前筛选标题'
  );

  console.log('orders summary ui contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
