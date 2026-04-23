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
  window: {
    confirm: () => true
  },
  document: {
    createElement: () => ({
      value: '',
      textContent: ''
    })
  }
};

vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.OrderTrackerCrud = OrderTrackerCrud;`, sandbox);

function makeField(initialValue = '') {
  const listeners = {};
  return {
    value: initialValue,
    dataset: {},
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
  orderStatus: makeField('未采购'),
  tracking: makeField(''),
  company: makeField('')
};

const form = {
  onsubmit: null,
  reset: () => {},
  querySelector(selector) {
    if (selector === '[name="下单时间"]') return fields.orderDate;
    if (selector === '[name="订单状态"]') return fields.orderStatus;
    if (selector === '[name="快递单号"]') return fields.tracking;
    if (selector === '[name="快递公司"]') return fields.company;
    return null;
  },
  querySelectorAll() {
    return [];
  },
  entries() {
    return [
      ['账号', '账号A'],
      ['下单时间', '2026-04-23'],
      ['采购日期', '2026-04-23'],
      ['订单号', 'ORDER-1'],
      ['产品名称', '测试产品'],
      ['快递公司', fields.company.value],
      ['快递单号', fields.tracking.value],
      ['订单状态', fields.orderStatus.value]
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
    normalizeOrderRecord: value => value,
    escapeHtml: value => String(value),
    normalizeStatusValue: value => String(value || '').trim(),
    detectCourierCompany: () => '顺丰快递',
    maybeAutoDetectCourierFromForm: () => '顺丰快递',
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

fields.tracking.value = 'SF123456';
fields.orderStatus.value = '未采购';
state.editingId = null;
fields.tracking.trigger('input');

assert.equal(fields.orderStatus.value, '在途', '新增订单填入快递单号后应自动把状态改为在途');
assert.equal(fields.orderStatus.dataset.autoTrackingStatus, '在途', '自动改状态后应记录自动联动标记');

fields.orderStatus.value = '已入仓';
fields.orderStatus.trigger('change');
fields.tracking.value = 'SF987654';
fields.tracking.trigger('input');

assert.equal(fields.orderStatus.value, '已入仓', '手动改过状态后再次输入快递单号不应覆盖状态');
assert.equal(fields.orderStatus.dataset.autoTrackingStatus, '', '手动改状态后应清除自动联动标记');

state.editingId = 'existing-order-id';
fields.orderStatus.value = '未采购';
fields.tracking.value = 'SF222222';
fields.tracking.trigger('input');

assert.equal(fields.orderStatus.value, '未采购', '编辑已有订单时修改快递单号不应自动改状态');

(async () => {
  state.editingId = null;
  fields.orderStatus.value = '未采购';
  fields.tracking.value = 'SF333333';
  await form.onsubmit({
    preventDefault: () => {},
    target: form
  });

  assert.equal(state.orders[0]['订单状态'], '在途', '新增订单保存时也应兜底把带快递单号的状态写成在途');
  console.log('orders crud status autofill behavior ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
