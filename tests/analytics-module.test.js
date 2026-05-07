const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const srcParserSource = fs.readFileSync(path.join(root, 'src', 'analytics', 'parser.mjs'), 'utf8');
const srcAnalyzerSource = fs.readFileSync(path.join(root, 'src', 'analytics', 'analyzer.mjs'), 'utf8');
const reactMainSource = fs.readFileSync(path.join(root, 'src', 'react', 'main.tsx'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const reactAppShellSource = fs.readFileSync(path.join(root, 'src', 'react', 'layouts', 'AppShell.tsx'), 'utf8');
const reactAnalyticsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'AnalyticsApp.tsx'), 'utf8');
const reactAnalyticsRouteSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'AnalyticsRoute.tsx'), 'utf8');
const reactChartOptionsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'chartOptions.ts'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'src', 'app-config.mjs'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styleSource = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const readmeSource = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

assert.match(
  configSource,
  /key:\s*'analytics'/,
  '全局配置需要注册数据分析模块'
);

assert.match(
  reactAppSource,
  /config\.modules/,
  'React SPA 路由需要从项目配置读取模块列表'
);

assert.doesNotMatch(
  reactMainSource,
  /TKAnalytics\?\.onEnter/,
  '数据分析页已由 React 入口懒加载，不应再调用旧 TKAnalytics DOM 入口'
);

assert.match(
  reactAppShellSource,
  /key:\s*'analytics'[\s\S]*data-view=\{module\.key\}/,
  'React AppShell 导航需要提供数据分析入口'
);

assert.match(
  reactAppSource,
  /id="view-analytics"/,
  'React App 需要提供数据分析视图容器'
);

assert.match(
  reactAppSource,
  /id="view-analytics"[\s\S]*<AnalyticsPane active=\{active === 'analytics'\} \/>/,
  '数据分析页需要由 React App 路由直接渲染'
);

assert.match(
  reactAnalyticsSource,
  /id="analytics-file-input"[^>]*type="file"[^>]*accept="\.xlsx,\.xls"/,
  'React 数据分析需要提供 Excel 文件选择入口'
);

assert.match(
  reactAnalyticsSource,
  /id="analytics-channel-share"[\s\S]*id="analytics-bubble-chart"/,
  'React 数据分析需要提供渠道环形图和商品机会散点图容器'
);

assert.match(
  indexSource,
  /xlsx\.full\.min\.js/,
  '数据分析需要继续加载浏览器端 SheetJS 解析库'
);

