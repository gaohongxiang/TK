const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

(async () => {
  const {
    computeCreatorCommissionValue,
    computeEstimatedProfitValue,
    resolveCourierAutodetectState
  } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'orders', 'crud.mjs')).href);

  assert.equal(
    computeCreatorCommissionValue({
      salePrice: '600',
      creatorCommissionRate: '10',
      exchangeRate: 20
    }),
    '3',
    '达人佣金纯函数需要按日元售价、佣金率和汇率折算人民币'
  );

  assert.equal(
    computeEstimatedProfitValue({
      salePrice: '600',
      purchasePrice: '19.8',
      estimatedShippingFee: '6.5',
      creatorCommissionRate: '10',
      exchangeRate: 20
    }),
    '0.7',
    '预估利润纯函数需要扣除采购价、预估运费和达人佣金'
  );

  assert.equal(
    computeEstimatedProfitValue({
      salePrice: '600',
      purchasePrice: '19.8',
      estimatedShippingFee: '',
      creatorCommissionRate: '10',
      exchangeRate: 20
    }),
    '',
    '缺少任一金额字段时预估利润纯函数应返回空字符串'
  );

  assert.deepEqual(
    resolveCourierAutodetectState({
      trackingNo: 'SF123',
      currentCompany: '',
      autoDetectedCourier: '',
      detectCourierCompany: value => value.startsWith('SF') ? '顺丰快递' : ''
    }),
    { courierCompany: '顺丰快递', autoDetectedCourier: '顺丰快递' },
    '快递自动识别纯函数需要保存识别出的快递公司和自动识别状态'
  );

  console.log('orders crud profit helper behavior ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
