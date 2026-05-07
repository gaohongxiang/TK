const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const srcSource = fs.readFileSync(path.join(root, 'src', 'shipping-core.mjs'), 'utf8');
const reactCalculatorSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'calculator', 'CalculatorApp.tsx'), 'utf8');
const reactOrdersSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const reactProductsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  srcSource,
  /function computeShippingQuote\(/,
  '共享运费核心需要暴露 computeShippingQuote'
);

assert.match(
  srcSource,
  /function computeCalculatedShippingCost\(/,
  '共享运费核心需要暴露 computeCalculatedShippingCost'
);

assert.match(
  srcSource,
  /export\s+\{/,
  '路线二 M3 需要提供共享运费核心 ESM 导出'
);
assert.match(srcSource, /\bTKShippingCore\b/, '共享运费核心 ESM 导出需要保留命名空间');
assert.match(srcSource, /\bcomputeShippingQuote\b/, '共享运费核心 ESM 导出需要提供 computeShippingQuote');
assert.match(srcSource, /\bcomputeCalculatedShippingCost\b/, '共享运费核心 ESM 导出需要提供 computeCalculatedShippingCost');
assert.doesNotMatch(srcSource, /window\.TKShippingCore/, '共享运费核心应保持纯 ESM，不应再挂旧全局命名空间');
assert.match(reactOrdersSource, /from '\.\.\/\.\.\/\.\.\/shipping-core\.mjs'/, 'React 订单页需要显式导入共享运费核心');
assert.match(reactProductsSource, /from '\.\.\/\.\.\/\.\.\/shipping-core\.mjs'/, 'React 商品页需要显式导入共享运费核心');
assert.match(reactCalculatorSource, /from '\.\.\/\.\.\/\.\.\/shipping-core\.mjs'/, 'React 利润计算器需要显式导入共享运费核心');
assert.doesNotMatch(htmlSource, /<script src="js\/shipping-core\.js" defer><\/script>/, 'index.html 不应再加载旧共享运费核心普通脚本');

(async () => {
  const shippingModule = await import(`file://${path.join(root, 'src', 'shipping-core.mjs')}`);

  const esmQuote = shippingModule.computeShippingQuote({
    cargoType: 'general',
    actualWeight: 50,
    length: 30,
    width: 10,
    height: 10,
    rate: 23.5
  });

  assert.equal(esmQuote.band.range, '0 - 0.5 kg', '共享运费核心 ESM 模块需要命中正确价卡');
  assert.equal(esmQuote.chargeWeightKg, 0.375, '共享运费核心 ESM 模块需要按体积重计费');
  assert.equal(esmQuote.jpyFee, 322.5, '共享运费核心 ESM 模块需要扣除用户承担金额');
  assert.equal(shippingModule.computeCalculatedShippingCost({ quote: esmQuote, multiplier: 1.1, labelFee: 1.2 }), 16.3, '共享运费核心 ESM 模块需要输出含倍率和贴单费的人民币运费');
  assert.equal(typeof shippingModule.TKShippingCore.getShippingBand, 'function', '共享运费核心 ESM 模块需要保留命名空间导出');

  const floorQuote = shippingModule.computeShippingQuote({
    cargoType: 'general',
    actualWeight: 10,
    length: '',
    width: '',
    height: '',
    rate: 23.5
  });
  assert.equal(floorQuote.chargeWeightKg, 0.05, '共享运费核心需要处理 50g 起计');
  assert.ok(
    floorQuote.alerts.some(alert => alert.text.includes('50g')),
    '共享运费核心需要保留低于 50g 的提示'
  );

  console.log('shipping core module ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