assert.doesNotMatch(
  indexSource,
  /<script type="module" src="\/src\/analytics\/index\.mjs"><\/script>/,
  '现代 React SPA 阶段数据分析页不应再加载旧 DOM 入口'
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
  styleSource,
  /\.analytics-insight-layout[\s\S]*grid-template-columns:[\s\S]*\.analytics-channel-share[\s\S]*grid-template-columns:\s*repeat\(2/,
  '数据分析页需要提供高级图表布局和双环形图样式'
);

assert.match(
  styleSource,
  /\.analytics-donut-card[\s\S]*\.analytics-donut-segment[\s\S]*\.analytics-bubble-point/,
  '数据分析页需要提供环形图和气泡图样式'
);

assert.match(
  styleSource,
  /\.analytics-react-overview[\s\S]*height:\s*332px[\s\S]*\.analytics-react-funnel-summary/,
  'React 数据分析页需要用一个总览图结合渠道结构和流量漏斗'
);

assert.match(
  styleSource,
  /\.analytics-react-scatter[\s\S]*height:\s*324px/,
  'React 数据分析页需要提供稳定的散点图画布高度'
);

assert.match(
  srcParserSource,
  /const TKAnalyticsParser = \{/,
  '数据分析解析逻辑需要独立命名空间导出'
);

assert.match(
  srcParserSource,
  /function parseRows\(rows\)/,
  '数据分析 parser 需要暴露 Excel 行解析逻辑'
);

assert.match(
  srcAnalyzerSource,
  /const TKAnalyticsAnalyzer = \{/,
  '数据分析汇总逻辑需要独立命名空间导出'
);

assert.match(
  srcAnalyzerSource,
  /function analyze\(records, period\)/,
  '数据分析 analyzer 需要暴露分析逻辑'
);

assert.match(
  srcParserSource,
  /export\s+\{[\s\S]*parseRows[\s\S]*\}/,
  '路线二 M1 需要提供 analytics parser ESM 导出'
);

assert.match(
  srcAnalyzerSource,
  /import\s+\{\s*CHANNELS\s*\}\s+from\s+'\.\/parser\.mjs'/,
  '路线二 M1 analytics analyzer 需要通过 import 读取 parser 元信息'
);

assert.ok(!fs.existsSync(path.join(root, 'src', 'analytics', 'index.mjs')), '完整 React SPA 重建后旧 analytics DOM 入口应删除');
assert.ok(!fs.existsSync(path.join(root, 'src', 'analytics', 'charts.mjs')), '完整 React SPA 重建后旧 SVG 图表 helper 应删除');

assert.match(
  reactAnalyticsSource,
  /file\.arrayBuffer\(\)/,
  'Excel 文件应在浏览器本地读取'
);

assert.match(
  reactAnalyticsSource,
  /xlsx\.read\(buffer,\s*\{\s*type:\s*'array'\s*\}\)/,
  'Excel 解析应使用本地 buffer，不依赖远程上传'
);

assert.doesNotMatch(
  [srcParserSource, srcAnalyzerSource, reactAnalyticsSource, reactAnalyticsRouteSource, reactChartOptionsSource].join('\n'),
  /\bfetch\s*\(|XMLHttpRequest|sendBeacon|firebase|localStorage\.setItem/,
  '数据分析相关模块不应上传或持久化用户 Excel 数据'
);

assert.match(
  reactAppSource,
  /import\('\.\.\/features\/analytics\/AnalyticsRoute'\)[\s\S]*AnalyticsStatus[\s\S]*AnalyticsPane/,
  'React 入口需要按需加载数据分析模块，并在加载期间提供轻量状态'
);

assert.doesNotMatch(
  reactMainSource,
  /from '\.\/features\/analytics\/AnalyticsRoute'/,
  'React 首屏入口不应静态引入数据分析模块，避免提前加载 ECharts'
);

assert.match(
  styleSource,
  /\.analytics-react-status[\s\S]*\.analytics-react-status\.is-error/,
  'React 数据分析懒加载状态需要有可见样式'
);

assert.match(
  reactAppSource,
  /data-analytics-lazy-state=\{state\}/,
  'React 数据分析懒加载状态需要提供可测试状态标记'
);

assert.match(
  reactAnalyticsRouteSource,
  /<AnalyticsApp[\s\S]*analyzer=\{TKAnalyticsAnalyzer\}[\s\S]*parser=\{TKAnalyticsParser\}/,
  'React 数据分析需要通过路由组件挂载 parser/analyzer'
);

assert.match(
  reactAnalyticsSource,
  /echarts\/core[\s\S]*echarts\.use\(\[[\s\S]*CanvasRenderer[\s\S]*FunnelChart[\s\S]*PieChart[\s\S]*ScatterChart[\s\S]*TooltipComponent/,
  'React 数据分析需要通过 ECharts core 按需注册实际使用的图表'
);

assert.doesNotMatch(
  reactAnalyticsSource,
  /from 'echarts-for-react';|from 'echarts';/,
  'React 数据分析不应引入完整 ECharts 包'
);

assert.match(
  reactAnalyticsSource,
  /data-react-analytics-ready="true"[\s\S]*getXlsx\?\.\(\)/,
  'React 数据分析需要暴露就绪标记并延迟读取 SheetJS'
);

assert.match(
  reactAnalyticsSource,
  /from '@\/components\/ui\/alert'[\s\S]*from '@\/components\/ui\/badge'[\s\S]*from '@\/components\/ui\/card'|from '@\/components\/ui\/card'[\s\S]*from '@\/components\/ui\/badge'[\s\S]*from '@\/components\/ui\/alert'/,
  '数据分析页面容器、状态标签和本地解析提示需要使用共享 Alert/Badge/Card primitives'
);

assert.match(
  reactAnalyticsSource,
  /<Card className="analytics-chart-card analytics-overview-card"[\s\S]*<Badge className="analytics-chip muted"[\s\S]*<Alert variant="info" className="analytics-privacy-strip"[\s\S]*<Card id="analytics-empty"/,
  '数据分析页面应在保留现有 class 的前提下，把卡片、标签和提示容器收敛到 primitives'
);

assert.match(
  reactChartOptionsSource,
  /function buildOverviewOption\([\s\S]*type:\s*'pie'[\s\S]*type:\s*'funnel'[\s\S]*type:\s*'scatter'/,
  'React 数据分析需要用少量 ECharts 图表覆盖渠道、漏斗和商品机会'
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

(async () => {
  const parserModule = await import(`file://${path.join(root, 'src', 'analytics', 'parser.mjs')}`);
  const analyzerModule = await import(`file://${path.join(root, 'src', 'analytics', 'analyzer.mjs')}`);
  const parsedByModule = parserModule.parseRows(rows);
  assert.strictEqual(parsedByModule.period, '2026-04-27 ~ 2026-05-03', '需要读取导出周期');
  assert.strictEqual(parsedByModule.records.length, 2, '需要读取商品数据行');
  assert.strictEqual(parsedByModule.records[0].gmv, 70036, 'analytics parser ESM 模块需要可被直接 import');
  assert.strictEqual(parsedByModule.records[0].channels.video.gmv, 50000, '需要解析视频归因 GMV');
  assert.strictEqual(parsedByModule.records[0].channels.mall.ctr, 0.12, '需要把百分比转换为小数');
  assert.strictEqual(parserModule.TKAnalyticsParser.normalizePercent('12%'), 0.12, 'analytics parser ESM 模块需要保留命名空间导出');

  const analysisByModule = analyzerModule.analyze(parsedByModule.records, parsedByModule.period);
  assert.strictEqual(analysisByModule.kpis.totalGmv, 70036, '需要汇总总 GMV');
  assert.strictEqual(analysisByModule.kpis.totalOrders, 51, 'analytics analyzer ESM 模块需要可被直接 import');
  assert.strictEqual(analysisByModule.kpis.productCount, 2, '需要汇总商品数');
  assert.strictEqual(analysisByModule.channelTotals.find(channel => channel.key === 'video').gmv, 50000, '需要按渠道汇总 GMV');
  assert.match(reactChartOptionsSource, /type:\s*'pie'[\s\S]*type:\s*'funnel'[\s\S]*type:\s*'scatter'/, 'React ECharts 配置需要覆盖渠道、漏斗和商品机会图');
  assert.ok(
    analysisByModule.records.some(record => record.diagnosis.label === '爆品放大'),
    '需要给高 GMV 商品生成运营诊断'
  );
  assert.strictEqual(typeof analyzerModule.TKAnalyticsAnalyzer.diagnoseProduct, 'function', 'analytics analyzer ESM 模块需要保留命名空间导出');

  console.log('analytics module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
