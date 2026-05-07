const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const esmPath = path.join(__dirname, '..', 'src', 'orders', 'crud.mjs');
const source = fs.readFileSync(esmPath, 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.match(
  source,
  /const OrderTrackerCrud = Object\.freeze\(\{/,
  'ESM 订单 CRUD helper 模块需要保留 OrderTrackerCrud 命名导出'
);

assert.match(
  source,
  /function buildItemProductOptions\(/,
  'ESM 订单 CRUD 工具模块需要包含商品选项纯函数'
);

assert.match(
  source,
  /function deriveOrderItemSummaryFields\(/,
  'ESM 订单 CRUD 工具模块需要包含明细汇总纯函数'
);

assert.match(
  source,
  /export \{[\s\S]*OrderTrackerCrud[\s\S]*buildItemProductOptions[\s\S]*computeEstimatedProfitValue[\s\S]*deriveOrderItemSummaryFields[\s\S]*\}/,
  'ESM 订单 CRUD 工具模块需要导出命名空间和关键纯函数'
);

assert.match(
  source,
  /import \{ OrderTrackerFormUtils \} from '\.\/form-utils\.mjs'/,
  'ESM 订单 CRUD 模块需要直接导入订单表单工具'
);

assert.doesNotMatch(
  source,
  /window\.OrderTrackerCrud|function create\(\{ state, constants, helpers, ui \}\)|function openModal\(|function bindEvents\(|TKSearchSelect/,
  '完整 React SPA 重建后订单 CRUD helper 不应再保留旧 DOM 运行时或全局下拉依赖'
);

const crudModulePromise = import(pathToFileURL(esmPath).href);

(async () => {
const crudModule = await crudModulePromise;
assert.equal(typeof crudModule.OrderTrackerCrud.buildItemProductOptions, 'function', 'CRUD helper 命名空间需要暴露 buildItemProductOptions');
assert.equal(typeof crudModule.OrderTrackerCrud.computeEstimatedProfitValue, 'function', 'CRUD helper 命名空间需要暴露 computeEstimatedProfitValue');
})().catch(error => {
  console.error(error);
  process.exit(1);
});

assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'orders', 'index.mjs')), '完整 React SPA 重建后旧订单 DOM 入口应删除');

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再通过旧订单 ESM 入口加载 CRUD 模块'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/crud\.js" defer><\/script>/,
  'index.html 不应再加载旧订单 CRUD 普通脚本'
);

assert.match(
  ordersPageSource,
  /className="ot-item-block"[\s\S]*<h4>订单明细<\/h4>/,
  '订单弹窗需要提供订单明细区域'
);

assert.match(
  ordersPageSource,
  /id="ot-item-list"/,
  '订单明细编辑器需要提供订单明细列表容器'
);

assert.match(
  ordersPageSource,
  /name="商品TK ID" id="ot-product-select"[\s\S]*name="商品SKU ID" id="ot-sku-select"/,
  '订单弹窗需要保留聚合后的商品和 SKU 字段'
);

assert.match(
  ordersPageSource,
  /id="ot-add-item-btn"[\s\S]*添加明细/,
  '订单弹窗需要支持新增订单明细行'
);

assert.doesNotMatch(
  source,
  /refreshProductsInOpenModal|shouldDeferItemOptionRefresh|markOrderItemFieldInteraction|pointerdown[\s\S]{0,260}data-item-field/,
  '订单 CRUD helper 不应再保留旧 DOM 编辑区刷新和抢焦点补丁'
);

assert.doesNotMatch(
  source,
  /function refreshProductsInOpenModal[\s\S]{0,900}renderOrderItems\(readOrderItemsFromDom\(\)\)/,
  '订单弹窗异步刷新商品资料不应重渲染明细行，否则刚填写的快递单号可能被清空'
);

assert.match(
  ordersPageSource,
  /一个 TK 订单可以包含多个商品和多个 SKU；每条订单明细对应一个商品的一个 SKU/,
  '订单弹窗需要说明 TK 订单与订单明细、SKU 的对应关系'
);

assert.match(
  ordersPageSource,
  /<FormField label="订单号 \*"[\s\S]*<Input name="订单号" required/,
  '订单号需要是必填字段'
);

assert.match(
  ordersPageSource,
  /<FormField label=\{<>总重量\(g\)[\s\S]*id="ot-weight-hint"[\s\S]*<\/span><\/>\}[\s\S]*name="重量"/,
  '订单弹窗需要展示多件重量自动折算提示'
);

assert.match(
  ordersPageSource,
  /from '@\/components\/ui\/searchable-select'[\s\S]*<SearchableSelect[\s\S]*role="product-combobox"[\s\S]*<SearchableSelect[\s\S]*role="sku-combobox"/,
  'React 订单页需要提供可搜索商品和 SKU 下拉组件'
);

assert.match(
  ordersPageSource,
  /COURIER_AUTO_DETECTORS[\s\S]*detectCourierCompany\(trackingNo,\s*COURIER_AUTO_DETECTORS\)[\s\S]*courierCompany:\s*detected \|\| item\.courierCompany/,
  'React 订单明细填写快递单号时需要优先保存自动识别出的快递公司'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/searchable-select\.js" defer><\/script>/,
  'index.html 不应再加载旧可搜索下拉组件普通脚本'
);

(async () => {
  const crudModule = await crudModulePromise;
  const products = [
    {
      tkId: 'TK-1',
      name: '雨衣',
      skus: [
        { skuId: 'SKU-1', skuName: '白色 / M' }
      ]
    }
  ];

  assert.deepEqual(
    crudModule.buildItemProductOptions({
      accountName: 'A',
      selectedTkId: 'TK-MISSING',
      products
    }),
    [
      { value: '', label: '- 不关联商品 -', searchText: '' },
      { value: 'TK-1', label: 'TK-1 - 雨衣', searchText: 'TK-1 雨衣 SKU-1 白色 / M' },
      { value: 'TK-MISSING', label: 'TK-MISSING（已不存在）', searchText: 'TK-MISSING' }
    ],
    'ESM 订单 CRUD 工具应生成商品选项并保留已不存在商品'
  );

  assert.deepEqual(
    crudModule.buildItemSkuOptions(products[0], 'SKU-MISSING'),
    [
      { value: '', label: '- 请选择 SKU -', searchText: '' },
      { value: 'SKU-1', label: '白色 / M - SKU-1', searchText: 'SKU-1 白色 / M' },
      { value: 'SKU-MISSING', label: 'SKU-MISSING（已不存在）', searchText: 'SKU-MISSING' }
    ],
    'ESM 订单 CRUD 工具应生成 SKU 选项并保留已不存在 SKU'
  );

  assert.deepEqual(
    crudModule.deriveOrderItemSummaryFields([
      {
        lineId: 'a',
        productTkId: 'TK-1',
        productSkuId: 'SKU-1',
        productSkuName: '白色',
        productName: '雨衣',
        quantity: '2',
        unitWeightG: '150',
        unitSizeText: '20×10×5'
      },
      {
        lineId: 'b',
        productName: '杯子',
        quantity: '3',
        unitWeightG: '100'
      }
    ]),
    {
      items: [
        {
          lineId: 'a',
          productTkId: 'TK-1',
          productSkuId: 'SKU-1',
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
    'ESM 订单 CRUD 工具应按多明细汇总数量、商品摘要和总重量'
  );

  assert.equal(
    crudModule.computeCreatorCommissionValue({
      salePrice: '600',
      creatorCommissionRate: '10',
      exchangeRate: 20
    }),
    '3',
    'ESM 订单 CRUD 工具应按汇率计算达人佣金'
  );

  assert.equal(
    crudModule.computeEstimatedProfitValue({
      salePrice: '600',
      purchasePrice: '19.8',
      estimatedShippingFee: '6.5',
      creatorCommissionRate: '10',
      exchangeRate: 20
    }),
    '0.7',
    'ESM 订单 CRUD 工具应按汇率计算预估利润'
  );

  assert.deepEqual(
    crudModule.resolveCourierAutodetectState({
      trackingNo: 'SF123',
      currentCompany: '',
      autoDetectedCourier: '',
      detectCourierCompany: value => value.startsWith('SF') ? '顺丰快递' : ''
    }),
    { courierCompany: '顺丰快递', autoDetectedCourier: '顺丰快递' },
    'ESM 订单 CRUD 工具应保留明细快递自动识别规则'
  );

  console.log('orders crud module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
