function getProviderDisplayName(state = {}) {
  const provider = state.remoteProvider;
  if (provider?.getDisplayName) return provider.getDisplayName(state);
  if (state.firestoreProjectId) return state.firestoreProjectId;
  return 'Firebase Firestore';
}

function buildConnectedUserText(state = {}) {
  return `已连接 · ${getProviderDisplayName(state)}`;
}

function shouldShowSetup(config) {
  return !config?.configText;
}

function applyStoredState(state = {}, cfg = {}) {
  state.clientId = cfg?.clientId || state.clientId || '';
  return state;
}

function applyGlobalConfig(state = {}, cfg = {}) {
  state.firestoreConfigText = cfg?.configText || '';
  state.firestoreProjectId = cfg?.projectId || '';
  return state;
}

function buildLocalCacheMessage({
  cachedPrefix,
  orderCount = 0,
  dirty = false
} = {}) {
  return dirty
    ? `${cachedPrefix} · ${orderCount} 条，等待同步…`
    : `${cachedPrefix} · ${orderCount} 条`;
}

function buildLoadedSyncMessage({
  orderCount = 0,
  dirty = false
} = {}) {
  return buildLocalCacheMessage({
    cachedPrefix: 'Firestore 本地缓存已就绪',
    orderCount,
    dirty
  });
}

function setRefreshButtonLoading(button, loading) {
  if (!button) return;
  button.disabled = !!loading;
  button.classList?.[loading ? 'add' : 'remove']?.('is-spinning');
  button.setAttribute?.('aria-busy', loading ? 'true' : 'false');
}

function resetConnectionState(state = {}) {
  state.loaded = false;
  state.firestoreConfigText = '';
  state.firestoreProjectId = '';
  return state;
}

