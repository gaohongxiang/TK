/* ============================================================
 * 模块 2：订单跟踪器（GitHub Gist / Firebase Firestore）
 * ============================================================ */
const OrderTracker = (function () {
  const LS_KEY = 'tk.orders.cfg.v1';
  const LS_ACC_KEY = 'tk.orders.accounts.v1';
  const GIST_FILENAME = 'tk-order-tracker.json';
  const META_FILENAME = 'tk-order-tracker-meta.json';
  const ACCOUNT_FILE_PREFIX = 'tk-order-tracker__';
  const ACCOUNT_FILE_SUFFIX = '.json';
  const CACHE_DB_NAME = 'tk-toolbox-cache';
  const CACHE_STORE = 'order-tracker-sessions';
  const CACHE_VERSION = 1;
  const REMOTE_DATA_VERSION = 2;
  const SYNC_DEBOUNCE_MS = 700;
  const UNASSIGNED_ACCOUNT_SLOT = '__unassigned__';
  const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

  const state = {
    storageMode: 'firestore',
    remoteProvider: null,
    token: '',
    gistId: '',
    firestoreConfigText: '',
    firestoreProjectId: '',
    user: '',
    clientId: '',
    orders: [],
    editingId: null,
    loaded: false,
    accounts: [],
    activeAccount: null,
    sortOrder: 'asc',
    searchQuery: '',
    searchComposing: false,
    pageSize: 50,
    currentPage: 1,
    baseOrders: null,
    baseAccounts: [],
    dirty: false,
    dirtyAccounts: {},
    accountRemoteUpdatedAt: {},
    accountLastSyncedAt: {},
    accountLocalUpdatedAt: {},
    accountLocalRevisions: {},
    accountsDirty: false,
    accountsLocalUpdatedAt: '',
    accountsLastRemoteUpdatedAt: '',
    accountsLastSyncedAt: '',
    accountsRevision: 0,
    localUpdatedAt: '',
    lastRemoteUpdatedAt: '',
    lastSyncedAt: '',
    localRevision: 0,
    remoteCursor: ''
  };

  const ORDER_STATUS_OPTIONS = ['未采购', '已采购', '在途', '已入仓', '已送达', '已完成', '订单取消'];
  const COURIER_AUTO_DETECTORS = [
    { name: '顺丰快递', test: value => /^SF[0-9A-Z]+$/i.test(value) || /^SFP[0-9A-Z]+$/i.test(value) },
    { name: '极兔快递', test: value => /^JT[0-9A-Z]+$/i.test(value) },
    { name: '中通快递', test: value => /^ZTO[0-9A-Z]+$/i.test(value) },
    { name: '圆通快递', test: value => /^YTO[0-9A-Z]+$/i.test(value) },
    { name: '申通快递', test: value => /^STO[0-9A-Z]+$/i.test(value) },
    { name: '韵达快递', test: value => /^YD[0-9A-Z]+$/i.test(value) },
    { name: '安能物流', test: value => /^ANE[0-9A-Z]+$/i.test(value) },
    { name: '邮政快递', test: value => /^EMS[0-9A-Z]+$/i.test(value) || /^[A-Z]{2}\d{9}CN$/i.test(value) }
  ];
  const shared = OrderTrackerShared.create({
    state,
    constants: {
      UNASSIGNED_ACCOUNT_SLOT,
      ACCOUNT_FILE_PREFIX,
      ACCOUNT_FILE_SUFFIX,
      COURIER_AUTO_DETECTORS
    }
  });
  const {
    $,
    uid,
    nowIso,
    showDatePicker,
    escapeHtml,
    normalizeStatusValue,
    normalizeOrderRecord,
    normalizeOrderList,
    cloneOrder,
    getOrderUpdatedAt,
    ordersEqual,
    mergeOrdersById,
    mergeOrdersLastWriteWins,
    normalizeAccountName,
    toAccountSlot,
    fromAccountSlot,
    getAccountFileName,
    parseAccountSlotFromFileName,
    uniqueAccounts,
    listOrderAccounts,
    groupOrdersByAccountSlot,
    flattenOrdersByAccountSlot,
    detectCourierCompany,
    getOrderFormCourierFields,
    maybeAutoDetectCourierFromForm,
    todayStr,
    addDays,
    computeWarning
  } = shared;

  /* ---------- util ---------- */
  function toast(msg, type = 'ok') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2500);
  }
  function setSync(text, cls = '') {
    const el = $('#ot-sync');
    el.textContent = text;
    el.className = 'sync ' + cls;
  }
  function saveCfg() {
    state.clientId = state.clientId || uid();
    localStorage.setItem(LS_KEY, JSON.stringify({
      mode: state.storageMode || 'firestore',
      token: state.token,
      gistId: state.gistId,
      firestoreConfigText: state.firestoreConfigText,
      firestoreProjectId: state.firestoreProjectId,
      user: state.user,
      clientId: state.clientId
    }));
  }
  function loadCfg() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!raw) return null;
      return {
        mode: raw.mode === 'gist' ? 'gist' : 'firestore',
        token: raw.token || '',
        gistId: raw.gistId || '',
        firestoreConfigText: raw.firestoreConfigText || raw.firebaseConfig || '',
        firestoreProjectId: raw.firestoreProjectId || raw.projectId || '',
        user: raw.user || '',
        clientId: raw.clientId || uid()
      };
    } catch (e) {
      return null;
    }
  }
  function resetTablePage() {
    state.currentPage = 1;
  }
  function bindStorageHelpModal() {
    const trigger = $('#ot-storage-help-btn');
    const modal = $('#ot-storage-help-modal');
    const closeBtn = $('#ot-storage-help-close');
    if (!trigger || !modal || !closeBtn || trigger.dataset.bound === 'true') return;

    const close = () => modal.classList.remove('show');

    trigger.addEventListener('click', () => modal.classList.add('show'));
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', event => {
      if (event.target.id === 'ot-storage-help-modal') close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal.classList.contains('show')) close();
    });
    trigger.dataset.bound = 'true';
  }

  /* ---------- 账号历史记忆 ---------- */
  function loadAccounts() {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_ACC_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveAccounts() {
    localStorage.setItem(LS_ACC_KEY, JSON.stringify(state.accounts));
  }
  function addAccount(acc) {
    acc = (acc || '').trim();
    if (!acc) return false;
    const existed = state.accounts.includes(acc);
    // 去重 & 最近使用置顶
    state.accounts = [acc, ...state.accounts.filter(a => a !== acc)];
    if (state.accounts.length > 30) state.accounts = state.accounts.slice(0, 30);
    saveAccounts();
    return !existed;
  }
  function removeAccount(acc) {
    const existed = state.accounts.includes(acc);
    state.accounts = state.accounts.filter(a => a !== acc);
    saveAccounts();
    return existed;
  }

  const providerGist = OrderTrackerProviderGist.create({
    state,
    constants: {
      GIST_FILENAME,
      META_FILENAME,
      REMOTE_DATA_VERSION,
      UNASSIGNED_ACCOUNT_SLOT
    },
    helpers: {
      nowIso,
      normalizeOrderList,
      uniqueAccounts,
      listOrderAccounts,
      groupOrdersByAccountSlot,
      flattenOrdersByAccountSlot,
      toAccountSlot,
      fromAccountSlot,
      getAccountFileName,
      parseAccountSlotFromFileName
    }
  });
  const providerFirestore = OrderTrackerProviderFirestore.create({
    state,
    helpers: {
      nowIso,
      normalizeOrderList,
      uniqueAccounts
    }
  });
  function getProviderByMode(mode) {
    if (mode === 'firestore') return providerFirestore;
    return providerGist;
  }

  const sync = OrderTrackerSync.create({
    state,
    constants: {
      CACHE_DB_NAME,
      CACHE_STORE,
      CACHE_VERSION,
      SYNC_DEBOUNCE_MS
    },
    helpers: {
      nowIso,
      normalizeOrderList,
      cloneOrder,
      ordersEqual,
      getOrderUpdatedAt,
      mergeOrdersById,
      mergeOrdersLastWriteWins,
      uniqueAccounts,
      listOrderAccounts,
      groupOrdersByAccountSlot,
      toAccountSlot
    },
    ui: {
      setSync,
      toast,
      renderAccTabs: () => renderAccTabs(),
      renderTable,
      saveAccounts
    }
  });
  const {
    markAccountsDirty,
    markOrderAccountsDirty,
    resetTrackerState,
    hydrateCache,
    renderLocalOrders,
    queueSync,
    cancelPendingSync,
    syncNow,
    commitLocalOrders,
    setRemoteProvider
  } = sync;
  function promptAddAccount(initialValue = '', title = '添加新账号') {
    return new Promise(resolve => {
      const modal = $('#ot-add-acc-modal');
      const form = $('#ot-add-acc-form');
      const input = $('#ot-new-acc-input');

      modal.querySelector('h3').textContent = title;

      modal.classList.add('show');
      input.value = initialValue;
      input.focus();

      function cleanup() {
        form.onsubmit = null;
        $('#ot-add-acc-cancel').onclick = null;
        modal.classList.remove('show');
      }

      $('#ot-add-acc-cancel').onclick = () => {
        cleanup();
        resolve(null);
      };

      form.onsubmit = (e) => {
        e.preventDefault();
        const val = input.value.trim();
        if (!val) return;
        if (val !== initialValue && getUniqueAccounts().includes(val)) {
          toast('该账号已存在', 'error');
          return;
        }
        cleanup();
        resolve(val);
      };
    });
  }
  const tabsTools = OrderTrackerTabs.create({
    state,
    helpers: {
      escapeHtml,
      normalizeAccountName
    },
    ui: {
      getContainer: () => $('#ot-acc-tabs'),
      promptAddAccount,
      saveAccounts,
      addAccount,
      removeAccount,
      markAccountsDirty,
      markOrderAccountsDirty,
      commitLocalOrders,
      resetTablePage,
      renderTable,
      toast
    }
  });
  const { getUniqueAccounts, renderAccTabs } = tabsTools;
  const exportTools = OrderTrackerExport.create({
    state,
    constants: {
      UNASSIGNED_ACCOUNT_SLOT
    },
    helpers: {
      normalizeAccountName,
      uniqueAccounts,
      toAccountSlot,
      todayStr,
      computeWarning,
      escapeHtml
    },
    ui: {
      toast
    }
  });
  const { exportOrdersCsv } = exportTools;
  const crudTools = OrderTrackerCrud.create({
    state,
    constants: {
      ORDER_STATUS_OPTIONS
    },
    helpers: {
      $,
      uid,
      nowIso,
      todayStr,
      addDays,
      computeWarning,
      normalizeOrderRecord,
      escapeHtml,
      normalizeStatusValue,
      detectCourierCompany,
      maybeAutoDetectCourierFromForm,
      getOrderFormCourierFields,
      showDatePicker
    },
    ui: {
      getUniqueAccounts,
      promptAddAccount,
      addAccount,
      markAccountsDirty,
      markOrderAccountsDirty,
      commitLocalOrders,
      resetTablePage,
      toast
    }
  });
  const { openModal, deleteOrder, bindEvents: bindCrudEvents } = crudTools;
  const sessionTools = OrderTrackerSession.create({
    state,
    constants: {
      LS_KEY
    },
    helpers: {
      $,
      loadCfg,
      saveCfg,
      loadAccounts
    },
    ui: {
      toast,
      setSync,
      openModal,
      exportOrdersCsv,
      bindCrudEvents,
      renderAccTabs,
      renderTable
    },
    sync: {
      setRemoteProvider,
      hydrateCache,
      syncNow,
      resetTrackerState,
      renderLocalOrders,
      queueSync,
      cancelPendingSync
    },
    providers: {
      getProviderByMode
    }
  });
  const { init, onEnter } = sessionTools;

  /* ---------- 账号标签栏 ---------- */
  /* ---------- 渲染表格 ---------- */
  function renderTable() {
    const result = OrderTableView.render({
      summaryContainer: $('#ot-summary-container'),
      toolbar: $('#ot-table-toolbar-container'),
      footerToolbar: $('#ot-table-footer-toolbar-container'),
      wrap: $('#ot-table-container'),
      orders: state.orders,
      activeAccount: state.activeAccount,
      searchQuery: state.searchQuery,
      pageSize: state.pageSize,
      currentPage: state.currentPage,
      sortOrder: state.sortOrder,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      computeWarning,
      getSearchComposing: () => state.searchComposing,
      onSearchCompositionStart: () => {
        state.searchComposing = true;
      },
      onSearchCompositionEnd: value => {
        state.searchComposing = false;
        state.searchQuery = value;
        resetTablePage();
        renderTable();
      },
      onSearchChange: value => {
        state.searchQuery = value;
        resetTablePage();
        renderTable();
      },
      onPageSizeChange: value => {
        state.pageSize = Math.max(1, parseInt(value, 10) || 50);
        resetTablePage();
        renderTable();
      },
      onPageChange: delta => {
        state.currentPage += delta;
        renderTable();
      },
      onSortToggle: () => {
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
        resetTablePage();
        renderTable();
      },
      onEdit: id => openModal(id),
      onDelete: id => deleteOrder(id)
    });
    if (result && result.currentPage !== state.currentPage) {
      state.currentPage = result.currentPage;
    }
  }

  function copyText(text) {
    if (!text) return Promise.reject(new Error('没有可复制的内容'));

    function legacyCopy() {
      return new Promise((resolve, reject) => {
        const input = document.createElement('textarea');
        input.value = text;
        input.setAttribute('readonly', 'readonly');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.focus();
        input.select();
        try {
          const ok = document.execCommand('copy');
          document.body.removeChild(input);
          if (!ok) throw new Error('浏览器未允许复制');
          resolve();
        } catch (error) {
          document.body.removeChild(input);
          reject(error);
        }
      });
    }

    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).catch(() => legacyCopy());
    }

    return legacyCopy();
  }

  function getEmbeddedFirestoreRules() {
    return String(window.ORDER_TRACKER_FIRESTORE_RULES || '').trim();
  }

  function getFirestoreRulesSource() {
    const embedded = getEmbeddedFirestoreRules();
    if (embedded) return embedded;

    const rulesUrl = $('#ot-copy-firestore-rules')?.dataset.rulesUrl || '';
    throw new Error(rulesUrl
      ? `页面内置 Firestore 规则未加载，请刷新页面后重试；如仍失败，可手动打开 ${rulesUrl}`
      : '页面内置 Firestore 规则未加载，请刷新页面后重试');
  }

  function openExternalUrl(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function bindFirestoreSetupActions() {
    const consoleBtn = $('#ot-open-firebase-console');
    const copyBtn = $('#ot-copy-firestore-rules');
    if (!consoleBtn || !copyBtn || consoleBtn.dataset.bound === 'true') return;

    consoleBtn.addEventListener('click', () => {
      openExternalUrl('https://console.firebase.google.com/');
    });

    copyBtn.addEventListener('click', async () => {
      const originalText = copyBtn.textContent;
      copyBtn.disabled = true;
      copyBtn.textContent = '复制中…';
      try {
        const rules = getFirestoreRulesSource();
        await copyText(rules);
        toast('Firestore 规则已复制，去 Rules 页面里粘贴发布即可', 'ok');
      } catch (error) {
        toast('复制 Firestore 规则失败: ' + error.message, 'error');
      } finally {
        copyBtn.disabled = false;
        copyBtn.textContent = originalText;
      }
    });

    consoleBtn.dataset.bound = 'true';
  }

  bindStorageHelpModal();
  bindFirestoreSetupActions();
  init();
  return { onEnter };
})();

/* ============================================================
 * 启动时按 hash 切换视图（所有模块加载完毕后执行）
 * ============================================================ */
(function boot() {
  const key = (location.hash || '#calc').slice(1);
  switchView(key);
  document.querySelectorAll('nav.modules a[data-view]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      location.hash = '#' + a.dataset.view;
    });
  });
})();
