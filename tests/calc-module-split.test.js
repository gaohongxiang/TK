const fs = require('fs');
const path = require('path');
const assert = require('assert');

const srcSharedSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'shared.mjs'), 'utf8');
const srcIndexSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'index.mjs'), 'utf8');
const srcMainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.mjs'), 'utf8');
const srcShippingSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'shipping.mjs'), 'utf8');
const srcLegacySource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'legacy.mjs'), 'utf8');
const srcPricingSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'pricing.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(srcSharedSource, /export\s+\{[\s\S]*CalcShared[\s\S]*create[\s\S]*\}/, '路线二 M3 需要提供 calc shared ESM 导出');
assert.match(srcIndexSource, /import\s+\{\s*ensureGlobalSettingsStore\s*\}\s+from\s+'..\/global-settings\.mjs'/, 'calc ESM 入口需要复用全局设置 ESM 模块');
assert.match(srcIndexSource, /import\s+\{\s*CalcShared\s*\}\s+from\s+'\.\/shared\.mjs'/, 'calc ESM 入口需要复用 CalcShared ESM 模块');
assert.match(srcIndexSource, /import\s+\{\s*CalcShipping\s*\}\s+from\s+'\.\/shipping\.mjs'/, 'calc ESM 入口需要复用 CalcShipping ESM 模块');
assert.match(srcIndexSource, /import\s+\{\s*CalcLegacyPricing\s*\}\s+from\s+'\.\/legacy\.mjs'/, 'calc ESM 入口需要复用 CalcLegacyPricing ESM 模块');
assert.match(srcIndexSource, /import\s+\{\s*CalcPricing\s*\}\s+from\s+'\.\/pricing\.mjs'/, 'calc ESM 入口需要复用 CalcPricing ESM 模块');
assert.match(srcIndexSource, /export\s+\{[\s\S]*DEFAULTS[\s\S]*initCalc[\s\S]*\}/, 'calc ESM 入口需要导出 initCalc 以便测试和后续迁移复用');
assert.match(srcMainSource, /import '\.\/global-settings\.mjs'[\s\S]*import '\.\/shipping-core\.mjs'[\s\S]*import '\.\/shared\/html\.mjs'[\s\S]*import '\.\/shared\/format\.mjs'/, 'ESM 主入口需要先导入基础全局工具');
assert.match(srcShippingSource, /const CalcShipping = \{[\s\S]*create/, 'calc shipping ESM 模块需要保留命名空间导出');
assert.match(srcLegacySource, /const CalcLegacyPricing = \{[\s\S]*create/, 'calc legacy ESM 模块需要保留命名空间导出');
assert.match(srcPricingSource, /const CalcPricing = \{[\s\S]*create/, 'calc pricing ESM 模块需要保留命名空间导出');
assert.match(srcIndexSource, /CalcShared\.create\(/, 'calc ESM 入口需要接入 CalcShared.create');
assert.match(srcIndexSource, /CalcShipping\.create\(/, 'calc ESM 入口需要接入 CalcShipping.create');
assert.match(srcIndexSource, /CalcLegacyPricing\.create\(/, 'calc ESM 入口需要接入 CalcLegacyPricing.create');
assert.match(srcIndexSource, /CalcPricing\.create\(/, 'calc ESM 入口需要接入 CalcPricing.create');
assert.doesNotMatch(htmlSource, /<script src="js\/calc\.js" defer><\/script>/, 'index.html 不应再直接加载旧的 js/calc.js');
assert.doesNotMatch(htmlSource, /<script src="js\/calc\/(?:shared|shipping|legacy|pricing|index)\.js" defer><\/script>/, 'index.html 不应再加载旧 calc 普通脚本链');
assert.match(
  htmlSource,
  /<script type="module" src="\/src\/main\.mjs"><\/script>\s*<script type="module" src="\/src\/firestore-connection\.mjs"><\/script>\s*<script type="module" src="\/src\/calc\/index\.mjs"><\/script>/,
  'index.html 需要先加载 ESM 主入口和 Firestore 连接模块，再通过 Vite ESM 入口加载利润计算器'
);

(async () => {
  const sharedModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'shared.mjs')}`);
  const indexModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'index.mjs')}`);
  const helpers = sharedModule.CalcShared.create({
    storageKey: 'tk.profit.v1',
    defaults: { calcTab: 'pricing' }
  });

  assert.equal(typeof indexModule.initCalc, 'function', 'calc ESM 入口需要提供 initCalc');
  assert.equal(indexModule.DEFAULTS.rateNew, 23.5, 'calc ESM 入口需要保留原默认汇率');
  assert.equal(indexModule.DEFAULTS.calcTab, 'pricingNew', 'calc ESM 入口需要保留默认新定价 tab');

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
