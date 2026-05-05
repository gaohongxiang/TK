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
  const escapeHtml = value => (
    typeof TKHtml !== 'undefined'
      ? TKHtml.escape(value)
      : String(value ?? '').replace(/[&<>"']/g, char => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
      ))
  );
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

  function getProviderMeta() {
    return typeof TKDataSourceRegistry !== 'undefined'
      ? TKDataSourceRegistry.getProvider('products', provider.key)
      : null;
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

  function getDisplayedProducts({ activeAccount = state.activeAccount } = {}) {
    return ProductLibraryTableView?.deriveDisplayedProducts?.({
      products: state.products,
      activeAccount,
      searchQuery: state.searchQuery,
      sortOrder: state.sortOrder
    }) || [];
  }

  const accountTools = ProductLibraryAccounts.create({
    state,
    constants: { UNASSIGNED_ACCOUNT_SLOT },
    helpers: { $, escapeHtml },
    ui: {
      rerender: renderMain
    }
  });
  const { normalizeAccountName, populateAccountSelect, renderAccountTabs, toAccountSlot, uniqueAccounts } = accountTools;
  const exportTools = ProductLibraryExport.create({
    state,
    helpers: {
      escapeHtml,
      getDisplayedProducts,
      normalizeAccountName,
      toAccountSlot,
      uniqueAccounts
    },
    ui: { toast }
  });
  const { exportProductsCsv } = exportTools;

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
      const providerMeta = getProviderMeta();
      user.textContent = state.firestoreProjectId
        ? `已连接 · ${provider.getDisplayName(state)}`
        : `已连接 · ${providerMeta?.label || 'Firebase Firestore'}`;
    }
    populateAccountSelect(state.activeAccount !== '__all__' ? state.activeAccount : '');
  }

  async function saveProduct(product) {
    const result = await provider.upsertProduct(product, { waitForCommit: false });
    return result?.product || result;
  }

  async function deleteProduct(tkId) {
    return provider.deleteProduct(tkId, { waitForCommit: false });
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
