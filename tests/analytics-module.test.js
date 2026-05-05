const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const parserSource = fs.readFileSync(path.join(root, 'js', 'analytics', 'parser.js'), 'utf8');
const analyzerSource = fs.readFileSync(path.join(root, 'js', 'analytics', 'analyzer.js'), 'utf8');
const analyticsSource = fs.readFileSync(path.join(root, 'js', 'analytics', 'index.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'js', 'app-config.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styleSource = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const readmeSource = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

assert.match(
  configSource,
  /key:\s*'analytics'/,
  '全局配置需要注册数据分析模块'
);

assert.match(
  appSource,
  /TKAppConfig\.modules/,
  '全局路由需要从项目配置读取模块列表'
);

assert.match(
  appSource,
  /key === 'analytics'[\s\S]*TKAnalytics\.onEnter\(\)/,
  '进入数据分析页时需要初始化 TKAnalytics'
);

assert.match(
  indexSource,
  /data-view="analytics"/,
  '页面导航需要提供数据分析入口'
);

assert.match(
  indexSource,
  /id="view-analytics"/,
  '页面需要提供数据分析视图容器'
);

assert.match(
  indexSource,
  /id="analytics-file-input"[^>]*type="file"[^>]*accept="\.xlsx,\.xls"/,
  '数据分析需要提供 Excel 文件选择入口'
);

assert.match(
  indexSource,
  /xlsx\.full\.min\.js[\s\S]*js\/analytics\/parser\.js[\s\S]*js\/analytics\/analyzer\.js[\s\S]*js\/analytics\/index\.js/,
  'SheetJS、parser、analyzer、index 需要按顺序加载'
);

assert.match(
  styleSource,
  /\.analytics-kpi-grid[\s\S]*grid-template-columns:\s*repeat\(4/,
  '数据分析页需要提供 KPI 网格样式'
);

assert.match(
  styleSource,
  /\.analytics-layout[\s\S]*grid-template-columns:\s*repeat\(2/,
  '数据分析页需要提供图表布局样式'
);

assert.match(
  parserSource,
  /const TKAnalyticsParser = \(function \(\) \{/,
  '数据分析解析逻辑需要独立命名空间'
);

assert.match(
  parserSource,
  /function parseRows\(rows\)/,
  '数据分析 parser 需要暴露 Excel 行解析逻辑'
);

assert.match(
  analyzerSource,
  /const TKAnalyticsAnalyzer = \(function \(\) \{/,
  '数据分析汇总逻辑需要独立命名空间'
);

assert.match(
  analyzerSource,
  /function analyze\(records, period\)/,
  '数据分析 analyzer 需要暴露分析逻辑'
);

assert.match(
  analyticsSource,
  /const TKAnalytics = \(function \(\) \{/,
  '数据分析 DOM 模块需要使用独立命名空间'
);

assert.match(
  analyticsSource,
  /file\.arrayBuffer\(\)/,
  'Excel 文件应在浏览器本地读取'
);

assert.match(
  analyticsSource,
  /window\.XLSX\.read\(buffer,\s*\{\s*type:\s*'array'\s*\}\)/,
  'Excel 解析应使用本地 buffer，不依赖远程上传'
);

assert.doesNotMatch(
  [parserSource, analyzerSource, analyticsSource].join('\n'),
  /\bfetch\s*\(|XMLHttpRequest|sendBeacon|firebase|Firestore|localStorage\.setItem/,
  '数据分析相关模块不应上传或持久化用户 Excel 数据'
);

assert.match(
  readmeSource,
  /本站不保存用户业务数据/,
  'README 需要说明本站不保存用户业务数据'
);

assert.match(
  readmeSource,
  /数据分析模块只在浏览器内读取 Excel 文件/,
  'README 需要说明数据分析文件只在浏览器本地解析'
);

const sandbox = {
  console,
  window: {}
};
vm.createContext(sandbox);
vm.runInContext(`
${parserSource}
${analyzerSource}
${analyticsSource}
this.TKAnalyticsParser = TKAnalyticsParser;
this.TKAnalyticsAnalyzer = TKAnalyticsAnalyzer;
this.TKAnalytics = TKAnalytics;
`, sandbox);

const rows = [
  ['2026-04-27 ~ 2026-05-03'],
  [
    'ID',
    '商品',
    '状态',
    'GMV',
    '成交件数',
    '订单数',
    '商城页 GMV',
    '商城商品成交件数',
    '商城页发品曝光次数',
    '商城页面浏览次数',
    '商城页去重商品客户数',
    '商城点击率',
    '商城转化率',
    '视频归因 GMV',
    '视频归因成交件数',
    '视频曝光次数',
    '来自视频的页面浏览次数',
    '视频去重商品客户数',
    '视频点击率',
    '视频转化率',
    '商品卡归因 GMV',
    '商品卡归因成交件数',
    '商品卡曝光次数',
    '商品卡的页面浏览次数',
    '商品卡去重客户数',
    '商品卡点击率',
    '商品卡转化率',
    '直播归因 GMV',
    '直播归因成交件数',
    '直播曝光次数',
    '直播的页面浏览次数',
    '直播去重商品客户数',
    '直播点击率',
    '直播转化率'
  ],
  [
    '1001',
    '雨衣',
    'Active',
    '70,036円',
    '58',
    '51',
    '10,000円',
    '8',
    '1000',
    '120',
    '80',
    '12%',
    '10%',
    '50,000円',
    '42',
    '6000',
    '320',
    '210',
    '5.33%',
    '20%',
    '9,000円',
    '7',
    '1800',
    '90',
    '70',
    '5%',
    '10%',
    '1,036円',
    '1',
    '200',
    '12',
    '10',
    '6%',
    '10%'
  ],
  [
    '1002',
    '水杯',
    'Active',
    '0円',
    '0',
    '0',
    '0円',
    '0',
    '3000',
    '20',
    '18',
    '0.67%',
    '0%',
    '0円',
    '0',
    '0',
    '0',
    '0',
    '0%',
    '0%',
    '0円',
    '0',
    '0',
    '0',
    '0',
    '0%',
    '0%',
    '0円',
    '0',
    '0',
    '0',
    '0',
    '0%',
    '0%'
  ]
];

const parsed = sandbox.TKAnalyticsParser.parseRows(rows);
assert.strictEqual(parsed.period, '2026-04-27 ~ 2026-05-03', '需要读取导出周期');
assert.strictEqual(parsed.records.length, 2, '需要读取商品数据行');
assert.strictEqual(parsed.records[0].gmv, 70036, '需要正确清洗日元和千分位');
assert.strictEqual(parsed.records[0].channels.video.gmv, 50000, '需要解析视频归因 GMV');
assert.strictEqual(parsed.records[0].channels.mall.ctr, 0.12, '需要把百分比转换为小数');

const analysis = sandbox.TKAnalyticsAnalyzer.analyze(parsed.records, parsed.period);
assert.strictEqual(analysis.kpis.totalGmv, 70036, '需要汇总总 GMV');
assert.strictEqual(analysis.kpis.totalOrders, 51, '需要汇总订单数');
assert.strictEqual(analysis.kpis.productCount, 2, '需要汇总商品数');
assert.strictEqual(analysis.channelTotals.find(channel => channel.key === 'video').gmv, 50000, '需要按渠道汇总 GMV');
assert.ok(
  analysis.records.some(record => record.diagnosis.label === '爆品放大'),
  '需要给高 GMV 商品生成运营诊断'
);
