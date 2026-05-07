const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const srcHtmlSource = fs.readFileSync(path.join(root, 'src', 'shared', 'html.mjs'), 'utf8');
const srcFormatSource = fs.readFileSync(path.join(root, 'src', 'shared', 'format.mjs'), 'utf8');
const reactOrdersSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const reactSearchableSelectSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'searchable-select.tsx'), 'utf8');
const srcProductsTableSource = fs.readFileSync(path.join(root, 'src', 'products', 'table.mjs'), 'utf8');
const reactAnalyticsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'AnalyticsApp.tsx'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(srcHtmlSource, /export\s+const\s+TKHtml/, '路线二 M1 需要提供共享 HTML ESM 导出');
assert.match(srcHtmlSource, /function escape\(value\)/, '共享 HTML 工具需要 escape');
assert.match(srcHtmlSource, /function shorten\(value,\s*max = 46\)/, '共享 HTML 工具需要 shorten');
assert.match(srcFormatSource, /export\s+const\s+TKFormat/, '路线二 M1 需要提供共享格式化 ESM 导出');
assert.match(srcFormatSource, /function integer\(value/, '共享格式化工具需要 integer');
assert.match(srcFormatSource, /function yen\(value\)/, '共享格式化工具需要 yen');
assert.match(srcFormatSource, /function percent\(value,\s*digits = 2\)/, '共享格式化工具需要 percent');
assert.doesNotMatch(srcHtmlSource, /window\.TKHtml/, '共享 HTML helper 应保持纯 ESM，不应再挂旧全局命名空间');
assert.doesNotMatch(srcFormatSource, /window\.TKFormat/, '共享格式化 helper 应保持纯 ESM，不应再挂旧全局命名空间');
assert.ok(!fs.existsSync(path.join(root, 'src', 'table-controls.mjs')), '完整 React SPA 重建后旧 DOM 表格控件 ESM 应清理');
assert.doesNotMatch(srcProductsTableSource, /TKTableControls/, '商品 React 表格迁移后商品表格 helper 不应继续依赖 DOM 表格控件');
assert.match(reactOrdersSource, /from '@\/components\/ui\/searchable-select'[\s\S]*<SearchableSelect/, 'React 订单页需要使用共享可搜索下拉框');
assert.match(reactSearchableSelectSource, /function SearchableSelect\([\s\S]*data-role="trigger"[\s\S]*data-option-value/, '可搜索下拉框需要提供 React primitive 实现');
assert.ok(!fs.existsSync(path.join(root, 'src', 'searchable-select.mjs')), '完整 React SPA 重建后旧 DOM 可搜索下拉 ESM 应清理');

assert.doesNotMatch(indexSource, /<script src="js\/shared\/html\.js" defer><\/script>/, 'index.html 不应再加载旧共享 HTML 普通脚本');
assert.doesNotMatch(indexSource, /<script src="js\/shared\/format\.js" defer><\/script>/, 'index.html 不应再加载旧共享格式化普通脚本');
assert.match(indexSource, /<script type="module" src="\/src\/react\/main\.tsx"><\/script>/, '主站壳层应由 React SPA 入口加载，共享工具由业务模块显式导入');

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
  reactAnalyticsSource,
  /formatInteger[\s\S]*formatPercent[\s\S]*formatYen[\s\S]*shortenText/,
  'React analytics 渲染层需要使用共享格式化 helper'
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
  console.log('shared utils contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
