const fs = require('fs');
const path = require('path');
const assert = require('assert');

const formulasSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'formulas.mjs'), 'utf8');
const reactCalculatorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'calculator', 'CalculatorApp.tsx'), 'utf8');
const reactMainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'main.tsx'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'app', 'App.tsx'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'calc', 'index.mjs')), '完整 React SPA 重建后旧 calc DOM 入口应删除');
['shared.mjs', 'shipping.mjs', 'legacy.mjs', 'pricing.mjs'].forEach(file => {
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'calc', file)), `完整 React SPA 重建后旧 calc DOM 壳层 ${file} 应删除`);
});
assert.match(reactCalculatorSource, /import \{ ensureGlobalSettingsStore \}[\s\S]*from '\.\.\/\.\.\/\.\.\/global-settings\.mjs'[\s\S]*import \{ DEFAULT_CONSTANTS[\s\S]*from '\.\.\/\.\.\/\.\.\/shipping-core\.mjs'/, 'React 利润计算器需要显式导入全局设置和共享运费核心');
assert.match(formulasSource, /export\s+\{[\s\S]*calcLegacyRow[\s\S]*calcPricingRow[\s\S]*calcSalePrice[\s\S]*deriveLegacyOrigPrice[\s\S]*derivePricingOrigPrice[\s\S]*\}/, '利润计算器应保留纯公式 ESM 导出');
assert.match(reactCalculatorSource, /import \{ calcLegacyRow, calcPricingRow, calcSalePrice, deriveLegacyOrigPrice, derivePricingOrigPrice \} from '\.\.\/\.\.\/\.\.\/calc\/formulas\.mjs'/, 'React 利润计算器需要直接导入纯公式模块');
assert.doesNotMatch(htmlSource, /<script src="js\/calc\.js" defer><\/script>/, 'index.html 不应再直接加载旧的 js/calc.js');
assert.doesNotMatch(htmlSource, /<script src="js\/calc\/(?:shared|shipping|legacy|pricing|index)\.js" defer><\/script>/, 'index.html 不应再加载旧 calc 普通脚本链');
assert.doesNotMatch(htmlSource, /<script type="module" src="\/src\/calc\/index\.mjs"><\/script>/, 'React SPA 阶段不应再自动运行旧 calc DOM 入口');
assert.match(
  htmlSource,
  /<div id="root"><\/div>[\s\S]*<script type="module" src="\/src\/react\/main\.tsx"><\/script>/,
  'React SPA 阶段 index.html 只需要提供单一 React 挂载容器'
);
assert.match(
  reactAppSource,
  /id="view-calc"[\s\S]*<CalculatorApp \/>/,
  'React App 需要渲染利润计算器页面'
);
assert.match(
  reactCalculatorSource,
  /calcPricingRow[\s\S]*calcSalePrice[\s\S]*derivePricingOrigPrice[\s\S]*computeShippingQuote[\s\S]*id="costNew"[\s\S]*id="totalCostNew"[\s\S]*id="tbodyNew"/,
  'React 利润计算器需要复用现有公式和运费核心，并保留关键 DOM id 以维持体验连续性'
);

assert.match(
  reactCalculatorSource,
  /from '@\/components\/ui\/table'[\s\S]*<Table className="mono calc-result-table"[\s\S]*<TableBody id="tbodyNew"[\s\S]*<TableBody id="tbody"/,
  'React 利润计算器结果表需要使用共享 Table primitive'
);

assert.doesNotMatch(
  reactCalculatorSource,
  /<table className="mono calc-result-table"/,
  '利润计算器结果表不应继续使用原生 table'
);

(async () => {
  assert.match(reactCalculatorSource, /rateNew:\s*23\.5[\s\S]*calcTab:\s*'pricingNew'/, 'React 利润计算器需要保留原默认汇率和默认新定价 tab');

  assert.match(reactCalculatorSource, /function normalizeDecimalText\([\s\S]*\.replace\(\s*\/\[。．｡，\]\/g,\s*'\.'/, 'React 利润计算器需要保留小数符号归一化');
  assert.match(reactCalculatorSource, /function parseDiscounts\([\s\S]*endsWith\('%'\)[\s\S]*DEFAULTS\.discountsNew/, 'React 利润计算器需要保留折扣档位解析和兜底');
  assert.match(reactCalculatorSource, /function formatCny\([\s\S]*-¥[\s\S]*function formatWeight/, 'React 利润计算器需要保留人民币和重量格式化');

  console.log('calc module split contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
