/* ============================================================
 * 订单跟踪器：账号标签栏
 * ============================================================ */
const OrderTrackerTabs = (function () {
  function create({ state, helpers, ui }) {
    const { escapeHtml, normalizeAccountName } = helpers;
    const {
      getContainer,
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
    } = ui;

    function getUniqueAccounts() {
      const set = new Set();
      (state.orders || []).forEach(order => {
        const account = normalizeAccountName(order['账号']);
        if (account) set.add(account);
      });
      (state.accounts || []).forEach(account => {
        const normalized = normalizeAccountName(account);
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
      const accounts = getUniqueAccounts();

      if (state.activeAccount !== '__all__' && (!state.activeAccount || !accounts.includes(state.activeAccount))) {
        state.activeAccount = '__all__';
      }

      const countMap = {};
      (state.orders || []).forEach(order => {
        const account = normalizeAccountName(order['账号']);
        if (account) countMap[account] = (countMap[account] || 0) + 1;
      });

      const allActive = state.activeAccount === '__all__';
      allContainer.innerHTML = `<span class="tab${allActive ? ' active' : ''}" data-tab-acc="__all__">
        全部<span class="tab-count">(${state.orders.length})</span>
      </span>`;

      if (!accounts.length) {
        scrollContainer.innerHTML = '<div class="ot-acc-tabs-scroll-inner"><span class="ot-acc-empty">暂无账号，点右侧账号区末尾的 + 可添加</span><button class="tab-add" id="ot-tab-add" title="添加账号">+</button></div>';
      } else {
        scrollContainer.innerHTML = `<div class="ot-acc-tabs-scroll-inner">${accounts.map(account => {
          const isActive = account === state.activeAccount;
          const count = countMap[account] || 0;
          return `<span class="tab${isActive ? ' active' : ''}" data-tab-acc="${escapeHtml(account)}">
            ${escapeHtml(account)}<span class="tab-count">(${count})</span>
            <div class="tab-actions">
              <span class="t-btn tab-edit" data-tab-edit="${escapeHtml(account)}" title="重命名">✎</span>
              <span class="t-btn danger tab-del" data-tab-del="${escapeHtml(account)}" title="删除">×</span>
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
          if (normalizeAccountName(order['账号']) === oldName) {
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
        tab.addEventListener('click', e => {
          if (e.target.closest('.tab-del') || e.target.closest('.tab-edit')) return;
          state.activeAccount = tab.dataset.tabAcc;
          resetTablePage();
          renderAccTabs();
          renderTable();
        });
        tab.addEventListener('dblclick', e => {
          if (e.target.closest('.tab-del') || e.target.closest('.tab-edit')) return;
          const targetAcc = tab.dataset.tabAcc;
          if (targetAcc === '__all__') return;
          void triggerRename(targetAcc);
        });
      });

      container.querySelectorAll('.tab-edit[data-tab-edit]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          void triggerRename(btn.dataset.tabEdit);
        });
      });

      container.querySelectorAll('.tab-del[data-tab-del]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const account = btn.dataset.tabDel;
          const orderCount = (state.orders || []).filter(order => normalizeAccountName(order['账号']) === account).length;
          const message = orderCount > 0
            ? `确定删除账号「${account}」？\n该账号下的 ${orderCount} 条订单数据将变为未关联（落入“全部”中）。`
            : `确定删除账号「${account}」？`;
          if (!window.confirm(message)) return;

          (state.orders || []).forEach(order => {
            if (normalizeAccountName(order['账号']) === account) {
              order['账号'] = '';
            }
          });

          if (removeAccount(account)) markAccountsDirty();
          if (state.activeAccount === account) state.activeAccount = '__all__';
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
      getUniqueAccounts,
      renderAccTabs
    };
  }

  return {
    create
  };
})();
