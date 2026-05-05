const fs = require('fs');
const path = require('path');
const assert = require('assert');

const globalSettingsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'global-settings.js'), 'utf8');
const sharedSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'shared.js'), 'utf8');
const srcSharedSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'shared.mjs'), 'utf8');
const shippingSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'shipping.js'), 'utf8');
const legacySource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'legacy.js'), 'utf8');
const pricingSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'pricing.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'calc', 'index.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(globalSettingsSource, /const TKGlobalSettings = \(function \(\) \{/, '需要独立的全局设置模块');
assert.match(sharedSource, /const CalcShared = \(function \(\) \{/, '需要新的 calc shared 模块');
assert.match(srcSharedSource, /export\s+\{[\s\S]*CalcShared[\s\S]*create[\s\S]*\}/, '路线二 M3 需要提供 calc shared ESM 导出');
assert.match(shippingSource, /const CalcShipping = \(function \(\) \{/, '需要新的 calc shipping 模块');
assert.match(legacySource, /const CalcLegacyPricing = \(function \(\) \{/, '需要新的 calc legacy 模块');
assert.match(pricingSource, /const CalcPricing = \(function \(\) \{/, '需要新的 calc pricing 模块');
assert.match(indexSource, /CalcShared\.create\(/, 'js/calc/index.js 需要接入 CalcShared.create');
assert.match(indexSource, /CalcShipping\.create\(/, 'js/calc/index.js 需要接入 CalcShipping.create');
assert.match(indexSource, /CalcLegacyPricing\.create\(/, 'js/calc/index.js 需要接入 CalcLegacyPricing.create');
assert.match(indexSource, /CalcPricing\.create\(/, 'js/calc/index.js 需要接入 CalcPricing.create');
assert.doesNotMatch(htmlSource, /<script src="js\/calc\.js" defer><\/script>/, 'index.html 不应再直接加载旧的 js/calc.js');
assert.match(
  htmlSource,
  /<script src="js\/app-config\.js" defer><\/script>\s*<script src="js\/app\.js" defer><\/script>[\s\S]*<script src="js\/global-settings\.js" defer><\/script>[\s\S]*<script src="js\/shipping-core\.js" defer><\/script>\s*<script src="js\/shared\/html\.js" defer><\/script>\s*<script src="js\/shared\/format\.js" defer><\/script>\s*<script src="js\/firestore-connection\.js" defer><\/script>\s*<script src="js\/calc\/shared\.js" defer><\/script>\s*<script src="js\/calc\/shipping\.js" defer><\/script>\s*<script src="js\/calc\/legacy\.js" defer><\/script>\s*<script src="js\/calc\/pricing\.js" defer><\/script>\s*<script src="js\/calc\/index\.js" defer><\/script>/,
  'index.html 需要先加载全局设置、共享运费核心和全局 Firestore 连接模块，再按 shared -> shipping -> legacy -> pricing -> index 的顺序加载利润计算器模块'
);

(async () => {
  const sharedModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'shared.mjs')}`);
  const helpers = sharedModule.CalcShared.create({
    storageKey: 'tk.profit.v1',
    defaults: { calcTab: 'pricing' }
  });

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
