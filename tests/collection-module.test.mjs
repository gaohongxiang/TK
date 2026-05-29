import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const configSource = fs.readFileSync(path.join(root, 'src', 'app-config.ts'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const collectionSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'collection', 'CollectionPage.tsx'), 'utf8');
const collectionExportSource = fs.readFileSync(path.join(root, 'src', 'collection', 'export.ts'), 'utf8');
const collectionTablePath = path.join(root, 'src', 'collection', 'table.ts');
const reactSearchHelpSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'search-help.tsx'), 'utf8');
const collectionProviderSource = fs.readFileSync(path.join(root, 'src', 'collection', 'provider-firestore.ts'), 'utf8');
const fastmossConfig = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'collectors', 'fastmoss', 'config.json'), 'utf8'));
const sopSource = fs.readFileSync(path.join(root, 'docs', 'ops', 'fastmoss-selection-sop.md'), 'utf8');
const gitignoreSource = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
const skillSource = fs.readFileSync(path.join(root, 'skills', 'tk-product-selection', 'SKILL.md'), 'utf8');
const selectionFirestoreSyncSource = fs.readFileSync(path.join(root, 'skills', 'tk-product-selection', 'scripts', 'firestore-sync.mjs'), 'utf8');
const firestoreRulesSource = fs.readFileSync(path.join(root, 'src', 'orders', 'firestore-rules.ts'), 'utf8');

assert.match(
  configSource,
  /key:\s*'orders'[\s\S]*key:\s*'collection'[\s\S]*key:\s*'analytics'/,
  '项目配置需要在订单管理和数据分析之间注册商品采编模块'
);

assert.match(
  configSource,
  /collection:\s*'user-owned-firestore'/,
  '商品采编模块需要在配置里声明同步到用户自己的 Firestore'
);

assert.match(
  reactAppSource,
  /import \{ CollectionPage \} from '\.\.\/features\/collection\/CollectionPage'/,
  'React App 需要引入商品采编页面'
);

assert.match(
  reactAppSource,
  /id="view-collection"[\s\S]*<CollectionPage active=\{active === 'collection'\} \/>/,
  'React App 需要提供商品采编视图容器，并且只有当前激活时才允许它同步数据库'
);

assert.match(
  collectionSource,
  /label:\s*'采编记录'[\s\S]*collection_records\.csv[\s\S]*采集状态/,
  '商品采编页面需要只展示采编记录，并在同一行里维护采集状态'
);

