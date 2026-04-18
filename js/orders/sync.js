/* ============================================================
 * 订单跟踪器：同步与存储
 * ============================================================ */
const OrderTrackerSync = (function () {
  function create({ state, constants, helpers, ui }) {
    const {
      GIST_FILENAME,
      META_FILENAME,
      CACHE_DB_NAME,
      CACHE_STORE,
      CACHE_VERSION,
      REMOTE_DATA_VERSION,
      SYNC_DEBOUNCE_MS
    } = constants;
    const {
      nowIso,
      normalizeOrderList,
      cloneOrder,
      mergeOrdersById,
      uniqueAccounts,
      listOrderAccounts,
      groupOrdersByAccountSlot,
      flattenOrdersByAccountSlot,
      toAccountSlot,
      fromAccountSlot,
      getAccountFileName,
      parseAccountSlotFromFileName
    } = helpers;
    const {
      setSync,
      toast,
      renderAccTabs,
      renderTable,
      saveAccounts
    } = ui;

    let dbPromise = null;
    let syncTimer = null;
    let syncInFlight = false;
    let syncQueued = false;

    function latestIso(values) {
      return (values || []).filter(Boolean).sort().slice(-1)[0] || '';
    }

    function computeDirtyState() {
      return !!(state.accountsDirty || Object.values(state.dirtyAccounts || {}).some(Boolean));
    }

    function refreshDirtyState() {
      state.dirty = computeDirtyState();
      state.localUpdatedAt = latestIso([
        state.accountsLocalUpdatedAt,
        ...Object.values(state.accountLocalUpdatedAt || {})
      ]);
      state.lastRemoteUpdatedAt = latestIso([
        state.accountsLastRemoteUpdatedAt,
        ...Object.values(state.accountRemoteUpdatedAt || {})
      ]);
      state.lastSyncedAt = latestIso([
        state.accountsLastSyncedAt,
        ...Object.values(state.accountLastSyncedAt || {})
      ]);
      state.localRevision = state.accountsRevision + Object.values(state.accountLocalRevisions || {}).reduce((sum, value) => sum + (value || 0), 0);
    }

    function markAccountsDirty() {
      state.accountsDirty = true;
      state.accountsLocalUpdatedAt = nowIso();
      state.accountsRevision += 1;
      refreshDirtyState();
    }

    function markOrderAccountsDirty(accounts) {
      const slots = [...new Set((accounts || []).map(toAccountSlot))];
      if (!slots.length) return;
      const updatedAt = nowIso();
      slots.forEach(slot => {
        state.dirtyAccounts[slot] = true;
        state.accountLocalUpdatedAt[slot] = updatedAt;
        state.accountLocalRevisions[slot] = (state.accountLocalRevisions[slot] || 0) + 1;
      });
      refreshDirtyState();
    }

    function clearAccountDirtyState(slot) {
      delete state.dirtyAccounts[slot];
      delete state.accountLocalRevisions[slot];
      refreshDirtyState();
    }

    function getDirtyAccountSlots() {
      return Object.keys(state.dirtyAccounts || {}).filter(slot => state.dirtyAccounts[slot]);
    }

    function buildMetaPayload(updatedAt = state.accountsLocalUpdatedAt || nowIso(), orders = state.orders, accounts = state.accounts) {
      return {
        version: REMOTE_DATA_VERSION,
        updatedAt,
        accounts: uniqueAccounts([...(accounts || []), ...listOrderAccounts(orders)])
      };
    }

    function normalizeMetaPayload(data, fallbackUpdatedAt = '') {
      return {
        version: typeof data?.version === 'number' ? data.version : REMOTE_DATA_VERSION,
        updatedAt: (typeof data?.updatedAt === 'string' && data.updatedAt) ? data.updatedAt : fallbackUpdatedAt,
        accounts: uniqueAccounts(data?.accounts)
      };
    }

    function normalizeAccountPayload(data, account, fallbackUpdatedAt = '') {
      return {
        version: typeof data?.version === 'number' ? data.version : REMOTE_DATA_VERSION,
        account: String(typeof data?.account === 'string' ? data.account : account || '').trim(),
        updatedAt: (typeof data?.updatedAt === 'string' && data.updatedAt) ? data.updatedAt : fallbackUpdatedAt,
        orders: normalizeOrderList(data?.orders)
      };
    }

    function buildAccountPayload(account, orders, updatedAt) {
      return {
        version: REMOTE_DATA_VERSION,
        account: String(account || '').trim(),
        updatedAt: updatedAt || nowIso(),
        orders: normalizeOrderList(orders)
      };
    }

    function resetTrackerState({ preserveAccounts = true } = {}) {
      state.orders = [];
      state.editingId = null;
      state.activeAccount = '__all__';
      state.sortOrder = 'asc';
      state.currentPage = 1;
      state.baseOrders = null;
      state.dirty = false;
      state.dirtyAccounts = {};
      state.accountRemoteUpdatedAt = {};
      state.accountLastSyncedAt = {};
      state.accountLocalUpdatedAt = {};
      state.accountLocalRevisions = {};
      state.accountsDirty = false;
      state.accountsLocalUpdatedAt = '';
      state.accountsLastRemoteUpdatedAt = '';
      state.accountsLastSyncedAt = '';
      state.accountsRevision = 0;
      state.localUpdatedAt = '';
      state.lastRemoteUpdatedAt = '';
      state.lastSyncedAt = '';
      state.localRevision = 0;
      if (!preserveAccounts) state.accounts = [];
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
        baseOrders: state.baseOrders,
        accounts: state.accounts,
        dirty: !!state.dirty,
        dirtyAccounts: state.dirtyAccounts,
        accountRemoteUpdatedAt: state.accountRemoteUpdatedAt,
        accountLastSyncedAt: state.accountLastSyncedAt,
        accountLocalUpdatedAt: state.accountLocalUpdatedAt,
        accountLocalRevisions: state.accountLocalRevisions,
        accountsDirty: !!state.accountsDirty,
        accountsLocalUpdatedAt: state.accountsLocalUpdatedAt || '',
        accountsLastRemoteUpdatedAt: state.accountsLastRemoteUpdatedAt || '',
        accountsLastSyncedAt: state.accountsLastSyncedAt || '',
        accountsRevision: state.accountsRevision || 0,
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
      state.orders = normalizeOrderList(record?.orders);
      state.baseOrders = Array.isArray(record?.baseOrders)
        ? normalizeOrderList(record.baseOrders)
        : (record?.dirty ? null : normalizeOrderList(record?.orders));
      state.accounts = uniqueAccounts(record?.accounts || state.accounts);
      state.dirtyAccounts = record?.dirtyAccounts || {};
      state.accountRemoteUpdatedAt = record?.accountRemoteUpdatedAt || {};
      state.accountLastSyncedAt = record?.accountLastSyncedAt || {};
      state.accountLocalUpdatedAt = record?.accountLocalUpdatedAt || {};
      state.accountLocalRevisions = record?.accountLocalRevisions || {};
      state.accountsDirty = !!record?.accountsDirty;
      state.accountsLocalUpdatedAt = record?.accountsLocalUpdatedAt || '';
      state.accountsLastRemoteUpdatedAt = record?.accountsLastRemoteUpdatedAt || record?.lastRemoteUpdatedAt || '';
      state.accountsLastSyncedAt = record?.accountsLastSyncedAt || record?.lastSyncedAt || '';
      state.accountsRevision = record?.accountsRevision || 0;
      if (!record?.accountRemoteUpdatedAt && record?.lastRemoteUpdatedAt) {
        Object.keys(groupOrdersByAccountSlot(state.orders)).forEach(slot => {
          state.accountRemoteUpdatedAt[slot] = record.lastRemoteUpdatedAt;
        });
      }
      if (!record?.dirtyAccounts && record?.dirty) {
        Object.keys(groupOrdersByAccountSlot(state.orders)).forEach(slot => {
          state.dirtyAccounts[slot] = true;
          state.accountLocalRevisions[slot] = state.accountLocalRevisions[slot] || 1;
          state.accountLocalUpdatedAt[slot] = state.accountLocalUpdatedAt[slot] || record.localUpdatedAt || nowIso();
        });
      }
      refreshDirtyState();
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

    async function verifyToken() {
      return await gh('GET', '/user');
    }

    async function createGist() {
      const gist = await gh('POST', '/gists', {
        description: 'TK Toolbox · Order Tracker Data (private)',
        public: false,
        files: { [META_FILENAME]: { content: JSON.stringify(buildMetaPayload(nowIso()), null, 2) } }
      });
      return gist.id;
    }

    async function readGistFileJson(file) {
      let content = file?.content || '';
      if (file?.truncated && file?.raw_url) {
        const response = await fetch(file.raw_url);
        content = await response.text();
      }
      return JSON.parse(content || '{}');
    }

    function normalizeLegacySnapshot(data, gistUpdatedAt = '') {
      return {
        version: typeof data?.version === 'number' ? data.version : REMOTE_DATA_VERSION,
        updatedAt: (typeof data?.updatedAt === 'string' && data.updatedAt) ? data.updatedAt : gistUpdatedAt,
        orders: normalizeOrderList(data?.orders)
      };
    }

    async function fetchGistSnapshot() {
      const gist = await gh('GET', '/gists/' + state.gistId);
      const files = gist.files || {};
      const grouped = {};
      const accountRemoteUpdatedAt = {};
      const metaFile = files[META_FILENAME] || null;
      const legacyFile = files[GIST_FILENAME] || null;
      const fallbackUpdatedAt = gist.updated_at || '';

      let meta = normalizeMetaPayload(null, fallbackUpdatedAt);
      let hasMeta = false;
      if (metaFile) {
        meta = normalizeMetaPayload(await readGistFileJson(metaFile), fallbackUpdatedAt);
        hasMeta = true;
      }

      for (const [filename, file] of Object.entries(files)) {
        const slot = parseAccountSlotFromFileName(filename);
        if (!slot) continue;
        const payload = normalizeAccountPayload(await readGistFileJson(file), fromAccountSlot(slot), fallbackUpdatedAt);
        grouped[slot] = payload.orders;
        accountRemoteUpdatedAt[slot] = payload.updatedAt;
      }

      Object.keys(grouped).forEach(slot => {
        const orders = grouped[slot] || [];
        const account = fromAccountSlot(slot);
        const shouldKeep = orders.length > 0
          || slot === constants.UNASSIGNED_ACCOUNT_SLOT
          || meta.accounts.includes(account);
        if (!shouldKeep) {
          delete grouped[slot];
          delete accountRemoteUpdatedAt[slot];
        }
      });

      const declaredSlots = meta.accounts.map(toAccountSlot);
      const allSlots = [...new Set([...declaredSlots, ...Object.keys(grouped)])];
      if (hasMeta || allSlots.length) {
        return {
          format: 'split',
          hasMeta,
          hasLegacy: !!legacyFile,
          metaUpdatedAt: meta.updatedAt || fallbackUpdatedAt,
          accounts: uniqueAccounts([...meta.accounts, ...Object.keys(grouped).map(fromAccountSlot)]),
          grouped,
          accountRemoteUpdatedAt,
          orders: flattenOrdersByAccountSlot(grouped, allSlots),
          updatedAt: latestIso([meta.updatedAt, ...Object.values(accountRemoteUpdatedAt)])
        };
      }

      if (legacyFile) {
        const legacy = normalizeLegacySnapshot(await readGistFileJson(legacyFile), fallbackUpdatedAt);
        const legacyGrouped = groupOrdersByAccountSlot(legacy.orders);
        Object.keys(legacyGrouped).forEach(slot => {
          accountRemoteUpdatedAt[slot] = legacy.updatedAt || fallbackUpdatedAt;
        });
        return {
          format: 'legacy',
          hasMeta: false,
          hasLegacy: true,
          metaUpdatedAt: '',
          accounts: listOrderAccounts(legacy.orders),
          grouped: legacyGrouped,
          accountRemoteUpdatedAt,
          orders: legacy.orders,
          updatedAt: legacy.updatedAt || fallbackUpdatedAt
        };
      }

      return {
        format: 'split',
        hasMeta: false,
        hasLegacy: false,
        metaUpdatedAt: '',
        accounts: [],
        grouped: {},
        accountRemoteUpdatedAt: {},
        orders: [],
        updatedAt: fallbackUpdatedAt
      };
    }

    async function pushFilesToGist(files) {
      await gh('PATCH', '/gists/' + state.gistId, { files });
    }

    function buildSplitFilesPayload({ grouped, slots, includeMeta = false, metaUpdatedAt = '', remoteGrouped = {}, removeLegacyFile = false }) {
      const files = {};
      const accountPayloads = {};
      const deletedSlots = [];
      let metaPayload = null;

      if (includeMeta) {
        metaPayload = buildMetaPayload(
          metaUpdatedAt || state.accountsLocalUpdatedAt || nowIso(),
          flattenOrdersByAccountSlot(grouped),
          state.accounts
        );
        files[META_FILENAME] = { content: JSON.stringify(metaPayload, null, 2) };
      }

      (slots || []).forEach(slot => {
        const account = fromAccountSlot(slot);
        const orders = normalizeOrderList(grouped[slot] || []);
        const filename = getAccountFileName(account);
        if (!orders.length) {
          if (remoteGrouped[slot]) {
            files[filename] = null;
            deletedSlots.push(slot);
          }
          return;
        }
        const payload = buildAccountPayload(account, orders, state.accountLocalUpdatedAt[slot] || nowIso());
        accountPayloads[slot] = payload;
        files[filename] = { content: JSON.stringify(payload, null, 2) };
      });

      if (removeLegacyFile) {
        files[GIST_FILENAME] = null;
      }

      return { files, metaPayload, accountPayloads, deletedSlots };
    }

    function applyRemoteSnapshot(snapshot) {
      state.orders = normalizeOrderList(snapshot.orders);
      state.baseOrders = normalizeOrderList(snapshot.orders);
      state.accounts = uniqueAccounts(snapshot.accounts || []);
      saveAccounts();
      state.accountRemoteUpdatedAt = { ...(snapshot.accountRemoteUpdatedAt || {}) };
      state.accountLastSyncedAt = Object.fromEntries(Object.keys(state.accountRemoteUpdatedAt).map(slot => [slot, nowIso()]));
      state.accountLocalUpdatedAt = {};
      state.accountLocalRevisions = {};
      state.dirtyAccounts = {};
      state.accountsDirty = false;
      state.accountsLocalUpdatedAt = '';
      state.accountsRevision = 0;
      state.accountsLastRemoteUpdatedAt = snapshot.metaUpdatedAt || '';
      state.accountsLastSyncedAt = nowIso();
      refreshDirtyState();
    }

    function finalizeSuccessfulSync({ metaPayload = null, accountPayloads = {}, deletedSlots = [], syncedAccountsRevision = 0, syncedAccountRevisions = {}, mergedOrders = null, nextAccountRemoteUpdatedAt = null }) {
      const syncedAt = nowIso();

      if (Array.isArray(mergedOrders)) {
        state.orders = normalizeOrderList(mergedOrders);
        state.baseOrders = normalizeOrderList(mergedOrders);
        state.accounts = uniqueAccounts([...(metaPayload?.accounts || state.accounts), ...listOrderAccounts(state.orders)]);
        saveAccounts();
      }
      if (nextAccountRemoteUpdatedAt && typeof nextAccountRemoteUpdatedAt === 'object') {
        state.accountRemoteUpdatedAt = { ...nextAccountRemoteUpdatedAt };
        state.accountLastSyncedAt = Object.fromEntries(Object.keys(state.accountRemoteUpdatedAt).map(slot => [slot, syncedAt]));
      }

      if (metaPayload) {
        state.accounts = uniqueAccounts([...(metaPayload.accounts || []), ...listOrderAccounts(state.orders)]);
        saveAccounts();
        state.accountsLastRemoteUpdatedAt = metaPayload.updatedAt;
        state.accountsLastSyncedAt = syncedAt;
        if (state.accountsDirty && state.accountsRevision === syncedAccountsRevision) {
          state.accountsDirty = false;
          state.accountsLocalUpdatedAt = '';
        } else if (state.accountsDirty) {
          syncQueued = true;
        }
      }

      const touchedSlots = [...new Set([...Object.keys(accountPayloads), ...(deletedSlots || [])])];
      touchedSlots.forEach(slot => {
        const payload = accountPayloads[slot] || null;
        if (payload) state.accountRemoteUpdatedAt[slot] = payload.updatedAt;
        else delete state.accountRemoteUpdatedAt[slot];
        state.accountLastSyncedAt[slot] = syncedAt;
        if ((state.accountLocalRevisions[slot] || 0) === (syncedAccountRevisions[slot] || 0)) {
          clearAccountDirtyState(slot);
          delete state.accountLocalUpdatedAt[slot];
        } else if (state.dirtyAccounts[slot]) {
          syncQueued = true;
        }
      });

      refreshDirtyState();
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

    function queueSync(delay = SYNC_DEBOUNCE_MS) {
      if (!state.token || !state.gistId) return;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        syncTimer = null;
        void syncNow();
      }, delay);
    }

    function cancelPendingSync() {
      if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }
      syncQueued = false;
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
        const dirtySlots = getDirtyAccountSlots();
        if (state.dirty) {
          setSync('正在同步到 Gist…', 'saving');
          const remote = await fetchGistSnapshot();
          const localOrders = normalizeOrderList(state.orders);
          const migratingLegacy = remote.format === 'legacy';
          const hasMergeBase = Array.isArray(state.baseOrders);
          let mergedOrders = localOrders;
          let conflictCount = 0;

          if (!migratingLegacy && state.accountsDirty && state.accountsLastRemoteUpdatedAt && remote.metaUpdatedAt !== state.accountsLastRemoteUpdatedAt) {
            setSync('账号列表有更新，请先刷新', 'error');
            toast('检测到另一端已修改账号列表，请先点刷新。', 'error');
            return false;
          }

          if (hasMergeBase) {
            const mergeResult = mergeOrdersById({
              baseOrders: state.baseOrders,
              localOrders,
              remoteOrders: remote.orders
            });
            mergedOrders = mergeResult.orders;
            conflictCount = mergeResult.conflictCount;
          } else {
            for (const slot of dirtySlots) {
              const knownRemoteUpdatedAt = state.accountRemoteUpdatedAt[slot] || '';
              const remoteUpdatedAt = remote.accountRemoteUpdatedAt[slot] || '';
              if (knownRemoteUpdatedAt && remoteUpdatedAt !== knownRemoteUpdatedAt) {
                setSync('云端有更新，请先刷新', 'error');
                toast(`检测到账号「${fromAccountSlot(slot) || '未关联'}」在另一端已被修改，请先点刷新。`, 'error');
                return false;
              }
              if (!knownRemoteUpdatedAt && remoteUpdatedAt && !migratingLegacy) {
                setSync('云端有更新，请先刷新', 'error');
                toast(`检测到账号「${fromAccountSlot(slot) || '未关联'}」在另一端已有新数据，请先点刷新。`, 'error');
                return false;
              }
            }
          }

          const mergedGrouped = groupOrdersByAccountSlot(mergedOrders);
          const slotsToPush = migratingLegacy
            ? [...new Set([...Object.keys(mergedGrouped), ...Object.keys(remote.grouped || {})])]
            : [...new Set(dirtySlots)];
          const syncedAccountsRevision = state.accountsRevision;
          const syncedAccountRevisions = Object.fromEntries(slotsToPush.map(slot => [slot, state.accountLocalRevisions[slot] || 0]));
          const { files, metaPayload, accountPayloads, deletedSlots } = buildSplitFilesPayload({
            grouped: mergedGrouped,
            slots: slotsToPush,
            includeMeta: migratingLegacy || state.accountsDirty || !remote.hasMeta,
            metaUpdatedAt: state.accountsLocalUpdatedAt || nowIso(),
            remoteGrouped: remote.grouped || {},
            removeLegacyFile: !!remote.hasLegacy
          });
          const nextAccountRemoteUpdatedAt = { ...(remote.accountRemoteUpdatedAt || {}) };
          slotsToPush.forEach(slot => {
            if (accountPayloads[slot]) nextAccountRemoteUpdatedAt[slot] = accountPayloads[slot].updatedAt;
            else delete nextAccountRemoteUpdatedAt[slot];
          });

          if (!Object.keys(files).length) {
            finalizeSuccessfulSync({
              metaPayload,
              accountPayloads,
              deletedSlots: [...new Set([...(deletedSlots || []), ...slotsToPush])],
              syncedAccountsRevision,
              syncedAccountRevisions,
              mergedOrders,
              nextAccountRemoteUpdatedAt
            });
            refreshDirtyState();
            await persistCache();
            renderAccTabs();
            renderTable();
            if (conflictCount > 0) toast(`已处理 ${conflictCount} 条同订单冲突`, 'ok');
            setSync(`已同步 · ${state.orders.length} 条`, 'saved');
            return true;
          }

          await pushFilesToGist(files);
          finalizeSuccessfulSync({
            metaPayload,
            accountPayloads,
            deletedSlots,
            syncedAccountsRevision,
            syncedAccountRevisions,
            mergedOrders,
            nextAccountRemoteUpdatedAt
          });
          await persistCache();
          renderAccTabs();
          renderTable();
          if (conflictCount > 0) toast(`已处理 ${conflictCount} 条同订单冲突`, 'ok');
          setSync(state.dirty ? '本地已更新，继续等待同步…' : `已同步 · ${state.orders.length} 条`, state.dirty ? 'saving' : 'saved');
          return !state.dirty;
        }

        setSync(forcePull ? '正在刷新云端数据…' : '正在检查云端更新…', 'saving');
        const remote = await fetchGistSnapshot();
        const remoteUpdatedAt = remote.updatedAt || remote.metaUpdatedAt || '';
        const shouldApplyRemote = forcePull
          || !state.lastRemoteUpdatedAt
          || remoteUpdatedAt !== state.lastRemoteUpdatedAt;

        if (shouldApplyRemote) {
          await applyAndRenderRemoteSnapshot(remote);
          if (remote.format === 'legacy') {
            setSync('正在升级为按账号分文件…', 'saving');
            const grouped = groupOrdersByAccountSlot(state.orders);
            const slotsToPush = Object.keys(grouped);
            const { files, metaPayload, accountPayloads, deletedSlots } = buildSplitFilesPayload({
              grouped,
              slots: slotsToPush,
              includeMeta: true,
              metaUpdatedAt: nowIso(),
              remoteGrouped: remote.grouped || {},
              removeLegacyFile: !!remote.hasLegacy
            });
            const nextAccountRemoteUpdatedAt = { ...(remote.accountRemoteUpdatedAt || {}) };
            slotsToPush.forEach(slot => {
              if (accountPayloads[slot]) nextAccountRemoteUpdatedAt[slot] = accountPayloads[slot].updatedAt;
              else delete nextAccountRemoteUpdatedAt[slot];
            });
            await pushFilesToGist(files);
            finalizeSuccessfulSync({
              metaPayload,
              accountPayloads,
              deletedSlots,
              syncedAccountsRevision: 0,
              syncedAccountRevisions: {},
              mergedOrders: state.orders,
              nextAccountRemoteUpdatedAt
            });
            await persistCache();
          } else if (remote.hasLegacy) {
            setSync('正在清理旧版文件…', 'saving');
            await pushFilesToGist({ [GIST_FILENAME]: null });
          }
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

    return {
      markAccountsDirty,
      markOrderAccountsDirty,
      resetTrackerState,
      persistCache,
      hydrateCache,
      verifyToken,
      createGist,
      renderLocalOrders,
      queueSync,
      cancelPendingSync,
      syncNow,
      commitLocalOrders
    };
  }

  return { create };
})();
