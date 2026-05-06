const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const esmPath = path.join(__dirname, '..', 'src', 'orders', 'crud.mjs');
const source = fs.readFileSync(esmPath, 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders', 'index.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.match(
  source,
  /const OrderTrackerCrud = \{/,
  'ESM 订单 CRUD 模块需要保留 OrderTrackerCrud 命名导出'
);

assert.match(
  source,
  /function create\(\{ state, constants, helpers, ui \}\)/,
  'ESM 订单 CRUD 模块需要暴露运行版 create 工厂'
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
  /export \{[\s\S]*OrderTrackerCrud[\s\S]*buildItemProductOptions[\s\S]*deriveOrderItemSummaryFields[\s\S]*computeEstimatedProfitValue[\s\S]*\}/,
  'ESM 订单 CRUD 工具模块需要导出命名空间和关键纯函数'
);

assert.match(
  source,
  /import \{ OrderTrackerFormUtils \} from '\.\/form-utils\.mjs'/,
  'ESM 订单 CRUD 模块需要直接导入订单表单工具'
);

assert.match(
  source,
  /window\.OrderTrackerCrud = OrderTrackerCrud/,
  'ESM 订单 CRUD 模块需要挂回旧全局命名空间'
);

assert.match(
  source,
  /function openModal\(/,
  '订单 CRUD 模块需要包含弹窗打开逻辑'
);

assert.match(
  source,
  /function updateProductSelect\(/,
  '订单 CRUD 模块需要包含商品选择下拉渲染逻辑'
);

assert.match(
  source,
  /function updateSkuSelect\(/,
  '订单 CRUD 模块需要包含 SKU 选择下拉渲染逻辑'
);

assert.match(
  source,
  /function applyOrderSnapshot\(/,
  '订单 CRUD 模块需要在选择商品或 SKU 后自动带出快照字段'
);

assert.match(
  source,
  /function syncOrderSpecFromQuantity\(/,
  '订单 CRUD 模块需要根据数量联动重量和尺寸提示'
);

assert.match(
  source,
  /function renderOrderItems\(/,
  '订单 CRUD 模块需要支持多条订单明细行渲染'
);

assert.match(
  source,
  /async function deleteOrder\(/,
  '订单 CRUD 模块需要包含删除逻辑'
);

assert.match(
  source,
  /function bindEvents\(/,
  '订单 CRUD 模块需要包含表单事件绑定逻辑'
);

const crudModulePromise = import(pathToFileURL(esmPath).href);

(async () => {
const crudModule = await crudModulePromise;
const crudTools = crudModule.OrderTrackerCrud.create({
  state: {},
  constants: {
    ORDER_STATUS_OPTIONS: []
  },
  helpers: {
    $: () => null,
    uid: () => 'id',
    todayStr: () => '2026-04-19',
    addDays: () => '2026-04-25',
    computeWarning: () => ({ text: '-' }),
    normalizeOrderRecord: value => value,
    escapeHtml: value => String(value),
    normalizeStatusValue: value => String(value || '').trim(),
    detectCourierCompany: () => '',
    maybeAutoDetectCourierFromForm: () => '',
    getOrderFormCourierFields: () => ({}),
    showDatePicker: () => {}
  },
  ui: {
    getUniqueAccounts: () => [],
    promptAddAccount: async () => null,
    addAccount: () => false,
    markAccountsDirty: () => {},
    markOrderAccountsDirty: () => {},
    commitLocalOrders: async () => {},
    resetTablePage: () => {},
    toast: () => {}
  }
});

assert.equal(typeof crudTools.openModal, 'function', 'CRUD 模块需要返回 openModal');
assert.equal(typeof crudTools.closeModal, 'function', 'CRUD 模块需要返回 closeModal');
assert.equal(typeof crudTools.deleteOrder, 'function', 'CRUD 模块需要返回 deleteOrder');
assert.equal(typeof crudTools.bindEvents, 'function', 'CRUD 模块需要返回 bindEvents');
})().catch(error => {
  console.error(error);
  process.exit(1);
});

assert.match(
  indexSource,
  /crudFactory\.create\(/,
  '订单 ESM 入口需要通过 CRUD 工厂接入 CRUD 模块'
);

assert.match(
  indexSource,
  /import \{ OrderTrackerCrud \} from '\.\/crud\.mjs'/,
  '订单 ESM 入口需要直接导入 CRUD ESM helper'
);

assert.match(
  indexSource,
  /productsFactory\.create\([\s\S]*loadProductsForModal/,
  '订单模块需要通过商品桥接模块为 CRUD 提供商品资料'
);

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

assert.match(
  source,
  /function copyTrackingNumberFromRow\(/,
  '订单 CRUD 模块需要支持订单明细里的快递单号复制'
);

assert.match(
  source,
  /function rememberOrderItemDrafts\(/,
  '订单 CRUD 模块需要缓存订单明细草稿，避免异步刷新商品资料时丢失快递单号'
);

assert.match(
  source,
  /async function prepareProductsBeforeEditing\(/,
  '订单弹窗应在进入可编辑状态前准备商品资料，避免打开后后台刷新抢焦点'
);

assert.match(
  source,
  /async function openModal[\s\S]{0,220}await prepareProductsBeforeEditing\(\);/,
  '订单弹窗需要先准备商品资料再渲染订单明细'
);

assert.doesNotMatch(
  source,
  /function refreshProductsInOpenModal\(/,
  '订单弹窗打开后不应再启动后台商品资料刷新去触碰编辑区'
);

assert.doesNotMatch(
  source,
  /shouldDeferItemOptionRefresh|markOrderItemFieldInteraction|pointerdown[\s\S]{0,260}data-item-field/,
  '订单弹窗不应依赖延迟抢焦点补丁，应从流程上避免后台刷新编辑区'
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
  /<label>订单号 \*<\/label>[\s\S]*<Input name="订单号" required/,
  '订单号需要是必填字段'
);

assert.match(
  ordersPageSource,
  /<label>总重量\(g\)[\s\S]*id="ot-weight-hint"[\s\S]*<\/label>[\s\S]*name="重量"/,
  '订单弹窗需要展示多件重量自动折算提示'
);

assert.match(
  ordersPageSource,
  /function SearchableCombo\([\s\S]*data-role="trigger"[\s\S]*data-option-value/,
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
