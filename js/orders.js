/* ============================================================
 * 模块 2：订单跟踪器（GitHub Gist 存储，多用户隔离）
 * ============================================================ */
const OrderTracker = (function () {
  const LS_KEY = 'tk.orders.cfg.v1';
  const LS_ACC_KEY = 'tk.orders.accounts.v1';
  const GIST_FILENAME = 'tk-order-tracker.json';

  const state = { token: '', gistId: '', user: '', orders: [], editingId: null, loaded: false, accounts: [], activeAccount: null };

  const $ = sel => document.querySelector(sel);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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
    localStorage.setItem(LS_KEY, JSON.stringify({
      token: state.token, gistId: state.gistId, user: state.user
    }));
  }
  function loadCfg() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }
    catch (e) { return null; }
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
    if (!acc) return;
    // 去重 & 最近使用置顶
    state.accounts = [acc, ...state.accounts.filter(a => a !== acc)];
    if (state.accounts.length > 30) state.accounts = state.accounts.slice(0, 30);
    saveAccounts();
  }
  function removeAccount(acc) {
    state.accounts = state.accounts.filter(a => a !== acc);
    saveAccounts();
    renderAccDropdown();
  }
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

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ---------- date math ---------- */
  function todayStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  function addDays(ymd, n) {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}`;
  }
  function diffDays(a, b) {
    if (!a || !b) return NaN;
    const [ya, ma, da] = a.split('-').map(Number);
    const [yb, mb, db] = b.split('-').map(Number);
    return Math.round((Date.UTC(ya, ma - 1, da) - Date.UTC(yb, mb - 1, db)) / 86400000);
  }

  /* ---------- 预警公式（完全按 Excel 原公式翻译） ----------
   * =IF(L="订单取消","取消订单",
   *   IF(L="已入仓","入仓完成",
   *     IF(L="已完成","订单完成",
   *       IF(L="已送达","订单送达",
   *         IF(TODAY()-C<0,
   *            IF(-(TODAY()-C)<=2,"延误风险",-(TODAY()-C)),
   *            "已超期")))))
   * L = 入仓状态, C = 最晚到仓时间
   * ------------------------------------------------ */
  function computeWarning(order) {
    const L = order['入仓状态'] || '';
    const C = order['最晚到仓时间'] || '';
    if (L === '订单取消') return { text: '取消订单', cls: 'muted' };
    if (L === '已入仓') return { text: '入仓完成', cls: 'ok' };
    if (L === '已完成') return { text: '订单完成', cls: 'ok' };
    if (L === '已送达') return { text: '订单送达', cls: 'ok' };
    if (!C) return { text: '-', cls: 'muted' };
    const tmc = diffDays(todayStr(), C);
    if (tmc < 0) {
      const remaining = -tmc;
      if (remaining <= 2) return { text: '延误风险', cls: 'danger' };
      return { text: `剩 ${remaining} 天`, cls: 'info' };
    }
    return { text: '已超期', cls: 'danger' };
  }

  /* ---------- GitHub Gist API ---------- */
  async function gh(method, path, body) {
    const resp = await fetch('https://api.github.com' + path, {
      method,
      headers: {
        'Authorization': 'token ' + state.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`GitHub API ${resp.status}: ${txt.slice(0, 200)}`);
    }
    return resp.json();
  }
  async function verifyToken() { return await gh('GET', '/user'); }
  async function createGist() {
    const g = await gh('POST', '/gists', {
      description: 'TK Toolbox · Order Tracker Data (private)',
      public: false,
      files: { [GIST_FILENAME]: { content: JSON.stringify({ version: 1, orders: [] }, null, 2) } }
    });
    return g.id;
  }
  async function loadFromGist() {
    setSync('加载中…', 'saving');
    try {
      const g = await gh('GET', '/gists/' + state.gistId);
      let file = g.files[GIST_FILENAME];
      if (!file) {
        // 兼容旧文件名
        const firstKey = Object.keys(g.files)[0];
        file = firstKey ? g.files[firstKey] : null;
      }
      if (!file) { state.orders = []; }
      else {
        let content = file.content;
        if (file.truncated && file.raw_url) {
          const r = await fetch(file.raw_url);
          content = await r.text();
        }
        const data = JSON.parse(content || '{}');
        state.orders = Array.isArray(data.orders) ? data.orders : [];
      }
      setSync(`已同步 · ${state.orders.length} 条`, 'saved');
    } catch (e) {
      setSync('加载失败', 'error');
      toast('加载失败: ' + e.message, 'error');
      throw e;
    }
  }
  async function saveToGist() {
    setSync('保存中…', 'saving');
    try {
      await gh('PATCH', '/gists/' + state.gistId, {
        files: { [GIST_FILENAME]: { content: JSON.stringify({ version: 1, orders: state.orders }, null, 2) } }
      });
      setSync(`已同步 · ${state.orders.length} 条`, 'saved');
    } catch (e) {
      setSync('保存失败', 'error');
      toast('保存失败: ' + e.message, 'error');
      throw e;
    }
  }

  /* ---------- 账号标签栏 ---------- */
  function getUniqueAccounts() {
    const set = new Set();
    state.orders.forEach(o => {
      const acc = (o['账号'] || '').trim();
      if (acc) set.add(acc);
    });
    // 也包含 accounts 列表中的（历史记忆的），确保标签栏正确
    state.accounts.forEach(a => { if (a) set.add(a); });
    return [...set];
  }

  function renderAccTabs() {
    const container = $('#ot-acc-tabs');
    const accs = getUniqueAccounts();

    let html = '';
    if (!accs.length) {
      html = '<span style="color:var(--muted);font-size:12.5px">暂无账号，点击右侧 + 号即可添加</span>';
    } else {
      // 如果当前选中的账号不在列表中（且不是全部），默认选"全部"
      if (state.activeAccount !== '__all__' && (!state.activeAccount || !accs.includes(state.activeAccount))) {
        state.activeAccount = '__all__';
      }
      const countMap = {};
      state.orders.forEach(o => {
        const acc = (o['账号'] || '').trim();
        if (acc) countMap[acc] = (countMap[acc] || 0) + 1;
      });
      // "全部"标签
      const allActive = state.activeAccount === '__all__';
      html = `<span class="tab${allActive ? ' active' : ''}" data-tab-acc="__all__">
        全部<span class="tab-count">(${state.orders.length})</span>
      </span>`;
      html += accs.map(a => {
        const isActive = a === state.activeAccount;
        const cnt = countMap[a] || 0;
        return `<span class="tab${isActive ? ' active' : ''}" data-tab-acc="${escapeHtml(a)}">
          ${escapeHtml(a)}<span class="tab-count">(${cnt})</span>
          <div class="tab-actions">
            <span class="t-btn tab-edit" data-tab-edit="${escapeHtml(a)}" title="重命名">✎</span>
            <span class="t-btn danger tab-del" data-tab-del="${escapeHtml(a)}" title="删除">×</span>
          </div>
        </span>`;
      }).join('');
    }

    html += '<button class="tab-add" id="ot-tab-add" title="添加账号" style="vertical-align:middle;margin-left:8px">+</button>';
    container.innerHTML = html;

    // 账号重命名逻辑（提出来复用）
    async function triggerRename(oldName) {
      const newName = await promptAddAccount(oldName, '重命名账号');
      if (!newName || newName === oldName) return;

      // 更新 history 中的数据
      state.accounts = state.accounts.map(a => a === oldName ? newName : a);
      saveAccounts();

      // 更新订单数据中的账号
      state.orders.forEach(o => {
        if ((o['账号'] || '').trim() === oldName) {
          o['账号'] = newName;
        }
      });

      if (state.activeAccount === oldName) state.activeAccount = newName;
      renderAccTabs();
      renderTable();
      saveToGist().then(() => toast('已重命名账号', 'ok')).catch(() => { });
    }

    // 点击/双击切换和重命名
    container.querySelectorAll('.tab[data-tab-acc]').forEach(tab => {
      tab.addEventListener('click', e => {
        if (e.target.closest('.tab-del') || e.target.closest('.tab-edit')) return;
        const targetAcc = tab.dataset.tabAcc;
        if (targetAcc === '__all__') {
          state.activeAccount = targetAcc;
          renderAccTabs();
          renderTable();
          return;
        }
        state.activeAccount = targetAcc;
        renderAccTabs();
        renderTable();
      });
      tab.addEventListener('dblclick', e => {
        if (e.target.closest('.tab-del') || e.target.closest('.tab-edit')) return;
        const targetAcc = tab.dataset.tabAcc;
        if (targetAcc === '__all__') return;
        triggerRename(targetAcc);
      });
    });
    // 编辑按钮重命名
    container.querySelectorAll('.tab-edit[data-tab-edit]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        triggerRename(btn.dataset.tabEdit);
      });
    });
    // 删除账号
    container.querySelectorAll('.tab-del[data-tab-del]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const acc = btn.dataset.tabDel;
        const orderCount = state.orders.filter(o => (o['账号'] || '').trim() === acc).length;
        const msg = orderCount > 0
          ? `确定删除账号「${acc}」？\n该账号下的 ${orderCount} 条订单数据将变为未关联（落入“全部”中）。`
          : `确定删除账号「${acc}」？`;
        if (!confirm(msg)) return;

        // 软删除订单账号：不清空数据，仅把归属账号清空
        state.orders.forEach(o => {
          if ((o['账号'] || '').trim() === acc) {
            o['账号'] = '';
          }
        });

        // 从账号历史中移除
        removeAccount(acc);
        // 重置选中
        if (state.activeAccount === acc) state.activeAccount = '__all__';
        renderAccTabs();
        renderTable();
        saveToGist().then(() => toast('已删除该账号标记', 'ok')).catch(() => { });
      });
    });
    const addBtn = container.querySelector('#ot-tab-add');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const name = await promptAddAccount();
        if (!name) return;
        addAccount(name);
        state.activeAccount = name;
        renderAccTabs();
        renderTable();
      });
    }
  }

  /* ---------- 渲染表格 ---------- */
  function renderTable() {
    const wrap = $('#ot-table-container');
    // 按当前选中账号过滤
    const isAll = state.activeAccount === '__all__';
    const filtered = isAll
      ? state.orders
      : state.activeAccount
        ? state.orders.filter(o => (o['账号'] || '').trim() === state.activeAccount)
        : state.orders;

    if (!filtered.length) {
      const msg = state.activeAccount
        ? `账号「${escapeHtml(state.activeAccount)}」下还没有订单`
        : '还没有订单';
      wrap.innerHTML = `
        <div class="ot-empty">
          <div style="font-size:15px;margin-bottom:6px">${msg}</div>
          <div style="font-size:12.5px">点击右上角「+ 新增订单」开始记录</div>
        </div>`;
      return;
    }
    const rows = filtered.map((o, i) => {
      const warn = computeWarning(o);
      return `
        <tr>
          <td style="color:var(--muted)">${i + 1}</td>
          ${isAll ? `<td><span class="chip muted">${escapeHtml(o['账号'] || '-')}</span></td>` : ''}
          <td>${escapeHtml(o['下单时间'])}</td>
          <td>${escapeHtml(o['采购日期'])}</td>
          <td>${escapeHtml(o['最晚到仓时间'])}</td>
          <td><span class="chip ${warn.cls}">${escapeHtml(warn.text)}</span></td>
          <td>${escapeHtml(o['订单号'])}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(o['产品名称'])}">${escapeHtml(o['产品名称'])}</td>
          <td>${escapeHtml(o['数量'])}</td>
          <td>${escapeHtml(o['采购价格'])}</td>
          <td>${escapeHtml(o['订单状态'])}</td>
          <td>${escapeHtml(o['快递公司'])}</td>
          <td>${escapeHtml(o['快递单号'])}</td>
          <td>${escapeHtml(o['入仓状态'])}</td>
          <td>
            <button class="btn sm" data-edit="${o.id}">编辑</button>
            <button class="btn sm danger" data-del="${o.id}">删除</button>
          </td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
      <table class="ot">
        <thead>
          <tr>
            <th>#</th>${isAll ? '<th>账号</th>' : ''}<th>下单时间</th><th>采购日期</th><th>最晚到仓</th>
            <th>订单预警</th><th>订单号</th><th>产品名称</th>
            <th>数量</th><th>采购价(元)</th><th>订单状态</th>
            <th>快递公司</th><th>快递单号</th><th>入仓状态</th><th>操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

    wrap.querySelectorAll('[data-edit]').forEach(b => {
      b.onclick = () => openModal(b.dataset.edit);
    });
    wrap.querySelectorAll('[data-del]').forEach(b => {
      b.onclick = () => deleteOrder(b.dataset.del);
    });
  }

  /* ---------- 弹窗 / CRUD ---------- */
  function updateModalAccountSelect(selectedAcc) {
    const sel = $('#ot-acc-select');
    const accs = getUniqueAccounts();
    sel.innerHTML = accs.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('') +
      `<option value="__ADD__">+ 添加新账号...</option>`;
    if (selectedAcc && accs.includes(selectedAcc)) sel.value = selectedAcc;
    else if (accs.length) sel.value = accs[0];
  }

  function openModal(editId = null) {
    const form = $('#ot-form');
    form.reset();
    state.editingId = editId;
    if (editId) {
      const o = state.orders.find(x => x.id === editId);
      if (!o) return;
      $('#ot-modal-title').textContent = '编辑订单';
      updateModalAccountSelect(o['账号'] || '');
      for (const [k, v] of Object.entries(o)) {
        if (k === '账号') continue;
        const el = form.querySelector(`[name="${k}"]`);
        if (el) el.value = v ?? '';
      }
    } else {
      $('#ot-modal-title').textContent = '新增订单';
      form.querySelector('[name="下单时间"]').value = todayStr();
      // 默认填入当前选中的账号
      let defaultAcc = null;
      if (state.activeAccount && state.activeAccount !== '__all__') {
        defaultAcc = state.activeAccount;
      } else if (state.accounts.length) {
        defaultAcc = state.accounts[0];
      }
      updateModalAccountSelect(defaultAcc);
    }
    recomputeAuto();
    $('#ot-modal').classList.add('show');
  }
  function closeModal() {
    $('#ot-modal').classList.remove('show');
    state.editingId = null;
  }
  function recomputeAuto() {
    const form = $('#ot-form');
    const ordered = form.querySelector('[name="下单时间"]').value;
    form.querySelector('[name="最晚到仓时间"]').value = ordered ? addDays(ordered, 6) : '';
    const tmp = Object.fromEntries(new FormData(form).entries());
    form.querySelector('[name="订单预警"]').value = computeWarning(tmp).text;
  }
  async function submitForm(e) {
    e.preventDefault();
    const obj = Object.fromEntries(new FormData(e.target).entries());
    if (obj['账号'] === '__ADD__') {
      toast('请选择有效的账号', 'error');
      return;
    }
    obj['最晚到仓时间'] = obj['下单时间'] ? addDays(obj['下单时间'], 6) : '';
    obj['订单预警'] = computeWarning(obj).text;
    // 记忆账号
    if (obj['账号']) addAccount(obj['账号']);
    if (state.editingId) {
      const idx = state.orders.findIndex(x => x.id === state.editingId);
      if (idx >= 0) state.orders[idx] = { ...state.orders[idx], ...obj };
    } else {
      state.orders.unshift({ id: uid(), ...obj });
    }
    closeModal();
    renderAccTabs();
    renderTable();
    try { await saveToGist(); toast('已保存到 Gist', 'ok'); } catch (e) { }
  }
  async function deleteOrder(id) {
    if (!confirm('确定删除这条订单？删除后需要手动从 Gist 历史恢复。')) return;
    state.orders = state.orders.filter(o => o.id !== id);
    renderAccTabs();
    renderTable();
    try { await saveToGist(); toast('已删除', 'ok'); } catch (e) { }
  }

  /* ---------- 切换到主面板 ---------- */
  function showMain() {
    $('#ot-setup').style.display = 'none';
    $('#ot-main').style.display = 'block';
    $('#ot-user').textContent = state.user
      ? `${state.user} · Gist ${state.gistId.slice(0, 7)}…`
      : `Gist ${state.gistId.slice(0, 7)}…`;
  }
  function showSetup() {
    $('#ot-setup').style.display = 'block';
    $('#ot-main').style.display = 'none';
  }

  /* ---------- 连接按钮 ---------- */
  async function connect() {
    const token = $('#ot-token').value.trim();
    const gistId = $('#ot-gistid').value.trim();
    if (!token) { toast('请填写 Token', 'error'); return; }
    state.token = token;
    const btn = $('#ot-connect');
    btn.disabled = true;
    btn.textContent = '连接中…';
    try {
      const user = await verifyToken();
      state.user = user.login;
      if (gistId) state.gistId = gistId;
      else {
        toast(`你好 ${user.login}，正在创建 Gist…`, 'ok');
        state.gistId = await createGist();
      }
      saveCfg();
      showMain();
      await loadFromGist();
      renderAccTabs();
      renderTable();
      toast(`已连接: ${user.login}`, 'ok');
    } catch (e) {
      toast('连接失败: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '连接并开始使用';
    }
  }

  function logout() {
    if (!confirm('退出后需要重新粘贴 Token。你的订单数据仍保存在你 GitHub 账号的 Gist 里。确定？')) return;
    localStorage.removeItem(LS_KEY);
    state.token = ''; state.gistId = ''; state.user = '';
    state.orders = []; state.loaded = false;
    showSetup();
    $('#ot-token').value = '';
    $('#ot-gistid').value = '';
  }

  async function refresh() {
    if (!state.token) { return; }
    try { await loadFromGist(); renderAccTabs(); renderTable(); toast('已刷新', 'ok'); } catch (e) { }
  }

  function copyGist() {
    if (!state.gistId) return;
    navigator.clipboard?.writeText(state.gistId).then(
      () => toast('Gist ID 已复制', 'ok'),
      () => toast('复制失败，请手动选择', 'error')
    );
  }

  /* ---------- 事件绑定 ---------- */
  function init() {
    $('#ot-connect').onclick = connect;
    $('#ot-add').onclick = () => openModal();
    $('#ot-refresh').onclick = refresh;
    $('#ot-copy-gist').onclick = copyGist;
    $('#ot-logout').onclick = logout;
    $('#ot-cancel').onclick = closeModal;
    $('#ot-form').onsubmit = submitForm;
    $('#ot-form [name="下单时间"]').addEventListener('change', recomputeAuto);
    $('#ot-form [name="入仓状态"]').addEventListener('change', recomputeAuto);
    $('#ot-modal').addEventListener('click', e => {
      if (e.target.id === 'ot-modal') closeModal();
    });

    // 监听 select 变化，如果选择了添加账号，则打开弹窗
    const accSelect = $('#ot-acc-select');
    let prevAccValue = '';
    accSelect.addEventListener('focus', () => { prevAccValue = accSelect.value; });
    accSelect.addEventListener('change', async () => {
      if (accSelect.value === '__ADD__') {
        const newName = await promptAddAccount();
        if (newName) {
          addAccount(newName);
          updateModalAccountSelect(newName);
        } else {
          accSelect.value = prevAccValue; // 恢复原来的选项
        }
      } else {
        prevAccValue = accSelect.value;
      }
    });


  }

  /* ---------- 进入模块时触发 ---------- */
  async function onEnter() {
    // 每次进入都重新加载账号历史（可能在另一个 tab 里有变更）
    state.accounts = loadAccounts();
    if (state.loaded) return;
    const cfg = loadCfg();
    if (cfg && cfg.token && cfg.gistId) {
      state.token = cfg.token;
      state.gistId = cfg.gistId;
      state.user = cfg.user || '';
      showMain();
      try {
        await loadFromGist();
        renderAccTabs();
        renderTable();
        state.loaded = true;
      } catch (e) {
        showSetup();
      }
    } else {
      showSetup();
    }
  }

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
