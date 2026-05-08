import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const reactOrdersSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const reactSearchableSelectSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'searchable-select.tsx'), 'utf8');
const srcProductsTableSource = fs.readFileSync(path.join(root, 'src', 'products', 'table.ts'), 'utf8');
const reactAnalyticsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'AnalyticsApp.tsx'), 'utf8');
const reactAnalyticsFormatSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'format.ts'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(!fs.existsSync(path.join(root, 'src', 'shared', 'html.mjs')), '完整 React SPA 后不应保留未使用的 shared/html 迁移壳层');
assert.ok(!fs.existsSync(path.join(root, 'src', 'shared', 'format.mjs')), '完整 React SPA 后不应保留未使用的 shared/format 迁移壳层');
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
  /import \{[^}]*formatInteger[^}]*formatPercent[^}]*formatYen[^}]*shortenText[^}]*\} from '\.\/format'/,
  'React analytics 渲染层需要使用 React 本地格式化 helper'
);

assert.match(
  reactAnalyticsFormatSource,
  /function formatInteger\([\s\S]*function formatYen\([\s\S]*function formatPercent\([\s\S]*function shortenText\(/,
  'React analytics 本地格式化 helper 需要覆盖整数、日元、百分比和短文本'
);

console.log('shared utils contract ok');
