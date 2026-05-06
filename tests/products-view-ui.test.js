const fs = require('fs');
const path = require('path');
const assert = require('assert');

const srcTableSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'products', 'table.mjs'), 'utf8');
const srcProductsIndexSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'products', 'index.mjs'), 'utf8');
const srcAccountsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'products', 'accounts.mjs'), 'utf8');
const srcExportSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'products', 'export.mjs'), 'utf8');
const srcCrudSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'products', 'crud.mjs'), 'utf8');
const reactProductsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'products', 'ProductsTable.tsx'), 'utf8');
const reactProductsMountSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'products', 'mountProductsTable.tsx'), 'utf8');
const reactAppShellSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'layouts', 'AppShell.tsx'), 'utf8');
const reactButtonSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'components', 'ui', 'button.tsx'), 'utf8');
const reactTableSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'components', 'ui', 'table.tsx'), 'utf8');
const configSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app-config.mjs'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.mjs'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const styleSource = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

assert.match(
  srcTableSource,
  /function deriveDisplayedProducts\(/,
  '商品库表格 ESM 视图需要暴露 deriveDisplayedProducts'
);

assert.match(
  srcTableSource,
  /export\s+\{[\s\S]*ProductLibraryTable[\s\S]*ProductLibraryTableView[\s\S]*deriveDisplayedProducts[\s\S]*mergeProductSku[\s\S]*render[\s\S]*\}/,
  '路线二 M4 需要提供商品表格 ESM 导出和渲染壳'
);

assert.match(
  srcTableSource,
  /window\.ProductLibraryTableView = ProductLibraryTableView/,
  '商品表格 ESM 模块需要挂回旧全局命名空间'
);

assert.match(
  srcProductsIndexSource,
  /import \{ ProductLibraryTableView \} from '\.\/table\.mjs'/,
  '商品 ESM 入口需要直接导入商品表格 ESM 模块'
);

assert.match(
  srcTableSource,
  /sortOrder = 'asc'/,
  '商品库表格 ESM 视图需要支持和订单页一致的排序方向状态'
);

assert.match(
  srcTableSource,
  /function render\(/,
  '商品库表格 ESM 视图需要暴露 render'
);

assert.match(
  srcProductsIndexSource,
  /function createProductLibrary\(options = \{\}\)/,
  '路线二 M4 商品管理 ESM 入口需要导出可注入依赖的创建函数'
);

assert.match(
  srcProductsIndexSource,
  /function getProductLibrary\(options = \{\}\)/,
  '路线二 M4 商品管理 ESM 入口需要懒初始化，避免旧 defer 子模块时序问题'
);

assert.match(
  srcProductsIndexSource,
  /window\.ProductLibrary = ProductLibrary/,
  '路线二 M4 商品管理 ESM 入口需要挂回 ProductLibrary 全局供旧路由调用'
);

assert.match(
  srcProductsIndexSource,
  /new CustomEvent\('tk-products-changed'[\s\S]*action: 'upsert'[\s\S]*action: 'delete'/,
  '商品管理保存或删除商品后需要广播 tk-products-changed，通知订单侧刷新关联商品缓存'
);

assert.match(
  configSource,
  /key:\s*'products'/,
  '全局配置需要新增商品库模块'
);

assert.match(
  appSource,
  /config\.modules/,
  '全局路由需要从项目配置读取模块列表'
);

assert.match(
  appSource,
  /DOMContentLoaded[\s\S]*windowRef\?\.addEventListener\?\.\('hashchange', route\)[\s\S]*route\(\)/,
  '初始路由需要等所有模块脚本加载完后再执行，避免商品库刷新后漏掉 onEnter'
);

assert.match(
  reactAppShellSource,
  /key:\s*'products'[\s\S]*data-view=\{module\.key\}/,
  'React AppShell 导航需要新增商品库入口'
);

assert.match(
  indexSource,
  /id="view-products"/,
  '页面需要新增商品库视图容器'
);

assert.match(
  indexSource,
  /id="pl-main"/,
  '商品库需要提供主列表容器'
);

assert.match(
  indexSource,
  /id="pl-acc-tabs"/,
  '商品库需要提供按账号区分的标签区域'
);

assert.match(
  indexSource,
  /id="pl-acc-actions"[\s\S]*id="pl-add"/,
  '商品库新增商品按钮需要放在账号标签同一行'
);

assert.match(
  indexSource,
  /id="pl-sku-list"/,
  '商品库弹窗需要提供 SKU 列表容器'
);

assert.match(
  indexSource,
  /id="pl-batch-axis-a"[\s\S]*id="pl-batch-axis-b"[\s\S]*id="pl-batch-axis-c"/,
  '商品库弹窗批量生成 SKU 需要在同一行提供三个规格维度'
);

assert.match(
  srcCrudSource,
  /data-sku-field="sizeText"/,
  '商品库弹窗需要在 SKU 区块里提供单个尺寸输入框'
);

assert.match(
  indexSource,
  /name="accountName"|id="pl-account-select"/,
  '商品库弹窗需要提供账号选择字段'
);

assert.doesNotMatch(
  indexSource,
  /name="lengthCm"|name="widthCm"|name="heightCm"/,
  '商品库弹窗不应再拆成长宽高三个输入框'
);

assert.match(
  indexSource,
  /id="pl-batch-weight"|id="pl-batch-size"/,
  '商品库弹窗需要提供统一的参数调整输入框'
);

assert.match(
  srcCrudSource,
  /data-sku-use-defaults=/,
  '商品库 SKU 行需要保留继承共用物流参数的内部状态'
);

assert.match(
  indexSource,
  /匹配关键词（可选）/,
  '商品库参数调整区需要支持“留空则应用到全部 SKU”的交互'
);

assert.doesNotMatch(
  indexSource,
  /id="pl-apply-sku-batch"|应用到 SKU/,
  '商品库参数调整区不应再保留“应用到 SKU”按钮，改为输入即联动'
);

assert.match(
  indexSource,
  /id="pl-add-sku"/,
  '商品库弹窗需要提供添加 SKU 的入口'
);

assert.match(
  indexSource,
  /id="pl-refresh"[\s\S]*ot-refresh-inline/,
  '商品库刷新按钮需要复用订单页的图标样式与位置语义'
);

assert.match(
  indexSource,
  /id="pl-export"[\s\S]*导出 CSV/,
  '商品库已连接状态条需要提供导出 CSV 按钮'
);

assert.match(
  indexSource,
  /id="pl-export-modal"[\s\S]*id="pl-export-options"[\s\S]*id="pl-export-confirm"/,
  '商品库需要提供按账号选择的导出 CSV 弹层'
);

assert.match(
  indexSource,
  /id="pl-disconnected"/,
  '商品库在未连接时需要提供轻量空态容器'
);

assert.match(
  indexSource,
  /id="pl-open-connection"/,
  '商品库在未连接时需要提供打开全局连接弹层的按钮'
);

assert.match(
  indexSource,
  /id="app-firestore-rules-modal"/,
  '页面需要提供全局 Firestore 规则更新提示弹层'
);

assert.doesNotMatch(
  indexSource,
  /id="pl-firestore-config"|id="pl-connect"|id="pl-reset-config"/,
  '商品库不应再保留独立 Firestore 配置表单'
);

assert.match(
  indexSource,
  /id="pl-table-footer-toolbar-container"/,
  '商品库需要提供底部分页容器'
);

assert.match(
  indexSource,
  /<script type="module" src="\/src\/products\/index\.mjs"><\/script>/,
  'index.html 需要通过 ESM 入口加载商品库 index'
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
  appSource,
  /import '\.\/table-controls\.mjs'/,
  '页面需要通过 ESM 主入口预先加载表格搜索/分页共用控件'
);

assert.match(
  srcProductsIndexSource,
  /products 集合[\s\S]*notifyRulesUpdateNeeded/,
  '商品库在 Firestore 权限不足时需要触发全局规则更新提示'
);

assert.match(
  srcProductsIndexSource,
  /classList\.add\('is-spinning'\)[\s\S]*classList\.remove\('is-spinning'\)/,
  '商品库刷新时需要和订单页一样显示转圈状态'
);

assert.match(
  srcExportSource,
  /function exportProductsCsv\(/,
  '商品库需要提供 CSV 导出逻辑'
);

assert.match(
  srcExportSource,
  /getDisplayedProducts\(\{\s*activeAccount:\s*'__all__'\s*\}\)/,
  '商品库导出应复用当前筛选结果，而不是忽略账号和搜索条件'
);

assert.match(
  srcProductsIndexSource,
  /provider\.upsertProduct\(product,\s*\{\s*waitForCommit:\s*false\s*\}\)/,
  '商品库保存应先进入 Firestore 本地队列，不等待云端提交后才更新 UI'
);

assert.match(
  srcProductsIndexSource,
  /provider\.deleteProduct\(tkId,\s*\{\s*waitForCommit:\s*false\s*\}\)/,
  '商品库删除应先进入 Firestore 本地队列，不等待云端提交后才更新 UI'
);

assert.match(
  srcExportSource,
  /function promptProductExportAccounts\(/,
  '商品库导出需要提供账号选择流程'
);

assert.match(
  srcAccountsSource,
  /function renderAccountTabs\(/,
  '商品库账号标签渲染需要从入口文件拆到账号模块'
);

assert.match(
  srcTableSource,
  /TKTableControls\?\.buildTableToolbarMarkup[\s\S]*搜索 TK ID \/ 名称 \/ 1688 链接/,
  '商品库搜索框需要通过共用表格控件复用订单页的搜索样式结构'
);

assert.match(
  srcTableSource,
  /TKTableControls\?\.buildTableToolbarMarkup[\s\S]*prefix: 'pl'[\s\S]*pageSizeOptions/,
  '商品库需要通过共用表格控件复用订单页的上下双分页结构'
);

assert.doesNotMatch(
  srcTableSource,
  /命中价卡/,
  '商品库表格不应再展示命中价卡字段'
);

assert.match(
  srcTableSource,
  /data-copy-link/,
  '商品库的 1688 列需要同时提供打开和复制两个按钮'
);

assert.match(
  srcTableSource,
  /id="pl-sort-btn"/,
  '商品库表格需要提供和订单页一致的排序切换按钮'
);

assert.match(
  srcTableSource,
  /<th>SKU数<\/th>/,
  '商品库主表需要提供 SKU 数量列'
);

assert.match(
  srcTableSource,
  /<th>商品名称<\/th>[\s\S]*<th>货物类型<\/th>[\s\S]*<th>SKU数<\/th>[\s\S]*<th>1688<\/th>/,
  '商品库主表应在货物类型后直接进入 SKU 数量与 1688 列'
);

assert.doesNotMatch(
  srcTableSource,
  /<th>更新时间<\/th>/,
  '商品库主表不应再展示更新时间列'
);

assert.match(
  srcTableSource,
  /data-toggle-expand=/,
  '多 SKU 商品行需要支持点击展开 SKU 明细'
);

assert.match(
  srcTableSource,
  /pl-sku-detail-row|pl-sku-expanded-surface/,
  '商品库需要为多 SKU 商品提供可展开的 SKU 明细层'
);

assert.match(
  srcTableSource,
  /import\('\.\.\/react\/features\/products\/mountProductsTable\.tsx'\)[\s\S]*tryRenderReactProductsTable/,
  '商品库表格应渐进式动态加载 React 表格，不阻塞 ESM 纯函数 import'
);

assert.match(
  reactProductsMountSource,
  /createRoot[\s\S]*mountProductsTable[\s\S]*<ProductToolbar[\s\S]*<ProductsTable[\s\S]*<ProductFooterToolbar/,
  'React 商品表格需要同时接管搜索、主表和底部分页'
);

assert.match(
  reactProductsSource,
  /data-react-products-table-ready="true"/,
  'React 商品表格需要提供可测试的挂载完成标记'
);

assert.match(
  reactProductsSource,
  /from '@\/components\/ui\/button'[\s\S]*from '@\/components\/ui\/table'/,
  'React 商品表格需要使用本地 shadcn 风格 UI primitives，而不是继续手写基础标签'
);

[
  /table-auto/,
  /max-w-\[clamp\(240px,30vw,420px\)\]/,
  /min-w-\[150px\]/,
  /inline-flex/
].forEach(pattern => {
  assert.match(
    reactProductsSource,
    pattern,
    'React 商品表格的布局样式需要迁到 Tailwind/shadcn class，而不是继续主要依赖旧 CSS'
  );
});

assert.doesNotMatch(
  reactProductsSource,
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
  /function Table[\s\S]*cn\('ot text-\[13px\]', className\)[\s\S]*bg-transparent font-semibold[\s\S]*font-normal/,
  '本地 Table primitive 需要用 Tailwind class 表达基础样式，同时保留现有 ot 表格 class'
);

assert.doesNotMatch(
  styleSource,
  /\.products-react-table\s*\{[\s\S]*\.products-react-empty\s*\{/,
  '商品 React 表格样式不应继续集中写在旧 css/style.css'
);

assert.match(
  reactProductsSource,
  /data-copy-link=\{link1688\}/,
  'React 商品表格需要保留复制链接的数据属性'
);

assert.match(
  reactProductsSource,
  /data-edit=\{tkId\}[\s\S]*data-del=\{tkId\}/,
  'React 商品表格需要保留编辑和删除的数据属性'
);

assert.match(
  reactProductsSource,
  /onCompositionStart[\s\S]*onCompositionEnd[\s\S]*onSearchChange/,
  'React 商品搜索需要保留中文输入法 composition 保护'
);

assert.doesNotMatch(
  reactProductsSource,
  /firebase|Firestore|localStorage|fetch\(|XMLHttpRequest|sendBeacon/,
  'React 商品表格只能做 UI 渲染，不应直接访问远端或持久化数据'
);

[
  /products-react-table-shell/,
  /products-react-actions/,
  /products-react-empty/
].forEach(pattern => {
  assert.match(
    reactProductsSource,
    pattern,
    'React 商品表格需要在 React/Tailwind 层保留独立的稳定布局标记'
  );
});

assert.match(
  srcTableSource,
  />打开<\/a>/,
  '商品库的 1688 列需要提供打开按钮'
);

assert.match(
  srcTableSource,
  />复制<\/button>/,
  '商品库的 1688 列需要提供复制按钮'
);

assert.match(
  srcProductsIndexSource,
  /expandedTkIds:\s*\{\}/,
  '商品库页面状态需要保存多 SKU 行的展开状态'
);

assert.match(
  srcProductsIndexSource,
  /onToggleExpand:\s*tkId\s*=>/,
  '商品库页面需要支持切换多 SKU 行的展开状态'
);

const numericProducts = [
  { tkId: '1', name: 'A' },
  { tkId: '2', name: 'B' },
  { tkId: '10', name: 'C' }
];

(async () => {
  const tableModule = await import(`file://${path.join(__dirname, '..', 'src', 'products', 'table.mjs')}`);
  const productsIndexModule = await import(`file://${path.join(__dirname, '..', 'src', 'products', 'index.mjs')}`);
  assert.equal(typeof productsIndexModule.createProductLibrary, 'function', '商品管理 ESM 入口需要可被直接 import');
  assert.equal(typeof productsIndexModule.getProductLibrary, 'function', '商品管理 ESM 入口需要导出懒初始化入口');
  assert.equal(typeof tableModule.ProductLibraryTableView.render, 'function', '商品表格 ESM 模块需要保留渲染壳');
  const result = tableModule.ProductLibraryTableView.deriveDisplayedProducts({
    products: [
      { tkId: 'TK-002', name: '红色杯子', cargoType: 'general' },
      { tkId: 'TK-001', name: '蓝色盘子', cargoType: 'special' }
    ],
    searchQuery: '蓝色'
  });

  assert.equal(result.length, 1, '商品表格 ESM 搜索应支持按名称筛选');
  assert.equal(result[0].tkId, 'TK-001', '商品表格 ESM 搜索结果不正确');

  const accountScoped = tableModule.ProductLibraryTableView.deriveDisplayedProducts({
    products: [
      { tkId: 'TK-002', accountName: 'A', name: '红色杯子' },
      { tkId: 'TK-001', accountName: 'B', name: '蓝色盘子' }
    ],
    activeAccount: 'B',
    searchQuery: ''
  });

  assert.equal(accountScoped.length, 1, '商品表格 ESM 应支持按账号筛选');
  assert.equal(accountScoped[0].tkId, 'TK-001', '商品表格 ESM 账号筛选结果不正确');

  const descSorted = tableModule.ProductLibraryTableView.deriveDisplayedProducts({
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
