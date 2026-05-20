import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import { readReactStyleSource } from './helpers/react-style-source.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const srcParserSource = fs.readFileSync(path.join(root, 'src', 'analytics', 'parser.ts'), 'utf8');
const srcAnalyzerSource = fs.readFileSync(path.join(root, 'src', 'analytics', 'analyzer.ts'), 'utf8');
const srcAggregateSource = fs.readFileSync(path.join(root, 'src', 'analytics', 'aggregate.ts'), 'utf8');
const reactMainSource = fs.readFileSync(path.join(root, 'src', 'react', 'main.tsx'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const reactAppShellSource = fs.readFileSync(path.join(root, 'src', 'react', 'layouts', 'AppShell.tsx'), 'utf8');
const reactAnalyticsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'AnalyticsApp.tsx'), 'utf8');
const reactAnalyticsRouteSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'AnalyticsRoute.tsx'), 'utf8');
const reactChartOptionsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'chartOptions.ts'), 'utf8');
const analyticsFirestoreSource = fs.readFileSync(path.join(root, 'src', 'analytics', 'provider-firestore.ts'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'src', 'app-config.ts'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styleSource = readReactStyleSource(root);
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
  reactAnalyticsSource,
  /kpiGridClass = 'analytics-kpi-grid grid grid-cols-4[\s\S]*max-\[860px\]:grid-cols-2[\s\S]*max-\[640px\]:grid-cols-1/,
  '数据分析页需要提供 KPI 网格样式'
);

assert.match(
  reactAnalyticsSource,
  /analyticsLayoutClass = 'analytics-layout grid grid-cols-2[\s\S]*max-\[860px\]:grid-cols-1/,
  '数据分析页需要提供图表布局样式'
);

assert.match(
  reactAnalyticsSource,
  /analyticsInsightLayoutClass = 'analytics-insight-layout analytics-react-insight-layout grid grid-cols-\[minmax\(0,1\.05fr\)_minmax\(0,\.95fr\)\][\s\S]*overviewChartWrapClass = 'analytics-react-overview-chart[\s\S]*scatterWrapClass = 'analytics-react-scatter-wrap/,
  '数据分析页需要提供 ECharts 图表布局样式'
);

assert.doesNotMatch(
  styleSource,
  /\.analytics-donut-card|\.analytics-bubble-point|\.analytics-bar-row|\.analytics-funnel-row/,
  'React ECharts 迁移后不应继续保留旧手写 SVG 图表样式块'
);

assert.doesNotMatch(
  styleSource,
  /\.field input,\s*\n\.field select,\s*\n\.field textarea|\.field\.expense-field input|\.field\.primary input|\.field\.success input|\.field\.readonly input/,
  '通用输入框和计算器 tone 样式应由 React Input/FormField primitives 接管'
);

assert.doesNotMatch(
  styleSource,
  /\.modal-copy/,
  '弹窗说明文字样式应进入 React Alert class，而不是继续留在旧 CSS'
);

assert.match(
  reactAnalyticsSource,
  /analytics-react-overview h-\[332px\][\s\S]*analytics-react-funnel-summary[\s\S]*grid-cols-4/,
  'React 数据分析页需要用一个总览图结合渠道结构和流量漏斗'
);

assert.match(
  reactAnalyticsSource,
  /<div ref=\{containerRef\} className=\{className\}>[\s\S]*<ReactEChartsCore[\s\S]*className="h-full w-full"[\s\S]*style=\{\{\s*height:\s*'100%',\s*width:\s*'100%'\s*\}\}[\s\S]*<\/div>/,
  'React ECharts 需要用外层固定画布高度、内层 100% 填充，避免库默认 300px 或父级塌陷'
);

assert.match(
  reactChartOptionsSource,
  /function buildOverviewOption\([\s\S]*legend:\s*\{\s*show:\s*false\s*\}[\s\S]*type:\s*'pie'[\s\S]*type:\s*'funnel'/,
  '运营总览图内部图例应关闭，避免和流量漏斗卡片重叠'
);

assert.match(
  reactAnalyticsSource,
  /analytics-react-scatter h-\[324px\]/,
  'React 数据分析页需要提供稳定的散点图画布高度'
);

assert.match(
  srcParserSource,
  /const TKAnalyticsParser = \{/,
  '数据分析解析逻辑需要独立命名空间导出'
);

assert.match(
  srcParserSource,
  /function parseRows\(rows(?:[\s\S]*?)?\)/,
  '数据分析 parser 需要暴露 Excel 行解析逻辑'
);

assert.match(
  srcAnalyzerSource,
  /const TKAnalyticsAnalyzer = \{/,
  '数据分析汇总逻辑需要独立命名空间导出'
);

assert.match(
  srcAnalyzerSource,
  /function analyze\(records(?:[\s\S]*?)?,\s*period(?:[\s\S]*?)?\)/,
  '数据分析 analyzer 需要暴露分析逻辑'
);

assert.match(
  srcParserSource,
  /export\s+\{[\s\S]*parseRows[\s\S]*\}/,
  '路线二 M1 需要提供 analytics parser ESM 导出'
);

assert.match(
  srcAnalyzerSource,
  /import\s+\{\s*CHANNELS\s*\}\s+from\s+'\.\/parser\.ts'/,
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
  /\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage\.setItem/,
  '数据分析相关模块不应上传或写浏览器持久化用户 Excel 数据'
);

assert.match(
  reactAnalyticsSource,
  /AnalyticsProviderFirestore[\s\S]*pullAccounts\(\)[\s\S]*listSavedAnalyses\(\)[\s\S]*pullAnalysesBySnapshots\([\s\S]*aggregateAnalyses\([\s\S]*saveAnalysis\(next,\s*\{\s*accountName:\s*normalizedAccountName,\s*filename\s*\}\)[\s\S]*analytics-sync-status/,
  'React 数据分析需要按账号保存到用户自己的 Firestore、恢复历史快照并显示同步状态'
);

assert.match(
  analyticsFirestoreSource,
  /analytics_snapshots[\s\S]*analytics_records[\s\S]*buildAnalyticsSnapshotDoc[\s\S]*buildAnalyticsRecordDoc[\s\S]*listSavedAnalyses[\s\S]*pullAnalysisBySnapshot[\s\S]*pullAnalysesBySnapshots[\s\S]*pullLatestAnalysis[\s\S]*saveAnalysis[\s\S]*upsertAccount[\s\S]*saveAccountOrder[\s\S]*renameAccount[\s\S]*deleteAccount/,
  '数据分析 Firestore provider 需要保存快照和商品明细，支持列出和恢复历史分析，并复用共享账号写入能力'
);

assert.match(
  reactAnalyticsSource,
  /isPermissionDenied\(error\)[\s\S]*TKFirestoreConnection\.notifyRulesUpdateNeeded\(message\)/,
  '数据分析权限不足时需要走全局 Firestore 规则弹窗'
);

assert.match(
  reactAnalyticsSource,
  /AccountTabsBar[\s\S]*id="analytics-acc-tabs"[\s\S]*allCount=\{savedSnapshots\.length\}[\s\S]*items=\{accountTabItems\}[\s\S]*addAccountButton=\{\{ id: 'analytics-tab-add'[\s\S]*onEditAccount=\{openEditAccount\}[\s\S]*onDeleteAccount=\{openDeleteAccount\}[\s\S]*onReorder=\{reorderAccounts\}/,
  '数据分析需要和其他模块一样显示账号标签，并接入添加、编辑、删除和拖拽排序'
);

assert.match(
  reactAnalyticsSource,
  /connected = !!projectId[\s\S]*connected \? \([\s\S]*<AccountTabsBar[\s\S]*connected && !permissionBlocked \? \([\s\S]*id="analytics-file-input"[\s\S]*id="analytics-connect-state"/,
  '数据分析未连接数据库时不应显示账号标签和导入流量表入口'
);

assert.match(
  reactAnalyticsSource,
  /const nextAccounts = uniqueAccounts\(remoteAccounts\)/,
  '数据分析账号标签必须只来自 order_accounts 共享账号表，不能从历史分析快照反推账号'
);

assert.doesNotMatch(
  reactAnalyticsSource,
  /snapshotAccounts|uniqueAccounts\(\[\.\.\.remoteAccounts,\s*\.\.\.snapshotAccounts\]\)/,
  '数据分析不应把历史快照账号混入账号标签列表'
);

assert.match(
  reactAnalyticsSource,
  /ACCOUNT_UPDATED_EVENT = 'tk-accounts-changed'[\s\S]*detail\.action === 'rename'[\s\S]*detail\.action === 'reorder'[\s\S]*detail\.action === 'rename'[\s\S]*window\.addEventListener\(ACCOUNT_UPDATED_EVENT,\s*handleAccountsChanged\)/,
  '数据分析需要监听跨模块账号变更，并即时应用排序和重命名'
);

assert.match(
  reactAnalyticsSource,
  /modalId="analytics-add-acc-modal"[\s\S]*modalId="analytics-edit-acc-modal"[\s\S]*onConfirm=\{renameAccount\}[\s\S]*modalId="analytics-delete-acc-modal"[\s\S]*onConfirm=\{deleteAccount\}/,
  '数据分析需要渲染和其他模块一致的账号添加、编辑和删除弹窗'
);

assert.match(
  reactAnalyticsSource,
  /uploadAccountOpen[\s\S]*uploadAccountDraft[\s\S]*fileInputRef[\s\S]*openUploadAccountDialog[\s\S]*confirmUploadAccount[\s\S]*fileInputRef\.current\?\.click\(\)[\s\S]*id="analytics-upload-account-modal"[\s\S]*id="analytics-upload-account-select"/,
  '数据分析导入流量表时需要先弹出账号选择，再打开 Excel 文件选择器'
);

assert.match(
  reactAnalyticsSource,
  /const accountName = normalizeAccountName\(uploadAccountDraft\)[\s\S]*saveAnalysisToFirestore\(next,\s*file\.name,\s*accountName\)/,
  '数据分析保存快照时必须使用上传弹窗选择的具体账号'
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
  reactAppSource,
  /analyticsStatusClass = 'analytics-react-status[\s\S]*analyticsStatusErrorClass = '\[\&_\.analytics-react-status-mark\]:border/,
  'React 数据分析懒加载状态需要有可见样式'
);

assert.match(
  reactAppSource,
  /data-analytics-lazy-state=\{state\}/,
  'React 数据分析懒加载状态需要提供可测试状态标记'
);

assert.match(
  reactAppSource,
  /from '@\/components\/ui\/button'[\s\S]*from '@\/components\/ui\/card'|from '@\/components\/ui\/card'[\s\S]*from '@\/components\/ui\/button'/,
  '数据分析懒加载状态需要使用共享 Card/Button primitives'
);

assert.match(
  reactAppSource,
  /<Card className=\{`\$\{analyticsStatusClass\}[\s\S]*<Button className=\{analyticsStatusRetryClass\} size="sm" data-analytics-retry/,
  '数据分析懒加载状态不应再手写 legacy card/btn 元素'
);

assert.doesNotMatch(
  reactAppSource,
  /className=\{`card analytics-react-status|className="btn sm"/,
  'App 层不应继续直接绑定 legacy card/btn class'
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
  /ALL_PERIODS_KEY[\s\S]*formatPeriodOption[\s\S]*filterSnapshotsByAccount[\s\S]*pullAnalysesBySnapshots[\s\S]*aggregateAnalyses[\s\S]*id="analytics-snapshot-select"[\s\S]*全部周期/,
  '数据分析页面需要先按账号过滤，再支持全部周期聚合和单周期切换'
);

assert.match(
  srcAggregateSource,
  /overallCtr[\s\S]*overallConversion[\s\S]*periodCount[\s\S]*latestPeriod[\s\S]*gmvTrend[\s\S]*gmvDelta[\s\S]*conversionDelta[\s\S]*function buildPeriodComparisons[\s\S]*function aggregateAnalyses[\s\S]*byProduct/,
  '数据分析多周期聚合需要按商品合并，并重新计算比例、覆盖周期、最近周期、趋势和周期对比'
);

assert.match(
  reactAnalyticsSource,
  /function PeriodComparisonTable[\s\S]*周期对比[\s\S]*GMV[\s\S]*订单[\s\S]*CTR[\s\S]*转化率[\s\S]*analysis\.periodComparisons/,
  '数据分析全部周期模式需要展示多周期对比表'
);

assert.match(
  reactAnalyticsSource,
  /tableWrapClass = 'analytics-table-wrap max-h-\[620px\] overflow-auto'[\s\S]*sort\(\(a, b\) => b\.gmv - a\.gmv/,
  '数据分析商品明细需要在滚动容器中展示全部商品'
);

assert.doesNotMatch(
  reactAnalyticsSource,
  /slice\(0,\s*50\)|仅展示前 50/,
  '数据分析商品明细不应再固定只展示前 50 条'
);

assert.match(
  reactAnalyticsSource,
  /from '@\/components\/ui\/badge'[\s\S]*from '@\/components\/ui\/button'[\s\S]*from '@\/components\/ui\/card'[\s\S]*from '@\/components\/ui\/dialog'/,
  '数据分析页面容器、状态标签、说明入口和说明弹窗需要使用共享 primitives'
);

assert.match(
  reactAnalyticsSource,
  /from '@\/components\/ui\/table'[\s\S]*detailTableClass = 'analytics-detail-table[\s\S]*<Table className=\{detailTableClass\}[\s\S]*<TableHeader>[\s\S]*<TableBody>/,
  '数据分析明细表需要使用共享 Table primitive'
);

assert.doesNotMatch(
  reactAnalyticsSource,
  /<table className="ot-table analytics-detail-table"/,
  '数据分析明细表不应继续使用 legacy ot-table 原生表格'
);

assert.match(
  reactAnalyticsSource,
  /analyticsCardClass = 'analytics-chart-card[\s\S]*mutedChipClass = cn\(analyticsChipClass, 'muted'\)[\s\S]*<Card className=\{cn\(analyticsCardClass, 'analytics-overview-card'\)\}[\s\S]*<Badge className=\{mutedChipClass\}[\s\S]*id="analytics-help"[\s\S]*<Card id="analytics-empty" className=\{emptyCardClass\}/,
  '数据分析页面应在保留现有 class 的前提下，把卡片、标签和说明入口收敛到 primitives'
);

assert.match(
  reactAnalyticsSource,
  /chart\.resize\(\)[\s\S]*ResizeObserver[\s\S]*window\.addEventListener\('resize'[\s\S]*window\.addEventListener\('hashchange'/,
  '数据分析 ECharts 需要在容器尺寸和路由切换时重新 resize，避免空白或错位'
);

assert.match(
  reactAnalyticsSource,
  /import \{ refreshButtonClass, statusStripClass, statusStripLeftClass, storageHelpButtonClass, syncStatusClass \} from '@\/components\/ui\/status-strip';[\s\S]*<div className=\{statusStripLeftClass\}>[\s\S]*id="analytics-user"[\s\S]*id="analytics-sync-status"[\s\S]*id="analytics-refresh"[\s\S]*id="analytics-help"[\s\S]*<\/div>\s*<\/div>\s*\{connected \? \(/,
  '数据分析刷新和说明入口需要紧跟连接和同步状态，不能放到状态栏最右侧'
);

assert.match(
  reactAnalyticsSource,
  /function AnalyticsHelpDialog[\s\S]*<Dialog id="analytics-help-modal"[\s\S]*<HelpStack>[\s\S]*<DialogActions>/,
  '数据分析说明需要使用共享 Dialog 和 HelpStack primitives'
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
  /数据分析模块只在浏览器内读取 Excel 原始文件[\s\S]*分析快照会写入用户自己的 Firebase Firestore/,
  'README 需要说明数据分析原始文件本地解析，分析快照写入用户自己的 Firestore'
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
  const parserModule = await import(`file://${path.join(root, 'src', 'analytics', 'parser.ts')}`);
  const analyzerModule = await import(`file://${path.join(root, 'src', 'analytics', 'analyzer.ts')}`);
  const aggregateModule = await import(`file://${path.join(root, 'src', 'analytics', 'aggregate.ts')}`);
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

  const nextRows = JSON.parse(JSON.stringify(rows));
  nextRows[0][0] = '2026-05-04 ~ 2026-05-10';
  nextRows[2][3] = '90,000円';
  nextRows[2][4] = '70';
  nextRows[2][5] = '60';
  nextRows[2][8] = '1500';
  nextRows[2][9] = '180';
  nextRows[2][10] = '100';
  const parsedNext = parserModule.parseRows(nextRows);
  const analysisNext = analyzerModule.analyze(parsedNext.records, parsedNext.period);
  const aggregated = aggregateModule.aggregateAnalyses([
    {
      analysis: analysisByModule,
      snapshotId: 'first',
      period: analysisByModule.period,
      updatedAt: '2026-05-03T00:00:00.000Z'
    },
    {
      analysis: analysisNext,
      snapshotId: 'second',
      period: analysisNext.period,
      updatedAt: '2026-05-10T00:00:00.000Z'
    }
  ]);
  const aggregatedRaincoat = aggregated.records.find(record => record.id === '1001');
  assert.ok(aggregatedRaincoat, '全部周期需要保留商品明细');
  assert.strictEqual(aggregated.period, '全部周期 · 2 期', '全部周期聚合需要显示覆盖周期数量');
  assert.strictEqual(aggregated.records.length, 2, '同一商品 ID 的多周期明细需要聚合成一行');
  assert.strictEqual(aggregated.kpis.totalGmv, analysisByModule.kpis.totalGmv + analysisNext.kpis.totalGmv, '全部周期 GMV 需要求和');
  assert.strictEqual(aggregatedRaincoat.gmv, 160036, '同一商品的多周期 GMV 需要求和');
  assert.strictEqual(aggregatedRaincoat.periodCount, 2, '商品明细需要记录覆盖周期数');
  assert.strictEqual(aggregatedRaincoat.latestPeriod, '2026-05-04 ~ 2026-05-10', '商品明细需要记录最近周期');
  assert.strictEqual(aggregatedRaincoat.gmvTrend, 19964, '商品明细需要记录最近周期相对首周期的 GMV 趋势');
  assert.strictEqual(aggregatedRaincoat.overallCtr, aggregatedRaincoat.pageViewsTotal / aggregatedRaincoat.exposureTotal, '聚合后点击率需要按总浏览/总曝光重新计算');
  assert.strictEqual(aggregatedRaincoat.channels.mall.ctr, 300 / 2500, '聚合后渠道点击率需要按总量重新计算，不能平均');
  assert.strictEqual(aggregated.periodComparisons.length, 2, '全部周期需要生成周期对比行');
  assert.strictEqual(aggregated.periodComparisons[1].period, '2026-05-04 ~ 2026-05-10', '周期对比需要按时间顺序保留周期');
  assert.strictEqual(aggregated.periodComparisons[1].totalGmv, analysisNext.kpis.totalGmv, '周期对比 GMV 需要来自单周期快照');
  assert.strictEqual(aggregated.periodComparisons[1].gmvDelta, analysisNext.kpis.totalGmv - analysisByModule.kpis.totalGmv, '周期对比需要计算 GMV 环比差异');
  assert.strictEqual(aggregated.periodComparisons[1].ctr, 622 / 12500, '周期对比 CTR 需要按周期总浏览/总曝光重算');
  assert.strictEqual(aggregated.periodComparisons[1].conversionDelta, aggregated.periodComparisons[1].conversion - aggregated.periodComparisons[0].conversion, '周期对比转化率需要计算百分点变化');
  const samePeriodComparisons = aggregateModule.buildPeriodComparisons([
    {
      analysis: analysisByModule,
      snapshotId: 'first',
      period: analysisByModule.period,
      updatedAt: '2026-05-03T00:00:00.000Z'
    },
    {
      analysis: analysisNext,
      snapshotId: 'second-noma',
      period: analysisNext.period,
      updatedAt: '2026-05-10T00:00:00.000Z'
    },
    {
      analysis: analysisNext,
      snapshotId: 'second-lumi',
      period: analysisNext.period,
      updatedAt: '2026-05-10T01:00:00.000Z'
    }
  ]);
  assert.strictEqual(samePeriodComparisons.length, 2, '全部账号下同一周期的多张流量表需要合并成同一条周期对比');
  assert.strictEqual(samePeriodComparisons[1].snapshotCount, 2, '周期对比需要记录同一周期覆盖的快照数量');
  assert.strictEqual(samePeriodComparisons[1].totalGmv, analysisNext.kpis.totalGmv * 2, '同一周期多张流量表的 GMV 需要求和');

  const analyticsProvider = await import(`file://${path.join(root, 'src', 'analytics', 'provider-firestore.ts')}`);
  const snapshotDoc = analyticsProvider.buildAnalyticsSnapshotDoc(analysisByModule, {
    accountName: 'NOMA',
    filename: 'traffic.xlsx',
    nowIso: '2026-05-19T00:00:00.000Z'
  });
  assert.strictEqual(snapshotDoc.accountName, 'NOMA', '数据分析快照需要保存账号名');
  assert.strictEqual(snapshotDoc.recordCount, 2, '数据分析快照需要记录商品数量');
  assert.match(snapshotDoc.id, /2026-04-27_~_2026-05-03_traffic_xlsx/, '数据分析快照 ID 需要包含周期和文件名');
  const recordDoc = analyticsProvider.buildAnalyticsRecordDoc(snapshotDoc.id, analysisByModule.records[0], snapshotDoc.updatedAt);
  assert.strictEqual(recordDoc.snapshotId, snapshotDoc.id, '数据分析商品明细需要关联快照 ID');

  console.log('analytics module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
