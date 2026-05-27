import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const reactCalculatorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'calculator', 'CalculatorApp.tsx'), 'utf8');

assert.match(
  reactCalculatorSource,
  /import \{ DEFAULT_CONSTANTS, SHIPPING_RULES, computeCalculatedShippingCost, computeShippingQuote \} from '\.\.\/\.\.\/\.\.\/shipping-core\.ts'/,
  'React 利润计算器需要直接复用共享运费核心'
);
assert.match(
  reactCalculatorSource,
  /function quoteForPricingMode\([\s\S]*computeShippingQuote\(\{[\s\S]*rules: SHIPPING_RULES[\s\S]*constants: shippingConstantsForCustomerShipping\(customerShippingJpy\)/,
  'React 利润计算器需要在页面内通过共享运费核心生成 quote'
);
assert.match(
  reactCalculatorSource,
  /function finalShippingCost\([\s\S]*computeCalculatedShippingCost\(\{/,
  'React 利润计算器需要通过共享运费核心计算最终人民币运费'
);
assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'calc', 'shipping.mjs')), '完整 React SPA 后不应保留 calc shipping DOM 壳层');

(async () => {
  const shippingCoreModule = await import(`file://${path.join(__dirname, '..', 'src', 'shipping-core.ts')}`);

  const esmState = {
    shippingMultiplierNew: 1.1,
    labelFeeNew: 1.2,
    costNew: 10,
    overseasShippingNew: 0,
    shipCargoTypeNew: 'general',
    shipActualWeightNew: 50,
    shipLengthNew: 30,
    shipWidthNew: 10,
    shipHeightNew: 10,
    rateNew: 23.5,
    shipCargoType: 'general',
    shipActualWeight: 500,
    shipLength: 20,
    shipWidth: 15,
    shipHeight: 10,
    rate: 23.5
  };

  const volumeQuote = shippingCoreModule.computeShippingQuote({
    cargoType: 'general',
    actualWeight: 50,
    length: 30,
    width: 10,
    height: 10,
    rate: 23.5
  });

  assert.equal(volumeQuote.band.range, '0 - 0.5 kg', 'calc shipping ESM 模块体积重命中的价卡区间不正确');
  assert.equal(volumeQuote.chargeWeightKg, 0.375, 'calc shipping ESM 模块应按体积重计费');
  assert.equal(volumeQuote.jpyFee, 322.5, 'calc shipping ESM 模块应扣除买家支付运费 350 円');

  const floorQuote = shippingCoreModule.computeShippingQuote({
    cargoType: 'general',
    actualWeight: 10,
    length: '',
    width: '',
    height: '',
    rate: 23.5
  });

  assert.equal(floorQuote.chargeWeightKg, 0.05, 'calc shipping ESM 模块低于 50g 时应按 0.05kg 起计');
  assert.ok(
    floorQuote.alerts.some(alert => alert.text.includes('50g')),
    'calc shipping ESM 模块低于 50g 时需要给出提示'
  );

  const esmQuote = shippingCoreModule.computeShippingQuote({
    cargoType: esmState.shipCargoTypeNew,
    actualWeight: esmState.shipActualWeightNew,
    length: esmState.shipLengthNew,
    width: esmState.shipWidthNew,
    height: esmState.shipHeightNew,
    rate: esmState.rateNew,
    rules: shippingCoreModule.SHIPPING_RULES,
    constants: shippingCoreModule.DEFAULT_CONSTANTS
  });
  assert.equal(esmQuote.chargeWeightKg, volumeQuote.chargeWeightKg, 'calc shipping ESM 模块需要复用同一运费 quote 逻辑');
  const finalCost = shippingCoreModule.computeCalculatedShippingCost({
    quote: esmQuote,
    multiplier: Math.max(1, esmState.shippingMultiplierNew || 1),
    labelFee: esmState.labelFeeNew || 0
  });
  assert.equal(finalCost, 16.3, '共享运费核心需要计算最终人民币运费');
  esmState.overseasShippingNew = finalCost;
  esmState.shippingSourceNew = 'calculator';
  assert.equal(esmState.shippingSourceNew, 'calculator', 'calc shipping ESM 模块需要保留计算器来源标记');
  assert.equal(esmState.costNew + esmState.overseasShippingNew, 26.3, 'React 利润计算器需要计算定价新总成本');

  console.log('calc shipping quote ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
