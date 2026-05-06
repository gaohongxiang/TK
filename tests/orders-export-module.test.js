const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const esmPath = path.join(__dirname, '..', 'src', 'orders', 'export.mjs');
const esmSource = fs.readFileSync(esmPath, 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.match(
  esmSource,
  /const OrderTrackerExport = \{/,
  'ESM 订单导出模块需要保留 OrderTrackerExport 命名导出'
);

assert.match(
  esmSource,
  /function buildExportFilename\(/,
  'ESM 订单导出模块需要包含导出文件名逻辑'
);

assert.match(
  esmSource,
  /function buildOrdersCsv\(/,
  'ESM 订单导出模块需要包含 CSV 构造纯函数'
);

assert.match(
  esmSource,
  /export \{[\s\S]*OrderTrackerExport[\s\S]*buildExportFilename[\s\S]*buildExportRows[\s\S]*buildOrdersCsv[\s\S]*\}/,
  'ESM 订单导出模块需要导出命名空间和 CSV 纯函数'
);

assert.match(
  esmSource,
  /window\.OrderTrackerExport = OrderTrackerExport/,
  'ESM 订单导出模块需要挂回旧全局命名空间'
);

assert.match(
  esmSource,
  /async function exportOrdersCsv\(/,
  '订单导出模块需要包含 CSV 导出逻辑'
);

assert.match(
  esmSource,
  /采购价格[\s\S]*售价\(日元\)[\s\S]*达人佣金率\(%\)[\s\S]*达人佣金\(人民币\)[\s\S]*预估运费\(人民币\)[\s\S]*预估利润\(人民币\)/,
  'CSV 导出需要明确标注售价为日元、达人佣金/运费/利润为人民币'
);

assert.match(
  esmSource,
  /computeOrderCreatorCommission[\s\S]*computeOrderEstimatedProfit/,
  'CSV 导出需要按当前汇率重新计算达人佣金和人民币预估利润，不能直接信任旧存量字段'
);

assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'orders', 'index.mjs')), '完整 React SPA 重建后旧订单 DOM 入口应删除');

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再通过旧订单 ESM 入口加载导出模块'
);

assert.match(
  ordersPageSource,
  /buildExportRows[\s\S]*buildOrdersCsv[\s\S]*id="ot-export-modal"/,
  'React 订单页需要直接接管订单 CSV 导出弹窗和 CSV 构造'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/export\.js" defer><\/script>/,
  'index.html 不应再加载旧订单导出普通脚本'
);

(async () => {
  const exportModule = await import(pathToFileURL(esmPath).href);
  const orders = [
    {
      '账号': 'A',
      '下单时间': '2026-04-23',
      '采购日期': '2026-04-24',
      '最晚到仓时间': '2026-04-29',
      '订单号': 'ORDER-1',
      '产品名称': '马克杯 "红"',
      '数量': '2',
      '采购价格': '20',
      '售价': '1000',
      '达人佣金率': '10',
      '预估运费': '5',
      '重量': '500',
      '尺寸': '10×10×10',
      '订单状态': '已采购',
      '快递公司': '顺丰快递',
      '快递单号': 'SF123'
    },
    {
      '账号': '',
      '订单号': 'ORDER-2',
      '产品名称': '未关联商品',
      '采购价格': '8',
      '售价': '300',
      '预估运费': '3'
    }
  ];

  assert.deepEqual(
    exportModule.getExportAccountOptions({
      accounts: ['A'],
      orders,
      constants: { UNASSIGNED_ACCOUNT_SLOT: '__unassigned__' }
    }),
    [
      { key: 'A', label: 'A', count: 1 },
      { key: '__unassigned__', label: '未关联', count: 1 }
    ],
    'ESM 订单导出模块应正确生成账号选项'
  );

  assert.equal(
    exportModule.buildExportFilename([{ label: 'A' }, { label: '未关联' }], { today: () => '2026-05-05' }),
    '订单数据导出_A等2个账号_2026-05-05.csv',
    'ESM 订单导出模块应正确生成导出文件名'
  );

  const rows = exportModule.buildExportRows({
    orders: [orders[0]],
    exchangeRate: 20,
    computeWarningFn: () => ({ text: '剩 6 天' })
  });

  assert.deepEqual(
    rows[0].slice(0, 6),
    ['A', '2026-04-23', '2026-04-24', '2026-04-29', '剩 6 天', 'ORDER-1'],
    'ESM 订单导出模块应按旧字段顺序生成 CSV 行'
  );

  assert.equal(rows[0][11], 5, 'ESM 订单导出模块应按当前汇率计算达人佣金');
  assert.equal(rows[0][13], 20, 'ESM 订单导出模块应按当前汇率计算预估利润');

  const csv = exportModule.buildOrdersCsv({ rows });
  assert.match(
    csv,
    /^"账号","下单时间","采购日期","最晚到仓时间","订单预警","订单号"/,
    'ESM 订单导出模块应保留 CSV 表头'
  );
  assert.match(
    csv,
    /"马克杯 ""红"""/,
    'ESM 订单导出模块应正确转义 CSV 双引号'
  );

  assert.deepEqual(
    exportModule.selectOrdersForExport({
      orders,
      selectedKeys: ['__unassigned__'],
      constants: { UNASSIGNED_ACCOUNT_SLOT: '__unassigned__' }
    }),
    [orders[1]],
    'ESM 订单导出模块应支持按未关联账号筛选导出订单'
  );

  console.log('orders export module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
