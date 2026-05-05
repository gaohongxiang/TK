const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const { pathToFileURL } = require('url');

const formUtilsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'form-utils.js'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'crud.js'), 'utf8');
const esmPath = path.join(__dirname, '..', 'src', 'orders', 'crud.mjs');
const esmSource = fs.readFileSync(esmPath, 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders', 'index.mjs'), 'utf8');
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerCrud = \(function \(\) \{/,
  '需要新的订单 CRUD 模块'
);

assert.match(
  source,
  /function create\(/,
  '订单 CRUD 模块需要暴露 create 工厂'
);

assert.match(
  esmSource,
  /const OrderTrackerCrud = \{/,
  'ESM 订单 CRUD 工具模块需要保留 OrderTrackerCrud 命名导出'
);

assert.match(
  esmSource,
  /function buildItemProductOptions\(/,
  'ESM 订单 CRUD 工具模块需要包含商品选项纯函数'
);

assert.match(
  esmSource,
  /function deriveOrderItemSummaryFields\(/,
  'ESM 订单 CRUD 工具模块需要包含明细汇总纯函数'
);

assert.match(
  esmSource,
  /export \{[\s\S]*OrderTrackerCrud[\s\S]*buildItemProductOptions[\s\S]*deriveOrderItemSummaryFields[\s\S]*computeEstimatedProfitValue[\s\S]*\}/,
  'ESM 订单 CRUD 工具模块需要导出命名空间和关键纯函数'
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

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${formUtilsSource}\n${source}\nthis.OrderTrackerCrud = OrderTrackerCrud;`, sandbox);

const crudTools = sandbox.OrderTrackerCrud.create({
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

assert.match(
  indexSource,
  /crudFactory\.create\(/,
  '订单 ESM 入口需要通过 CRUD 工厂接入 CRUD 模块'
);

assert.match(
  indexSource,
  /productsFactory\.create\([\s\S]*loadProductsForModal/,
  '订单模块需要通过商品桥接模块为 CRUD 提供商品资料'
);

assert.match(
  htmlSource,
  /<script src="js\/orders\/table\.js" defer><\/script>\s*<script src="js\/orders\/sync\.js" defer><\/script>\s*<script src="js\/orders\/export\.js" defer><\/script>\s*<script src="js\/orders\/tabs\.js" defer><\/script>\s*<script src="js\/orders\/form-utils\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>\s*<script src="js\/orders\/session\.js" defer><\/script>\s*<script src="js\/orders\/shared\.js" defer><\/script>\s*<script src="js\/orders\/products\.js" defer><\/script>\s*<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  'index.html 需要在订单 ESM 入口前先加载 form-utils.js、crud.js、session.js、shared.js、products.js'
);

assert.match(
  htmlSource,
  /<section class="ot-item-block">[\s\S]*<h4>订单明细<\/h4>[\s\S]*id="ot-item-list"/,
  '订单弹窗需要提供订单明细区域'
);

assert.match(
  htmlSource,
  /<input type="hidden" name="商品TK ID" id="ot-product-select">[\s\S]*<input type="hidden" name="商品SKU ID" id="ot-sku-select">/,
  '订单弹窗需要保留聚合后的商品和 SKU 字段'
);

assert.match(
  htmlSource,
  /<button type="button" class="btn" id="ot-add-item-btn">.*添加明细.*<\/button>/,
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
  htmlSource,
  /一个 TK 订单可以包含多个商品和多个 SKU；每条订单明细对应一个商品的一个 SKU，数量表示该 SKU 的件数。多条订单明细还可以归属同一个 1688 采购单。/,
  '订单弹窗需要说明 TK 订单与订单明细、SKU 的对应关系'
);

assert.match(
  htmlSource,
  /<label>订单号 \*<\/label>[\s\S]*<input type="text" name="订单号" required>/,
  '订单号需要是必填字段'
);

assert.match(
  htmlSource,
  /<label>总重量\(g\)[\s\S]*id="ot-weight-hint"[\s\S]*<\/label>[\s\S]*name="重量"/,
  '订单弹窗需要展示多件重量自动折算提示'
);

assert.match(
  mainSource,
  /import '\.\/searchable-select\.mjs'/,
  'ESM 主入口需要预先加载共用的可搜索下拉组件'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/searchable-select\.js" defer><\/script>/,
  'index.html 不应再加载旧可搜索下拉组件普通脚本'
);

(async () => {
  const crudModule = await import(pathToFileURL(esmPath).href);
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