function create({ state = {}, helpers = {}, ui = {}, sync = {}, providers = {}, window: rootWindow = globalThis.window } = {}) {
  const { $, loadCfg = () => null, saveCfg = () => {}, loadAccounts = () => [] } = helpers;
  const {
    toast = () => {},
    setSync = () => {},
    openModal = () => {},
    exportOrdersCsv = () => {},
    bindCrudEvents = () => {},
    renderAccTabs = () => {},
    renderTable = () => {}
  } = ui;
  const {
    setRemoteProvider = () => {},
    hydrateCache = async () => false,
    syncNow = async () => true,
    resetTrackerState = () => {},
    renderLocalOrders = () => {},
    queueSync = () => {},
    cancelPendingSync = () => {}
  } = sync;
  const { getProviderByMode } = providers;

  function getGlobalConnection() {
    return rootWindow?.TKFirestoreConnection || null;
  }

  function getGlobalConfig() {
    return getGlobalConnection()?.getConfig?.() || null;
  }

  function bindOpenConnectionButton() {
    const button = $('#ot-open-connection');
    if (!button || button.dataset.bound === 'true') return;
    button.addEventListener('click', () => {
      getGlobalConnection()?.open?.();
    });
    button.dataset.bound = 'true';
  }

  function showMain() {
    const setup = $('#ot-setup');
    const main = $('#ot-main');
    const user = $('#ot-user');
    if (!setup || !main || !user) return;
    setup.style.display = 'none';
    main.style.display = 'block';
    user.textContent = buildConnectedUserText(state);
  }

  function showSetup() {
    const setup = $('#ot-setup');
    const main = $('#ot-main');
    if (!setup || !main) return;
    setup.style.display = 'block';
    main.style.display = 'none';
  }

  async function restoreCache({ cachedPrefix, emptyText, emptyClass = 'saving' }) {
    const hasCache = await hydrateCache();
    if (hasCache) {
      renderLocalOrders(
        buildLocalCacheMessage({
          cachedPrefix,
          orderCount: state.orders.length,
          dirty: state.dirty
        }),
        'local'
      );
    } else {
      resetTrackerState();
      renderLocalOrders(emptyText, emptyClass);
    }
    return hasCache;
  }

  async function completeFirestoreConnection(provider, { forcePull, successMessage = '' } = {}) {
    if (!provider?.isConnected?.()) {
      await provider.init({
        configText: state.firestoreConfigText,
        user: ''
      });
    }

    saveCfg();
    showMain();
    await restoreCache({
      cachedPrefix: 'Firestore 本地缓存已恢复',
      emptyText: '正在准备 Firestore 同步…'
    });
    state.loaded = true;
    const ok = await syncNow({
      forcePull: typeof forcePull === 'boolean' ? forcePull : true
    });
    if (ok && successMessage) toast(successMessage, 'ok');
    return ok;
  }

  async function connectUsingGlobalConfig({ forcePull = true, successMessage = '' } = {}) {
    const cfg = getGlobalConfig();
    if (shouldShowSetup(cfg)) {
      showSetup();
      return false;
    }

    applyGlobalConfig(state, cfg);
    const provider = typeof getProviderByMode === 'function' ? getProviderByMode('firestore') : null;
    if (!provider) {
      toast('当前 Firestore 接入能力不可用', 'error');
      return false;
    }

    setRemoteProvider(provider);
    await completeFirestoreConnection(provider, { forcePull, successMessage });
    return true;
  }

  async function handleConnectionChange(event) {
    const nextConfig = event?.detail?.connected === false ? null : getGlobalConfig();
    cancelPendingSync();
    setRemoteProvider(null);
    resetConnectionState(state);
    resetTrackerState({ preserveAccounts: true });

    if (shouldShowSetup(nextConfig)) {
      showSetup();
      setSync('未连接', '');
      return;
    }

    try {
      await connectUsingGlobalConfig({
        forcePull: true,
        successMessage: '已切换到新的 Firebase 项目'
      });
    } catch (error) {
      toast('恢复连接失败: ' + error.message, 'error');
      showSetup();
    }
  }

  function bindConnectionListener() {
    if (bindConnectionListener.bound) return;
    rootWindow?.addEventListener?.('tk-firestore-config-changed', handleConnectionChange);
    bindConnectionListener.bound = true;
  }

  async function refresh() {
    const provider = state.remoteProvider;
    if (!provider) return;

    const refreshBtn = $('#ot-refresh');
    setRefreshButtonLoading(refreshBtn, true);

    try {
      const ok = await syncNow({ forcePull: true });
      if (ok) toast('已刷新', 'ok');
    } finally {
      setRefreshButtonLoading(refreshBtn, false);
    }
  }

  function init() {
    const addBtn = $('#ot-add');
    const refreshBtn = $('#ot-refresh');
    const exportBtn = $('#ot-export');

    if (addBtn) addBtn.onclick = () => openModal();
    if (refreshBtn) refreshBtn.onclick = refresh;
    if (exportBtn) exportBtn.onclick = exportOrdersCsv;

    bindOpenConnectionButton();
    bindConnectionListener();
    bindCrudEvents();
  }

  async function onEnter() {
    state.accounts = loadAccounts();
    applyStoredState(state, loadCfg());
    bindOpenConnectionButton();
    bindConnectionListener();

    if (state.loaded) {
      renderAccTabs();
      renderTable();
      if (state.remoteProvider) {
        setSync(buildLoadedSyncMessage({
          orderCount: state.orders.length,
          dirty: state.dirty
        }), 'local');
        if (state.dirty) queueSync(0);
      }
      return;
    }

    if (shouldShowSetup(getGlobalConfig())) {
      showSetup();
      return;
    }

    try {
      await connectUsingGlobalConfig({ forcePull: true });
    } catch (error) {
      toast('恢复连接失败: ' + error.message, 'error');
      showSetup();
    }
  }

  return {
    init,
    onEnter
  };
}

const OrderTrackerSession = {
  create
};

export {
  OrderTrackerSession,
  applyGlobalConfig,
  applyStoredState,
  buildConnectedUserText,
  buildLoadedSyncMessage,
  buildLocalCacheMessage,
  create,
  getProviderDisplayName,
  resetConnectionState,
  setRefreshButtonLoading,
  shouldShowSetup
};

