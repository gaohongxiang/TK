const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'products', 'table.js'), 'utf8');
const accountsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'products', 'accounts.js'), 'utf8');
const exportSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'products', 'export.js'), 'utf8');
const crudSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'products', 'crud.js'), 'utf8');
const productsIndexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'products', 'index.js'), 'utf8');
const configSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app-config.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const ProductLibraryTableView = \(function \(\) \{/,
  '商品库需要独立的表格视图模块'
);

assert.match(
  source,
  /function deriveDisplayedProducts\(/,
  '商品库表格视图需要暴露 deriveDisplayedProducts'
);

assert.match(
  source,
  /sortOrder = 'asc'/,
  '商品库表格视图需要支持和订单页一致的排序方向状态'
);

assert.match(
  source,
  /function render\(/,
  '商品库表格视图需要暴露 render'
);

assert.match(
  configSource,
  /key:\s*'products'/,
  '全局配置需要新增商品库模块'
);

assert.match(
  appSource,
  /TKAppConfig\.modules/,
  '全局路由需要从项目配置读取模块列表'
);

assert.match(
  appSource,
  /DOMContentLoaded[\s\S]*switchView\(\(location\.hash \|\| '#calc'\)\.slice\(1\)\)/,
  '初始路由需要等所有模块脚本加载完后再执行，避免商品库刷新后漏掉 onEnter'
);

assert.match(
  indexSource,
  /data-view="products"/,
  '页面导航需要新增商品库入口'
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
  crudSource,
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
  crudSource,
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
  /<script src="js\/products\/provider-firestore\.js" defer><\/script>[\s\S]*<script src="js\/products\/table\.js" defer><\/script>\s*<script src="js\/products\/accounts\.js" defer><\/script>\s*<script src="js\/products\/export\.js" defer><\/script>\s*<script src="js\/products\/form-utils\.js" defer><\/script>\s*<script src="js\/products\/crud\.js" defer><\/script>\s*<script src="js\/products\/index\.js" defer><\/script>/,
  'index.html 需要先加载商品 provider，再按 table -> accounts -> export -> form-utils -> crud -> index 顺序加载商品库模块'
);

assert.match(
  indexSource,
  /<script src="js\/table-controls\.js" defer><\/script>/,
  '页面需要预先加载表格搜索/分页共用控件'
);

assert.match(
  productsIndexSource,
  /products 集合[\s\S]*notifyRulesUpdateNeeded/,
  '商品库在 Firestore 权限不足时需要触发全局规则更新提示'
);

assert.match(
  productsIndexSource,
  /classList\.add\('is-spinning'\)[\s\S]*classList\.remove\('is-spinning'\)/,
  '商品库刷新时需要和订单页一样显示转圈状态'
);

assert.match(
  exportSource,
  /function exportProductsCsv\(/,
  '商品库需要提供 CSV 导出逻辑'
);

assert.match(
  exportSource,
  /getDisplayedProducts\(\{\s*activeAccount:\s*'__all__'\s*\}\)/,
  '商品库导出应复用当前筛选结果，而不是忽略账号和搜索条件'
);

assert.match(
  productsIndexSource,
  /provider\.upsertProduct\(product,\s*\{\s*waitForCommit:\s*false\s*\}\)/,
  '商品库保存应先进入 Firestore 本地队列，不等待云端提交后才更新 UI'
);

assert.match(
  productsIndexSource,
  /provider\.deleteProduct\(tkId,\s*\{\s*waitForCommit:\s*false\s*\}\)/,
  '商品库删除应先进入 Firestore 本地队列，不等待云端提交后才更新 UI'
);

assert.match(
  exportSource,
  /function promptProductExportAccounts\(/,
  '商品库导出需要提供账号选择流程'
);

assert.match(
  accountsSource,
  /function renderAccountTabs\(/,
  '商品库账号标签渲染需要从入口文件拆到账号模块'
);

assert.match(
  source,
  /tableControls\?\.buildTableToolbarMarkup[\s\S]*搜索 TK ID \/ 名称 \/ 1688 链接/,
  '商品库搜索框需要通过共用表格控件复用订单页的搜索样式结构'
);

assert.match(
  source,
  /tableControls\?\.buildTableToolbarMarkup[\s\S]*prefix: 'pl'[\s\S]*pageSizeOptions/,
  '商品库需要通过共用表格控件复用订单页的上下双分页结构'
);

assert.doesNotMatch(
  source,
  /命中价卡/,
  '商品库表格不应再展示命中价卡字段'
);

assert.match(
  source,
  /data-copy-link/,
  '商品库的 1688 列需要同时提供打开和复制两个按钮'
);

assert.match(
  source,
  /id="pl-sort-btn"/,
  '商品库表格需要提供和订单页一致的排序切换按钮'
);

assert.match(
  source,
  /<th>SKU数<\/th>/,
  '商品库主表需要提供 SKU 数量列'
);

assert.match(
  source,
  /<th>商品名称<\/th>[\s\S]*<th>货物类型<\/th>[\s\S]*<th>SKU数<\/th>[\s\S]*<th>1688<\/th>/,
  '商品库主表应在货物类型后直接进入 SKU 数量与 1688 列'
);

assert.doesNotMatch(
  source,
  /<th>更新时间<\/th>/,
  '商品库主表不应再展示更新时间列'
);

assert.match(
  source,
  /data-toggle-expand=/,
  '多 SKU 商品行需要支持点击展开 SKU 明细'
);

assert.match(
  source,
  /pl-sku-detail-row|pl-sku-expanded-surface/,
  '商品库需要为多 SKU 商品提供可展开的 SKU 明细层'
);

assert.match(
  source,
  />打开<\/a>/,
  '商品库的 1688 列需要提供打开按钮'
);

assert.match(
  source,
  />复制<\/button>/,
  '商品库的 1688 列需要提供复制按钮'
);

assert.match(
  productsIndexSource,
  /expandedTkIds:\s*\{\}/,
  '商品库页面状态需要保存多 SKU 行的展开状态'
);

assert.match(
  productsIndexSource,
  /onToggleExpand:\s*tkId\s*=>/,
  '商品库页面需要支持切换多 SKU 行的展开状态'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.ProductLibraryTableView = ProductLibraryTableView;`, sandbox);

const result = sandbox.ProductLibraryTableView.deriveDisplayedProducts({
  products: [
    { tkId: 'TK-002', name: '红色杯子', cargoType: 'general' },
    { tkId: 'TK-001', name: '蓝色盘子', cargoType: 'special' }
  ],
  searchQuery: '蓝色'
});

assert.equal(result.length, 1, '商品库搜索应支持按名称筛选');
assert.equal(result[0].tkId, 'TK-001', '商品库搜索结果不正确');

const accountScoped = sandbox.ProductLibraryTableView.deriveDisplayedProducts({
  products: [
    { tkId: 'TK-002', accountName: 'A', name: '红色杯子' },
    { tkId: 'TK-001', accountName: 'B', name: '蓝色盘子' }
  ],
  activeAccount: 'B',
  searchQuery: ''
});

assert.equal(accountScoped.length, 1, '商品库应支持按账号筛选');
assert.equal(accountScoped[0].tkId, 'TK-001', '商品库账号筛选结果不正确');

const descSorted = sandbox.ProductLibraryTableView.deriveDisplayedProducts({
  products: [
    { tkId: '1', name: 'A' },
    { tkId: '2', name: 'B' },
    { tkId: '10', name: 'C' }
  ],
  sortOrder: 'desc'
});

assert.equal(descSorted[0].tkId, '10', '商品库倒序应支持自然数字排序');
assert.equal(descSorted[2].tkId, '1', '商品库倒序结果不正确');

console.log('products view ui contract ok');
