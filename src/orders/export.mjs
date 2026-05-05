import {
  computeOrderCreatorCommission,
  computeOrderEstimatedProfit,
  computeWarning,
  todayStr
} from './shared.mjs';

const DEFAULT_CONSTANTS = {
  UNASSIGNED_ACCOUNT_SLOT: '__unassigned__'
};

const CSV_HEADERS = [
  '账号',
  '下单时间',
  '采购日期',
  '最晚到仓时间',
  '订单预警',
  '订单号',
  '产品名称',
  '数量',
  '采购价格',
  '售价(日元)',
  '达人佣金率(%)',
  '达人佣金(人民币)',
  '预估运费(人民币)',
  '预估利润(人民币)',
  '重量',
  '尺寸',
  '订单状态',
  '快递公司',
  '快递单号'
];

function normalizeAccountName(account) {
  return String(account || '').trim();
}

function uniqueAccounts(accounts) {
  return [...new Set((accounts || []).map(normalizeAccountName).filter(Boolean))];
}

function toAccountSlot(account, constants = DEFAULT_CONSTANTS) {
  const normalized = normalizeAccountName(account);
  return normalized || constants.UNASSIGNED_ACCOUNT_SLOT;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function getExportAccountOptions({
  accounts = [],
  orders = [],
  constants = DEFAULT_CONSTANTS
} = {}) {
  const safeConstants = { ...DEFAULT_CONSTANTS, ...(constants || {}) };
  const safeOrders = Array.isArray(orders) ? orders : [];
  const accountOptions = uniqueAccounts([
    ...(Array.isArray(accounts) ? accounts : []),
    ...safeOrders.map(order => order?.['账号'])
  ]).map(account => ({
    key: account,
    label: account,
    count: safeOrders.filter(order => normalizeAccountName(order?.['账号']) === account).length
  }));
  const unassignedCount = safeOrders.filter(order => !normalizeAccountName(order?.['账号'])).length;
  if (unassignedCount > 0) {
    accountOptions.push({
      key: safeConstants.UNASSIGNED_ACCOUNT_SLOT,
      label: '未关联',
      count: unassignedCount
    });
  }
  return accountOptions;
}

function buildExportFilename(selectedOptions, { today = todayStr } = {}) {
  const names = (selectedOptions || []).map(option => option.label).filter(Boolean);
  const suffix = names.length === 1
    ? names[0]
    : names.length > 1
      ? `${names[0]}等${names.length}个账号`
      : '空';
  return `订单数据导出_${suffix}_${today()}.csv`;
}

function selectOrdersForExport({
  orders = [],
  selectedKeys = [],
  constants = DEFAULT_CONSTANTS
} = {}) {
  const safeConstants = { ...DEFAULT_CONSTANTS, ...(constants || {}) };
  const selectedSet = new Set(selectedKeys || []);
  return (Array.isArray(orders) ? orders : []).filter(order => {
    const slot = toAccountSlot(order?.['账号'], safeConstants);
    return selectedSet.has(slot);
  });
}

function buildExportRows({
  orders = [],
  exchangeRate = null,
  computeWarningFn = computeWarning,
  computeOrderCreatorCommissionFn = computeOrderCreatorCommission,
  computeOrderEstimatedProfitFn = computeOrderEstimatedProfit
} = {}) {
  return (Array.isArray(orders) ? orders : []).map(order => {
    const warning = computeWarningFn(order).text;
    const creatorCommission = typeof computeOrderCreatorCommissionFn === 'function'
      ? computeOrderCreatorCommissionFn(order, exchangeRate)
      : order?.['达人佣金'];
    const estimatedProfit = typeof computeOrderEstimatedProfitFn === 'function'
      ? computeOrderEstimatedProfitFn(order, exchangeRate)
      : order?.['预估利润'];
    return [
      order?.['账号'] || '',
      order?.['下单时间'] || '',
      order?.['采购日期'] || '',
      order?.['最晚到仓时间'] || '',
      warning,
      order?.['订单号'] || '',
      order?.['产品名称'] || '',
      order?.['数量'] || '',
      order?.['采购价格'] || '',
      order?.['售价'] || '',
      order?.['达人佣金率'] || '',
      creatorCommission ?? '',
      order?.['预估运费'] || '',
      estimatedProfit ?? '',
      order?.['重量'] || '',
      order?.['尺寸'] || '',
      order?.['订单状态'] || '',
      order?.['快递公司'] || '',
      order?.['快递单号'] || ''
    ];
  });
}

function buildOrdersCsv({
  rows = [],
  headers = CSV_HEADERS,
  includeBom = false
} = {}) {
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
  return includeBom ? `\uFEFF${csv}` : csv;
}

function create({
  state = {},
  constants = {},
  helpers = {},
  ui = {},
  document: rootDocument = globalThis.document,
  URL: rootURL = globalThis.URL,
  Blob: RootBlob = globalThis.Blob
} = {}) {
  const safeConstants = { ...DEFAULT_CONSTANTS, ...(constants || {}) };
  const normalizeAccountNameFn = helpers.normalizeAccountName || normalizeAccountName;
  const uniqueAccountsFn = helpers.uniqueAccounts || uniqueAccounts;
  const toAccountSlotFn = helpers.toAccountSlot || (account => toAccountSlot(account, safeConstants));
  const todayStrFn = helpers.todayStr || todayStr;
  const computeWarningFn = helpers.computeWarning || computeWarning;
  const getPricingExchangeRate = helpers.getPricingExchangeRate;
  const computeOrderCreatorCommissionFn = helpers.computeOrderCreatorCommission || computeOrderCreatorCommission;
  const computeOrderEstimatedProfitFn = helpers.computeOrderEstimatedProfit || computeOrderEstimatedProfit;
  const escapeHtml = helpers.escapeHtml || (value => String(value ?? ''));
  const toast = ui.toast || (() => {});

  function getScopedExportAccountOptions() {
    const accounts = uniqueAccountsFn([
      ...(state.accounts || []),
      ...(state.orders || []).map(order => order?.['账号'])
    ]);
    const options = accounts.map(account => ({
      key: account,
      label: account,
      count: state.orders.filter(order => normalizeAccountNameFn(order?.['账号']) === account).length
    }));
    const unassignedCount = state.orders.filter(order => !normalizeAccountNameFn(order?.['账号'])).length;
    if (unassignedCount > 0) {
      options.push({
        key: safeConstants.UNASSIGNED_ACCOUNT_SLOT,
        label: '未关联',
        count: unassignedCount
      });
    }
    return options;
  }

  function buildScopedExportFilename(selectedOptions) {
    return buildExportFilename(selectedOptions, { today: todayStrFn });
  }

  function promptExportAccounts() {
    return new Promise(resolve => {
      const options = getScopedExportAccountOptions();
      const modal = rootDocument?.querySelector?.('#ot-export-modal');
      const list = rootDocument?.querySelector?.('#ot-export-options');
      const allCheckbox = rootDocument?.querySelector?.('#ot-export-all');
      const cancelBtn = rootDocument?.querySelector?.('#ot-export-cancel');
      const confirmBtn = rootDocument?.querySelector?.('#ot-export-confirm');

      if (!options.length || !modal || !list || !allCheckbox || !cancelBtn || !confirmBtn) {
        resolve(null);
        return;
      }

      const defaultSelectedKeys = state.activeAccount && state.activeAccount !== '__all__'
        ? [state.activeAccount]
        : options.map(option => option.key);

      list.innerHTML = options.map(option => `
          <label class="ot-export-option">
            <span class="ot-export-option-main">
              <input type="checkbox" class="ot-export-checkbox" value="${escapeHtml(option.key)}" ${defaultSelectedKeys.includes(option.key) ? 'checked' : ''}>
              <span class="ot-export-option-name">${escapeHtml(option.label)}</span>
            </span>
            <span class="ot-export-option-count">${option.count} 条</span>
          </label>
        `).join('');

      const checkboxes = [...list.querySelectorAll('.ot-export-checkbox')];
      const syncAllState = () => {
        allCheckbox.checked = checkboxes.length > 0 && checkboxes.every(checkbox => checkbox.checked);
      };
      syncAllState();

      function cleanup(result) {
        modal.classList.remove('show');
        allCheckbox.checked = false;
        allCheckbox.onchange = null;
        cancelBtn.onclick = null;
        confirmBtn.onclick = null;
        modal.onclick = null;
        checkboxes.forEach(checkbox => {
          checkbox.onchange = null;
        });
        resolve(result);
      }

      allCheckbox.onchange = () => {
        checkboxes.forEach(checkbox => {
          checkbox.checked = allCheckbox.checked;
        });
      };
      checkboxes.forEach(checkbox => {
        checkbox.onchange = syncAllState;
      });

      cancelBtn.onclick = () => cleanup(null);
      confirmBtn.onclick = () => {
        const selectedKeys = checkboxes.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
        if (!selectedKeys.length) {
          toast('请至少选择一个账号', 'error');
          return;
        }
        cleanup(selectedKeys);
      };
      modal.onclick = event => {
        if (event.target.id === 'ot-export-modal') cleanup(null);
      };

      modal.classList.add('show');
      confirmBtn.focus();
    });
  }

  async function exportOrdersCsv() {
    if (!state.orders.length) {
      toast('当前没有可导出的订单数据', 'error');
      return;
    }
    const selectedKeys = await promptExportAccounts();
    if (!selectedKeys || !selectedKeys.length) return;

    const selectedSet = new Set(selectedKeys);
    const options = getScopedExportAccountOptions();
    const selectedOptions = options.filter(option => selectedSet.has(option.key));
    const rowsSource = state.orders.filter(order => {
      const slot = toAccountSlotFn(order?.['账号']);
      return selectedSet.has(slot);
    });
    if (!rowsSource.length) {
      toast('当前选择下没有可导出的订单数据', 'error');
      return;
    }

    const exchangeRate = typeof getPricingExchangeRate === 'function' ? getPricingExchangeRate() : null;
    const rows = buildExportRows({
      orders: rowsSource,
      exchangeRate,
      computeWarningFn,
      computeOrderCreatorCommissionFn,
      computeOrderEstimatedProfitFn
    });
    const csv = buildOrdersCsv({ rows, includeBom: true });
    const blob = new RootBlob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = buildScopedExportFilename(selectedOptions);
    const url = rootURL.createObjectURL(blob);
    const link = rootDocument.createElement('a');
    link.href = url;
    link.download = filename;
    rootDocument.body.appendChild(link);
    link.click();
    link.remove();
    rootURL.revokeObjectURL(url);
    toast('CSV 已开始导出', 'ok');
  }

  return {
    buildExportFilename: buildScopedExportFilename,
    exportOrdersCsv,
    getExportAccountOptions: getScopedExportAccountOptions
  };
}

const OrderTrackerExport = {
  create
};

if (typeof window !== 'undefined') {
  window.OrderTrackerExport = OrderTrackerExport;
}

export {
  OrderTrackerExport,
  CSV_HEADERS,
  buildExportFilename,
  buildExportRows,
  buildOrdersCsv,
  create,
  csvEscape,
  getExportAccountOptions,
  selectOrdersForExport
};
