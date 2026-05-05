const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const htmlSource = fs.readFileSync(path.join(root, 'js', 'shared', 'html.js'), 'utf8');
const formatSource = fs.readFileSync(path.join(root, 'js', 'shared', 'format.js'), 'utf8');
const srcHtmlSource = fs.readFileSync(path.join(root, 'src', 'shared', 'html.mjs'), 'utf8');
const srcFormatSource = fs.readFileSync(path.join(root, 'src', 'shared', 'format.mjs'), 'utf8');
const analyticsSource = fs.readFileSync(path.join(root, 'js', 'analytics', 'index.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(htmlSource, /const TKHtml = \(function \(\) \{/, '需要共享 HTML 工具命名空间');
assert.match(htmlSource, /function escape\(value\)/, '共享 HTML 工具需要 escape');
assert.match(htmlSource, /function shorten\(value,\s*max = 46\)/, '共享 HTML 工具需要 shorten');
assert.match(formatSource, /const TKFormat = \(function \(\) \{/, '需要共享格式化工具命名空间');
assert.match(formatSource, /function integer\(value/, '共享格式化工具需要 integer');
assert.match(formatSource, /function yen\(value\)/, '共享格式化工具需要 yen');
assert.match(formatSource, /function percent\(value,\s*digits = 2\)/, '共享格式化工具需要 percent');
assert.match(srcHtmlSource, /export\s+const\s+TKHtml/, '路线二 M1 需要提供共享 HTML ESM 导出');
assert.match(srcFormatSource, /export\s+const\s+TKFormat/, '路线二 M1 需要提供共享格式化 ESM 导出');

assert.match(
  indexSource,
  /<script src="js\/shipping-core\.js" defer><\/script>\s*<script src="js\/shared\/html\.js" defer><\/script>\s*<script src="js\/shared\/format\.js" defer><\/script>\s*<script src="js\/firestore-connection\.js" defer><\/script>/,
  '共享工具需要在业务模块前加载'
);

assert.match(
  analyticsSource,
  /TKHtml\.escape[\s\S]*TKFormat\.integer[\s\S]*TKFormat\.yen[\s\S]*TKFormat\.percent[\s\S]*TKHtml\.shorten/,
  'analytics 渲染层需要使用共享 HTML/format 工具'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${htmlSource}\n${formatSource}\nthis.TKHtml = TKHtml; this.TKFormat = TKFormat;`, sandbox);

assert.strictEqual(sandbox.TKHtml.escape('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;', 'escape 需要处理 HTML 特殊字符');
assert.strictEqual(sandbox.TKHtml.shorten('abcdefghijkl', 8), 'abcdefgh...', 'shorten 需要截断长文本');
assert.strictEqual(sandbox.TKFormat.integer(12345.6), '12,346', 'integer 需要四舍五入并格式化千分位');
assert.strictEqual(sandbox.TKFormat.yen(12345.2), '12,345 円', 'yen 需要格式化日元');
assert.strictEqual(sandbox.TKFormat.percent(0.1234, 1), '12.3%', 'percent 需要按小数转百分比');

(async () => {
  const htmlModule = await import(`file://${path.join(root, 'src', 'shared', 'html.mjs')}`);
  const formatModule = await import(`file://${path.join(root, 'src', 'shared', 'format.mjs')}`);

  assert.strictEqual(htmlModule.TKHtml.escape('<b>'), '&lt;b&gt;', '共享 HTML ESM 模块需要可被直接 import');
  assert.strictEqual(htmlModule.shorten('abcdefghijkl', 8), 'abcdefgh...', '共享 HTML ESM 模块需要导出 shorten');
  assert.strictEqual(formatModule.TKFormat.yen(1200), '1,200 円', '共享格式化 ESM 模块需要可被直接 import');
  assert.strictEqual(formatModule.percent(0.456, 1), '45.6%', '共享格式化 ESM 模块需要导出 percent');

  console.log('shared utils contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
