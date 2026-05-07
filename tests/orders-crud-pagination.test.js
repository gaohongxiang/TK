const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

(async () => {
  const {
    buildItemProductOptions,
    buildItemSkuOptions,
    deriveOrderItemSummaryFields
  } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'orders', 'crud.mjs')).href);

  const products = [
    {
      accountName: '账号A',
      tkId: 'TK-1',
      name: '雨衣',
      skus: [
        { skuId: 'SKU-1', skuName: '白色 / M' }
      ]
    }
  ];

  assert.deepEqual(
    buildItemProductOptions({ accountName: '账号A', selectedTkId: 'TK-MISSING', products }),
    [
      { value: '', label: '- 不关联商品 -', searchText: '' },
      { value: 'TK-1', label: 'TK-1 - 雨衣', searchText: 'TK-1 雨衣 SKU-1 白色 / M' },
      { value: 'TK-MISSING', label: 'TK-MISSING（已不存在）', searchText: 'TK-MISSING' }
    ],
    '商品选项纯函数需要生成当前账号商品，并保留已不存在的已选商品'
  );

  assert.deepEqual(
    buildItemSkuOptions(products[0], 'SKU-MISSING'),
    [
      { value: '', label: '- 请选择 SKU -', searchText: '' },
      { value: 'SKU-1', label: '白色 / M - SKU-1', searchText: 'SKU-1 白色 / M' },
      { value: 'SKU-MISSING', label: 'SKU-MISSING（已不存在）', searchText: 'SKU-MISSING' }
    ],
    'SKU 选项纯函数需要生成商品 SKU，并保留已不存在的已选 SKU'
  );

  assert.deepEqual(
    deriveOrderItemSummaryFields([
      { lineId: 'a', productName: '雨衣', productSkuName: '白色', quantity: '2', unitWeightG: '150', unitSizeText: '20×10×5' },
      { lineId: 'b', productName: '杯子', quantity: '3', unitWeightG: '100' }
    ]),
    {
      items: [
        {
          lineId: 'a',
          productTkId: '',
          productSkuId: '',
          productSkuName: '白色',
          productName: '雨衣',
          quantity: '2',
          unitSalePrice: '',
          unitPurchasePrice: '',
          unitWeightG: '150',
          unitSizeText: '20×10×5',
          useOrderCourier: null,
          courierCompany: '',
          trackingNo: ''
        },
        {
          lineId: 'b',
          productTkId: '',
          productSkuId: '',
          productSkuName: '',
          productName: '杯子',
          quantity: '3',
          unitSalePrice: '',
          unitPurchasePrice: '',
          unitWeightG: '100',
          unitSizeText: '',
          useOrderCourier: null,
          courierCompany: '',
          trackingNo: ''
        }
      ],
      quantityTotal: 5,
      productName: '雨衣 - 白色 / 杯子',
      productTkId: '',
      productSkuId: '',
      productSkuName: '',
      weight: '600',
      size: ''
    },
    '订单明细摘要纯函数需要稳定汇总数量、商品摘要和总重量'
  );

  console.log('orders crud helper behavior ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
