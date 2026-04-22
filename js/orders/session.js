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
      return document.querySelector('input[name="ot-storage-mode"]:checked')?.value || state.storageMode || 'gist';
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
      const supabaseCopy = $('#ot-supabase-copy');
      const gistFields = $('#ot-gist-fields');
      const supabaseFields = $('#ot-supabase-fields');
      const button = $('#ot-connect');

      if (gistCopy) gistCopy.style.display = mode === 'gist' ? 'block' : 'none';
      if (supabaseCopy) supabaseCopy.style.display = mode === 'supabase' ? 'block' : 'none';
      if (gistFields) gistFields.style.display = mode === 'gist' ? 'block' : 'none';
      if (supabaseFields) supabaseFields.style.display = mode === 'supabase' ? 'block' : 'none';

      if (button) {
        button.textContent = '连接并开始使用';
      }
    }

    function normalizeSupabaseProjectId(value = '') {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (/^https?:\/\//i.test(raw)) {
        try {
          const host = String(new URL(raw).hostname || '').trim().toLowerCase();
          if (!host.endsWith('.supabase.co')) return '';
          return host.split('.')[0] || '';
        } catch (error) {
          return '';
        }
      }

      const normalized = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
      return normalized || '';
    }

    function buildSupabaseProjectUrl(value = '') {
      const projectId = normalizeSupabaseProjectId(value);
      if (!projectId) return '';
      return `https://${projectId}.supabase.co`;
    }

    function readSupabaseTarget() {
      const projectId = $('#ot-supabase-url')?.value.trim() || '';
      const anonKey = $('#ot-supabase-anon-key')?.value.trim() || '';
      const url = buildSupabaseProjectUrl(projectId);
      if (!url || !anonKey) {
        throw new Error('请填写 Project ID 和 Publishable key');
      }
      return { projectId, anonKey, url };
    }

    function populateSetupForm() {
      const mode = state.storageMode || 'gist';
      const radio = document.querySelector(`input[name="ot-storage-mode"][value="${mode}"]`);
      if (radio) radio.checked = true;
      const tokenInput = $('#ot-token');
      const gistInput = $('#ot-gistid');
      const supabaseUrlInput = $('#ot-supabase-url');
      const supabaseKeyInput = $('#ot-supabase-anon-key');

      if (tokenInput) tokenInput.value = state.token || '';
      if (gistInput) gistInput.value = state.gistId || '';
      if (supabaseUrlInput) supabaseUrlInput.value = normalizeSupabaseProjectId(state.supabaseUrl) || '';
      if (supabaseKeyInput) supabaseKeyInput.value = state.supabaseAnonKey || '';
      syncStorageModeFields(mode);
    }

    function applyConfig(cfg) {
      state.storageMode = cfg?.mode === 'supabase' ? 'supabase' : 'gist';
      state.token = cfg?.token || '';
      state.gistId = cfg?.gistId || '';
      state.supabaseUrl = cfg?.supabaseUrl || '';
      state.supabaseAnonKey = cfg?.supabaseAnonKey || '';
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

    async function completeSupabaseConnection(provider, {
      forcePull,
      successMessage = '已连接到你自己的 Supabase 项目'
    } = {}) {
      if (!provider?.isConnected?.()) {
        await provider.init({
          url: state.supabaseUrl,
          anonKey: state.supabaseAnonKey,
          user: ''
        });
      }
      saveCfg();
      showMain();
      const hasCache = await restoreCache({
        cachedPrefix: '本地缓存已恢复',
        emptyText: '正在准备 Supabase 同步…'
      });
      state.loaded = true;
      const ok = await syncNow({
        forcePull: typeof forcePull === 'boolean' ? forcePull : (!state.dirty || !hasCache)
      });
      if (ok) toast(successMessage, 'ok');
    }

    async function connectSupabase(provider) {
      let target;
      try {
        target = readSupabaseTarget();
      } catch (error) {
        toast(error.message, 'error');
        return;
      }

      state.supabaseUrl = target.url;
      state.supabaseAnonKey = target.anonKey;
      await completeSupabaseConnection(provider);
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

    async function connectOrMigrateSupabase() {
      let target;
      try {
        target = readSupabaseTarget();
      } catch (error) {
        toast(error.message, 'error');
        return;
      }

      const source = await promptGistMigration();
      if (!source) return;

      const gistProvider = typeof getProviderByMode === 'function' ? getProviderByMode('gist') : null;
      const supabaseProvider = typeof getProviderByMode === 'function' ? getProviderByMode('supabase') : null;
      if (!gistProvider || !supabaseProvider) {
        toast('当前迁移能力不可用', 'error');
        return;
      }

      const migrateBtn = $('#ot-migrate-from-gist');
      const connectBtn = $('#ot-connect');
      const originalMigrateText = migrateBtn?.textContent || '';
      const originalConnectText = connectBtn?.textContent || '';

      if (migrateBtn) {
        migrateBtn.disabled = true;
        migrateBtn.textContent = '处理中…';
      }
      if (connectBtn) {
        connectBtn.disabled = true;
        connectBtn.textContent = '处理中…';
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

        state.token = source.token;
        state.gistId = source.gistId;
        state.supabaseUrl = target.url;
        state.supabaseAnonKey = target.anonKey;

        await supabaseProvider.init({
          url: target.url,
          anonKey: target.anonKey,
          user: ''
        });

        if (hasSourceData) {
          setSync('正在检查 Supabase 目标库…', 'saving');
          const targetSnapshot = await supabaseProvider.pullSnapshot({ cursor: '' });
          if (targetSnapshot.orders.length || targetSnapshot.accounts.length) {
            throw new Error('目标 Supabase 已有数据，请换一个空库再迁移');
          }

          setSync('正在从 Gist 迁移到 Supabase…', 'saving');
          await supabaseProvider.pushChanges({
            upserts: sourceSnapshot.orders,
            deletions: [],
            accountUpserts: sourceSnapshot.accounts,
            accountDeletions: [],
            clientId: state.clientId || ''
          });
        }

        setModeProvider('supabase');
        await completeSupabaseConnection(supabaseProvider, {
          forcePull: true,
          successMessage: hasSourceData
            ? '已从 Gist 迁移到 Supabase，并已切换为 Supabase 存储'
            : 'Gist 暂无云端数据，已直接连接到你自己的 Supabase 项目'
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
        if (mode === 'supabase') {
          await connectSupabase(provider);
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
        if (state.storageMode === 'supabase' && state.remoteProvider?.signOut) {
          await state.remoteProvider.signOut();
        }
      } catch (error) {
        toast('退出 Supabase 会话失败: ' + error.message, 'error');
      }

      localStorage.removeItem(LS_KEY);
      state.storageMode = 'gist';
      state.token = '';
      state.gistId = '';
      state.supabaseUrl = '';
      state.supabaseAnonKey = '';
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
        const ok = await syncNow({ forcePull: !state.dirty || state.storageMode === 'supabase' });
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
      if (migrateBtn) migrateBtn.onclick = connectOrMigrateSupabase;
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

      const provider = setModeProvider(state.storageMode || 'gist');
      try {
        if (state.storageMode === 'supabase' && state.supabaseUrl && state.supabaseAnonKey) {
          await provider.init({
            url: state.supabaseUrl,
            anonKey: state.supabaseAnonKey,
            user: state.user
          });
          saveCfg();
          showMain();
          const hasCache = await restoreCache({
            cachedPrefix: '本地缓存已就绪',
            emptyText: '本地暂无缓存，正在读取 Supabase…'
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
