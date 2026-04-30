/* ============================================================
 * 模块 3：商品库（Firebase Firestore）
 * ============================================================ */
const ProductLibrary = (function () {
  const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
  const UNASSIGNED_ACCOUNT_SLOT = '__unassigned__';
  const state = {
    firestoreConfigText: '',
    firestoreProjectId: '',
    user: '',
    accounts: [],
    activeAccount: '__all__',
    products: [],
    expandedTkIds: {},
    searchQuery: '',
    sortOrder: 'asc',
    pageSize: 50,
    currentPage: 1,
    editingTkId: '',
    loaded: false
  };

  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
  const provider = ProductLibraryProviderFirestore.create({
    state,
    helpers: {
      nowIso: () => new Date().toISOString()
    }
  });

  function toast(msg, type = 'ok') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2500);
  }

  function setStatus(text, cls = '') {
    const el = $('#pl-sync');
    if (!el) return;
    el.textContent = text;
    el.className = 'sync ' + cls;
  }

  function formatFirestoreError(error, fallback = '商品管理操作失败') {
    const code = String(error?.code || '').trim();
    const message = String(error?.message || '').trim();
    if (code.includes('permission-denied') || /Missing or insufficient permissions/i.test(message)) {
      const next = '当前 Firebase 项目的 Firestore 规则还没放行 products 集合。请打开 Firebase Console → Firestore Database → Rules，重新复制并发布最新规则。';
      window.TKFirestoreConnection?.notifyRulesUpdateNeeded?.(next);
      return next;
    }
    return message || fallback;
  }

  function getGlobalConfig() {
    return window.TKFirestoreConnection?.getConfig?.() || null;
  }

  function getPricingContext() {
    return window.__tkGlobalSettingsStore?.getPricingContext?.() || {
      rate: null,
      shippingMultiplier: 1.1,
      labelFee: 1.2
    };
  }

  async function copyLink(link) {
    const text = String(link || '').trim();
    if (!text) {
      toast('没有可复制的链接', 'error');
      return;
    }
    try {
      if (window.TKFirestoreConnection?.copyText) {
        await window.TKFirestoreConnection.copyText(text);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('浏览器未允许复制');
      }
      toast('链接已复制', 'ok');
    } catch (error) {
      toast(error?.message || '复制失败', 'error');
    }
  }

  function csvEscape(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function normalizeAccountName(value) {
    return String(value || '').trim();
  }

  function getDisplayedProducts({ activeAccount = state.activeAccount } = {}) {
    return ProductLibraryTableView?.deriveDisplayedProducts?.({
      products: state.products,
      activeAccount,
      searchQuery: state.searchQuery,
      sortOrder: state.sortOrder
    }) || [];
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

  function getProductDefaults(product = {}) {
    return product?.defaults && typeof product.defaults === 'object'
      ? product.defaults
      : product;
  }

  function getProductSkus(product = {}) {
    return Array.isArray(product?.skus)
      ? product.skus.filter(sku => String(sku?.skuId || sku?.skuName || '').trim())
      : [];
  }

  function skuUsesProductDefaults(sku = {}) {
    if (sku?.useProductDefaults === true) return true;
    if (sku?.useProductDefaults === false) return false;
    const hasOwnSpec = !!String(sku?.weightG || '').trim()
      || !!String(sku?.sizeText || '').trim()
      || !!String(sku?.lengthCm || '').trim()
      || !!String(sku?.widthCm || '').trim()
      || !!String(sku?.heightCm || '').trim()
      || !!String(sku?.estimatedShippingFee || '').trim();
    return !hasOwnSpec;
  }

  function toNumber(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatSizeText(record = {}) {
    const direct = String(record?.sizeText || '').trim();
    if (direct) return direct.replace(/\*/g, '×');
    const values = [record?.lengthCm, record?.widthCm, record?.heightCm]
      .map(toNumber)
      .filter(value => value !== null);
    return values.length === 3 ? values.join('×') : '';
  }

  function mergeProductSku(product = {}, sku = {}) {
    const defaults = getProductDefaults(product);
    if (!skuUsesProductDefaults(sku)) return sku;
    return {
      ...defaults,
      ...sku,
      weightG: sku?.weightG || defaults?.weightG || '',
      lengthCm: sku?.lengthCm || defaults?.lengthCm || '',
      widthCm: sku?.widthCm || defaults?.widthCm || '',
      heightCm: sku?.heightCm || defaults?.heightCm || '',
      estimatedShippingFee: sku?.estimatedShippingFee || defaults?.estimatedShippingFee || '',
      sizeText: sku?.sizeText || defaults?.sizeText || ''
    };
  }

  function toAccountSlot(value) {
    const normalized = normalizeAccountName(value);
    return normalized || UNASSIGNED_ACCOUNT_SLOT;
  }

  function getProductExportAccountOptions() {
    const products = getDisplayedProducts({ activeAccount: '__all__' });
    const accounts = uniqueAccounts([
      ...(state.accounts || []),
      ...products.map(product => product?.accountName)
    ]);
    const options = accounts.map(account => ({
      key: account,
      label: account,
      count: products.filter(product => normalizeAccountName(product?.accountName) === account).length
    }));
    const unassignedCount = products.filter(product => !normalizeAccountName(product?.accountName)).length;
    if (unassignedCount > 0) {
      options.push({
        key: UNASSIGNED_ACCOUNT_SLOT,
        label: '未关联',
        count: unassignedCount
      });
    }
    return options;
  }

  function buildProductExportFilename(selectedOptions) {
    const names = (selectedOptions || []).map(option => option.label).filter(Boolean);
    const suffix = names.length === 1
      ? names[0]
      : names.length > 1
        ? `${names[0]}等${names.length}个账号`
        : '空';
    return `商品数据导出_${suffix}_${todayStr()}.csv`;
  }

  function promptProductExportAccounts() {
    return new Promise(resolve => {
      const options = getProductExportAccountOptions();
      const modal = document.querySelector('#pl-export-modal');
      const list = document.querySelector('#pl-export-options');
      const allCheckbox = document.querySelector('#pl-export-all');
      const cancelBtn = document.querySelector('#pl-export-cancel');
      const confirmBtn = document.querySelector('#pl-export-confirm');

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
            <input type="checkbox" class="pl-export-checkbox" value="${escapeHtml(option.key)}" ${defaultSelectedKeys.includes(option.key) ? 'checked' : ''}>
            <span class="ot-export-option-name">${escapeHtml(option.label)}</span>
          </span>
          <span class="ot-export-option-count">${option.count} 个商品</span>
        </label>
      `).join('');

      const checkboxes = [...list.querySelectorAll('.pl-export-checkbox')];
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
        if (event.target?.id === 'pl-export-modal') cleanup(null);
      };

      modal.classList.add('show');
      confirmBtn.focus();
    });
  }

  function buildProductExportRows(selectedSet) {
    const products = getDisplayedProducts({ activeAccount: '__all__' })
      .filter(product => selectedSet.has(toAccountSlot(product?.accountName)));
    return products.flatMap(product => {
      const defaults = getProductDefaults(product);
      const skus = getProductSkus(product);
      const base = [
        product?.accountName || '',
        product?.tkId || '',
        product?.name || '',
        defaults?.cargoType === 'special' ? '特货' : '普货'
      ];
      if (!skus.length) {
        return [[
          ...base,
          '',
          '',
          defaults?.weightG || '',
          formatSizeText(defaults),
          defaults?.estimatedShippingFee || '',
          product?.link1688 || '',
          product?.imageUrl || '',
          product?.createdAt || '',
          product?.updatedAt || ''
        ]];
      }
      return skus.map(sku => {
        const record = mergeProductSku(product, sku);
        return [
          ...base,
          sku?.skuName || '',
          sku?.skuId || '',
          record?.weightG || '',
          formatSizeText(record),
          record?.estimatedShippingFee || '',
          product?.link1688 || '',
          product?.imageUrl || '',
          product?.createdAt || '',
          product?.updatedAt || ''
        ];
      });
    });
  }

  async function exportProductsCsv() {
    const selectedKeys = await promptProductExportAccounts();
    if (!selectedKeys || !selectedKeys.length) return;
    const selectedSet = new Set(selectedKeys);
    const selectedOptions = getProductExportAccountOptions().filter(option => selectedSet.has(option.key));
    const rows = buildProductExportRows(selectedSet);
    if (!rows.length) {
      toast('当前选择下没有可导出的商品数据', 'error');
      return;
    }
    const headers = ['账号', 'TK ID', '商品名称', '货物类型', 'SKU 名称', 'SKU ID', '重量(g)', '尺寸(cm)', '单件预估海外运费(元)', '1688 链接', '图片 URL', '创建时间', '更新时间'];
    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const filename = buildProductExportFilename(selectedOptions);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('CSV 已开始导出', 'ok');
  }

  function showDisconnected(show) {
    const disconnected = $('#pl-disconnected');
    const main = $('#pl-main');
    if (disconnected) disconnected.style.display = show ? '' : 'none';
    if (main) main.style.display = show ? 'none' : '';
  }

  async function loadProducts() {
    const result = await provider.pullProducts();
    state.products = result.products || [];
    state.accounts = Array.isArray(result.accounts) ? result.accounts : [];
    state.loaded = true;
    renderMain();
    setStatus(`已同步 · ${state.products.length} 个商品`, 'saved');
  }

  function getAllProductAccounts() {
    const set = new Set();
    (state.accounts || []).forEach(account => {
      const next = String(account || '').trim();
      if (next) set.add(next);
    });
    (state.products || []).forEach(product => {
      const next = String(product?.accountName || '').trim();
      if (next) set.add(next);
    });
    return [...set];
  }

  function populateAccountSelect(selected = '') {
    const select = $('#pl-account-select');
    if (!select) return;
    const accounts = getAllProductAccounts();
    const normalizedSelected = String(selected || '').trim();
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
      const account = String(product?.accountName || '').trim();
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
          renderMain();
        });
      });
    });
  }

  async function connectUsingGlobalConfig() {
    const cfg = getGlobalConfig();
    if (!cfg?.configText) {
      showDisconnected(true);
      return false;
    }
    setStatus('正在刷新云端数据…', 'saving');
    const next = await provider.init({ firestoreConfigText: cfg.configText });
    state.firestoreConfigText = next.configText;
    state.firestoreProjectId = next.projectId;
    state.user = next.user;
    showDisconnected(false);
    await loadProducts();
    return true;
  }

  function renderMain() {
    renderAccountTabs();
    const pageState = ProductLibraryTableView.render({
      toolbar: $('#pl-toolbar'),
      footerToolbar: $('#pl-table-footer-toolbar-container'),
      wrap: $('#pl-table-container'),
      products: state.products,
      activeAccount: state.activeAccount,
      searchQuery: state.searchQuery,
      sortOrder: state.sortOrder,
      pageSize: state.pageSize,
      currentPage: state.currentPage,
      expandedTkIds: state.expandedTkIds,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      onSearchChange: value => {
        state.searchQuery = value;
        state.currentPage = 1;
        renderMain();
      },
      onPageSizeChange: value => {
        state.pageSize = Math.max(1, Number(value) || 50);
        state.currentPage = 1;
        renderMain();
      },
      onPageChange: delta => {
        state.currentPage += delta;
        renderMain();
      },
      onSortToggle: () => {
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
        state.currentPage = 1;
        renderMain();
      },
      onToggleExpand: tkId => {
        const key = String(tkId || '').trim();
        if (!key) return;
        state.expandedTkIds = {
          ...state.expandedTkIds,
          [key]: !state.expandedTkIds[key]
        };
        renderMain();
      },
      onCopyLink: copyLink,
      onEdit: tkId => crud.openModal(tkId),
      onDelete: tkId => crud.deleteProduct(tkId)
    });
    state.currentPage = pageState?.currentPage || 1;
    const user = $('#pl-user');
    if (user) {
      user.textContent = state.firestoreProjectId
        ? `已连接 · ${provider.getDisplayName(state)}`
        : '已连接 · Firebase Firestore';
    }
    populateAccountSelect(state.activeAccount !== '__all__' ? state.activeAccount : '');
  }

  async function saveProduct(product) {
    return provider.upsertProduct(product);
  }

  async function deleteProduct(tkId) {
    return provider.deleteProduct(tkId);
  }

  const crud = ProductLibraryCrud.create({
    state,
    helpers: {
      $,
      nowIso: () => new Date().toISOString(),
      getPricingContext,
      shippingCore: typeof TKShippingCore !== 'undefined' ? TKShippingCore : null
    },
    ui: {
      saveProduct,
      deleteProduct,
      toast,
      rerender: renderMain,
      formatError: formatFirestoreError
    }
  });

  function bindDisconnected() {
    const button = $('#pl-open-connection');
    if (!button || button.dataset.bound === 'true') return;
    button.addEventListener('click', () => {
      window.TKFirestoreConnection?.open?.();
    });
    button.dataset.bound = 'true';
  }

  function bindMain() {
    const addBtn = $('#pl-add');
    const refreshBtn = $('#pl-refresh');
    const exportBtn = $('#pl-export');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.addEventListener('click', () => crud.openModal());
      addBtn.dataset.bound = 'true';
    }
    if (exportBtn && !exportBtn.dataset.bound) {
      exportBtn.addEventListener('click', exportProductsCsv);
      exportBtn.dataset.bound = 'true';
    }
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('is-spinning');
        refreshBtn.setAttribute('aria-busy', 'true');
        try {
          setStatus('正在刷新云端数据…', 'saving');
          await loadProducts();
        } catch (error) {
          toast(formatFirestoreError(error, '刷新失败'), 'error');
          setStatus('刷新失败', 'error');
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.classList.remove('is-spinning');
          refreshBtn.setAttribute('aria-busy', 'false');
        }
      });
      refreshBtn.dataset.bound = 'true';
    }
  }

  async function handleConnectionChange(event) {
    const connected = event?.detail?.connected !== false && !!getGlobalConfig()?.configText;
    state.loaded = false;
    state.firestoreConfigText = '';
    state.firestoreProjectId = '';
    state.user = '';
    state.accounts = [];
    state.activeAccount = '__all__';
    state.products = [];
    state.searchQuery = '';
    state.pageSize = 50;
    state.currentPage = 1;
    state.editingTkId = '';

    if (!connected) {
      showDisconnected(true);
      return;
    }

    try {
      await connectUsingGlobalConfig();
    } catch (error) {
      toast(formatFirestoreError(error, '连接商品管理失败'), 'error');
      showDisconnected(true);
    }
  }

  function bindConnectionListener() {
    if (bindConnectionListener.bound) return;
    window.addEventListener('tk-firestore-config-changed', handleConnectionChange);
    bindConnectionListener.bound = true;
  }

  function initIfNeeded() {
    bindDisconnected();
    bindMain();
    bindConnectionListener();
    crud.bindEvents();
    populateAccountSelect();
  }

  async function onEnter() {
    initIfNeeded();
    if (state.loaded) {
      showDisconnected(false);
      renderMain();
      return;
    }
    if (!getGlobalConfig()?.configText) {
      showDisconnected(true);
      return;
    }
    try {
      await connectUsingGlobalConfig();
    } catch (error) {
      toast(formatFirestoreError(error, '连接商品管理失败'), 'error');
      showDisconnected(true);
      setStatus('未连接', '');
    }
  }

  return {
    onEnter,
    formatFirestoreError
  };
})();
