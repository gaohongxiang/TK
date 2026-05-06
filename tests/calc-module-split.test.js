const fs = require('fs');
const path = require('path');
const assert = require('assert');

const srcSharedSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'shared.mjs'), 'utf8');
const srcShippingSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'shipping.mjs'), 'utf8');
const srcLegacySource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'legacy.mjs'), 'utf8');
const srcPricingSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'pricing.mjs'), 'utf8');
const reactCalculatorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'calculator', 'CalculatorApp.tsx'), 'utf8');
const reactMainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'main.tsx'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'app', 'App.tsx'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(srcSharedSource, /export\s+\{[\s\S]*CalcShared[\s\S]*create[\s\S]*\}/, '路线二 M3 需要提供 calc shared ESM 导出');
assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'calc', 'index.mjs')), '完整 React SPA 重建后旧 calc DOM 入口应删除');
assert.match(reactCalculatorSource, /import \{ ensureGlobalSettingsStore \}[\s\S]*from '\.\.\/\.\.\/\.\.\/global-settings\.mjs'[\s\S]*import \{ DEFAULT_CONSTANTS[\s\S]*from '\.\.\/\.\.\/\.\.\/shipping-core\.mjs'/, 'React 利润计算器需要显式导入全局设置和共享运费核心');
assert.match(srcShippingSource, /const CalcShipping = \{[\s\S]*create/, 'calc shipping ESM 模块需要保留命名空间导出');
assert.match(srcLegacySource, /const CalcLegacyPricing = \{[\s\S]*create/, 'calc legacy ESM 模块需要保留命名空间导出');
assert.match(srcPricingSource, /const CalcPricing = \{[\s\S]*create/, 'calc pricing ESM 模块需要保留命名空间导出');
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

(async () => {
  const sharedModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'shared.mjs')}`);
  const helpers = sharedModule.CalcShared.create({
    storageKey: 'tk.profit.v1',
    defaults: { calcTab: 'pricing' }
  });

  assert.match(reactCalculatorSource, /rateNew:\s*23\.5[\s\S]*calcTab:\s*'pricingNew'/, 'React 利润计算器需要保留原默认汇率和默认新定价 tab');

  assert.deepStrictEqual(helpers.parseDiscounts('35%, 0.4，50'), [0.35, 0.4, 0.5], 'calc shared ESM 模块需要解析折扣');
  assert.strictEqual(helpers.fmtDiscount(0.35), '3.5折', 'calc shared ESM 模块需要格式化折扣');
  assert.strictEqual(helpers.fmtCny(-12.3), '-¥12.30', 'calc shared ESM 模块需要格式化人民币');
  assert.strictEqual(helpers.fmtWeight(0.375), '0.375 kg', 'calc shared ESM 模块需要格式化重量');
  assert.strictEqual(helpers.normalizeDecimalText('１２。３'), '１２.３', 'calc shared ESM 模块需要归一化常见小数符号');
  assert.strictEqual(helpers.toNumber('12，5'), 12.5, 'calc shared ESM 模块需要按归一化结果转数字');

  console.log('calc module split contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
