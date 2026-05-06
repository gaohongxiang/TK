const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const srcHtmlSource = fs.readFileSync(path.join(root, 'src', 'shared', 'html.mjs'), 'utf8');
const srcFormatSource = fs.readFileSync(path.join(root, 'src', 'shared', 'format.mjs'), 'utf8');
const srcTableControlsSource = fs.readFileSync(path.join(root, 'src', 'table-controls.mjs'), 'utf8');
const srcSearchSelectSource = fs.readFileSync(path.join(root, 'src', 'searchable-select.mjs'), 'utf8');
const srcOrdersSource = fs.readFileSync(path.join(root, 'src', 'orders', 'index.mjs'), 'utf8');
const reactOrdersSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const srcProductsTableSource = fs.readFileSync(path.join(root, 'src', 'products', 'table.mjs'), 'utf8');
const analyticsSource = fs.readFileSync(path.join(root, 'src', 'analytics', 'index.mjs'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(srcHtmlSource, /export\s+const\s+TKHtml/, '路线二 M1 需要提供共享 HTML ESM 导出');
assert.match(srcHtmlSource, /function escape\(value\)/, '共享 HTML 工具需要 escape');
assert.match(srcHtmlSource, /function shorten\(value,\s*max = 46\)/, '共享 HTML 工具需要 shorten');
assert.match(srcFormatSource, /export\s+const\s+TKFormat/, '路线二 M1 需要提供共享格式化 ESM 导出');
assert.match(srcFormatSource, /function integer\(value/, '共享格式化工具需要 integer');
assert.match(srcFormatSource, /function yen\(value\)/, '共享格式化工具需要 yen');
assert.match(srcFormatSource, /function percent\(value,\s*digits = 2\)/, '共享格式化工具需要 percent');
assert.match(srcHtmlSource, /window\.TKHtml = TKHtml/, '共享 HTML ESM 模块需要在浏览器里挂回旧全局命名空间');
assert.match(srcFormatSource, /window\.TKFormat = TKFormat/, '共享格式化 ESM 模块需要在浏览器里挂回旧全局命名空间');
assert.match(srcTableControlsSource, /export\s+\{[\s\S]*TKTableControls[\s\S]*buildTableToolbarMarkup[\s\S]*clampPage[\s\S]*\}/, '路线二需要提供表格控件 ESM 导出');
assert.match(srcProductsTableSource, /import \{ TKTableControls \} from '\.\.\/table-controls\.mjs'/, '商品表格需要显式导入表格控件');
assert.match(reactOrdersSource, /function SearchableCombo\(/, 'React 订单页需要提供可搜索下拉框');
assert.match(srcSearchSelectSource, /export\s+\{[\s\S]*TKSearchSelect[\s\S]*create[\s\S]*normalizeText[\s\S]*\}/, '路线二需要提供可搜索下拉框 ESM 导出');

assert.doesNotMatch(indexSource, /<script src="js\/shared\/html\.js" defer><\/script>/, 'index.html 不应再加载旧共享 HTML 普通脚本');
assert.doesNotMatch(indexSource, /<script src="js\/shared\/format\.js" defer><\/script>/, 'index.html 不应再加载旧共享格式化普通脚本');
assert.match(indexSource, /<script type="module" src="\/src\/react\/main\.tsx"><\/script>\s*<script type="module" src="\/src\/firestore-connection\.mjs"><\/script>/, '主站壳层应由 React SPA 入口加载，共享工具由业务模块显式导入');

assert.doesNotMatch(
  indexSource,
  /<script src="js\/table-controls\.js" defer><\/script>/,
  'index.html 不应再加载旧表格控件普通脚本'
);

assert.doesNotMatch(
  indexSource,
  /<script src="js\/searchable-select\.js" defer><\/script>/,
  'index.html 不应再加载旧可搜索下拉框普通脚本'
);

assert.match(
  analyticsSource,
  /import \{ TKFormat \}[\s\S]*import \{ TKHtml \}[\s\S]*html\.escape[\s\S]*format\.integer[\s\S]*format\.yen[\s\S]*format\.percent[\s\S]*html\.shorten/,
  'analytics 渲染层需要使用共享 HTML/format 工具'
);

(async () => {
  const htmlModule = await import(`file://${path.join(root, 'src', 'shared', 'html.mjs')}`);
  const formatModule = await import(`file://${path.join(root, 'src', 'shared', 'format.mjs')}`);

  assert.strictEqual(htmlModule.TKHtml.escape('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;', 'escape 需要处理 HTML 特殊字符');
  assert.strictEqual(htmlModule.TKHtml.escape('<b>'), '&lt;b&gt;', '共享 HTML ESM 模块需要可被直接 import');
  assert.strictEqual(htmlModule.shorten('abcdefghijkl', 8), 'abcdefgh...', '共享 HTML ESM 模块需要导出 shorten');
  assert.strictEqual(formatModule.TKFormat.integer(12345.6), '12,346', 'integer 需要四舍五入并格式化千分位');
  assert.strictEqual(formatModule.TKFormat.yen(1200), '1,200 円', '共享格式化 ESM 模块需要可被直接 import');
  assert.strictEqual(formatModule.percent(0.456, 1), '45.6%', '共享格式化 ESM 模块需要导出 percent');
  const tableControlsModule = await import(`file://${path.join(root, 'src', 'table-controls.mjs')}`);
  assert.deepStrictEqual(tableControlsModule.clampPage(12, 20, 45), { currentPage: 3, totalPages: 3, pageSize: 20 }, '表格控件 ESM 模块需要可被直接 import');
  assert.match(
    tableControlsModule.buildTableToolbarMarkup({ prefix: 'x', pageSize: 20, currentPage: 1, totalPages: 2, pageSizeOptions: [20], includeSearch: true, searchQuery: '<a>' }),
    /id="x-table-search-input"[\s\S]*&lt;a&gt;[\s\S]*id="x-page-next"/,
    '表格控件 ESM 模块需要生成搜索和分页 HTML，并转义搜索值'
  );
  const searchSelectModule = await import(`file://${path.join(root, 'src', 'searchable-select.mjs')}`);
  assert.equal(searchSelectModule.normalizeText('  ABC  '), 'abc', '可搜索下拉框 ESM 模块需要可被直接 import');
  assert.equal(searchSelectModule.escapeHtml('<a>"'), '&lt;a&gt;&quot;', '可搜索下拉框 ESM 模块需要导出 HTML 转义');

  console.log('shared utils contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
