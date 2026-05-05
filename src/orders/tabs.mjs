import {
  escapeHtml,
  normalizeAccountName
} from './shared.mjs';

const ALL_ACCOUNT = '__all__';

function getUniqueAccounts({ orders = [], accounts = [] } = {}) {
  const set = new Set();
  (Array.isArray(orders) ? orders : []).forEach(order => {
    const account = normalizeAccountName(order?.['账号']);
    if (account) set.add(account);
  });
  (Array.isArray(accounts) ? accounts : []).forEach(account => {
    const normalized = normalizeAccountName(account);
    if (normalized) set.add(normalized);
  });
  return [...set];
}

function buildAccountCountMap(orders = []) {
  const countMap = {};
  (Array.isArray(orders) ? orders : []).forEach(order => {
    const account = normalizeAccountName(order?.['账号']);
    if (account) countMap[account] = (countMap[account] || 0) + 1;
  });
  return countMap;
}

function resolveActiveAccount(activeAccount, accounts = []) {
  if (activeAccount !== ALL_ACCOUNT && (!activeAccount || !accounts.includes(activeAccount))) {
    return ALL_ACCOUNT;
  }
  return activeAccount;
}

function buildAllAccountTabMarkup({
  activeAccount = ALL_ACCOUNT,
  orderCount = 0
} = {}) {
  const allActive = activeAccount === ALL_ACCOUNT;
  return `<span class="tab${allActive ? ' active' : ''}" data-tab-acc="__all__">
        全部<span class="tab-count">(${orderCount})</span>
      </span>`;
}

function buildAccountTabMarkup({
  account,
  activeAccount = ALL_ACCOUNT,
  count = 0
} = {}) {
  const isActive = account === activeAccount;
  return `<span class="tab${isActive ? ' active' : ''}" data-tab-acc="${escapeHtml(account)}">
            ${escapeHtml(account)}<span class="tab-count">(${count})</span>
            <div class="tab-actions">
              <span class="t-btn tab-edit" data-tab-edit="${escapeHtml(account)}" title="重命名">✎</span>
              <span class="t-btn danger tab-del" data-tab-del="${escapeHtml(account)}" title="删除">×</span>
            </div>
          </span>`;
}

function buildAccountTabsMarkup({
  accounts = [],
  activeAccount = ALL_ACCOUNT,
  countMap = {}
} = {}) {
  if (!accounts.length) {
    return '<div class="ot-acc-tabs-scroll-inner"><span class="ot-acc-empty">暂无账号，点右侧账号区末尾的 + 可添加</span><button class="tab-add" id="ot-tab-add" title="添加账号">+</button></div>';
  }
  return `<div class="ot-acc-tabs-scroll-inner">${accounts.map(account => buildAccountTabMarkup({
    account,
    activeAccount,
    count: countMap[account] || 0
  })).join('')}<button class="tab-add" id="ot-tab-add" title="添加账号">+</button></div>`;
}

function getDeleteAccountMessage(account, orderCount = 0) {
  return orderCount > 0
    ? `确定删除账号「${account}」？\n该账号下的 ${orderCount} 条订单数据将变为未关联（落入“全部”中）。`
    : `确定删除账号「${account}」？`;
}

