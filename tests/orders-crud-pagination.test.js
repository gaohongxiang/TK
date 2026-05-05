const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const formUtilsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'form-utils.js'), 'utf8');
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
vm.runInContext(`${formUtilsSource}\n${source}\nthis.OrderTrackerCrud = OrderTrackerCrud;`, sandbox);

const fields = {
  orderDate: { value: '2026-04-20', addEventListener: () => {} },
  orderStatus: { value: '未采购', addEventListener: () => {} }
};

const form = {
  onsubmit: null,
  reset: () => {},
  querySelector(selector) {
    if (selector === '[name="下单时间"]') return fields.orderDate;
    if (selector === '[name="订单状态"]') return fields.orderStatus;
    return null;
  },
  querySelectorAll() {
    return [];
  },
  entries() {
    return [
      ['账号', '账号A'],
      ['下单时间', '2026-04-20'],
      ['采购日期', '2026-04-20'],
      ['订单号', 'ORDER-3'],
      ['产品名称', '测试产品'],
      ['快递公司', ''],
      ['快递单号', ''],
      ['订单状态', '未采购']
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

let resetCalls = 0;
let commitCalls = 0;

const state = {
  orders: [],
  currentPage: 3,
  editingId: null,
  activeAccount: '__all__',
  accounts: ['账号A']
};

const crudTools = sandbox.OrderTrackerCrud.create({
  state,
  constants: {
    ORDER_STATUS_OPTIONS: []
  },
  helpers: {
    $: selector => dom[selector] || null,
    uid: () => 'new-order-id',
    todayStr: () => '2026-04-20',
    addDays: () => '2026-04-26',
    computeWarning: () => ({ text: '-' }),
    normalizeOrderRecord: value => value,
    escapeHtml: value => String(value),
    normalizeStatusValue: value => String(value || '').trim(),
    detectCourierCompany: () => '',
    maybeAutoDetectCourierFromForm: () => {},
    getOrderFormCourierFields: () => ({}),
    showDatePicker: () => {}
  },
  ui: {
    getUniqueAccounts: () => state.accounts,
    promptAddAccount: async () => null,
    addAccount: () => false,
    markAccountsDirty: () => {},
    markOrderAccountsDirty: () => {},
    commitLocalOrders: async () => {
      commitCalls += 1;
    },
    resetTablePage: () => {
      resetCalls += 1;
      state.currentPage = 1;
    },
    toast: () => {}
  }
});

crudTools.bindEvents();

(async () => {
  await form.onsubmit({
    preventDefault: () => {},
    target: form
  });

  assert.equal(state.orders.length, 1, '新增订单后应写入 state.orders');
  assert.equal(state.currentPage, 3, '新增订单后应保留当前分页');
  assert.equal(resetCalls, 0, '新增订单后不应重置分页');
  assert.equal(commitCalls, 1, '新增订单后应提交本地保存');

  console.log('orders crud pagination behavior ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
