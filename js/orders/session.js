/* ============================================================
 * 订单跟踪器：会话与生命周期
 * ============================================================ */
const OrderTrackerSession = (function () {
  function create({ state, constants, helpers, ui, sync, providers }) {
    const { LS_KEY } = constants;
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

    function getSelectedStorageMode() {
      return document.querySelector('input[name="ot-storage-mode"]:checked')?.value || state.storageMode || 'firestore';
    }

    function setModeProvider(mode) {
      state.storageMode = mode;
      const provider = typeof getProviderByMode === 'function' ? getProviderByMode(mode) : null;
      setRemoteProvider(provider);
      return provider;
    }

    function syncStorageModeFields(mode = getSelectedStorageMode()) {
      document.querySelectorAll('.ot-storage-mode').forEach(label => {
        const input = label.querySelector('input[name="ot-storage-mode"]');
        label.classList.toggle('active', input?.value === mode);
      });

      const gistCopy = $('#ot-gist-copy');
      const firestoreCopy = $('#ot-firestore-copy');
      const gistFields = $('#ot-gist-fields');
      const firestoreFields = $('#ot-firestore-fields');
      const firestoreMigrationEntry = $('#ot-firestore-migration-entry');
      const button = $('#ot-connect');

      if (gistCopy) gistCopy.style.display = mode === 'gist' ? 'block' : 'none';
      if (firestoreCopy) firestoreCopy.style.display = mode === 'firestore' ? 'block' : 'none';
      if (gistFields) gistFields.style.display = mode === 'gist' ? 'block' : 'none';
      if (firestoreFields) firestoreFields.style.display = mode === 'firestore' ? 'block' : 'none';
      if (firestoreMigrationEntry) firestoreMigrationEntry.style.display = mode === 'firestore' ? 'flex' : 'none';

      if (button) {
        button.textContent = '连接并开始使用';
      }
    }

    function readFirestoreTarget() {
      const configText = $('#ot-firestore-config')?.value.trim() || '';
      const provider = typeof getProviderByMode === 'function' ? getProviderByMode('firestore') : null;
      if (!provider?.parseConfigInput) {
        throw new Error('当前 Firestore 接入能力不可用');
      }
      const parsed = provider.parseConfigInput(configText);
      if (!parsed?.projectId) {
        throw new Error('请粘贴完整的 firebaseConfig');
      }
      return {
        configText: provider.normalizeConfigText(parsed),
        projectId: parsed.projectId
      };
    }

    function populateSetupForm() {
      const mode = state.storageMode || 'firestore';
      const radio = document.querySelector(`input[name="ot-storage-mode"][value="${mode}"]`);
      if (radio) radio.checked = true;
      const tokenInput = $('#ot-token');
      const gistInput = $('#ot-gistid');
      const firestoreConfigInput = $('#ot-firestore-config');

      if (tokenInput) tokenInput.value = state.token || '';
      if (gistInput) gistInput.value = state.gistId || '';
      if (firestoreConfigInput) firestoreConfigInput.value = state.firestoreConfigText || '';
      syncStorageModeFields(mode);
    }

    function applyConfig(cfg) {
      state.storageMode = cfg?.mode === 'gist' ? 'gist' : 'firestore';
      state.token = cfg?.token || '';
      state.gistId = cfg?.gistId || '';
      state.firestoreConfigText = cfg?.firestoreConfigText || '';
      state.firestoreProjectId = cfg?.firestoreProjectId || '';
      state.user = cfg?.user || '';
      state.clientId = cfg?.clientId || state.clientId || '';
    }

    function updateMainActions() {
      const copyBtn = $('#ot-copy-gist');
      if (copyBtn) copyBtn.style.display = state.storageMode === 'gist' ? 'inline-flex' : 'none';
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
        ? provider.getDisplayName(state)
        : '订单存储';
      updateMainActions();
    }

    function showSetup() {
      const setup = $('#ot-setup');
      const main = $('#ot-main');
      if (!setup || !main) return;
      setup.style.display = 'block';
      main.style.display = 'none';
      populateSetupForm();
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

    async function connectGist(provider) {
      const token = $('#ot-token')?.value.trim() || '';
      const gistId = $('#ot-gistid')?.value.trim() || '';
      if (!token) {
        toast('请填写 Token', 'error');
        return;
      }

      state.token = token;
      state.gistId = gistId;
      await provider.init({ token: state.token, gistId: state.gistId, user: state.user });
      const user = await provider.verifyToken();
      state.user = user.login;
      if (!state.gistId) {
        toast(`你好 ${user.login}，正在创建 Gist…`, 'ok');
        state.gistId = await provider.createGist();
      }
      await provider.init({ token: state.token, gistId: state.gistId, user: state.user });
      saveCfg();
      showMain();
      const hasCache = await restoreCache({
        cachedPrefix: '本地缓存已恢复',
        emptyText: '本地暂无缓存，正在读取 Gist…'
      });
      const ok = await syncNow({ forcePull: !state.dirty || !hasCache });
      state.loaded = true;
      if (!ok && !hasCache) {
        showSetup();
        return;
      }
      toast(`已连接: ${user.login}，请保存好 Token 和 Gist ID`, 'ok');
    }

    async function completeFirestoreConnection(provider, {
      forcePull,
      successMessage = '已连接到你自己的 Firestore 项目'
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
        forcePull: typeof forcePull === 'boolean' ? forcePull : (!state.dirty || !hasCache)
      });
      if (ok) toast(successMessage, 'ok');
    }

    async function connectFirestore(provider) {
      let target;
      try {
        target = readFirestoreTarget();
      } catch (error) {
        toast(error.message, 'error');
        return;
      }

      state.firestoreConfigText = target.configText;
      state.firestoreProjectId = target.projectId;
      await completeFirestoreConnection(provider);
    }

    function promptGistMigration() {
      return new Promise(resolve => {
        const modal = $('#ot-migrate-gist-modal');
        const tokenInput = $('#ot-migrate-gist-token');
        const gistIdInput = $('#ot-migrate-gist-id');
        const cancelBtn = $('#ot-migrate-gist-cancel');
        const confirmBtn = $('#ot-migrate-gist-confirm');
        if (!modal || !tokenInput || !gistIdInput || !cancelBtn || !confirmBtn) {
          resolve(null);
          return;
        }

        tokenInput.value = state.token || '';
        gistIdInput.value = state.gistId || '';

        function cleanup(result) {
          modal.classList.remove('show');
          cancelBtn.onclick = null;
          confirmBtn.onclick = null;
          modal.onclick = null;
          resolve(result);
        }

        cancelBtn.onclick = () => cleanup(null);
        confirmBtn.onclick = () => {
          const token = tokenInput.value.trim();
          const gistId = gistIdInput.value.trim();
          if (!token || !gistId) {
            toast('请填写 Gist Token 和 Gist ID', 'error');
            return;
          }
          cleanup({ token, gistId });
        };
        modal.onclick = event => {
          if (event.target.id === 'ot-migrate-gist-modal') cleanup(null);
        };

        modal.classList.add('show');
        tokenInput.focus();
      });
    }

    async function connectOrMigrateFirestore() {
      let target;
      try {
        target = readFirestoreTarget();
      } catch (error) {
        toast(error.message, 'error');
        return;
      }

      const source = await promptGistMigration();
      if (!source) return;

      const gistProvider = typeof getProviderByMode === 'function' ? getProviderByMode('gist') : null;
      const firestoreProvider = typeof getProviderByMode === 'function' ? getProviderByMode('firestore') : null;
      if (!gistProvider || !firestoreProvider) {
        toast('当前迁移能力不可用', 'error');
        return;
      }

      const migrateBtn = $('#ot-migrate-from-gist');
      const connectBtn = $('#ot-connect');
      const originalMigrateText = migrateBtn?.textContent || '';
      const originalConnectText = connectBtn?.textContent || '';

      if (migrateBtn) {
        migrateBtn.disabled = true;
        migrateBtn.textContent = '迁移中…';
      }
      if (connectBtn) {
        connectBtn.disabled = true;
        connectBtn.textContent = '迁移中…';
      }

      try {
        setSync('正在读取 Gist 云端数据…', 'saving');
        await gistProvider.init({
          token: source.token,
          gistId: source.gistId,
          user: ''
        });
        const sourceSnapshot = await gistProvider.pullSnapshot();
        const hasSourceData = !!(sourceSnapshot.orders.length || sourceSnapshot.accounts.length);

        state.firestoreConfigText = target.configText;
        state.firestoreProjectId = target.projectId;

        await firestoreProvider.init({
          configText: target.configText,
          user: ''
        });

        if (hasSourceData) {
          setSync('正在检查 Firestore 目标库…', 'saving');
          const targetSnapshot = await firestoreProvider.pullSnapshot({ cursor: '' });
          if (targetSnapshot.orders.length || targetSnapshot.accounts.length) {
            throw new Error('目标 Firestore 已有数据，请换一个空库再迁移');
          }

          setSync('正在从 Gist 迁移到 Firestore…', 'saving');
          await firestoreProvider.pushChanges({
            upserts: sourceSnapshot.orders,
            deletions: [],
            accountUpserts: sourceSnapshot.accounts,
            accountDeletions: [],
            clientId: state.clientId || ''
          });
        }

        setModeProvider('firestore');
        await completeFirestoreConnection(firestoreProvider, {
          forcePull: true,
          successMessage: hasSourceData
            ? '已从 Gist 迁移到 Firestore，并已切换为 Firestore 存储'
            : 'Gist 暂无云端数据，已直接连接到你自己的 Firestore 项目'
        });
      } catch (error) {
        setSync('迁移失败', 'error');
        toast('从 GitHub Gist 迁移失败: ' + error.message, 'error');
      } finally {
        if (migrateBtn) {
          migrateBtn.disabled = false;
          migrateBtn.textContent = originalMigrateText || '从 GitHub Gist 迁移';
        }
        if (connectBtn) {
          connectBtn.disabled = false;
          connectBtn.textContent = originalConnectText || '连接并开始使用';
        }
        syncStorageModeFields(getSelectedStorageMode());
      }
    }

    async function connect() {
      const button = $('#ot-connect');
      const mode = getSelectedStorageMode();
      const provider = setModeProvider(mode);
      if (!provider) {
        toast('当前存储模式不可用', 'error');
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = '连接中…';
      }

      try {
        if (mode === 'firestore') {
          await connectFirestore(provider);
        } else {
          await connectGist(provider);
        }
      } catch (error) {
        toast('连接失败: ' + error.message, 'error');
      } finally {
        if (button) {
          button.disabled = false;
          syncStorageModeFields(mode);
        }
      }
    }

    function promptLogoutConfirm() {
      return new Promise(resolve => {
        const modal = $('#ot-logout-modal');
        const cancelBtn = $('#ot-logout-cancel');
        const confirmBtn = $('#ot-logout-confirm');
        if (!modal || !cancelBtn || !confirmBtn) {
          resolve(false);
          return;
        }

        function cleanup(result) {
          modal.classList.remove('show');
          cancelBtn.onclick = null;
          confirmBtn.onclick = null;
          modal.onclick = null;
          resolve(result);
        }

        cancelBtn.onclick = () => cleanup(false);
        confirmBtn.onclick = () => cleanup(true);
        modal.onclick = event => {
          if (event.target.id === 'ot-logout-modal') cleanup(false);
        };

        modal.classList.add('show');
        confirmBtn.focus();
      });
    }

    async function logout() {
      const confirmed = await promptLogoutConfirm();
      if (!confirmed) return;

      try {
        if (state.storageMode === 'firestore' && state.remoteProvider?.signOut) {
          await state.remoteProvider.signOut();
        }
      } catch (error) {
        toast('退出 Firestore 会话失败: ' + error.message, 'error');
      }

      localStorage.removeItem(LS_KEY);
      state.storageMode = 'firestore';
      state.token = '';
      state.gistId = '';
      state.firestoreConfigText = '';
      state.firestoreProjectId = '';
      state.user = '';
      state.loaded = false;
      cancelPendingSync();
      resetTrackerState({ preserveAccounts: false });
      setRemoteProvider(null);
      showSetup();
    }

    async function refresh() {
      const provider = state.remoteProvider;
      if (!provider) {
        return;
      }

      const refreshBtn = $('#ot-refresh');
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('is-spinning');
        refreshBtn.setAttribute('aria-busy', 'true');
      }

      try {
        const ok = await syncNow({ forcePull: !state.dirty || state.storageMode === 'firestore' });
        if (ok) toast('已刷新', 'ok');
      } finally {
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.classList.remove('is-spinning');
          refreshBtn.setAttribute('aria-busy', 'false');
        }
      }
    }

    function copyGist() {
      if (state.storageMode !== 'gist' || !state.gistId) return;
      navigator.clipboard?.writeText(state.gistId).then(
        () => toast('Gist ID 已复制', 'ok'),
        () => toast('复制失败，请手动选择', 'error')
      );
    }

    function init() {
      const connectBtn = $('#ot-connect');
      const addBtn = $('#ot-add');
      const refreshBtn = $('#ot-refresh');
      const exportBtn = $('#ot-export');
      const copyBtn = $('#ot-copy-gist');
      const migrateBtn = $('#ot-migrate-from-gist');
      const logoutBtn = $('#ot-logout');

      if (connectBtn) connectBtn.onclick = connect;
      if (addBtn) addBtn.onclick = () => openModal();
      if (refreshBtn) refreshBtn.onclick = refresh;
      if (exportBtn) exportBtn.onclick = exportOrdersCsv;
      if (copyBtn) copyBtn.onclick = copyGist;
      if (migrateBtn) migrateBtn.onclick = connectOrMigrateFirestore;
      if (logoutBtn) logoutBtn.onclick = logout;

      document.querySelectorAll('input[name="ot-storage-mode"]').forEach(input => {
        input.addEventListener('change', () => syncStorageModeFields(input.value));
      });

      populateSetupForm();
      bindCrudEvents();
    }

    async function onEnter() {
      state.accounts = loadAccounts();
      const cfg = loadCfg();
      if (cfg) applyConfig(cfg);
      populateSetupForm();

      if (state.loaded) {
        renderAccTabs();
        renderTable();
        if (state.remoteProvider) {
          if (state.dirty) setSync(`本地缓存已就绪 · ${state.orders.length} 条，等待同步…`, 'local');
          else setSync(`本地缓存已就绪 · ${state.orders.length} 条`, 'local');
          if (state.dirty) queueSync(0);
        }
        return;
      }

      if (!cfg) {
        showSetup();
        return;
      }

      const provider = setModeProvider(state.storageMode || 'firestore');
      try {
        if (state.storageMode === 'firestore' && state.firestoreConfigText) {
          await provider.init({
            configText: state.firestoreConfigText,
            user: state.user
          });
          saveCfg();
          showMain();
          const hasCache = await restoreCache({
            cachedPrefix: 'Firestore 本地缓存已就绪',
            emptyText: '正在读取 Firestore 本地缓存…'
          });
          state.loaded = true;
          if (hasCache) void syncNow({ forcePull: !state.dirty });
          else await syncNow({ forcePull: true });
          return;
        }

        if (state.token && state.gistId) {
          await provider.init({ token: state.token, gistId: state.gistId, user: state.user });
          showMain();
          const hasCache = await restoreCache({
            cachedPrefix: '本地缓存已就绪',
            emptyText: '本地暂无缓存，正在读取 Gist…'
          });
          state.loaded = true;
          if (hasCache) {
            void syncNow({ forcePull: !state.dirty });
          } else {
            const ok = await syncNow({ forcePull: true });
            if (!ok) showSetup();
          }
          return;
        }
      } catch (error) {
        toast('恢复连接失败: ' + error.message, 'error');
      }

      showSetup();
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
