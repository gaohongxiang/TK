const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'shipping-core.js'), 'utf8');
const srcSource = fs.readFileSync(path.join(root, 'src', 'shipping-core.mjs'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'src', 'main.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  source,
  /const TKShippingCore = \(function \(\) \{/,
  '共享运费核心需要暴露 TKShippingCore 模块'
);

assert.match(
  source,
  /function computeShippingQuote\(/,
  '共享运费核心需要暴露 computeShippingQuote'
);

assert.match(
  source,
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
assert.match(srcSource, /window\.TKShippingCore = TKShippingCore/, '共享运费核心 ESM 模块需要在浏览器里挂回旧全局命名空间');
assert.match(mainSource, /import '\.\/shipping-core\.mjs'/, 'ESM 主入口需要先导入共享运费核心');
assert.doesNotMatch(htmlSource, /<script src="js\/shipping-core\.js" defer><\/script>/, 'index.html 不应再加载旧共享运费核心普通脚本');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.TKShippingCore = TKShippingCore;`, sandbox);

const quote = sandbox.TKShippingCore.computeShippingQuote({
  cargoType: 'general',
  actualWeight: 50,
  length: 30,
  width: 10,
  height: 10,
  rate: 23.5
});

assert.equal(quote.band.range, '0 - 0.5 kg', '共享运费核心需要命中正确价卡');
assert.equal(quote.chargeWeightKg, 0.375, '共享运费核心需要按体积重计费');
assert.equal(quote.jpyFee, 322.5, '共享运费核心需要扣除用户承担金额');

const finalCnyFee = sandbox.TKShippingCore.computeCalculatedShippingCost({
  quote,
  multiplier: 1.1,
  labelFee: 1.2
});

assert.equal(finalCnyFee, 16.3, '共享运费核心需要输出含倍率和贴单费的人民币运费');

const floorQuote = sandbox.TKShippingCore.computeShippingQuote({
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

  assert.equal(esmQuote.band.range, quote.band.range, '共享运费核心 ESM 模块需要命中同一价卡');
  assert.equal(esmQuote.chargeWeightKg, quote.chargeWeightKg, '共享运费核心 ESM 模块需要按同一计费重');
  assert.equal(esmQuote.jpyFee, quote.jpyFee, '共享运费核心 ESM 模块需要输出同一日元运费');
  assert.equal(
    shippingModule.computeCalculatedShippingCost({ quote: esmQuote, multiplier: 1.1, labelFee: 1.2 }),
    finalCnyFee,
    '共享运费核心 ESM 模块需要输出同一人民币运费'
  );
  assert.equal(typeof shippingModule.TKShippingCore.getShippingBand, 'function', '共享运费核心 ESM 模块需要保留命名空间导出');

  console.log('shipping core module ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
