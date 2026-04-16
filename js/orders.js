/* ============================================================
 * 模块 2：订单跟踪器（IndexedDB 本地优先 + GitHub Gist 同步）
 * ============================================================ */
const OrderTracker = (function () {
  const LS_KEY = 'tk.orders.cfg.v1';
  const LS_ACC_KEY = 'tk.orders.accounts.v1';
  const GIST_FILENAME = 'tk-order-tracker.json';
  const CACHE_DB_NAME = 'tk-toolbox-cache';
  const CACHE_STORE = 'order-tracker-sessions';
  const CACHE_VERSION = 1;
  const REMOTE_DATA_VERSION = 2;
  const SYNC_DEBOUNCE_MS = 700;

  const state = {
    token: '',
    gistId: '',
    user: '',
    orders: [],
    editingId: null,
    loaded: false,
    accounts: [],
    activeAccount: null,
    sortOrder: 'asc',
    dirty: false,
    localUpdatedAt: '',
    lastRemoteUpdatedAt: '',
    lastSyncedAt: '',
    localRevision: 0
  };

  const $ = sel => document.querySelector(sel);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  let dbPromise = null;
  let syncTimer = null;
  let syncInFlight = false;
  let syncQueued = false;

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
  function nowIso() {
    return new Date().toISOString();
  }
  function getCacheKey(gistId = state.gistId) {
    return gistId ? `gist:${gistId}` : '';
  }
  async function openCacheDb() {
    if (typeof indexedDB === 'undefined') return null;
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(CACHE_DB_NAME, CACHE_VERSION);
      req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'));
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
    }).catch(err => {
      dbPromise = null;
      throw err;
    });
    return dbPromise;
  }
  async function readCacheRecord(gistId = state.gistId) {
    const key = getCacheKey(gistId);
    if (!key) return null;
    const db = await openCacheDb();
    if (!db) return null;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const store = tx.objectStore(CACHE_STORE);
      const req = store.get(key);
      req.onerror = () => reject(req.error || new Error('读取本地缓存失败'));
      req.onsuccess = () => resolve(req.result || null);
    });
  }
  async function writeCacheRecord() {
    const key = getCacheKey();
    if (!key) return false;
    const db = await openCacheDb();
    if (!db) return false;
    const record = {
      key,
      gistId: state.gistId,
      version: REMOTE_DATA_VERSION,
      orders: state.orders,
      dirty: !!state.dirty,
      localUpdatedAt: state.localUpdatedAt || '',
      lastRemoteUpdatedAt: state.lastRemoteUpdatedAt || '',
      lastSyncedAt: state.lastSyncedAt || '',
      cachedAt: nowIso()
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('写入本地缓存失败'));
      tx.objectStore(CACHE_STORE).put(record);
    });
    return true;
  }
  function applyCacheRecord(record) {
    state.orders = Array.isArray(record?.orders) ? record.orders : [];
    state.dirty = !!record?.dirty;
    state.localUpdatedAt = record?.localUpdatedAt || '';
    state.lastRemoteUpdatedAt = record?.lastRemoteUpdatedAt || '';
    state.lastSyncedAt = record?.lastSyncedAt || '';
    state.localRevision = 0;
  }
  async function persistCache() {
    try {
      await writeCacheRecord();
      return true;
    } catch (e) {
      setSync('本地缓存写入失败', 'error');
      toast('本地缓存写入失败: ' + e.message, 'error');
      return false;
    }
  }
  async function hydrateCache(gistId = state.gistId) {
    try {
      const record = await readCacheRecord(gistId);
      if (!record) return false;
      applyCacheRecord(record);
      return true;
    } catch (e) {
      setSync('本地缓存读取失败', 'error');
      toast('本地缓存读取失败: ' + e.message, 'error');
      return false;
    }
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
      files: { [GIST_FILENAME]: { content: JSON.stringify({ version: REMOTE_DATA_VERSION, updatedAt: nowIso(), orders: [] }, null, 2) } }
    });
    return g.id;
  }
  function normalizeRemoteSnapshot(data, gistUpdatedAt = '') {
    return {
      version: typeof data?.version === 'number' ? data.version : 1,
      updatedAt: (typeof data?.updatedAt === 'string' && data.updatedAt) ? data.updatedAt : gistUpdatedAt,
      orders: Array.isArray(data?.orders) ? data.orders : []
    };
  }
  async function fetchGistSnapshot() {
    const g = await gh('GET', '/gists/' + state.gistId);
    let file = g.files[GIST_FILENAME];
    if (!file) {
      const firstKey = Object.keys(g.files)[0];
      file = firstKey ? g.files[firstKey] : null;
    }
    if (!file) return normalizeRemoteSnapshot({ version: REMOTE_DATA_VERSION, orders: [] }, g.updated_at || '');

    let content = file.content;
    if (file.truncated && file.raw_url) {
      const r = await fetch(file.raw_url);
      content = await r.text();
    }
    const data = JSON.parse(content || '{}');
    return normalizeRemoteSnapshot(data, g.updated_at || '');
  }
  function buildRemotePayload() {
    return {
      version: REMOTE_DATA_VERSION,
      updatedAt: state.localUpdatedAt || nowIso(),
      orders: state.orders
    };
  }
  async function pushStateToGist(payload = buildRemotePayload()) {
    await gh('PATCH', '/gists/' + state.gistId, {
      files: { [GIST_FILENAME]: { content: JSON.stringify(payload, null, 2) } }
    });
    return payload;
  }
  function applyRemoteSnapshot(snapshot) {
    state.orders = snapshot.orders;
    state.localUpdatedAt = snapshot.updatedAt || nowIso();
    state.lastRemoteUpdatedAt = snapshot.updatedAt || '';
    state.lastSyncedAt = nowIso();
    state.dirty = false;
    state.localRevision = 0;
  }
  async function applyAndRenderRemoteSnapshot(snapshot) {
    applyRemoteSnapshot(snapshot);
    await persistCache();
    renderAccTabs();
    renderTable();
  }
  function renderLocalOrders(statusText, statusClass = 'local') {
    renderAccTabs();
    renderTable();
    setSync(statusText, statusClass);
  }
  function markOrdersDirty() {
    state.dirty = true;
    state.localUpdatedAt = nowIso();
    state.localRevision += 1;
  }
  function queueSync(delay = SYNC_DEBOUNCE_MS) {
    if (!state.token || !state.gistId) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      void syncNow();
    }, delay);
  }
  async function commitLocalOrders(statusText = '已保存到本地，等待同步…') {
    renderLocalOrders(statusText, 'local');
    await persistCache();
    queueSync();
  }
  async function syncNow({ forcePull = false } = {}) {
    if (!state.token || !state.gistId) return false;
    if (syncInFlight) {
      syncQueued = true;
      return false;
    }
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }

    syncInFlight = true;
    try {
      if (state.dirty) {
        setSync('正在同步到 Gist…', 'saving');
        const remote = await fetchGistSnapshot();
        const remoteUpdatedAt = remote.updatedAt || '';
        const knownRemoteUpdatedAt = state.lastRemoteUpdatedAt || '';
        if (knownRemoteUpdatedAt && remoteUpdatedAt && remoteUpdatedAt !== knownRemoteUpdatedAt) {
          setSync('云端有更新，请先刷新', 'error');
          toast('检测到另一端已修改 Gist，当前未自动覆盖，请先点刷新。', 'error');
          return false;
        }

        const payload = buildRemotePayload();
        const syncedRevision = state.localRevision;
        await pushStateToGist(payload);
        state.lastSyncedAt = nowIso();
        state.lastRemoteUpdatedAt = payload.updatedAt;
        if (state.localRevision === syncedRevision) {
          state.localUpdatedAt = payload.updatedAt;
          state.dirty = false;
        } else {
          state.dirty = true;
          syncQueued = true;
        }
        await persistCache();
        setSync(state.dirty ? '本地已更新，继续等待同步…' : `已同步 · ${state.orders.length} 条`, state.dirty ? 'saving' : 'saved');
        return !state.dirty;
      }

      setSync(forcePull ? '正在刷新云端数据…' : '正在检查云端更新…', 'saving');
      const remote = await fetchGistSnapshot();
      const remoteUpdatedAt = remote.updatedAt || '';
      const shouldApplyRemote = forcePull
        || !state.lastRemoteUpdatedAt
        || remoteUpdatedAt !== state.lastRemoteUpdatedAt;

      if (shouldApplyRemote) {
        await applyAndRenderRemoteSnapshot(remote);
      }
      setSync(`已同步 · ${state.orders.length} 条`, 'saved');
      return true;
    } catch (e) {
      setSync(state.dirty ? '同步失败，已保留本地缓存' : '加载失败', 'error');
      toast((state.dirty ? '同步失败' : '加载失败') + ': ' + e.message, 'error');
      return false;
    } finally {
      syncInFlight = false;
      if (syncQueued) {
        syncQueued = false;
        void syncNow();
      }
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
      markOrdersDirty();
      await commitLocalOrders('账号已重命名，等待同步…');
      toast('已重命名账号', 'ok');
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
        markOrdersDirty();
        void commitLocalOrders('账号标记已更新，等待同步…');
        toast('已删除该账号标记', 'ok');
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
      const msg = (state.activeAccount && state.activeAccount !== '__all__')
        ? `账号「${escapeHtml(state.activeAccount)}」下还没有订单`
        : '还没有订单';
      wrap.innerHTML = `
        <div class="ot-empty">
          <div style="font-size:15px;margin-bottom:6px">${msg}</div>
          <div style="font-size:12.5px">点击右上角「+ 新增订单」开始记录</div>
        </div>`;
      return;
    }
    const allIds = state.orders.map(o => o.id);

    // 按添加时间正/倒序排列（orders 数组新的在前，所以正序需反转 index）
    let sorted = [...filtered];
    sorted.sort((a, b) => {
      const ia = allIds.indexOf(a.id);
      const ib = allIds.indexOf(b.id);
      return state.sortOrder === 'asc' ? ib - ia : ia - ib;
    });
    const total = sorted.length;

    const rows = sorted.map((o, i) => {
      const seqNum = state.sortOrder === 'asc' ? i + 1 : total - i;
      const warn = computeWarning(o);
      return `
        <tr>
          <td style="color:var(--muted)">${seqNum}</td>
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

    const sortIcon = state.sortOrder === 'asc' ? '↑' : '↓';
    const sortTitle = state.sortOrder === 'asc' ? '当前正序（最早在上），点击切换' : '当前倒序（最新在上），点击切换';

    wrap.innerHTML = `
      <table class="ot">
        <thead>
          <tr>
            <th><span id="ot-sort-btn" title="${sortTitle}" style="cursor:pointer;user-select:none"># ${sortIcon}</span></th>${isAll ? '<th>账号</th>' : ''}<th>下单时间</th><th>采购日期</th><th>最晚到仓</th>
            <th>订单预警</th><th>订单号</th><th>产品名称</th>
            <th>数量</th><th>采购价(元)</th><th>订单状态</th>
            <th>快递公司</th><th>快递单号</th><th>入仓状态</th><th>操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

    const sortBtn = wrap.querySelector('#ot-sort-btn');
    if (sortBtn) {
      sortBtn.addEventListener('click', () => {
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
        renderTable();
      });
    }

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
    markOrdersDirty();
    await commitLocalOrders('已保存到本地，等待同步…');
    toast('已保存到本地', 'ok');
  }
  async function deleteOrder(id) {
    if (!confirm('确定删除这条订单？删除后需要手动从 Gist 历史恢复。')) return;
    state.orders = state.orders.filter(o => o.id !== id);
    markOrdersDirty();
    await commitLocalOrders('已删除，本地已更新，等待同步…');
    toast('已删除', 'ok');
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
      const hasCache = await hydrateCache();
      if (hasCache) {
        renderLocalOrders(state.dirty ? `本地缓存已恢复 · ${state.orders.length} 条，等待同步…` : `本地缓存已恢复 · ${state.orders.length} 条`);
      } else {
        state.orders = [];
        state.activeAccount = '__all__';
        state.dirty = false;
        state.localUpdatedAt = '';
        state.lastRemoteUpdatedAt = '';
        state.lastSyncedAt = '';
        renderLocalOrders('本地暂无缓存，正在读取 Gist…', 'saving');
      }
      await syncNow({ forcePull: !state.dirty });
      state.loaded = true;
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
    state.dirty = false;
    state.localUpdatedAt = '';
    state.lastRemoteUpdatedAt = '';
    state.lastSyncedAt = '';
    state.localRevision = 0;
    showSetup();
    $('#ot-token').value = '';
    $('#ot-gistid').value = '';
  }

  async function refresh() {
    if (!state.token) { return; }
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
        state.orders = [];
        state.activeAccount = '__all__';
        state.dirty = false;
        state.localUpdatedAt = '';
        state.lastRemoteUpdatedAt = '';
        state.lastSyncedAt = '';
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
