const fs = require('fs');
const path = require('path');
const assert = require('assert');

const srcShippingSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc', 'shipping.mjs'), 'utf8');

assert.match(
  srcShippingSource,
  /import\s+\{\s*TKShippingCore\s*\}\s+from\s+'..\/shipping-core\.mjs'/,
  '路线二 M3 calc shipping ESM 模块需要复用共享运费核心'
);
assert.match(
  srcShippingSource,
  /export\s+\{[\s\S]*CalcShipping[\s\S]*create[\s\S]*\}/,
  '路线二 M3 calc shipping 需要提供 ESM 导出'
);

(async () => {
  const sharedModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'shared.mjs')}`);
  const shippingModule = await import(`file://${path.join(__dirname, '..', 'src', 'calc', 'shipping.mjs')}`);
  const shippingCoreModule = await import(`file://${path.join(__dirname, '..', 'src', 'shipping-core.mjs')}`);

  const esmShared = sharedModule.CalcShared.create({
    storageKey: 'tk.profit.v1',
    defaults: {}
  });
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
  const esmEls = {
    overseasShippingNew: { value: '' },
    shippingReview: { value: '' }
  };
  const esmShipping = shippingModule.CalcShipping.create({
    state: esmState,
    els: esmEls,
    helpers: esmShared,
    constants: {
      SHIPPING_RULES: shippingCoreModule.SHIPPING_RULES,
      ...shippingCoreModule.DEFAULT_CONSTANTS
    }
  });

  const volumeQuote = esmShipping.computeShippingQuote({
    cargoType: 'general',
    actualWeight: 50,
    length: 30,
    width: 10,
    height: 10,
    rate: 23.5
  });

  assert.equal(volumeQuote.band.range, '0 - 0.5 kg', 'calc shipping ESM 模块体积重命中的价卡区间不正确');
  assert.equal(volumeQuote.chargeWeightKg, 0.375, 'calc shipping ESM 模块应按体积重计费');
  assert.equal(volumeQuote.jpyFee, 322.5, 'calc shipping ESM 模块应扣除用户承担的 350 円');

  const floorQuote = esmShipping.computeShippingQuote({
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

  const esmQuote = esmShipping.computePricingNewShipping();
  assert.equal(esmQuote.chargeWeightKg, volumeQuote.chargeWeightKg, 'calc shipping ESM 模块需要复用同一运费 quote 逻辑');
  assert.equal(esmShipping.getCalculatedShippingCostNew(esmQuote), 16.3, 'calc shipping ESM 模块需要计算最终人民币运费');
  assert.equal(esmShipping.applyCalculatedShippingCostNew(esmQuote, { markSource: true }), 16.3, 'calc shipping ESM 模块需要支持回填计算运费');
  assert.equal(esmState.shippingSourceNew, 'calculator', 'calc shipping ESM 模块需要保留计算器来源标记');
  assert.equal(esmShipping.computeTotalCostNew(), 26.3, 'calc shipping ESM 模块需要计算定价新总成本');
  assert.equal(esmShipping.renderShippingCalc(), null, 'calc shipping ESM 模块在缺少 DOM 容器时应安全返回');

  console.log('calc shipping quote ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