assert.doesNotMatch(
  collectionSource,
  /activeData \? `\$\{activeData\.filename\}|datasetMeta\[activeDataset\]\.filename<\/div>|tableSubClass/,
  '商品采编页标题区域不应展示 collection_records.csv 这类内部文件名'
);

assert.match(
  collectionSource,
  /statusStripClass[\s\S]*syncStatusClass\(syncClass\)[\s\S]*refreshButtonClass\(loading\)[\s\S]*刷新采编记录/,
  '商品采编页需要在左侧展示同步状态和刷新按钮，数据库连接入口交给顶部全局菜单'
);

assert.doesNotMatch(
  collectionSource,
  /id="collection-export"|FileDown/,
  '商品采编页不应再保留模块内导出入口，导出统一放进顶部账号菜单'
);

assert.doesNotMatch(
  collectionSource,
  /id="collection-user"|id="collection-disconnect-firestore"/,
  '商品采编页不应重复展示数据库连接和退出数据库入口'
);

assert.doesNotMatch(
  collectionSource,
  /导出当前表/,
  '商品采编页不应在表格工具条里重复显示第二个导出按钮'
);

assert.match(
  collectionSource,
  /formatFirestoreRulesUpdateMessage\('collection'[\s\S]*permissionBlocked[\s\S]*<ModuleListState[\s\S]*商品采编保存不可用[\s\S]*复制 Firestore 规则/,
  '商品采编页在 Firestore 权限不足时需要在列表区提示，并提供复制规则入口'
);

assert.doesNotMatch(
  collectionSource,
  /数据库记录|CSV 补录|等待数据库同步|type="file"|accept="\.csv"|collection-\$\{key\}-input|FileSpreadsheet/,
  '商品采编页日常使用应走自动同步，不展示数据库记录标题或 CSV 补录入口'
);

assert.doesNotMatch(
  collectionSource,
  /label:\s*'候选品'|label:\s*'店小秘状态'|type DatasetKey = 'candidates' \| 'rejects' \| 'dxm'|activeDataset\] === 'dxm'/,
  '商品采编页面不应把候选品和店小秘状态拆成两个业务表'
);

for (const [pattern, message] of [
  [/商品采编由两个 Codex skill[\s\S]*商品采集负责 FastMoss 筛选[\s\S]*商品编辑负责店小秘编辑/, 'Hero 需要说明商品采编由采集和编辑两个 skill 串起来'],
  [/skills\/tk-product-selection[\s\S]*skills\/tk-product-editor[\s\S]*selectionInstallCommand[\s\S]*editorInstallCommand/, '页面需要同时声明采集和编辑两个 skill 安装入口'],
  [/按 FastMoss 日本站条件找品[\s\S]*筛选合格商品[\s\S]*采集到店小秘待编辑商品/, '采集 skill 卡片需要说明选品、筛选和店小秘待编辑录入'],
  [/核验 1688 货源[\s\S]*分类属性[\s\S]*日语标题描述[\s\S]*图片和物流信息/, '编辑 skill 卡片需要说明货源核验和编辑字段'],
  [/先采集[\s\S]*当前已连接的 Chrome 扩展会话[\s\S]*FastMoss[\s\S]*TikTok Shop[\s\S]*店小秘采集箱/, '流程说明需要覆盖采集阶段和当前 Chrome 扩展会话'],
  [/再编辑[\s\S]*编辑技能只处理店小秘编辑字段[\s\S]*看回写[\s\S]*店小秘编辑状态/, '流程说明需要覆盖编辑字段边界和状态回写']
]) {
  assert.match(collectionSource, pattern, message);
}

assert.match(
  collectionSource,
  /function getVisibleHeaders[\s\S]*账号[\s\S]*选品分[\s\S]*商品名称[\s\S]*店铺名[\s\S]*商品价格[\s\S]*商品近7天销量[\s\S]*采集时间[\s\S]*采集状态[\s\S]*选品判断[\s\S]*店小秘编辑状态[\s\S]*编辑时间[\s\S]*编辑标题[\s\S]*编辑判断/,
  '商品采编页采编记录默认展示账号、选品分、商品、店铺、价格、关键销量、采集时间、采集状态、选品判断、店小秘编辑状态、编辑时间、编辑标题和编辑判断字段'
);

assert.match(
  collectionSource,
  /function normalizeEditStatus[\s\S]*row\['编辑标题'\][\s\S]*return '已编辑'[\s\S]*status === '已编辑'[\s\S]*status === '编辑失败'/,
  '商品采编页有编辑标题时必须显示已编辑，编辑标题是编辑回填成功的证据'
);

assert.doesNotMatch(
  collectionSource,
  /records:\s*\[[^\]]*店铺总销售额/s,
  '商品采编页默认列表不应展示店铺总销售额'
);

assert.doesNotMatch(
  collectionSource,
  new RegExp(`records:\\s*\\[[^\\]]*${String.fromCharCode(21407, 26631, 39064)}`, 's'),
  '商品采编页默认列表不应再展示旧的原始标题列；商品名称就是采集时的原始标题'
);

assert.doesNotMatch(
  collectionSource,
  /records:\s*\[[^\]]*(排名|商品ID|是否已采集到店小秘|建议动作|备注|失败原因|风险标记|需求\/场景|小卖家机会)|状态维护/s,
  '商品采编页默认列表不应展示排名、商品ID、是否已采集到店小秘、建议动作、备注、失败原因、风险标记、需求/场景、小卖家机会或状态维护等冗余字段'
);

assert.match(
  collectionSource,
  /选品分[\s\S]*function getHeaderHelp[\s\S]*基准 50 分[\s\S]*不是百分制[\s\S]*商品销量[\s\S]*硬风险品先剔除/,
  '商品采编页需要展示选品分，并说明它是基准 50 的加分制'
);

assert.doesNotMatch(
  collectionSource,
  /候选品|评分|店小秘已编辑|是否已采集到店小秘|function isEditJudgementText|cleanEditJudgementText|需求\/场景|小卖家机会/,
  '商品采编页不兼容旧字段，不应再从旧字段推导采集或编辑判断'
);

assert.match(
  collectionSource,
  /function ProductNameCell[\s\S]*getRowValue\(row, \['核心 TK 链接', '商品链接', 'product_url', 'tk_product_url', '链接'\]\)[\s\S]*productNameActionsClass[\s\S]*title="打开商品链接"[\s\S]*title="复制商品链接"/,
  '商品采编页需要把打开和复制 TK 商品链接按钮放到商品名称列'
);

assert.doesNotMatch(
  collectionSource,
  /<TableHead>操作<\/TableHead>/,
  '商品采编页不应再展示单独的操作链接列'
);

assert.doesNotMatch(
  collectionSource,
  /打开店铺链接|getRowValue\(row, \['店铺链接', 'shop_url'\]\)/,
  '商品采编页操作列不应再展示店铺链接按钮'
);

assert.match(
  collectionSource,
  /header === '采集时间'[\s\S]*formatDateTimeCell[\s\S]*replace\('T', ' '\)[\s\S]*slice\(0, 16\)/,
  '商品采编页需要把 ISO 采集时间格式化成 YYYY-MM-DD HH:mm'
);

assert.match(
  collectionSource,
  /import \{ AccountTabsBar \}[\s\S]*const allAccounts = accounts[\s\S]*<AccountTabsBar[\s\S]*id="collection-acc-tabs"[\s\S]*data-collection-acc/,
  '商品采编页需要像商品和订单一样从共享账号表显示标签，并按账号筛选采集记录'
);

assert.doesNotMatch(
  collectionSource,
  /mergeAccountOrder|indexedRows\.map\(item => item\.row\['账号'\]\)[\s\S]*allAccounts/,
  '商品采编账号标签只能来自 order_accounts 共享账号表，不能从采集记录反推账号列表'
);

for (const [pattern, message] of [
  [/skills\/tk-product-selection[\s\S]*selectionInstallCommand/, '商品采编页需要提供采集 skill 安装命令'],
  [/skills\/tk-product-editor[\s\S]*editorInstallCommand/, '商品采编页需要提供编辑 skill 安装命令'],
  [/\$tk-product-selection[\s\S]*复制采集命令/, '商品采编页需要提供采集常用命令'],
  [/\$tk-product-editor[\s\S]*复制编辑命令/, '商品采编页需要提供编辑常用命令'],
  [/copyText\(skill\.installCommand\)[\s\S]*复制安装命令[\s\S]*copyText\(skill\.command\)/, '技能卡片需要同时复制安装命令和常用命令']
]) {
  assert.match(collectionSource, pattern, message);
}

assert.match(
  collectionSource,
  /skillPanelClass = 'flex min-h-\[156px\] flex-col[\s\S]*skillCopyClass = 'text-\[12\.5px\][\s\S]*skillActionClass = 'mt-2 flex min-h-8[\s\S]*stepCardClass = 'flex min-h-\[96px\] flex-col[\s\S]*stepHeadClass = 'mb-1\.5 flex items-center gap-2/,
  '技能卡片需要收紧正文和按钮间距，流程卡片需要让序号和标题同排'
);

assert.doesNotMatch(
  collectionSource,
  /<InlineToken>\{skillUrl\}<\/InlineToken>|打开 GitHub 技能目录|复制技能链接|skillBadgeClass|skill\.badge/,
  '商品采编页不应直接展示长 GitHub 链接、额外链接按钮或内部 skill 名称标签'
);

for (const [pattern, message] of [
  [/skillGridClass = 'grid grid-cols-2[\s\S]*workflowGridClass = 'mt-3 grid grid-cols-3/, '商品采编页需要用两列技能入口和三列流程说明布局'],
  [/商品采集[\s\S]*商品编辑/, '商品采编页需要展示两个技能入口'],
  [/先采集[\s\S]*再编辑[\s\S]*看回写/, '商品采编页需要展示采集、编辑和回写三步流程'],
  [/<CardTitle className="mb-0"><ClipboardList[\s\S]*使用说明[\s\S]*<div className=\{skillGridClass\}[\s\S]*skillCards\.map[\s\S]*<div className=\{workflowGridClass\}[\s\S]*usageSteps\.map/, '使用说明需要先渲染技能入口，再渲染三步流程'],
  [/<\/Card>[\s\S]*<div className=\{metricGridClass\}[\s\S]*statusStripClass[\s\S]*TableToolbar/, '使用说明结束后需要直接进入指标和采集工具条，数据库连接入口不在模块内重复展示']
]) {
  assert.match(collectionSource, pattern, message);
}

assert.match(
  collectionSource,
  /deriveDisplayedCollectionRows[\s\S]*rows: indexedRows[\s\S]*activeAccount[\s\S]*searchQuery[\s\S]*sortOrder/,
  '数据采编记录需要复用纯函数按账号、搜索和当前行序排序'
);

assert.match(
  collectionSource,
  /当前正序，点击切换为倒序[\s\S]*当前倒序，点击切换为正序/,
  '数据采编记录排序按钮需要提示当前排序方向'
);

assert.match(
  collectionSource,
  /<TableSortButton[\s\S]*id="collection-sort-btn"[\s\S]*排序 \{sortIcon\}[\s\S]*<TablePager/,
  '商品采编排序按钮需要放在搜索分页工具栏里，并位于分页前面'
);

assert.match(
  collectionSource + reactSearchHelpSource,
  /id="collection-search-help-btn"[\s\S]*modalId="collection-search-help-modal"[\s\S]*05-18 等于 采集:2026-05-18[\s\S]*别名[\s\S]*cj=采集，bj=编辑[\s\S]*NOMA 雨衣 cj:05-01~05-18 bj:>=05-18[\s\S]*搜索只作用于当前账号标签|搜索只作用于当前账号标签[\s\S]*id="collection-search-help-btn"[\s\S]*modalId="collection-search-help-modal"[\s\S]*05-18 等于 采集:2026-05-18[\s\S]*别名[\s\S]*cj=采集，bj=编辑[\s\S]*NOMA 雨衣 cj:05-01~05-18 bj:>=05-18/,
  '数据采集搜索框右侧需要提供当前账号范围和搜索语法说明'
);

assert.match(
  collectionSource,
  /setSortOrder\(value => value === 'asc' \? 'desc' : 'asc'\)[\s\S]*setCurrentPage\(1\)/,
  '数据采编记录需要按当前行序正倒序切换'
);

assert.doesNotMatch(
  collectionSource,
  /<h3 className=\{tableTitleClass\}>\{datasetMeta\[activeDataset\]\.label\}<\/h3>/,
  '商品采编列表上方不应再显示“采编记录”标题'
);

assert.doesNotMatch(
  collectionSource,
  new RegExp([
    '接' + '口\\/脚本负责批量采集',
    'Chrome 扩展负责登录态',
    '本地\\/' + '专' + '用浏览器负责查看网站同步结果',
    '接' + '口 \\/ 脚本',
    '专' + '用 \\/ ' + '内置' + '浏览器'
  ].join('|')),
  '商品采编页只写操作步骤，不展示三种访问通道解释'
);

assert.doesNotMatch(
  collectionSource,
  /FastMoss 条件：日本|不自动发布，不修改标题|输出 selection_candidates\.csv、selection_rejects\.csv/,
  '页面不应再展示长 SOP；详细规则应放在 skill 中'
);

assert.doesNotMatch(
  packageJson.scripts.build,
  /build-codex-fastmoss-kit|tk-fastmoss-collector\.zip/,
  '主站构建不应再生成离线技能包'
);

for (const [pattern, message] of [
  [/references\/rules\.md[\s\S]*scripts\//, '发布 skill 需要引用规则和内置脚本'],
  [/当前已连接的 Chrome 扩展会话[\s\S]*多个店小秘\/TK 账号必须顺序切换/, '发布 skill 需要说明单个已连接 Chrome 扩展会话和多账号顺序切换'],
  [/local-credentials\.mjs[\s\S]*配置缺什么只问什么[\s\S]*本机缺 `firebaseConfig` 时才问/, '发布 skill 需要说明本地私密配置和 firebaseConfig 缺失才询问'],
  [/目标账号必须存在[\s\S]*firestore-sync\.mjs preflight --account <账号名>[\s\S]*不自动创建/, '发布 skill 需要说明目标账号存在性校验且不自动创建账号'],
  [/普通登录、账号切换和明确目标店铺选择[\s\S]*验证码[\s\S]*FastMoss 登录失败[\s\S]*expired/, '发布 skill 需要说明普通登录代办和人工校验/过期边界'],
  [/平台人工确认处理[\s\S]*page_confirmation_state\.json[\s\S]*verification_blocked[\s\S]*等待超时[\s\S]*采集状态=采集失败[\s\S]*选品判断/, '发布 skill 需要说明人机验证保存现场、等待恢复、超时写失败原因'],
  [/采集当场完成硬过滤[\s\S]*collection_records[\s\S]*采集状态[\s\S]*collection_excluded_products/, '发布 skill 需要说明当场筛选、一张采编记录和拒绝品去重'],
  [/采集阶段只写采集字段[\s\S]*账号[\s\S]*选品分[\s\S]*商品名称[\s\S]*店铺名[\s\S]*商品价格[\s\S]*商品近7天销量[\s\S]*采集时间[\s\S]*采集状态[\s\S]*选品判断/, '发布 skill 需要说明采集技能只写采集字段'],
  [/店小秘编辑追踪字段顺序[\s\S]*店小秘编辑状态[\s\S]*编辑时间[\s\S]*编辑标题[\s\S]*编辑判断[\s\S]*采集阶段不写这几个编辑字段/, '发布 skill 需要说明编辑字段由编辑技能处理']
]) {
  assert.match(skillSource, pattern, message);
}

assert.match(
  skillSource,
  /FastMoss[\s\S]*全局[\s\S]*店小秘[\s\S]*按 TK 账号绑定|店小秘[\s\S]*按 TK 账号绑定[\s\S]*FastMoss[\s\S]*全局/,
  '发布 skill 需要说明 FastMoss 全局复用，店小秘按 TK 账号绑定复用'
);

assert.match(
  skillSource,
  /不复制 FastMoss 或店小秘 cookie、LocalStorage、IndexedDB[\s\S]*同一个已连接 Chrome 会话里切换店小秘账号|同一个已连接 Chrome 会话里切换店小秘账号[\s\S]*不复制 FastMoss 或店小秘 cookie、LocalStorage、IndexedDB/,
  '发布 skill 需要明确不复制浏览器登录态，并优先在同一个已连接 Chrome 会话里切换账号'
);

assert.match(
  collectionProviderSource,
  /CollectionDatasetKey = 'records' \| 'rejects'[\s\S]*getProductKey[\s\S]*商品ID[\s\S]*核心 TK 链接[\s\S]*getAccountName[\s\S]*getScopedProductKey[\s\S]*collection_excluded_products[\s\S]*collection_records/,
  '商品采编 Firestore provider 需要只对外暴露采编记录和拒绝去重集合，并按账号 + 核心 TK 链接或商品 ID 去重'
);

assert.match(
  collectionProviderSource,
  /accountName:\s*string \| null[\s\S]*putIfValue\(row, '账号', doc\.accountName\)[\s\S]*defaultHeaders = \['账号'/,
  '商品采编 Firestore provider 读写采编记录时需要保留账号字段'
);

assert.match(
  collectionProviderSource,
  /function accountsFromSnapshot[\s\S]*filter\(row => !row\.data\.deletedAt\)[\s\S]*pullAccounts[\s\S]*collection\('order_accounts'\)[\s\S]*return accountsFromSnapshot\(snapshot\)/,
  '商品采编 Firestore provider 需要通过共享账号集合生成账号标签，采编记录权限不足不应影响账号体系'
);

assert.match(
  collectionProviderSource,
  /pullDatasets\(\{\s*includeRejects = true\s*\}[\s\S]*includeRejects[\s\S]*collection\('collection_excluded_products'\)[\s\S]*Promise\.resolve\(null\)[\s\S]*collection\('collection_records'\)/,
  '商品采编 Firestore provider 需要支持按需跳过拒绝品集合，避免采编表刷新读取无关数据'
);

assert.match(
  collectionSource,
  /const \[accounts, setAccounts\][\s\S]*pullDatasets\(\{ includeRejects: false \}\)[\s\S]*setAccounts\(snapshot\.accounts \|\| \[\]\)[\s\S]*setDatasets\(\{\s*records:\s*remoteRecords\s*\}\)[\s\S]*subscribeSnapshot\(snapshot =>[\s\S]*hasExternalChanges[\s\S]*buildFirestoreSyncStatus\('stale'\)[\s\S]*markPermissionBlocked\(\)[\s\S]*<AccountTabsBar[\s\S]*<ModuleListState[\s\S]*数据库权限不足/,
  '商品采编页需要首屏拉取采编记录，轻量订阅 sync_state 提醒外部变更，且权限不足时走统一权限提示'
);

assert.match(
  collectionSource,
  /const accountCounts = useMemo[\s\S]*counts\.set\(account, \(counts\.get\(account\) \|\| 0\) \+ 1\)[\s\S]*count: accountCounts\.get\(account\) \|\| 0/,
  '商品采编账号标签数量需要一次性统计，避免每个账号重复扫描全表'
);

assert.match(
  collectionSource,
  /const accountScopedRows = useMemo[\s\S]*activeAccount === ALL_ACCOUNTS_KEY[\s\S]*indexedRows\.filter\(item => normalizeAccountName\(item\.row\['账号'\]\) === activeAccount\)[\s\S]*buildSummaryRows\(accountScopedRows\.map\(item => item\.row\)\)/,
  '商品采编汇总只需要按账号过滤，不能为了汇总重复执行搜索排序派生'
);

assert.match(
  collectionSource,
  /const seqNum = startIndex \+ index \+ 1/,
  '商品采编表序号需要按当前展示顺序从 1 递增，倒序时也不能反向编号'
);

assert.match(
  collectionSource,
  /pullDatasets\(\{ includeRejects: false \}\)[\s\S]*setDatasets\(\{\s*records:\s*remoteRecords\s*\}\)[\s\S]*buildFirestoreSyncStatus\(snapshot\.hasPendingWrites \? 'queueing' : 'confirmed'[\s\S]*count:\s*remoteRecords\?\.rows\.length \|\| 0[\s\S]*subscribeSnapshot\(snapshot =>[\s\S]*hasExternalChanges[\s\S]*buildFirestoreSyncStatus\('stale'\)/,
  '商品采编页首屏拉取 records 并显示记录数，之后只用轻量 sync_state 提示需要刷新'
);

assert.doesNotMatch(
  collectionSource,
  /采集成功\|已存在\\\/已采集\|已采集到店小秘\|成功|是否已采集到店小秘/,
  '商品采编页不应再兼容旧采集状态字段或旧状态文案'
);

assert.match(
  collectionProviderSource,
  /datasetKey === 'rejects'[\s\S]*collection_excluded_products[\s\S]*return waitForCommit[\s\S]*collection_records/,
  '拒绝品不应写入主 collection_records，只能写入轻量拒绝去重集合'
);

assert.match(
  collectionProviderSource,
  /recordRowFromDoc[\s\S]*商品名称[\s\S]*编辑时间[\s\S]*编辑标题[\s\S]*店小秘编辑状态[\s\S]*编辑判断[\s\S]*recordsDatasetFromDocs[\s\S]*defaultHeaders[\s\S]*店小秘编辑状态[\s\S]*编辑时间[\s\S]*编辑标题[\s\S]*编辑判断/,
  'Firestore provider 需要把采集状态和店小秘编辑状态合并成一张采编记录'
);

assert.match(
  collectionProviderSource,
  /function normalizeEditStatus[\s\S]*getRowValue\(row, \['编辑标题'\]\)[\s\S]*return '已编辑'[\s\S]*status === '已编辑'[\s\S]*status === '编辑失败'/,
  'Firestore provider 有编辑标题时必须归一为已编辑，编辑标题是编辑回填成功的证据'
);

assert.doesNotMatch(
  collectionProviderSource,
  /datasets\?\.(?:candidates|dxm)|CollectionRecordDatasetKey = 'records' \| 'candidates'|dxmEdited|候选品|评分|店小秘已编辑|是否已采集到店小秘|function isEditJudgementText|legacySelectionEditJudgement|风险标记|编辑失败原因|店小秘采集时间|collected_at|dxm_collected_at/,
  'Firestore provider 不兼容旧采集字段，也不迁移历史混写判断'
);

assert.match(
  firestoreRulesSource,
  /match \/collection_records\/\{productKey\}[\s\S]*match \/collection_excluded_products\/\{productKey\}/,
  'Firestore 规则需要放行商品采编记录和拒绝去重集合'
);

assert.match(
  collectionSource,
  /navigator\.clipboard\.writeText/,
  '商品采编页面需要支持复制命令和链接'
);

assert.match(
  collectionExportSource,
  /function buildCollectionExportFile[\s\S]*stringifyCollectionCsv/,
  '商品采编导出需要通过公共导出模块生成编辑后的 CSV'
);

assert.doesNotMatch(
  collectionSource,
  /\bfetch\s*\(|XMLHttpRequest|sendBeacon/,
  '商品采编页面不应上传到站点自有后端'
);

for (const [name, command] of Object.entries({
  'collect:select': 'node scripts/collectors/fastmoss/select-fastmoss-products.mjs',
  'collect:dxm:init': 'node scripts/collectors/fastmoss/init-dianxiaomi-status.mjs'
})) {
  assert.ok(packageJson.scripts[name]?.includes(command), `package.json 需要提供 ${name} 命令`);
}

for (const name of [
  `collect:${'browser'}`,
  `collect:${'fastmoss'}`,
  `collect:${'fastmoss'}:slow`
]) {
  assert.equal(packageJson.scripts[name], undefined, `package.json 不应再提供 ${name} 命令`);
}

for (const file of [
  'skills/tk-product-selection/scripts/select-fastmoss-products.mjs',
  'skills/tk-product-selection/scripts/init-dianxiaomi-status.mjs',
  'scripts/collectors/fastmoss/select-fastmoss-products.mjs',
  'scripts/collectors/fastmoss/init-dianxiaomi-status.mjs'
]) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(
    source,
    /--account/,
    `${file} 需要支持 --account 参数`
  );
  assert.match(
    source,
    /TK_COLLECTION_ACCOUNT/,
    `${file} 需要支持 TK_COLLECTION_ACCOUNT 环境变量`
  );
  assert.match(
    source,
    /缺少目标账号/,
    `${file} 缺少账号时需要停止，不能静默写入未分账号数据`
  );
  assert.match(
    source,
    /'账号'/,
    `${file} 需要把账号写入输出`
  );
}

for (const file of [
  'skills/tk-product-selection/scripts/init-dianxiaomi-status.mjs',
  'scripts/collectors/fastmoss/init-dianxiaomi-status.mjs'
]) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(
    source,
    /商品价格[\s\S]*商品近7天销量[\s\S]*采集时间[\s\S]*采集状态[\s\S]*选品判断/,
    `${file} 生成采编记录时需要保留采集字段`
  );
  assert.doesNotMatch(
    source,
    /店小秘编辑状态|编辑判断|编辑时间|店小秘已编辑/,
    `${file} 属于采集技能，不能初始化或写入编辑字段`
  );
}

assert.match(
  selectionFirestoreSyncSource,
  /removeCollectionEditFields[\s\S]*店小秘编辑状态[\s\S]*编辑时间[\s\S]*编辑标题[\s\S]*编辑判断[\s\S]*buildRecordDoc[\s\S]*removeCollectionEditFields/,
  '采集同步脚本写 collection_records 时必须剥离编辑字段'
);

assert.match(
  selectionFirestoreSyncSource,
  /function normalizeEditStatus[\s\S]*getRowValue\(row, \['编辑标题'\]\)[\s\S]*return '已编辑'[\s\S]*async function repairEditStatusFromTitle[\s\S]*repair-edit-status/,
  '采集同步脚本需要提供按编辑标题修复店小秘编辑状态的命令'
);

assert.match(
  selectionFirestoreSyncSource,
  /markDxmEdited[\s\S]*args\.judgement[\s\S]*nextRow\['编辑判断'\] = editJudgement/,
  '编辑成功回填需要允许写入商品成功判断'
);

assert.match(
  selectionFirestoreSyncSource,
  /markDxmEdited[\s\S]*nextRow\['编辑时间'\] = editedAt[\s\S]*editedAt/,
  '编辑成功回填必须写编辑时间'
);

assert.match(
  selectionFirestoreSyncSource,
  /markDxmRejected[\s\S]*delete nextRow\['编辑标题'\][\s\S]*editedTitle: null/,
  '编辑失败回填需要清空编辑标题，避免失败行被识别为已编辑'
);

assert.match(
  selectionFirestoreSyncSource,
  /markDxmRejected[\s\S]*nextRow\['编辑时间'\] = rejectedAt[\s\S]*editedAt: rejectedAt/,
  '编辑失败回填必须写编辑时间'
);

assert.match(
  selectionFirestoreSyncSource,
  /repairEditStatusFromTitle[\s\S]*needsTimeRepair[\s\S]*\['已编辑', '编辑失败'\]\.includes\(normalizedStatus\)[\s\S]*'编辑时间': editedAt/,
  '按编辑标题修复已编辑状态时，也必须给已编辑和编辑失败记录补齐编辑时间'
);

for (const file of [
  'skills/tk-product-selection/SKILL.md',
  'skills/tk-product-selection/package.json',
  'skills/tk-product-selection/agents/openai.yaml',
  'skills/tk-product-selection/references/rules.md',
  'skills/tk-product-selection/references/fastmoss-selection-sop.md',
  'skills/tk-product-selection/scripts/config.json',
  'skills/tk-product-selection/scripts/select-fastmoss-products.mjs',
  'skills/tk-product-selection/scripts/init-dianxiaomi-status.mjs',
  'skills/tk-product-selection/scripts/local-credentials.mjs',
  'skills/tk-product-selection/scripts/firestore-sync.mjs',
  'src/collection/provider-firestore.ts',
  'scripts/collectors/fastmoss/config.json',
  'scripts/collectors/fastmoss/select-fastmoss-products.mjs',
  'scripts/collectors/fastmoss/init-dianxiaomi-status.mjs',
  'docs/ops/fastmoss-selection-sop.md'
]) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} 需要存在`);
}

