import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import { readReactStyleSource } from './helpers/react-style-source.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');

const srcTableSource = fs.readFileSync(path.join(root, 'src', 'products', 'table.ts'), 'utf8');
const srcAccountsSource = fs.readFileSync(path.join(root, 'src', 'products', 'accounts.ts'), 'utf8');
const srcExportSource = fs.readFileSync(path.join(root, 'src', 'products', 'export.ts'), 'utf8');
const reactProductsPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const reactMainSource = fs.readFileSync(path.join(root, 'src', 'react', 'main.tsx'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const reactAppShellSource = fs.readFileSync(path.join(root, 'src', 'react', 'layouts', 'AppShell.tsx'), 'utf8');
const appRuntimeSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'AppRuntime.tsx'), 'utf8');
const reactAccountTabsSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'account-tabs-bar.tsx'), 'utf8');
const reactButtonSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'button.tsx'), 'utf8');
const reactCheckboxSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'checkbox.tsx'), 'utf8');
const reactExportOptionsSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'export-options.tsx'), 'utf8');
const reactTabsSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'tabs.tsx'), 'utf8');
const reactTableSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'table.tsx'), 'utf8');
const reactTableToolsSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'table-tools.tsx'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'src', 'app-config.ts'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styleSource = readReactStyleSource(root);

