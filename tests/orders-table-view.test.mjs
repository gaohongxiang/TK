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
  /const OrderTableView = \{/,
  'ESM 订单表格模块需要保留 OrderTableView 命名导出'
);

assert.match(
  esmSource,
  /function deriveDisplayedOrders\(/,
  'ESM 订单表格模块需要暴露纯函数 deriveDisplayedOrders'
);

assert.match(
  esmSource,
  /export \{[\s\S]*OrderTableView[\s\S]*deriveDisplayedOrders[\s\S]*derivePurchaseSummary[\s\S]*getProfitCellToneClass[\s\S]*\}/,
  'ESM 订单表格模块需要导出表格命名空间和关键纯函数'
);

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

assert.match(
  ordersPageSource,
  /<TableHead>总售价\(円\)<\/TableHead>[\s\S]*<TableHead>总采购额\(¥\)<\/TableHead>[\s\S]*<TableHead>预估总海外运费\(¥\)<\/TableHead>[\s\S]*<TableHead>预估总利润\(¥\)<\/TableHead>/,
  '表格需要按订单总额口径展示金额列，并保持售价在采购额前面'
);

assert.match(
  ordersPageSource,
  /ot-profit-value[\s\S]*getProfitCellToneClass\(profit\)/,
  '预估利润列需要按正负利润套用颜色样式'
);

assert.match(
  esmSource,
  /isOrderRefunded\(order\) \? '退款 已退款' : ''/,
  '搜索口径需要包含退款关键词，便于搜出退款订单'
);

assert.match(
  esmSource,
  /isCreatorOrder\(order\) \? '达人 达人单' : ''/,
  '搜索口径需要包含达人关键词，便于搜出达人带货订单'
);

assert.match(
  esmSource,
  /ot-order-tag ot-order-tag-creator"[\s\S]*>达人<\/span>/,
  '订单号纯函数需要在达人带货订单后显示达人标记'
);

assert.match(
  ordersPageSource,
  /const orderTagClass = 'ot-order-tag[\s\S]*function OrderNoCell[\s\S]*isCreatorOrder\(order\)[\s\S]*isOrderRefunded\(order\)[\s\S]*orderTagClass/,
  'React 订单号列需要用 React 渲染达人和退款标记'
);

assert.match(
  ordersPageSource,
  /className=\{isOrderRefunded\(order\) \? 'is-refunded' : undefined\}/,
  '退款订单行需要挂上淡红提示样式'
);

assert.match(
  ordersPageSource,
  /deriveDisplayedOrders[\s\S]*derivePurchaseSummary[\s\S]*getProfitCellToneClass/,
  'React 订单页需要直接复用订单表格筛选、摘要和利润颜色 helper'
);

assert.match(
  ordersPageSource,
  /function OrdersTable\([\s\S]*id="ot-table-container"[\s\S]*<Table className="[^"]*\borders-react-table\b[^"]*"/,
  'React 订单页需要通过共享 Table primitive 直接渲染订单表格，并保留 orders-react-table 定位类'
);

assert.doesNotMatch(
  indexSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再加载旧订单 ESM 入口'
);

assert.doesNotMatch(
  indexSource,
  /<script src="js\/orders\/table\.js" defer><\/script>/,
  'index.html 不应再加载旧订单 table 普通脚本'
);

assert.match(
  ordersPageSource,
  /id="ot-table-toolbar-container"[\s\S]*<TableSearch[\s\S]*id="ot-table-search-input"/,
  'React 订单页需要通过共享 TableSearch 渲染搜索和分页控制'
);

assert.match(
  ordersPageSource,
  /搜索下单时间 \/ 订单号 \/ 产品 \/ 快递/,
  '搜索提示文案需要明确包含下单时间'
);

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

(async () => {
  const tableModule = await import(pathToFileURL(esmPath).href);
  const result = tableModule.OrderTableView.deriveDisplayedOrders({
    orders,
    activeAccount: '__all__',
    searchQuery: '红色',
    sortOrder: 'asc'
  });

  assert.equal(result.isAll, true, '全部账号模式下 isAll 应为 true');
  assert.equal(result.sorted.length, 1, '搜索应只命中一条记录');
  assert.equal(result.sorted[0].id, '1', '应命中包含关键词的订单');

  const creatorSearchResult = tableModule.OrderTableView.deriveDisplayedOrders({
    orders: [
      { id: 'creator-1', '账号': 'A', '订单号': 'AA-1', '达人佣金率': '10' },
      { id: 'creator-2', '账号': 'A', '订单号': 'AA-2', '达人佣金率': '' }
    ],
    activeAccount: '__all__',
    searchQuery: '达人',
    sortOrder: 'asc'
  });

  assert.equal(creatorSearchResult.sorted.length, 1, '搜索达人应命中达人带货订单');
  assert.equal(creatorSearchResult.sorted[0].id, 'creator-1', '达人搜索应命中佣金率大于 0 的订单');

  const dateSearchResult = tableModule.OrderTableView.deriveDisplayedOrders({
    orders: [
      { id: 'dated-1', '账号': 'A', '下单时间': '2026-04-23', '订单号': 'AA-1' },
      { id: 'dated-2', '账号': 'A', '下单时间': '2026-04-10', '订单号': 'AA-2' }
    ],
    activeAccount: '__all__',
    searchQuery: '2026-04-23',
    sortOrder: 'asc'
  });

  assert.equal(dateSearchResult.sorted.length, 1, '搜索应支持按下单时间匹配');
  assert.equal(dateSearchResult.sorted[0].id, 'dated-1', '下单时间搜索应命中对应订单');

  const dateSearchShouldIgnoreOtherDateFields = tableModule.OrderTableView.deriveDisplayedOrders({
    orders: [
      {
        id: 'order-date-match',
        '账号': 'A',
        '下单时间': '2026-04-01',
        '采购日期': '2026-04-23',
        '最晚到仓时间': '2026-04-29',
        '订单号': 'AA-1'
      },
      {
        id: 'purchase-date-only',
        '账号': 'A',
        '下单时间': '2026-04-02',
        '采购日期': '2026-04-23',
        '最晚到仓时间': '2026-04-23',
        '订单号': 'AA-2'
      }
    ],
    activeAccount: '__all__',
    searchQuery: '2026-04-23',
    sortOrder: 'asc'
  });

  assert.equal(dateSearchShouldIgnoreOtherDateFields.sorted.length, 0, '日期型搜索不应匹配采购日期和最晚到仓时间');

  const accountOnlyResult = tableModule.OrderTableView.deriveDisplayedOrders({
    orders,
    activeAccount: 'B',
    searchQuery: '',
    sortOrder: 'asc'
  });

  assert.equal(accountOnlyResult.sorted.length, 1, '账号筛选应只保留目标账号');
  assert.equal(accountOnlyResult.sorted[0].id, '2', '账号筛选结果不正确');

  const stableSortResult = tableModule.OrderTableView.deriveDisplayedOrders({
    orders: [
      { id: 'newer', createdAt: '2026-04-22T10:00:00.000Z', '账号': 'A' },
      { id: 'older', createdAt: '2026-04-20T10:00:00.000Z', '账号': 'A' }
    ],
    activeAccount: '__all__',
    searchQuery: '',
    sortOrder: 'asc'
  });

  assert.equal(stableSortResult.sorted[0].id, 'older', '表格排序应优先按持久化创建时间，而不是当前数组顺序');

  const seqPriorityResult = tableModule.OrderTableView.deriveDisplayedOrders({
    orders: [
      { id: 'late-created', seq: 9, createdAt: '2026-04-23T10:00:00.000Z', '账号': 'A' },
      { id: 'early-created', seq: 2, createdAt: '2026-04-20T10:00:00.000Z', '账号': 'A' }
    ],
    activeAccount: '__all__',
    searchQuery: '',
    sortOrder: 'asc'
  });

  assert.equal(seqPriorityResult.sorted[0].id, 'early-created', '有 seq 时应优先按录入编号排序');

  assert.equal(tableModule.OrderTableView.getProfitCellToneClass(12.5), 'profit-positive', '正利润应使用绿色样式');
  assert.equal(tableModule.OrderTableView.getProfitCellToneClass(-3.2), 'profit-negative', '负利润应使用红色样式');
  assert.equal(tableModule.OrderTableView.getProfitCellToneClass(null), 'neutral', '无利润数据应保持中性色');

  assert.deepEqual(
    toPlain(tableModule.OrderTableView.deriveDisplayedOrders({
      orders,
      activeAccount: '__all__',
      searchQuery: '红色',
      sortOrder: 'asc'
    })),
    toPlain(result),
    'ESM 订单表格筛选结果需要保持稳定'
  );

  const esmCreatorSearchResult = tableModule.deriveDisplayedOrders({
    orders: [
      { id: 'creator-1', '账号': 'A', '订单号': 'AA-1', '达人佣金率': '10' },
      { id: 'creator-2', '账号': 'A', '订单号': 'AA-2', '达人佣金率': '' }
    ],
    activeAccount: '__all__',
    searchQuery: '达人',
    sortOrder: 'asc'
  });

  assert.deepEqual(
    toPlain(esmCreatorSearchResult),
    toPlain(creatorSearchResult),
    'ESM 订单表格达人搜索结果需要保持稳定'
  );

  assert.deepEqual(
    toPlain(tableModule.deriveDisplayedOrders({
      orders: [
        { id: 'newer', createdAt: '2026-04-22T10:00:00.000Z', '账号': 'A' },
        { id: 'older', createdAt: '2026-04-20T10:00:00.000Z', '账号': 'A' }
      ],
      activeAccount: '__all__',
      searchQuery: '',
      sortOrder: 'asc'
    })),
    toPlain(stableSortResult),
    'ESM 订单表格稳定排序结果需要保持稳定'
  );

  assert.equal(
    tableModule.getProfitCellToneClass(-3.2),
    'profit-negative',
    'ESM 订单表格应保留利润颜色判断'
  );

  assert.equal(
    tableModule.buildOrderCourierSummary({
      items: [
        { courierCompany: '顺丰快递', trackingNo: 'SF123' },
        { courierCompany: '中通快递', trackingNo: 'ZT456' }
      ]
    }, 'company', 'compact'),
    '共2家',
    'ESM 订单表格应保留多明细快递紧凑展示口径'
  );

  assert.match(
    tableModule.buildOrderNoCellMarkup({ '订单号': 'AA-1', '达人佣金率': '10' }),
    /ot-order-tag ot-order-tag-creator[\s\S]*>达人</,
    'ESM 订单号纯函数应保留达人标记'
  );

  assert.match(
    tableModule.buildOrderNoCellMarkup({ '订单号': 'AA-2', '是否退款': '1' }),
    /ot-order-tag ot-order-tag-creator[\s\S]*>退款</,
    'ESM 订单号纯函数应保留退款标记'
  );

  assert.equal(tableModule.OrderTableView.render, undefined, '完整 React SPA 重建后订单表格 helper 不再暴露 DOM render 壳');

  console.log('orders table view contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
