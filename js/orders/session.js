/* ============================================================
 * 订单跟踪器：会话与生命周期
 * ============================================================ */
const OrderTrackerSession = (function () {
  function create({ state, constants, helpers, ui, sync, providers }) {
    const { $, loadCfg, saveCfg, loadAccounts } = helpers;
    const {
      toast,
      setSync,
      openModal,
      exportOrdersCsv,
      bindCrudEvents,
      renderAccTabs,
      renderTable
    } = ui;
    const {
      setRemoteProvider,
      hydrateCache,
      syncNow,
      resetTrackerState,
      renderLocalOrders,
      queueSync,
      cancelPendingSync
    } = sync;
    const { getProviderByMode } = providers;

    function getGlobalConnection() {
      return window.TKFirestoreConnection || null;
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

    function applyStoredState(cfg) {
      state.clientId = cfg?.clientId || state.clientId || '';
    }

    function applyGlobalConfig(cfg) {
      state.firestoreConfigText = cfg?.configText || '';
      state.firestoreProjectId = cfg?.projectId || '';
    }

    function showMain() {
      const setup = $('#ot-setup');
      const main = $('#ot-main');
      const user = $('#ot-user');
      const provider = state.remoteProvider;
      if (!setup || !main || !user) return;
      setup.style.display = 'none';
      main.style.display = 'block';
      user.textContent = provider?.getDisplayName
        ? `已连接 · ${provider.getDisplayName(state)}`
        : (state.firestoreProjectId ? `已连接 · ${state.firestoreProjectId}` : '已连接 · Firebase Firestore');
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
          state.dirty ? `${cachedPrefix} · ${state.orders.length} 条，等待同步…` : `${cachedPrefix} · ${state.orders.length} 条`,
          'local'
        );
      } else {
        resetTrackerState();
        renderLocalOrders(emptyText, emptyClass);
      }
      return hasCache;
    }

    async function completeFirestoreConnection(provider, {
      forcePull,
      successMessage = ''
    } = {}) {
      if (!provider?.isConnected?.()) {
        await provider.init({
          configText: state.firestoreConfigText,
          user: ''
        });
      }

      saveCfg();
      showMain();
      const hasCache = await restoreCache({
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
      if (!cfg?.configText) {
        showSetup();
        return false;
      }

      applyGlobalConfig(cfg);
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
      state.loaded = false;
      state.firestoreConfigText = '';
      state.firestoreProjectId = '';
      resetTrackerState({ preserveAccounts: true });

      if (!nextConfig?.configText) {
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
      window.addEventListener('tk-firestore-config-changed', handleConnectionChange);
      bindConnectionListener.bound = true;
    }

    async function refresh() {
      const provider = state.remoteProvider;
      if (!provider) return;

      const refreshBtn = $('#ot-refresh');
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('is-spinning');
        refreshBtn.setAttribute('aria-busy', 'true');
      }

      try {
        const ok = await syncNow({ forcePull: true });
        if (ok) toast('已刷新', 'ok');
      } finally {
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.classList.remove('is-spinning');
          refreshBtn.setAttribute('aria-busy', 'false');
        }
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
      applyStoredState(loadCfg());
      bindOpenConnectionButton();
      bindConnectionListener();

      if (state.loaded) {
        renderAccTabs();
        renderTable();
        if (state.remoteProvider) {
          if (state.dirty) setSync(`Firestore 本地缓存已就绪 · ${state.orders.length} 条，等待同步…`, 'local');
          else setSync(`Firestore 本地缓存已就绪 · ${state.orders.length} 条`, 'local');
          if (state.dirty) queueSync(0);
        }
        return;
      }

      if (!getGlobalConfig()?.configText) {
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

  return {
    create
  };
})();
