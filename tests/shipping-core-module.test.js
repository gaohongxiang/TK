const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'shipping-core.js'), 'utf8');

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

console.log('shipping core module ok');