function create({ state = {}, helpers = {}, ui = {}, window: rootWindow = globalThis.window } = {}) {
  const escapeHtmlFn = helpers.escapeHtml || escapeHtml;
  const normalizeAccountNameFn = helpers.normalizeAccountName || normalizeAccountName;
  const {
    getContainer,
    promptAddAccount,
    saveAccounts = () => {},
    addAccount = () => false,
    removeAccount = () => false,
    markAccountsDirty = () => {},
    markOrderAccountsDirty = () => {},
    commitLocalOrders = async () => {},
    resetTablePage = () => {},
    renderTable = () => {},
    toast = () => {}
  } = ui;

  function getScopedUniqueAccounts() {
    const set = new Set();
    (state.orders || []).forEach(order => {
      const account = normalizeAccountNameFn(order?.['账号']);
      if (account) set.add(account);
    });
    (state.accounts || []).forEach(account => {
      const normalized = normalizeAccountNameFn(account);
      if (normalized) set.add(normalized);
    });
    return [...set];
  }

  function renderAccTabs() {
    const container = typeof getContainer === 'function' ? getContainer() : null;
    if (!container) return;
    const allContainer = container.querySelector('#ot-acc-tabs-all');
    const scrollContainer = container.querySelector('#ot-acc-tabs-scroll');
    if (!allContainer || !scrollContainer) return;
    const accounts = getScopedUniqueAccounts();

    state.activeAccount = resolveActiveAccount(state.activeAccount, accounts);

    const countMap = {};
    (state.orders || []).forEach(order => {
      const account = normalizeAccountNameFn(order?.['账号']);
      if (account) countMap[account] = (countMap[account] || 0) + 1;
    });

    allContainer.innerHTML = buildAllAccountTabMarkup({
      activeAccount: state.activeAccount,
      orderCount: state.orders.length
    });

    if (!accounts.length) {
      scrollContainer.innerHTML = '<div class="ot-acc-tabs-scroll-inner"><span class="ot-acc-empty">暂无账号，点右侧账号区末尾的 + 可添加</span><button class="tab-add" id="ot-tab-add" title="添加账号">+</button></div>';
    } else {
      scrollContainer.innerHTML = `<div class="ot-acc-tabs-scroll-inner">${accounts.map(account => {
        const isActive = account === state.activeAccount;
        const count = countMap[account] || 0;
        return `<span class="tab${isActive ? ' active' : ''}" data-tab-acc="${escapeHtmlFn(account)}">
            ${escapeHtmlFn(account)}<span class="tab-count">(${count})</span>
            <div class="tab-actions">
              <span class="t-btn tab-edit" data-tab-edit="${escapeHtmlFn(account)}" title="重命名">✎</span>
              <span class="t-btn danger tab-del" data-tab-del="${escapeHtmlFn(account)}" title="删除">×</span>
            </div>
          </span>`;
      }).join('')}<button class="tab-add" id="ot-tab-add" title="添加账号">+</button></div>`;
    }

    async function triggerRename(oldName) {
      const newName = await promptAddAccount(oldName, '重命名账号');
      if (!newName || newName === oldName) return;

      state.accounts = (state.accounts || []).map(account => account === oldName ? newName : account);
      saveAccounts();

      (state.orders || []).forEach(order => {
        if (normalizeAccountNameFn(order?.['账号']) === oldName) {
          order['账号'] = newName;
        }
      });

      if (state.activeAccount === oldName) state.activeAccount = newName;
      markAccountsDirty();
      markOrderAccountsDirty([oldName, newName]);
      await commitLocalOrders('账号已重命名，等待同步…');
      toast('已重命名账号', 'ok');
    }

    container.querySelectorAll('.tab[data-tab-acc]').forEach(tab => {
      tab.addEventListener('click', event => {
        if (event.target.closest('.tab-del') || event.target.closest('.tab-edit')) return;
        state.activeAccount = tab.dataset.tabAcc;
        resetTablePage();
        renderAccTabs();
        renderTable();
      });
      tab.addEventListener('dblclick', event => {
        if (event.target.closest('.tab-del') || event.target.closest('.tab-edit')) return;
        const targetAcc = tab.dataset.tabAcc;
        if (targetAcc === ALL_ACCOUNT) return;
        void triggerRename(targetAcc);
      });
    });

    container.querySelectorAll('.tab-edit[data-tab-edit]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        void triggerRename(button.dataset.tabEdit);
      });
    });

    container.querySelectorAll('.tab-del[data-tab-del]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        const account = button.dataset.tabDel;
        const orderCount = (state.orders || []).filter(order => normalizeAccountNameFn(order?.['账号']) === account).length;
        if (!rootWindow?.confirm?.(getDeleteAccountMessage(account, orderCount))) return;

        (state.orders || []).forEach(order => {
          if (normalizeAccountNameFn(order?.['账号']) === account) {
            order['账号'] = '';
          }
        });

        if (removeAccount(account)) markAccountsDirty();
        if (state.activeAccount === account) state.activeAccount = ALL_ACCOUNT;
        resetTablePage();
        markOrderAccountsDirty([account, '']);
        void commitLocalOrders('账号标记已更新，等待同步…');
        toast('已删除该账号标记', 'ok');
      });
    });

    const nextAddBtn = container.querySelector('#ot-tab-add');
    if (!nextAddBtn) return;

    nextAddBtn.onclick = async () => {
      const name = await promptAddAccount();
      if (!name) return;
      if (addAccount(name)) {
        markAccountsDirty();
        void commitLocalOrders('账号已添加，等待同步…');
      }
      state.activeAccount = name;
      resetTablePage();
      renderAccTabs();
      renderTable();
    };
  }

  return {
    getUniqueAccounts: getScopedUniqueAccounts,
    renderAccTabs
  };
}

const OrderTrackerTabs = {
  create
};

export {
  OrderTrackerTabs,
  ALL_ACCOUNT,
  buildAccountCountMap,
  buildAccountTabMarkup,
  buildAccountTabsMarkup,
  buildAllAccountTabMarkup,
  create,
  getDeleteAccountMessage,
  getUniqueAccounts,
  resolveActiveAccount
};

