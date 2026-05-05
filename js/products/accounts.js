/* ============================================================
 * 商品库：账号筛选与账号选择
 * ============================================================ */
const ProductLibraryAccounts = (function () {
  function fallbackEscapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
  }

  function normalizeAccountName(value) {
    return String(value || '').trim();
  }

  function toAccountSlot(value, unassignedSlot = '__unassigned__') {
    const normalized = normalizeAccountName(value);
    return normalized || unassignedSlot;
  }

  function uniqueAccounts(values = []) {
    const seen = new Set();
    const result = [];
    values.forEach(value => {
      const normalized = normalizeAccountName(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      result.push(normalized);
    });
    return result;
  }

  function create({ state, constants = {}, helpers = {}, ui = {} } = {}) {
    const $ = helpers.$ || (selector => document.querySelector(selector));
    const escapeHtml = helpers.escapeHtml || (value => (
      typeof TKHtml !== 'undefined' ? TKHtml.escape(value) : fallbackEscapeHtml(value)
    ));
    const unassignedSlot = constants.UNASSIGNED_ACCOUNT_SLOT || '__unassigned__';

    function getAllProductAccounts() {
      const set = new Set();
      (state.accounts || []).forEach(account => {
        const next = normalizeAccountName(account);
        if (next) set.add(next);
      });
      (state.products || []).forEach(product => {
        const next = normalizeAccountName(product?.accountName);
        if (next) set.add(next);
      });
      return [...set];
    }

    function populateAccountSelect(selected = '') {
      const select = $('#pl-account-select');
      if (!select) return;
      const accounts = getAllProductAccounts();
      const normalizedSelected = normalizeAccountName(selected);
      const defaultSelected = normalizedSelected && accounts.includes(normalizedSelected)
        ? normalizedSelected
        : (accounts[0] || '');
      select.innerHTML = `<option value="">- 请选择 -</option>${accounts.map(account => `
        <option value="${escapeHtml(account)}" ${account === defaultSelected ? 'selected' : ''}>${escapeHtml(account)}</option>
      `).join('')}`;
      if (defaultSelected) select.value = defaultSelected;
    }

    function renderAccountTabs() {
      const allContainer = $('#pl-acc-tabs-all');
      const scrollContainer = $('#pl-acc-tabs-scroll');
      if (!allContainer || !scrollContainer) return;
      const accounts = getAllProductAccounts();
      if (state.activeAccount !== '__all__' && (!state.activeAccount || !accounts.includes(state.activeAccount))) {
        state.activeAccount = '__all__';
      }

      const countMap = {};
      (state.products || []).forEach(product => {
        const account = normalizeAccountName(product?.accountName);
        if (account) countMap[account] = (countMap[account] || 0) + 1;
      });

      allContainer.innerHTML = `<span class="tab${state.activeAccount === '__all__' ? ' active' : ''}" data-pl-acc="__all__">
        全部<span class="tab-count">(${state.products.length})</span>
      </span>`;

      scrollContainer.innerHTML = accounts.length
        ? `<div class="ot-acc-tabs-scroll-inner">${accounts.map(account => `
          <span class="tab${account === state.activeAccount ? ' active' : ''}" data-pl-acc="${escapeHtml(account)}">
            ${escapeHtml(account)}<span class="tab-count">(${countMap[account] || 0})</span>
          </span>`).join('')}</div>`
        : '<div class="ot-acc-tabs-scroll-inner"><span class="ot-acc-empty">暂无账号，先去订单管理添加账号或在已有商品里关联账号</span></div>';

      [allContainer, scrollContainer].forEach(container => {
        container.querySelectorAll('.tab[data-pl-acc]').forEach(tab => {
          tab.addEventListener('click', () => {
            state.activeAccount = tab.dataset.plAcc || '__all__';
            state.currentPage = 1;
            if (typeof ui.rerender === 'function') ui.rerender();
          });
        });
      });
    }

    return {
      getAllProductAccounts,
      normalizeAccountName,
      populateAccountSelect,
      renderAccountTabs,
      toAccountSlot: value => toAccountSlot(value, unassignedSlot),
      uniqueAccounts
    };
  }

  return {
    create,
    normalizeAccountName,
    toAccountSlot,
    uniqueAccounts
  };
})();