for (const file of [
  `skills/tk-product-selection/references/fastmoss-${'interface'}-notes.md`,
  `skills/tk-product-selection/scripts/start-fastmoss-${'browser'}.mjs`,
  `skills/tk-product-selection/scripts/scrape-fastmoss-${'jp'}.mjs`,
  `scripts/collectors/fastmoss/start-fastmoss-${'browser'}.mjs`,
  `scripts/collectors/fastmoss/scrape-fastmoss-${'jp'}.mjs`,
  `docs/ops/fastmoss-${'interface'}-notes.md`
]) {
  assert.equal(fs.existsSync(path.join(root, file)), false, `${file} 不应再存在`);
}

for (const [pattern, message] of [
  [/这个流程只使用当前已连接的 Chrome 扩展会话[\s\S]*辅助脚本只负责本地配置、账号检查、筛选、状态初始化和同步/, 'FastMoss SOP 需要说明 Chrome 扩展会话是唯一路径，辅助脚本不负责页面采集'],
  [/多个店小秘\/TK 账号按顺序切换[\s\S]*同一会话里切到下一个账号/, 'FastMoss SOP 需要说明单个已连接 Chrome 扩展会话和多账号顺序切换'],
  [/保存内容[\s\S]*FastMoss 手机号和密码，全局复用[\s\S]*该 TK 账号绑定的店小秘登录信息/, 'FastMoss SOP 需要说明 FastMoss 全局复用和店小秘按 TK 账号绑定'],
  [/缺什么只问什么[\s\S]*已有配置直接复用/, 'FastMoss SOP 需要说明配置缺什么问什么、已有配置直接复用'],
  [/目标账号必须存在[\s\S]*firestore-sync\.mjs preflight --account <目标账号名>[\s\S]*不要自动创建账号/, 'FastMoss SOP 需要说明目标账号存在性校验且不自动创建账号'],
  [/Firebase config[\s\S]*本机缺失[\s\S]*已有，直接跳过并复用/, 'FastMoss SOP 需要说明 firebaseConfig 本机缺失才询问，已有则跳过复用']
]) {
  assert.match(sopSource, pattern, message);
}

