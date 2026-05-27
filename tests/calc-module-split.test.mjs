import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const formulasSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'formulas.ts'), 'utf8');
const reactCalculatorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'calculator', 'CalculatorApp.tsx'), 'utf8');
const numberInputSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'components', 'ui', 'number-input.tsx'), 'utf8');
const reactMainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'main.tsx'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'app', 'App.tsx'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'calc', 'index.mjs')), '完整 React SPA 重建后旧 calc DOM 入口应删除');
['shared.ts', 'shipping.mjs', 'legacy.mjs', 'pricing.mjs'].forEach(file => {
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'calc', file)), `完整 React SPA 重建后旧 calc DOM 壳层 ${file} 应删除`);
});
assert.match(reactCalculatorSource, /import \{ ensureGlobalSettingsStore \}[\s\S]*from '\.\.\/\.\.\/\.\.\/global-settings\.ts'[\s\S]*import \{ DEFAULT_CONSTANTS[\s\S]*from '\.\.\/\.\.\/\.\.\/shipping-core\.ts'/, 'React 利润计算器需要显式导入全局设置和共享运费核心');
assert.match(formulasSource, /export\s+\{[\s\S]*calcLegacyRow[\s\S]*calcPricingRow[\s\S]*calcPricingV3Row[\s\S]*calcSalePrice[\s\S]*calcSalePriceV3[\s\S]*deriveLegacyOrigPrice[\s\S]*derivePricingOrigPrice[\s\S]*derivePricingV3OrigPrice[\s\S]*\}/, '利润计算器应保留纯公式 ESM 导出');
assert.match(reactCalculatorSource, /calcLegacyRow[\s\S]*calcPricingRow[\s\S]*calcPricingV3Row[\s\S]*calcSalePriceV3[\s\S]*deriveLegacyOrigPrice[\s\S]*derivePricingOrigPrice[\s\S]*derivePricingV3OrigPrice/, 'React 利润计算器需要直接导入纯公式模块');
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
  /calcPricingRow[\s\S]*calcPricingV3Row[\s\S]*calcSalePriceV3[\s\S]*derivePricingOrigPrice[\s\S]*derivePricingV3OrigPrice[\s\S]*computeShippingQuote[\s\S]*id="costNew"[\s\S]*id="totalCostNew"[\s\S]*id=\{isV3 \? 'tbodyV3' : 'tbodyNew'\}/,
  'React 利润计算器需要复用现有公式和运费核心，并保留关键 DOM id 以维持体验连续性'
);

assert.match(
  reactCalculatorSource,
  /from '@\/components\/ui\/table'[\s\S]*calcResultTableClass = 'calc-result-table[\s\S]*tabular-nums[\s\S]*<Table className=\{calcResultTableClass\}[\s\S]*<TableBody id=\{isV3 \? 'tbodyV3' : 'tbodyNew'\}[\s\S]*<TableBody id="tbody"/,
  'React 利润计算器结果表需要使用共享 Table primitive'
);

assert.match(
  reactCalculatorSource,
  /calcResultTableClass = 'calc-result-table[\s\S]*border-0[\s\S]*\[\&_td\]:border-x-0[\s\S]*\[\&_th\]:border-x-0/,
  '利润计算器折扣结果表需要保持旧版只留横线的视觉，不应出现外边框和竖线'
);

assert.match(
  reactCalculatorSource,
  /calcResultTableClass = 'calc-result-table[\s\S]*text-\[14\.5px\][\s\S]*calcResultHeadClass = 'px-\[11px\] py-\[11\.5px\][\s\S]*calcResultCellClass = 'px-\[11px\] py-\[11\.5px\]/,
  '利润计算器折扣结果表只应比原版略大，不能过度放大'
);

assert.match(
  reactCalculatorSource,
  /calcFormulaBlockClass = 'calc-formula-block mt-3 text-\[var\(--muted\)\]'[\s\S]*calcFormulaListClass = 'calc-formula-list[\s\S]*text-\[10\.5px\][\s\S]*原价反推 = 总费用 × 目标利润率 × 汇率 ÷ \[基准折扣 × \(1 − 平台手续费率\) × \(1 − 达人佣金率\)\]/,
  '利润计算器公式区需要去掉外框、保持小字体，并补全原价反推公式'
);

assert.match(
  reactCalculatorSource,
  /id="totalCostNew" tone="expense"[\s\S]*id="totalCostReview" tone="expense"/,
  '定价新和利润复盘总费用字段需要保持费用红色输入框风格'
);

assert.match(
  reactCalculatorSource,
  /calcTabsClass = 'calc-tabs flex w-auto flex-none[\s\S]*className="flex-none border-transparent/,
  '利润计算器模式按钮需要保持旧版自然宽度按钮组，不应铺满成三等分'
);

assert.doesNotMatch(
  reactCalculatorSource,
  /<table className="mono calc-result-table"/,
  '利润计算器结果表不应继续使用原生 table'
);

(async () => {
  assert.match(reactCalculatorSource, /rateNew:\s*23\.5[\s\S]*calcTab:\s*'pricingV3'/, 'React 利润计算器需要保留原默认汇率，并默认进入 V3 主口径 tab');

  assert.match(reactCalculatorSource, /from '@\/components\/ui\/number-input'[\s\S]*DecimalInput[\s\S]*DecimalListInput/, 'React 利润计算器需要使用共享数字输入组件');
  assert.match(numberInputSource, /function normalizeDecimalText\([\s\S]*\.replace\(\s*\/\[。．｡，\]\/g,\s*'\.'[\s\S]*function normalizeDecimalInput[\s\S]*seenDot/, '共享数字输入需要统一小数符号归一化和单小数点规则');
  assert.match(numberInputSource, /const DecimalListInput[\s\S]*normalizeDecimalListInput[\s\S]*setSelectionRange/, '共享数字列表输入需要维护光标');
  assert.match(numberInputSource, /const DecimalListInput[\s\S]*onValuesChange\?\.\(values\)/, '共享数字列表输入需要回传有效数值列表');
  assert.match(reactCalculatorSource, /function parseDiscounts\([\s\S]*endsWith\('%'\)[\s\S]*DEFAULTS\.discountsNew/, 'React 利润计算器需要保留折扣档位解析和兜底');
  assert.match(reactCalculatorSource, /function formatCny\([\s\S]*-¥[\s\S]*function formatWeight/, 'React 利润计算器需要保留人民币和重量格式化');

  console.log('calc module split contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