assert.match(
  srcTableSource,
  /function deriveDisplayedProducts\(/,
  '商品库表格 ESM 视图需要暴露 deriveDisplayedProducts'
);

assert.match(
  srcTableSource,
  /export\s+\{[\s\S]*ProductLibraryTable[\s\S]*deriveDisplayedProducts[\s\S]*mergeProductSku[\s\S]*\}/,
  '路线二 M4 需要提供商品表格纯函数 ESM 导出'
);

assert.doesNotMatch(
  srcTableSource,
  /window\.ProductLibraryTableView|function render\(/,
  '完整 React SPA 重建后商品表格 helper 不应再挂旧全局或暴露 DOM render'
);

assert.match(
  srcTableSource,
  /sortOrder = 'asc'/,
  '商品库表格 ESM 视图需要支持和订单页一致的排序方向状态'
);

assert.match(
  reactProductsPageSource,
  /new CustomEvent\('tk-products-changed'[\s\S]*action: 'upsert'[\s\S]*action: 'delete'/,
  'React 商品管理保存或删除商品后需要广播 tk-products-changed，通知订单侧刷新关联商品缓存'
);

assert.match(
  configSource,
  /key:\s*'products'/,
  '全局配置需要新增商品库模块'
);

assert.match(
  reactAppSource,
  /config\.modules/,
  'React SPA 路由需要从项目配置读取模块列表'
);

assert.match(
  reactMainSource,
  /DOMContentLoaded[\s\S]*start/,
  '初始路由需要等所有模块脚本加载完后再执行，避免商品库刷新后漏掉 onEnter'
);

assert.match(
  reactMainSource,
  /getElementById\('root'\)[\s\S]*<App \/>/,
  'React SPA 启动函数需要挂载单一 App root'
);

assert.match(
  reactAppShellSource,
  /key:\s*'products'[\s\S]*data-view=\{module\.key\}/,
  'React AppShell 导航需要新增商品库入口'
);

assert.match(
  reactAppSource,
  /id="view-products"[\s\S]*<ProductsPage \/>/,
  'React App 需要新增商品库视图容器'
);

assert.match(
  reactProductsPageSource,
  /id="pl-main"/,
  '商品库 React 页面需要提供主列表容器'
);

assert.match(
  reactProductsPageSource,
  /id="pl-acc-tabs"/,
  '商品库 React 页面需要提供按账号区分的标签区域'
);

assert.match(
  reactProductsPageSource,
  /actionsId="pl-acc-actions"[\s\S]*id="pl-add"/,
  '商品库新增商品按钮需要放在账号标签同一行'
);

assert.match(
  reactProductsPageSource,
  /ot-header-status-row[\s\S]*statusStripClass[\s\S]*statusStripLeftClass[\s\S]*id="pl-user"[\s\S]*id="pl-sync"[\s\S]*id="pl-refresh"[\s\S]*statusStripRightClass[\s\S]*id="pl-export"[\s\S]*id="pl-disconnect-firestore"[\s\S]*<AccountTabsBar[\s\S]*id="pl-acc-tabs"[\s\S]*actionsId="pl-acc-actions"[\s\S]*id="pl-add"/,
  'React 商品管理顶部需要和订单管理一致：连接、同步和图标刷新在左侧，账号栏和新增商品走 AccountTabsBar'
);

assert.match(
  reactProductsPageSource,
  /id="pl-sku-list"/,
  'React 商品库弹窗需要提供 SKU 列表容器'
);

assert.match(
  reactProductsPageSource,
  /id="pl-batch-axis-a"[\s\S]*id="pl-batch-axis-b"[\s\S]*id="pl-batch-axis-c"/,
  'React 商品库弹窗批量生成 SKU 需要在同一行提供三个规格维度'
);

assert.match(
  reactProductsPageSource,
  /data-sku-field="sizeText"/,
  'React 商品库弹窗需要在 SKU 区块里提供单个尺寸输入框'
);

assert.match(
  reactProductsPageSource,
  /name="accountName"|id="pl-account-select"/,
  'React 商品库弹窗需要提供账号选择字段'
);

assert.doesNotMatch(
  reactProductsPageSource,
  /name="lengthCm"|name="widthCm"|name="heightCm"/,
  'React 商品库弹窗不应再拆成长宽高三个输入框'
);

assert.match(
  reactProductsPageSource,
  /id="pl-batch-weight"|id="pl-batch-size"/,
  'React 商品库弹窗需要提供统一的参数调整输入框'
);

assert.match(
  reactProductsPageSource,
  /data-sku-use-defaults=/,
  'React 商品库 SKU 行需要保留继承共用物流参数的内部状态'
);

assert.match(
  reactProductsPageSource,
  /匹配关键词（可选）/,
  'React 商品库参数调整区需要支持“留空则应用到全部 SKU”的交互'
);

assert.doesNotMatch(
  reactProductsPageSource,
  /id="pl-apply-sku-batch"|应用到 SKU/,
  'React 商品库参数调整区不应再保留“应用到 SKU”按钮，改为输入即联动'
);

assert.match(
  reactProductsPageSource,
  /id="pl-add-sku"/,
  'React 商品库弹窗需要提供添加 SKU 的入口'
);

assert.match(
  reactProductsPageSource,
  /id="pl-refresh"[\s\S]*variant="plain"[\s\S]*className=\{refreshButtonClass\(loading\)\}[\s\S]*aria-label="刷新商品数据"[\s\S]*<RefreshCw/,
  '商品库刷新按钮需要复用订单页的图标按钮样式与位置语义'
);

assert.doesNotMatch(
  reactProductsPageSource,
  /id="pl-refresh"[\s\S]*>\s*<RefreshCw[\s\S]*刷新\s*<\/Button>/,
  '商品库刷新按钮不应显示“刷新”文字，和订单页保持图标按钮'
);

assert.match(
  reactProductsPageSource,
  /id="pl-export"[\s\S]*className="inline-flex items-center justify-center gap-1\.5"[\s\S]*<FileDown[\s\S]*导出 CSV/,
  '商品库导出 CSV 按钮需要图标和文字居中'
);

assert.match(
  reactProductsPageSource,
  /id="pl-export-modal"[\s\S]*<ExportOptions[\s\S]*optionsId="pl-export-options"[\s\S]*id="pl-export-confirm"/,
  'React 商品库需要提供按账号选择的导出 CSV 弹层'
);

assert.match(
  reactProductsPageSource,
  /from '@\/components\/ui\/account-tabs-bar'[\s\S]*from '@\/components\/ui\/export-options'|from '@\/components\/ui\/export-options'[\s\S]*from '@\/components\/ui\/account-tabs-bar'/,
  '商品管理账号标签和导出弹层需要使用共享 AccountTabsBar/ExportOptions primitives'
);

assert.match(
  reactProductsPageSource,
  /dataAttrs:\s*\{\s*'data-pl-acc': account\s*\}[\s\S]*<AccountTabsBar[\s\S]*items=\{accountTabItems\}/,
  '商品管理账号筛选和导出账号选择需要迁到共享 TabsTrigger 与 ExportOptions，减少旧基础标签依赖'
);

assert.match(
  reactProductsPageSource,
  /<ExportOptions[\s\S]*allCheckboxId="pl-export-all"[\s\S]*checkboxClassName="pl-export-checkbox"/,
  '商品管理导出账号选择需要迁到共享 ExportOptions'
);

assert.match(
  reactTabsSource + reactCheckboxSource + reactExportOptionsSource + reactAccountTabsSource,
  /data-slot="tabs-trigger"[\s\S]*data-slot="checkbox"[\s\S]*data-slot="export-options"[\s\S]*data-slot="account-tabs-bar"/,
  '共享 Tabs、Checkbox、ExportOptions 和 AccountTabsBar primitives 需要暴露 data-slot'
);

assert.match(
  reactProductsPageSource,
  /<Card id="pl-disconnected"(?![^>]*className="card")/,
  '商品库在未连接时需要通过 Card primitive 提供轻量空态容器'
);

assert.match(
  reactProductsPageSource,
  /id="pl-open-connection"/,
  '商品库在未连接时需要提供打开全局连接弹层的按钮'
);

assert.match(
  appRuntimeSource,
  /id="app-firestore-rules-modal"/,
  'AppRuntime 需要提供全局 Firestore 规则更新提示弹层'
);

assert.doesNotMatch(
  indexSource,
  /id="pl-firestore-config"|id="pl-connect"|id="pl-reset-config"/,
  '商品库不应再保留独立 Firestore 配置表单'
);

assert.match(
  reactProductsPageSource,
  /id="pl-table-footer-toolbar-container"/,
  '商品库需要提供底部分页容器'
);

assert.doesNotMatch(
  indexSource,
  /<script type="module" src="\/src\/products\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再加载商品旧 DOM 入口'
);

assert.doesNotMatch(
  indexSource,
  /<script src="js\/products\/crud\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 crud 普通脚本'
);

assert.doesNotMatch(
  indexSource,
  /<script src="js\/products\/export\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 export 普通脚本'
);

assert.doesNotMatch(
  indexSource,
  /<script src="js\/products\/accounts\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 accounts 普通脚本'
);

assert.doesNotMatch(
  indexSource,
  /<script src="js\/products\/table\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 table 普通脚本'
);

assert.doesNotMatch(
  indexSource,
  /<script src="js\/products\/provider-firestore\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 provider 普通脚本'
);

assert.doesNotMatch(
  indexSource,
  /<script src="js\/products\/form-utils\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 form-utils 普通脚本'
);

assert.doesNotMatch(
  indexSource,
  /<script src="js\/products\/index\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 index 普通脚本'
);

assert.match(
  reactProductsPageSource,
  /id="pl-toolbar"[\s\S]*id="pl-table-search-input"[\s\S]*id="pl-table-footer-toolbar-container"/,
  'React 商品页需要直接渲染表格搜索和上下分页控件'
);

assert.match(
  reactProductsPageSource,
  /products 集合[\s\S]*notifyRulesUpdateNeeded/,
  'React 商品库在 Firestore 权限不足时需要触发全局规则更新提示'
);

assert.match(
  reactProductsPageSource,
  /aria-busy[\s\S]*is-spinning|is-spinning[\s\S]*aria-busy/,
  'React 商品库刷新时需要和订单页一样显示转圈状态'
);

assert.match(
  reactProductsPageSource,
  /function confirmExport\([\s\S]*new Blob\(\[[^\]]+csv\][\s\S]*link\.download = productExporter\.buildProductExportFilename/,
  'React 商品库需要直接负责 CSV 下载逻辑'
);

assert.match(
  srcExportSource,
  /getDisplayedProducts\(\{\s*activeAccount:\s*'__all__'\s*\}\)/,
  '商品库导出应复用当前筛选结果，而不是忽略账号和搜索条件'
);

assert.match(
  reactProductsPageSource,
  /upsertProduct\([\s\S]*waitForCommit:\s*false/,
  'React 商品库保存应先进入 Firestore 本地队列，不等待云端提交后才更新 UI'
);

assert.match(
  reactProductsPageSource,
  /deleteProduct\(tkId,\s*\{\s*waitForCommit:\s*false\s*\}\)/,
  'React 商品库删除应先进入 Firestore 本地队列，不等待云端提交后才更新 UI'
);

assert.match(
  reactProductsPageSource,
  /id="pl-export-modal"[\s\S]*<ExportOptions[\s\S]*optionsId="pl-export-options"[\s\S]*id="pl-export-confirm"/,
  'React 商品库需要直接负责导出账号选择弹层'
);

assert.match(
  srcAccountsSource,
  /function getAllProductAccounts\(/,
  '商品库账号模块需要保留账号纯函数'
);

assert.match(
  reactProductsPageSource,
  /搜索 TK ID \/ 名称 \/ 1688 链接/,
  '商品库搜索框需要通过共用表格控件复用订单页的搜索样式结构'
);

assert.match(
  reactProductsPageSource,
  /PAGE_SIZE_OPTIONS[\s\S]*ProductPager[\s\S]*id="pl-table-footer-toolbar-container"/,
  '商品库需要通过共用表格控件复用订单页的上下双分页结构'
);

assert.doesNotMatch(
  srcTableSource,
  /命中价卡/,
  '商品库表格不应再展示命中价卡字段'
);

assert.match(
  reactProductsPageSource,
  /data-copy-link/,
  '商品库的 1688 列需要同时提供打开和复制两个按钮'
);

assert.match(
  reactProductsPageSource,
  /id="pl-sort-btn"/,
  '商品库表格需要提供和订单页一致的排序切换按钮'
);

assert.match(
  reactProductsPageSource,
  /<TableHead>SKU数<\/TableHead>/,
  '商品库主表需要提供 SKU 数量列'
);

assert.match(
  reactProductsPageSource,
  /<TableHead>商品名称<\/TableHead>[\s\S]*<TableHead>货物类型<\/TableHead>[\s\S]*<TableHead>SKU数<\/TableHead>[\s\S]*<TableHead>1688<\/TableHead>/,
  '商品库主表应在货物类型后直接进入 SKU 数量与 1688 列'
);

assert.doesNotMatch(
  reactProductsPageSource,
  /<TableHead>更新时间<\/TableHead>|<th>更新时间<\/th>/,
  '商品库主表不应再展示更新时间列'
);

assert.match(
  reactProductsPageSource,
  /data-toggle-expand=/,
  '多 SKU 商品行需要支持点击展开 SKU 明细'
);

assert.match(
  reactProductsPageSource,
  /pl-sku-detail-row|pl-sku-expanded-surface/,
  '商品库需要为多 SKU 商品提供可展开的 SKU 明细层'
);

assert.ok(
  !fs.existsSync(path.join(__dirname, '..', 'src', 'react', 'features', 'products', 'ProductsTable.tsx'))
    && !fs.existsSync(path.join(__dirname, '..', 'src', 'react', 'features', 'products', 'mountProductsTable.tsx')),
  '完整 React SPA 重建后商品表格不应再通过独立 React 二次挂载'
);

assert.match(
  reactProductsPageSource,
  /data-react-products-page-ready="true"/,
  'React 商品页面外壳需要提供可测试的挂载完成标记'
);

assert.match(
  reactAppSource,
  /id="view-products"[\s\S]*<ProductsPage \/>/,
  'React App 需要直接渲染商品页面'
);

assert.match(
  reactProductsPageSource,
  /from '@\/components\/ui\/button'[\s\S]*from '@\/components\/ui\/table'|from '@\/components\/ui\/table'[\s\S]*from '@\/components\/ui\/button'/,
  'React 商品表格需要使用本地 shadcn 风格 UI primitives，而不是继续手写基础标签'
);

[
  /table-auto/,
  /from '@\/components\/ui\/table-tools'/,
  /<TableSearch[\s\S]*products-react-search w-full max-w-\[520px\]/,
  /inline-flex/,
  /TableHead>SKU数<\/TableHead>/
].forEach(pattern => {
  assert.match(
    reactProductsPageSource,
    pattern,
    'React 商品表格的布局样式需要迁到 Tailwind/shadcn class，而不是继续主要依赖旧 CSS'
  );
});

assert.doesNotMatch(
  reactProductsPageSource,
  /@tanstack\/react-table|useReactTable|getCoreRowModel/,
  '商品表格当前不需要引入 TanStack Table，避免为了库重写数据逻辑'
);

assert.match(
  reactButtonSource,
  /@radix-ui\/react-slot[\s\S]*class-variance-authority[\s\S]*border-\[var\(--border\)\][\s\S]*buttonVariants/,
  '本地 Button primitive 需要使用 shadcn/Tailwind 风格 variants，并沿用现有 btn 样式避免显示大变'
);

assert.match(
  reactTableSource,
  /function Table[\s\S]*cn\('w-full border-collapse text-\[13px\]', className\)[\s\S]*border-b border-dashed border-\[var\(--border\)\][\s\S]*font-normal/,
  '本地 Table primitive 需要用 Tailwind class 表达基础表格样式'
);

assert.doesNotMatch(
  reactTableSource,
  /cn\('ot text-\[13px\]'/,
  '通用 Table primitive 不应默认夹带订单 ot 旧类'
);

assert.match(
  reactTableToolsSource,
  /function TableToolbar[\s\S]*function TableSearch[\s\S]*function TablePager[\s\S]*function TableViewport[\s\S]*function EmptyState/,
  '表格工具栏、搜索、分页、滚动外壳和空状态需要收敛到共享 React primitives'
);

assert.doesNotMatch(
  styleSource,
  /\.ot-table-toolbar|\.ot-table-search|\.ot-table-wrap|\.ot-table-pagination/,
  '表格工具栏、搜索、分页和滚动外壳不应继续依赖旧 ot-* 全局 CSS'
);

assert.doesNotMatch(
  styleSource,
  /table\.ot/,
  '订单表样式应迁到 orders-react-table，不应继续依赖 table.ot 旧选择器'
);

assert.match(
  reactProductsPageSource,
  /productSkuEditTableClass[\s\S]*pl-sku-edit-table[\s\S]*<Table className=\{productSkuEditTableClass\}>[\s\S]*<TableHeader>[\s\S]*<TableBody>/,
  '商品 SKU 编辑表需要迁到共享 Table primitive'
);

assert.match(
  reactProductsPageSource,
  /data-copy-link=\{link1688\}/,
  'React 商品表格需要保留复制链接的数据属性'
);

assert.match(
  reactProductsPageSource,
  /data-edit=\{tkId\}[\s\S]*data-del=\{tkId\}/,
  'React 商品表格需要保留编辑和删除的数据属性'
);

assert.match(
  reactProductsPageSource,
  /<TableSearch[\s\S]*onChange=\{onSearchChange\}/,
  'React 商品搜索需要通过共享 TableSearch 复用中文输入法 composition 保护'
);

assert.doesNotMatch(
  reactProductsPageSource,
  /fetch\(|XMLHttpRequest|sendBeacon/,
  'React 商品页不应上传用户数据到平台方接口'
);

[
  /products-react-table-shell/,
  /products-react-actions/,
  /products-react-empty/
].forEach(pattern => {
  assert.match(
    reactProductsPageSource,
    pattern,
    'React 商品表格需要在 React/Tailwind 层保留独立的稳定布局标记'
  );
});

assert.match(
  reactProductsPageSource,
  /aria-label="打开 1688 链接"[\s\S]*<ExternalLink/,
  '商品库的 1688 列需要提供打开按钮'
);

assert.match(
  reactProductsPageSource,
  /aria-label="复制 1688 链接"[\s\S]*<Copy/,
  '商品库的 1688 列需要提供复制按钮'
);

assert.match(
  reactProductsPageSource,
  /expandedTkIds/,
  'React 商品库页面状态需要保存多 SKU 行的展开状态'
);

assert.match(
  reactProductsPageSource,
  /onToggleExpand=\{tkId =>/,
  'React 商品库页面需要支持切换多 SKU 行的展开状态'
);

const numericProducts = [
  { tkId: '1', name: 'A' },
  { tkId: '2', name: 'B' },
  { tkId: '10', name: 'C' }
];

(async () => {
  const tableModule = await import(`file://${path.join(__dirname, '..', 'src', 'products', 'table.ts')}`);
  assert.equal(tableModule.ProductLibraryTable.render, undefined, '完整 React SPA 重建后商品表格 helper 不再暴露 DOM render 壳');
  const result = tableModule.ProductLibraryTable.deriveDisplayedProducts({
    products: [
      { tkId: 'TK-002', name: '红色杯子', cargoType: 'general' },
      { tkId: 'TK-001', name: '蓝色盘子', cargoType: 'special' }
    ],
    searchQuery: '蓝色'
  });

  assert.equal(result.length, 1, '商品表格 ESM 搜索应支持按名称筛选');
  assert.equal(result[0].tkId, 'TK-001', '商品表格 ESM 搜索结果不正确');

  const accountScoped = tableModule.ProductLibraryTable.deriveDisplayedProducts({
    products: [
      { tkId: 'TK-002', accountName: 'A', name: '红色杯子' },
      { tkId: 'TK-001', accountName: 'B', name: '蓝色盘子' }
    ],
    activeAccount: 'B',
    searchQuery: ''
  });

  assert.equal(accountScoped.length, 1, '商品表格 ESM 应支持按账号筛选');
  assert.equal(accountScoped[0].tkId, 'TK-001', '商品表格 ESM 账号筛选结果不正确');

  const descSorted = tableModule.ProductLibraryTable.deriveDisplayedProducts({
    products: numericProducts,
    sortOrder: 'desc'
  });

  assert.equal(descSorted[0].tkId, '10', '商品表格 ESM 倒序应支持自然数字排序');
  assert.equal(descSorted[2].tkId, '1', '商品表格 ESM 倒序结果不正确');

  const esmSearch = tableModule.ProductLibraryTable.deriveDisplayedProducts({
    products: [
      { tkId: 'TK-002', name: '红色杯子', cargoType: 'general' },
      { tkId: 'TK-001', name: '蓝色盘子', cargoType: 'special' }
    ],
    searchQuery: '特货'
  });
  assert.equal(esmSearch.length, 1, '商品表格 ESM 模块需要支持按货物类型筛选');
  assert.equal(esmSearch[0].tkId, 'TK-001', '商品表格 ESM 搜索结果不正确');

  const esmDescSorted = tableModule.deriveDisplayedProducts({
    products: numericProducts,
    sortOrder: 'desc'
  });
  const legacySortOrder = Array.from(descSorted, product => product.tkId);
  const esmSortOrder = Array.from(esmDescSorted, product => product.tkId);
  assert.deepStrictEqual(
    esmSortOrder,
    legacySortOrder,
    '商品表格 ESM 模块排序结果需要保持稳定'
  );

  const mergedSku = tableModule.mergeProductSku(
    {
      tkId: 'TK-001',
      defaults: {
        weightG: '120',
        lengthCm: '10',
        widthCm: '8',
        heightCm: '3',
        estimatedShippingFee: '12.5'
      }
    },
    { skuId: 'S-1', skuName: '蓝 / M', useProductDefaults: true }
  );
  assert.equal(mergedSku.weightG, '120', '商品表格 ESM 模块需要为继承默认值的 SKU 合并重量');
  assert.equal(tableModule.formatSize(mergedSku), '10 * 8 * 3', '商品表格 ESM 模块需要格式化 SKU 尺寸');
  assert.equal(tableModule.formatSkuShippingFee({ defaults: { estimatedShippingFee: '12.5' } }, { skuId: 'S-1' }), '¥ 12.50', '商品表格 ESM 模块需要格式化 SKU 运费');

  console.log('products view ui contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
