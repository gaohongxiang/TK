import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const esmPath = path.join(__dirname, '..', 'src', 'orders', 'export.ts');
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

assert.doesNotMatch(
  esmSource,
  /window\.OrderTrackerExport|document\.|querySelector|innerHTML|classList|createElement|globalThis\.Blob|globalThis\.URL|function promptExportAccounts|async function exportOrdersCsv/,
  '订单导出模块应保持纯 ESM，不应再包含旧 DOM 弹层、下载动作或全局暴露'
);

assert.match(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'app-export-center.ts'), 'utf8'),
  /function downloadBlob[\s\S]*new Blob\(\[files\[0\]\.csv\][\s\S]*JSZip/,
  '统一导出中心需要直接负责 CSV 下载和多文件 ZIP 打包'
);

assert.match(
  esmSource,
  /售价口径[\s\S]*采购价格[\s\S]*售价\(日元\)[\s\S]*平台手续费率\(%\)[\s\S]*平台手续费\(人民币\)[\s\S]*达人佣金率\(%\)[\s\S]*达人佣金\(人民币\)[\s\S]*预估运费\(人民币\)[\s\S]*预估利润\(人民币\)/,
  'CSV 导出需要明确标注售价口径、售价为日元、平台手续费/达人佣金/运费/利润为人民币'
);

assert.match(
  esmSource,
  /computeOrderPlatformFee[\s\S]*computeOrderCreatorCommission[\s\S]*computeOrderEstimatedProfit/,
  'CSV 导出需要按当前 V3 参数重新计算平台手续费、达人佣金和人民币预估利润，不能直接信任旧存量字段'
);

assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'orders', 'index.mjs')), '完整 React SPA 重建后旧订单 DOM 入口应删除');

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再通过旧订单 ESM 入口加载导出模块'
);

assert.match(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'app-export-center.ts'), 'utf8'),
  /buildExportRows[\s\S]*buildOrdersCsv[\s\S]*function buildExportFiles/,
  '统一导出中心需要负责订单 CSV 构造'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/export\.js" defer><\/script>/,
  'index.html 不应再加载旧订单导出普通脚本'
);

(async () => {
  const exportModule = await import(pathToFileURL(esmPath).href);
  assert.equal(typeof exportModule.OrderTrackerExport.buildOrdersCsv, 'function', '订单导出命名空间需要保留 CSV 纯函数');
  const orders = [
    {
      '账号': 'A',
      '下单时间': '2026-04-23',
      '采购日期': '2026-04-24',
      '最晚到仓时间': '2026-04-29',
      '订单号': 'ORDER-1',
      '产品名称': '马克杯 "红"',
      '数量': '2',
      '售价口径': 'free_shipping_transfer',
      '采购价格': '20',
      '售价': '1350',
      '达人佣金率': '10',
      '预估运费': '5',
      '重量': '500',
      '尺寸': '10×10×10',
      '订单状态': '已采购',
      '快递公司': '顺丰快递',
      '快递单号': 'SF123',
      '备注': '催采购'
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
    exchangeRate: { rate: 20, platformFeeRate: 10 },
    computeWarningFn: () => ({ text: '剩 6 天' })
  });

  assert.deepEqual(
    rows[0].slice(0, 6),
    ['A', '2026-04-23', '2026-04-24', '2026-04-29', '剩 6 天', 'ORDER-1'],
    'ESM 订单导出模块应按旧字段顺序生成 CSV 行'
  );

  assert.equal(rows[0][8], '包邮转嫁', 'ESM 订单导出模块应导出售价口径');
  assert.equal(rows[0][11], 10, 'ESM 订单导出模块应导出当前平台手续费率');
  assert.equal(rows[0][12], 6.75, 'ESM 订单导出模块应按 V3 当前参数计算包邮转嫁平台手续费');
  assert.equal(rows[0][14], 6.75, 'ESM 订单导出模块应按实际商品售价计算包邮转嫁达人佣金');
  assert.equal(rows[0][16], 11.5, 'ESM 订单导出模块应按当前 V3 参数计算包邮转嫁预估利润');
  assert.equal(rows[0].at(-1), '催采购', 'ESM 订单导出模块应包含订单备注');

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
