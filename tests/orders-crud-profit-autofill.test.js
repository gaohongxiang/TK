const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'crud.js'), 'utf8');

const sandbox = {
  FormData: class FormData {
    constructor(target) {
      this.target = target;
    }

    entries() {
      return this.target.entries();
    }
  },
  localStorage: {
    getItem: () => JSON.stringify({ rateNew: 20 }),
    setItem: () => {}
  },
  window: {
    confirm: () => true,
    __tkGlobalSettingsStore: {
      getExchangeRate: () => 20
    }
  },
  document: {
    createElement: () => ({
      value: '',
      textContent: ''
    }),
    querySelector: selector => (selector === '#rateNew' ? { value: '20' } : null)
  }
};

vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTrackerCrud = OrderTrackerCrud;`, sandbox);

function makeField(initialValue = '') {
  const listeners = {};
  return {
    value: initialValue,
    dataset: {},
    readOnly: false,
    disabled: false,
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    trigger(type) {
      if (listeners[type]) listeners[type]();
    }
  };
}

const fields = {
  orderDate: makeField('2026-04-23'),
  purchaseDate: makeField('2026-04-23'),
  latestWarehouse: makeField(''),
  warning: makeField(''),
  quantity: makeField('2'),
  purchasePrice: makeField('19.8'),
  salePrice: makeField('600'),
  estimatedShippingFee: makeField('6.5'),
  estimatedProfit: makeField(''),
  orderStatus: makeField('未采购'),
  company: makeField(''),
  tracking: makeField('')
};

fields.latestWarehouse.readOnly = true;
fields.warning.readOnly = true;
fields.estimatedProfit.readOnly = true;

const form = {
  onsubmit: null,
  reset: () => {},
  querySelector(selector) {
    if (selector === '[name="下单时间"]') return fields.orderDate;
    if (selector === '[name="采购日期"]') return fields.purchaseDate;
    if (selector === '[name="最晚到仓时间"]') return fields.latestWarehouse;
    if (selector === '[name="订单预警"]') return fields.warning;
    if (selector === '[name="数量"]') return fields.quantity;
    if (selector === '[name="采购价格"]') return fields.purchasePrice;
    if (selector === '[name="售价"]') return fields.salePrice;
    if (selector === '[name="预估运费"]') return fields.estimatedShippingFee;
    if (selector === '[name="预估利润"]') return fields.estimatedProfit;
    if (selector === '[name="订单状态"]') return fields.orderStatus;
    if (selector === '[name="快递公司"]') return fields.company;
    if (selector === '[name="快递单号"]') return fields.tracking;
    return null;
  },
  querySelectorAll() {
    return [];
  },
  entries() {
    return [
      ['账号', '账号A'],
      ['下单时间', fields.orderDate.value],
      ['采购日期', fields.purchaseDate.value],
      ['数量', fields.quantity.value],
      ['采购价格', fields.purchasePrice.value],
      ['售价', fields.salePrice.value],
      ['预估运费', fields.estimatedShippingFee.value],
      ['预估利润', fields.estimatedProfit.value],
      ['订单状态', fields.orderStatus.value],
      ['快递公司', fields.company.value],
      ['快递单号', fields.tracking.value]
    ][Symbol.iterator]();
  }
};

const dom = {
  '#ot-form': form,
  '#ot-modal': {
    classList: {
      add: () => {},
      remove: () => {}
    },
    addEventListener: () => {}
  },
  '#ot-cancel': null,
  '#ot-acc-select': null
};

const state = {
  orders: [],
  editingId: null,
  activeAccount: '__all__',
  accounts: ['账号A']
};

const crudTools = sandbox.OrderTrackerCrud.create({
  state,
  constants: {
    ORDER_STATUS_OPTIONS: ['未采购', '已采购', '在途', '已入仓']
  },
  helpers: {
    $: selector => dom[selector] || null,
    uid: () => 'new-order-id',
    nowIso: () => '2026-04-23T10:00:00.000Z',
    todayStr: () => '2026-04-23',
    addDays: () => '2026-04-29',
    computeWarning: () => ({ text: '-' }),
    getPricingExchangeRate: () => 20,
    normalizeOrderRecord: value => value,
    escapeHtml: value => String(value),
    normalizeStatusValue: value => String(value || '').trim(),
    detectCourierCompany: () => '',
    maybeAutoDetectCourierFromForm: () => '',
    getOrderFormCourierFields: () => ({ tracking: fields.tracking, company: fields.company }),
    showDatePicker: () => {}
  },
  ui: {
    getUniqueAccounts: () => state.accounts,
    promptAddAccount: async () => null,
    addAccount: () => false,
    markAccountsDirty: () => {},
    markOrderAccountsDirty: () => {},
    commitLocalOrders: async () => {},
    toast: () => {}
  }
});

crudTools.bindEvents();

fields.salePrice.trigger('input');
assert.equal(fields.estimatedProfit.value, '3.7', '输入日元售价、采购价、预估运费后应按汇率自动回填人民币利润');

fields.estimatedShippingFee.value = '7';
fields.estimatedShippingFee.trigger('change');
assert.equal(fields.estimatedProfit.value, '3.2', '修改预估运费后应实时更新人民币利润');

fields.estimatedShippingFee.value = '';
fields.estimatedShippingFee.trigger('change');
assert.equal(fields.estimatedProfit.value, '', '缺少任一金额字段时不应计算预估利润');

fields.estimatedShippingFee.value = '7';
fields.estimatedShippingFee.trigger('change');
assert.equal(fields.estimatedProfit.value, '3.2', '重新补齐金额字段后应恢复人民币利润计算');

(async () => {
  await form.onsubmit({
    preventDefault: () => {},
    target: form
  });

  assert.equal(state.orders[0]['预估利润'], '3.2', '保存订单时应按汇率折算后的人民币利润写入预估利润');
  console.log('orders crud profit autofill behavior ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
