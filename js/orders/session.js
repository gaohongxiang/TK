/* ============================================================
 * 订单跟踪器：会话与生命周期
 * ============================================================ */
const OrderTrackerSession = (function () {
  function create({ state, constants, helpers, ui, sync }) {
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
      verifyToken,
      createGist,
      hydrateCache,
      syncNow,
      resetTrackerState,
      renderLocalOrders,
      queueSync,
      cancelPendingSync
    } = sync;

    function showMain() {
      const setup = $('#ot-setup');
      const main = $('#ot-main');
      const user = $('#ot-user');
      if (!setup || !main || !user) return;
      setup.style.display = 'none';
      main.style.display = 'block';
      user.textContent = state.user
        ? `${state.user} · Gist ${state.gistId.slice(0, 7)}…`
        : `Gist ${state.gistId.slice(0, 7)}…`;
    }

    function showSetup() {
      const setup = $('#ot-setup');
      const main = $('#ot-main');
      if (!setup || !main) return;
      setup.style.display = 'block';
      main.style.display = 'none';
    }

    async function connect() {
      const tokenInput = $('#ot-token');
      const gistInput = $('#ot-gistid');
      const button = $('#ot-connect');
      const token = tokenInput?.value.trim() || '';
      const gistId = gistInput?.value.trim() || '';
      if (!token) {
        toast('请填写 Token', 'error');
        return;
      }

      state.token = token;
      if (button) {
        button.disabled = true;
        button.textContent = '连接中…';
      }

      try {
        const user = await verifyToken();
        state.user = user.login;
        if (gistId) {
          state.gistId = gistId;
        } else {
          toast(`你好 ${user.login}，正在创建 Gist…`, 'ok');
          state.gistId = await createGist();
        }

        saveCfg();
        showMain();
        const hasCache = await hydrateCache();
        if (hasCache) {
          renderLocalOrders(state.dirty ? `本地缓存已恢复 · ${state.orders.length} 条，等待同步…` : `本地缓存已恢复 · ${state.orders.length} 条`);
        } else {
          resetTrackerState();
          renderLocalOrders('本地暂无缓存，正在读取 Gist…', 'saving');
        }
        await syncNow({ forcePull: !state.dirty });
        state.loaded = true;
        toast(`已连接: ${user.login}，请保存好 Token 和 Gist ID`, 'ok');
      } catch (error) {
        toast('连接失败: ' + error.message, 'error');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = '连接并开始使用';
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
      localStorage.removeItem(LS_KEY);
      state.token = '';
      state.gistId = '';
      state.user = '';
      state.loaded = false;
      cancelPendingSync();
      resetTrackerState({ preserveAccounts: false });
      showSetup();
      const tokenInput = $('#ot-token');
      const gistInput = $('#ot-gistid');
      if (tokenInput) tokenInput.value = '';
      if (gistInput) gistInput.value = '';
    }

    async function refresh() {
      if (!state.token) return;
      const ok = await syncNow({ forcePull: !state.dirty });
      if (ok) toast('已刷新', 'ok');
    }

    function copyGist() {
      if (!state.gistId) return;
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
      const logoutBtn = $('#ot-logout');

      if (connectBtn) connectBtn.onclick = connect;
      if (addBtn) addBtn.onclick = () => openModal();
      if (refreshBtn) refreshBtn.onclick = refresh;
      if (exportBtn) exportBtn.onclick = exportOrdersCsv;
      if (copyBtn) copyBtn.onclick = copyGist;
      if (logoutBtn) logoutBtn.onclick = logout;
      bindCrudEvents();
    }

    async function onEnter() {
      state.accounts = loadAccounts();
      if (state.loaded) {
        renderAccTabs();
        renderTable();
        if (state.token && state.gistId) {
          if (state.dirty) setSync(`本地缓存已就绪 · ${state.orders.length} 条，等待同步…`, 'local');
          else setSync(`本地缓存已就绪 · ${state.orders.length} 条`, 'local');
          if (state.dirty) queueSync(0);
        }
        return;
      }

      const cfg = loadCfg();
      if (cfg && cfg.token && cfg.gistId) {
        state.token = cfg.token;
        state.gistId = cfg.gistId;
        state.user = cfg.user || '';
        showMain();
        const hasCache = await hydrateCache();
        if (hasCache) {
          renderLocalOrders(state.dirty ? `本地缓存已就绪 · ${state.orders.length} 条，等待同步…` : `本地缓存已就绪 · ${state.orders.length} 条`);
        } else {
          resetTrackerState();
          renderLocalOrders('本地暂无缓存，正在读取 Gist…', 'saving');
        }
        state.loaded = true;
        if (hasCache) {
          void syncNow({ forcePull: !state.dirty });
        } else {
          const ok = await syncNow({ forcePull: true });
          if (!ok) showSetup();
        }
      } else {
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
