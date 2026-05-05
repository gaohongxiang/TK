const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const formUtilsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'form-utils.js'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'crud.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'index.js'), 'utf8');
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
  /OrderTrackerCrud\.create\(/,
  'js/orders/index.js 需要通过 OrderTrackerCrud.create 接入 CRUD 模块'
);

assert.match(
  indexSource,
  /OrderTrackerProducts\.create\([\s\S]*loadProductsForModal/,
  '订单模块需要通过商品桥接模块为 CRUD 提供商品资料'
);

assert.match(
  htmlSource,
  /<script src="js\/orders\/table\.js" defer><\/script>\s*<script src="js\/orders\/sync\.js" defer><\/script>\s*<script src="js\/orders\/export\.js" defer><\/script>\s*<script src="js\/orders\/tabs\.js" defer><\/script>\s*<script src="js\/orders\/form-utils\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>\s*<script src="js\/orders\/session\.js" defer><\/script>\s*<script src="js\/orders\/shared\.js" defer><\/script>\s*<script src="js\/orders\/products\.js" defer><\/script>\s*<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 需要在 index.js 前先加载 form-utils.js、crud.js、session.js、shared.js、products.js'
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
  htmlSource,
  /<script src="js\/searchable-select\.js" defer><\/script>/,
  '页面需要预先加载共用的可搜索下拉组件'
);

console.log('orders crud module contract ok');