assert.match(
  sopSource,
  /firestore-sync\.mjs preflight --account NOMA[\s\S]*select-fastmoss-products\.mjs data\/collection\/fastmoss\/runs\/<run-id>\/products\.json --account NOMA[\s\S]*init-dianxiaomi-status\.mjs data\/collection\/fastmoss\/runs\/<run-id>\/selection_candidates\.json --account NOMA[\s\S]*firestore-sync\.mjs sync data\/collection\/fastmoss\/runs\/<run-id> --account NOMA/,
  'FastMoss SOP 需要展示前置检查、目标账号筛选、状态初始化和 Firestore 同步的辅助命令顺序'
);

for (const [pattern, message] of [
  [/合格\/拒绝必须在采集流程内完成/, 'FastMoss SOP 需要明确采集当场筛选'],
  [/平台人工确认状态机[\s\S]*page_confirmation_state\.json[\s\S]*verification_blocked[\s\S]*等待超时[\s\S]*采集状态=采集失败[\s\S]*选品判断/, 'FastMoss SOP 需要说明人机验证保存现场、等待恢复、超时写失败原因'],
  [/collection_records[\s\S]*账号[\s\S]*采集状态[\s\S]*collection_excluded_products/, 'FastMoss SOP 需要明确采编记录字段和拒绝品去重'],
  [/init-dianxiaomi-status\.mjs/, 'FastMoss SOP 需要说明店小秘状态初始化脚本']
]) {
  assert.match(sopSource, pattern, message);
}

assert.equal(fastmossConfig['pro' + 'fileRootDir'], undefined, 'FastMoss 配置不应再包含浏览器用户目录');
assert.equal(fastmossConfig.runtimeFile, undefined, 'FastMoss 配置不应再包含浏览器运行标记文件');
assert.equal(fastmossConfig['remote' + 'DebuggingPort'], undefined, 'FastMoss 配置不应再包含独立浏览器端口');

assert.match(
  gitignoreSource,
  /^data\/$/m,
  '采集输出 data/ 不应提交'
);

(async () => {
  const collectionTable = await import(`file://${collectionTablePath}`);
  const rows = [
    { sourceIndex: 0, row: { '账号': 'NOMA', '商品名称': '雨衣', '店铺名': 'A店', '采集时间': '2026-05-18T10:00:00.000Z', '编辑时间': '2026-05-20T10:00:00.000Z', '采集状态': '已采集', '店小秘编辑状态': '已编辑', '选品判断': '符合', '编辑判断': '已补图' } },
    { sourceIndex: 1, row: { '账号': 'NOMA', '商品名称': '杯子', '店铺名': 'B店', '采集时间': '2026-05-10T10:00:00.000Z', '编辑时间': '2026-05-17T10:00:00.000Z', '采集状态': '采集失败', '店小秘编辑状态': '未编辑', '选品判断': '页面确认等待超时', '编辑判断': '' } },
    { sourceIndex: 2, row: { '账号': 'LUMI', '商品名称': '雨衣', '店铺名': 'C店', '采集时间': '2026-05-18T10:00:00.000Z', '编辑时间': '2026-05-20T10:00:00.000Z', '采集状态': '已采集', '店小秘编辑状态': '已编辑', '选品判断': '符合', '编辑判断': '已补图' } }
  ];

  const bareDate = collectionTable.deriveDisplayedCollectionRows({
    rows,
    activeAccount: 'NOMA',
    searchQuery: '05-18',
    sortOrder: 'asc'
  });
  assert.equal(bareDate.length, 1, '数据采集裸日期应默认按采集时间搜索');
  assert.equal(bareDate[0].row['商品名称'], '雨衣', '数据采集裸日期搜索结果不正确');

  const editDate = collectionTable.deriveDisplayedCollectionRows({
    rows,
    activeAccount: 'NOMA',
    searchQuery: '编辑:>=05-18',
    sortOrder: 'asc'
  });
  assert.equal(editDate.length, 1, '数据采集应支持编辑日期比较搜索');
  assert.equal(editDate[0].row['商品名称'], '雨衣', '编辑日期比较搜索结果不正确');

  const editAliasDate = collectionTable.deriveDisplayedCollectionRows({
    rows,
    activeAccount: 'NOMA',
    searchQuery: 'BJ：＞＝05/18',
    sortOrder: 'asc'
  });
  assert.equal(editAliasDate.length, 1, '数据采集应支持编辑日期英文别名和中文符号搜索');
  assert.equal(editAliasDate[0].row['商品名称'], '雨衣', '编辑日期别名搜索结果不正确');

  const collectionRange = collectionTable.deriveDisplayedCollectionRows({
    rows,
    activeAccount: 'NOMA',
    searchQuery: '采集:05-01～05-18',
    sortOrder: 'asc'
  });
  assert.equal(collectionRange.length, 2, '数据采集应支持采集日期范围搜索');

  const accountFirst = collectionTable.deriveDisplayedCollectionRows({
    rows,
    activeAccount: 'NOMA',
    searchQuery: '雨衣',
    sortOrder: 'asc'
  });
  assert.equal(accountFirst.length, 1, '数据采集搜索必须先按当前账号标签过滤');
  assert.equal(accountFirst[0].row['账号'], 'NOMA', '数据采集具体账号标签下搜索不能跨账号命中数据');

  console.log('collection module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
