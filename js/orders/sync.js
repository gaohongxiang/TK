/* ============================================================
 * 订单跟踪器：同步与存储
 * ============================================================ */
const OrderTrackerSync = (function () {
  function create({ state, constants, helpers, ui }) {
    const {
      CACHE_DB_NAME,
      CACHE_STORE,
      CACHE_VERSION,
      SYNC_DEBOUNCE_MS
    } = constants;
    const {
      nowIso,
      normalizeOrderList,
      cloneOrder,
      ordersEqual,
      getOrderUpdatedAt,
      mergeOrdersById,
      uniqueAccounts,
      listOrderAccounts,
      groupOrdersByAccountSlot,
      toAccountSlot
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
    let syncQueuedOptimisticFirestoreWrite = false;
    let firestorePendingWriteCount = 0;
    let firestoreOptimisticWriteSeq = 0;
    let firestoreAppliedWriteSeq = 0;

    function latestIso(values) {
      return (values || []).filter(Boolean).sort().slice(-1)[0] || '';
    }

    function hasPendingFirestoreWrites() {
      return firestorePendingWriteCount > 0;
    }

    function beginPendingFirestoreWrite() {
      firestorePendingWriteCount += 1;
    }

    function finishPendingFirestoreWrite() {
      firestorePendingWriteCount = Math.max(0, firestorePendingWriteCount - 1);
    }

    function normalizeAccounts(accounts) {
      return uniqueAccounts(accounts || []).sort();
    }

    function sameAccountSet(left, right) {
      const a = normalizeAccounts(left);
      const b = normalizeAccounts(right);
      if (a.length !== b.length) return false;
      return a.every((value, index) => value === b[index]);
    }

    function sameOrdersSnapshot(left, right) {
      const leftList = normalizeOrderList(left);
      const rightList = normalizeOrderList(right);
      if (leftList.length !== rightList.length) return false;
      const rightMap = new Map(rightList.map(order => [String(order?.id || ''), order]));
      return leftList.every(order => ordersEqual(order, rightMap.get(String(order?.id || '')) || null));
    }

    function parseOrderSeq(value) {
      const parsed = Number.parseInt(String(value ?? '').trim(), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function getOrdersMissingSeq(orders = []) {
      return normalizeOrderList(orders).filter(order => order?.id && parseOrderSeq(order?.seq) === null);
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
      state.localRevision = (state.accountsRevision || 0)
        + Object.values(state.accountLocalRevisions || {}).reduce((sum, value) => sum + (value || 0), 0);
    }

    function markAccountsDirty() {
      state.accountsDirty = true;
      state.accountsLocalUpdatedAt = nowIso();
      state.accountsRevision = (state.accountsRevision || 0) + 1;
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

    function setRemoteProvider(provider) {
      state.remoteProvider = provider || null;
      if (provider?.key) state.storageMode = provider.key;
    }

    function usesProviderManagedCache() {
      const provider = state.remoteProvider;
      return !!(provider && typeof provider.usesBuiltInLocalCache === 'function' && provider.usesBuiltInLocalCache());
    }

    function formatFirestoreError(error, fallback = '') {
      const code = String(error?.code || '').trim();
      const message = String(error?.message || '').trim();
      if (code.includes('permission-denied') || /Missing or insufficient permissions/i.test(message)) {
        const next = '当前 Firebase 项目的 Firestore 规则较旧，请重新复制并发布最新规则，确保 orders、order_accounts、sync_state 和 products 都已放行。';
        window.TKFirestoreConnection?.notifyRulesUpdateNeeded?.(next);
        return next;
      }
      return message || fallback;
    }

    function resetTrackerState({ preserveAccounts = true } = {}) {
      state.orders = [];
      state.editingId = null;
      state.activeAccount = '__all__';
      state.sortOrder = 'asc';
      state.currentPage = 1;
      state.baseOrders = null;
      state.baseAccounts = preserveAccounts ? uniqueAccounts(state.accounts || []) : [];
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
      state.remoteCursor = '';
      if (!preserveAccounts) state.accounts = [];
    }

    function getCacheKey() {
      if (usesProviderManagedCache()) return '';
      const provider = state.remoteProvider;
      if (provider && typeof provider.getCacheKey === 'function') return provider.getCacheKey();
      return `orders:${state.storageMode || 'firestore'}`;
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
      }).catch(error => {
        dbPromise = null;
        throw error;
      });
      return dbPromise;
    }

    async function readCacheRecord(cacheKey = getCacheKey()) {
      if (!cacheKey) return null;
      const db = await openCacheDb();
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readonly');
        const store = tx.objectStore(CACHE_STORE);
        const req = store.get(cacheKey);
        req.onerror = () => reject(req.error || new Error('读取本地缓存失败'));
        req.onsuccess = () => resolve(req.result || null);
      });
    }

    async function writeCacheRecord() {
      if (usesProviderManagedCache()) return false;
      const key = getCacheKey();
      if (!key) return false;
      const db = await openCacheDb();
      if (!db) return false;
      const record = {
        key,
        storageMode: state.storageMode || 'firestore',
        version: 3,
        orders: state.orders,
        baseOrders: state.baseOrders,
        accounts: state.accounts,
        baseAccounts: state.baseAccounts,
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
        remoteCursor: state.remoteCursor || '',
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
      state.baseAccounts = Array.isArray(record?.baseAccounts)
        ? uniqueAccounts(record.baseAccounts)
        : uniqueAccounts(record?.accounts || []);
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
      state.remoteCursor = record?.remoteCursor || '';
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
      if (usesProviderManagedCache()) return true;
      try {
        await writeCacheRecord();
        return true;
      } catch (error) {
        setSync('本地缓存写入失败', 'error');
        toast('本地缓存写入失败: ' + error.message, 'error');
        return false;
      }
    }

    async function hydrateCache(cacheKey = getCacheKey()) {
      if (usesProviderManagedCache()) return false;
      try {
        const record = await readCacheRecord(cacheKey);
        if (!record) return false;
        applyCacheRecord(record);
        return true;
      } catch (error) {
        setSync('本地缓存读取失败', 'error');
        toast('本地缓存读取失败: ' + error.message, 'error');
        return false;
      }
    }

    function renderLocalOrders(statusText, statusClass = 'local') {
      renderAccTabs();
      renderTable();
      setSync(statusText, statusClass);
    }

    function queueSync(delay = SYNC_DEBOUNCE_MS) {
      const provider = state.remoteProvider;
      if (!provider) return;
      if (typeof provider.isConnected === 'function' && !provider.isConnected()) return;
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
      if (state.remoteProvider?.key === 'firestore' && state.remoteProvider?.isConnected?.()) {
        void syncNow({ optimisticFirestoreWrite: true });
        return;
      }
      queueSync();
    }

    function buildOptimisticFirestoreChangeSet() {
      const dirtySlots = getDirtyAccountSlots();
      const touchedSlots = dirtySlots.length ? dirtySlots : Object.keys(state.accountLocalRevisions || {});
      const touchedSet = new Set(touchedSlots);
      const localOrders = normalizeOrderList(state.orders);
      const baseOrders = Array.isArray(state.baseOrders) ? normalizeOrderList(state.baseOrders) : [];
      const localMap = new Map(localOrders.map(order => [String(order?.id || ''), order]));
      const baseMap = new Map(baseOrders.map(order => [String(order?.id || ''), order]));
      const upserts = localOrders.filter(order => {
        const slot = toAccountSlot(order?.['账号']);
        if (touchedSet.size && !touchedSet.has(slot)) return false;
        return !ordersEqual(order, baseMap.get(String(order?.id || '')) || null);
      });
      const deletions = baseOrders
        .filter(order => {
          const slot = toAccountSlot(order?.['账号']);
          if (touchedSet.size && !touchedSet.has(slot)) return false;
          return !localMap.has(String(order?.id || ''));
        })
        .map(order => ({
          id: order.id,
          accountName: order['账号'] || '',
          deletedAt: getLocalDeletionTimestamp(order)
        }));
      const localAccounts = uniqueAccounts(state.accounts || []);
      const baseAccountSet = new Set(uniqueAccounts(state.baseAccounts || []));
      const localAccountSet = new Set(localAccounts);
      return {
        touchedSlots,
        upserts,
        deletions,
        accountUpserts: localAccounts.filter(name => !baseAccountSet.has(name)),
        accountDeletions: [...baseAccountSet].filter(name => !localAccountSet.has(name))
      };
    }

    function getLocalDeletionTimestamp(baseOrder) {
      const slot = toAccountSlot(baseOrder?.['账号']);
      return state.accountLocalUpdatedAt[slot] || state.localUpdatedAt || nowIso();
    }

    function mergeFirestoreOrders({ baseOrders = [], localOrders = [], remoteOrders = [], changedOrders = [] }) {
      const baseMap = new Map(normalizeOrderList(baseOrders).map(order => [String(order?.id || ''), order]));
      const localMap = new Map(normalizeOrderList(localOrders).map(order => [String(order?.id || ''), order]));
      const remoteMap = new Map(normalizeOrderList(remoteOrders).map(order => [String(order?.id || ''), order]));
      const changedMap = new Map(normalizeOrderList(changedOrders).map(order => [String(order?.id || ''), order]));
      const ids = [...new Set([
        ...baseMap.keys(),
        ...localMap.keys(),
        ...remoteMap.keys()
      ])];

      const merged = [];
      const deletedAtById = {};

      ids.forEach(id => {
        const base = baseMap.get(id) || null;
        const local = localMap.get(id) || null;
        const remote = remoteMap.get(id) || null;
        const changedRemote = changedMap.get(id) || null;
        const localChanged = !ordersEqual(local, base);
        const remoteChanged = !!changedRemote || !ordersEqual(remote, base);
        const localTs = local ? getOrderUpdatedAt(local) : getLocalDeletionTimestamp(base);
        const remoteTs = remote
          ? getOrderUpdatedAt(remote)
          : (changedRemote?.deletedAt || changedRemote?.updatedAt || '');
        let resolved = local || remote || base || null;
        let resolvedDeletedAt = '';

        if (!base) {
          if (local && remote) {
            resolved = Date.parse(getOrderUpdatedAt(local) || 0) >= Date.parse(getOrderUpdatedAt(remote) || 0)
              ? local
              : remote;
          } else {
            resolved = local || remote || null;
          }
        } else if (localChanged && remoteChanged) {
          if (Date.parse(localTs || 0) >= Date.parse(remoteTs || 0)) {
            resolved = local;
            if (!local) resolvedDeletedAt = localTs;
          } else {
            resolved = remote;
            if (!remote) resolvedDeletedAt = remoteTs;
          }
        } else if (localChanged) {
          resolved = local;
          if (!local) resolvedDeletedAt = localTs;
        } else if (remoteChanged) {
          resolved = remote;
          if (!remote) resolvedDeletedAt = remoteTs;
        } else {
          resolved = local || remote || base;
        }

        if (resolved) {
          merged.push(cloneOrder(resolved));
        } else {
          deletedAtById[id] = resolvedDeletedAt || localTs || remoteTs || nowIso();
        }
      });

      return {
        orders: normalizeOrderList(merged),
        deletedAtById
      };
    }

    function mergeAccountNames({
      baseAccounts = [],
      localAccounts = [],
      remoteAccounts = [],
      remoteUpdatedAt = '',
      orderAccounts = []
    }) {
      const base = normalizeAccounts(baseAccounts);
      const local = normalizeAccounts(localAccounts);
      const remote = normalizeAccounts(remoteAccounts);
      const localChanged = !sameAccountSet(base, local);
      const remoteChanged = !sameAccountSet(base, remote);
      let picked = local;

      if (!localChanged && remoteChanged) {
        picked = remote;
      } else if (localChanged && !remoteChanged) {
        picked = local;
      } else if (localChanged && remoteChanged && !sameAccountSet(local, remote)) {
        picked = Date.parse(state.accountsLocalUpdatedAt || 0) >= Date.parse(remoteUpdatedAt || 0)
          ? local
          : remote;
      } else if (!local.length && remote.length) {
        picked = remote;
      }

      return uniqueAccounts([...(picked || []), ...(orderAccounts || [])]);
    }

    function buildFirestoreChangeSet({
      mergedOrders = [],
      remoteOrders = [],
      deletedAtById = {},
      mergedAccounts = [],
      remoteAccounts = []
    }) {
      const remoteMap = new Map(normalizeOrderList(remoteOrders).map(order => [String(order?.id || ''), order]));
      const mergedMap = new Map(normalizeOrderList(mergedOrders).map(order => [String(order?.id || ''), order]));
      const ids = [...new Set([...remoteMap.keys(), ...mergedMap.keys()])];
      const upserts = [];
      const deletions = [];

      ids.forEach(id => {
        const remote = remoteMap.get(id) || null;
        const merged = mergedMap.get(id) || null;
        if (merged) {
          const remoteNeedsCanonicalCleanup = remote?.__needsOrderCleanup === true;
          if (remoteNeedsCanonicalCleanup || !ordersEqual(merged, remote)) {
            upserts.push(cloneOrder(merged));
          }
        } else if (remote) {
          deletions.push({
            id,
            accountName: remote['账号'] || '',
            deletedAt: deletedAtById[id] || nowIso()
          });
        }
      });

      const remoteAccountSet = new Set(uniqueAccounts(remoteAccounts));
      const mergedAccountSet = new Set(uniqueAccounts(mergedAccounts));

      return {
        upserts,
        deletions,
        accountUpserts: [...mergedAccountSet].filter(name => !remoteAccountSet.has(name)),
        accountDeletions: [...remoteAccountSet].filter(name => !mergedAccountSet.has(name))
      };
    }

    function applyAssignedOrderFields(orders = [], assignedOrders = []) {
      const assignedMap = new Map(normalizeOrderList(assignedOrders).map(order => [String(order?.id || ''), order]));
      return normalizeOrderList(orders).map(order => {
        const assigned = assignedMap.get(String(order?.id || ''));
        return assigned
          ? cloneOrder({ ...order, ...assigned })
          : cloneOrder(order);
      });
    }

    async function reconcileFirestoreMissingSeqs(provider, remote = {}) {
      const missingSeqOrders = getOrdersMissingSeq(remote.orders);
      if (!missingSeqOrders.length) return remote;
      setSync('正在补齐 Firestore 录入编号…', 'saving');
      const pushResult = await provider.pushChanges({
        upserts: missingSeqOrders,
        deletions: [],
        accountUpserts: [],
        accountDeletions: [],
        clientId: state.clientId || '',
        assignSeq: true
      });
      return {
        ...remote,
        orders: applyAssignedOrderFields(remote.orders, pushResult.assignedOrders || []),
        updatedAt: pushResult.updatedAt || remote.updatedAt || '',
        remoteCursor: pushResult.remoteCursor || pushResult.updatedAt || remote.remoteCursor || ''
      };
    }

    function applyRemoteSnapshot(snapshot) {
      state.orders = normalizeOrderList(snapshot.orders);
      state.baseOrders = normalizeOrderList(snapshot.orders);
      state.accounts = uniqueAccounts([...(snapshot.accounts || []), ...listOrderAccounts(snapshot.orders)]);
      state.baseAccounts = uniqueAccounts(state.accounts);
      saveAccounts();
      state.accountRemoteUpdatedAt = { ...(snapshot.accountRemoteUpdatedAt || {}) };
      state.accountLastSyncedAt = Object.fromEntries(Object.keys(state.accountRemoteUpdatedAt).map(slot => [slot, nowIso()]));
      state.accountLocalUpdatedAt = {};
      state.accountLocalRevisions = {};
      state.dirtyAccounts = {};
      state.accountsDirty = false;
      state.accountsLocalUpdatedAt = '';
      state.accountsRevision = 0;
      state.accountsLastRemoteUpdatedAt = latestIso([
        snapshot.accountsUpdatedAt,
        snapshot.metaUpdatedAt,
        snapshot.updatedAt
      ]);
      state.accountsLastSyncedAt = nowIso();
      state.remoteCursor = snapshot.remoteCursor || snapshot.updatedAt || state.remoteCursor || '';
      refreshDirtyState();
    }

    function finalizeGistSync({
      metaPayload = null,
      accountPayloads = {},
      deletedSlots = [],
      syncedAccountsRevision = 0,
      syncedAccountRevisions = {},
      mergedOrders = [],
      nextAccountRemoteUpdatedAt = {}
    }) {
      const syncedAt = nowIso();
      state.orders = normalizeOrderList(mergedOrders);
      state.baseOrders = normalizeOrderList(mergedOrders);
      state.accounts = uniqueAccounts([...(metaPayload?.accounts || state.accounts), ...listOrderAccounts(state.orders)]);
      state.baseAccounts = uniqueAccounts(state.accounts);
      saveAccounts();

      state.accountRemoteUpdatedAt = { ...nextAccountRemoteUpdatedAt };
      state.accountLastSyncedAt = Object.fromEntries(Object.keys(state.accountRemoteUpdatedAt).map(slot => [slot, syncedAt]));

      if (metaPayload) {
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

      state.remoteCursor = latestIso([
        state.remoteCursor,
        metaPayload?.updatedAt,
        ...Object.values(state.accountRemoteUpdatedAt || {})
      ]);
      refreshDirtyState();
    }

    function finalizeFirestoreSync({
      mergedOrders = [],
      mergedAccounts = [],
      remote = {},
      pushResult = {},
      syncedAccountsRevision = 0,
      syncedAccountRevisions = {},
      touchedSlots = []
    }) {
      const syncedAt = nowIso();
      state.orders = normalizeOrderList(mergedOrders);
      state.baseOrders = normalizeOrderList(mergedOrders);
      state.accounts = uniqueAccounts([...(mergedAccounts || []), ...listOrderAccounts(mergedOrders)]);
      state.baseAccounts = uniqueAccounts(state.accounts);
      saveAccounts();

      state.accountRemoteUpdatedAt = {};
      state.accountLastSyncedAt = {};
      state.accountsLastRemoteUpdatedAt = latestIso([
        remote.accountsUpdatedAt,
        remote.updatedAt,
        pushResult.updatedAt
      ]);
      state.accountsLastSyncedAt = syncedAt;
      state.remoteCursor = pushResult.remoteCursor || remote.remoteCursor || state.remoteCursor || '';

      if (state.accountsDirty && state.accountsRevision === syncedAccountsRevision) {
        state.accountsDirty = false;
        state.accountsLocalUpdatedAt = '';
      } else if (state.accountsDirty) {
        syncQueued = true;
      }

      touchedSlots.forEach(slot => {
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

    async function syncGist(provider, { forcePull = false } = {}) {
      const dirtySlots = getDirtyAccountSlots();
      if (state.dirty) {
        setSync('正在同步到 Gist…', 'saving');
        const remote = await provider.pullSnapshot();
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
              toast(`检测到账号「${slot === '__unassigned__' ? '未关联' : slot}」在另一端已被修改，请先点刷新。`, 'error');
              return false;
            }
            if (!knownRemoteUpdatedAt && remoteUpdatedAt && !migratingLegacy) {
              setSync('云端有更新，请先刷新', 'error');
              toast(`检测到账号「${slot === '__unassigned__' ? '未关联' : slot}」在另一端已有新数据，请先点刷新。`, 'error');
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
        const pushResult = await provider.pushChanges({
          grouped: mergedGrouped,
          slots: slotsToPush,
          includeMeta: migratingLegacy || state.accountsDirty || !remote.hasMeta,
          metaUpdatedAt: state.accountsLocalUpdatedAt || nowIso(),
          remoteGrouped: remote.grouped || {},
          removeLegacyFile: !!remote.hasLegacy,
          accounts: state.accounts,
          accountLocalUpdatedAt: state.accountLocalUpdatedAt
        });
        const nextAccountRemoteUpdatedAt = { ...(remote.accountRemoteUpdatedAt || {}) };
        slotsToPush.forEach(slot => {
          if (pushResult.accountPayloads[slot]) nextAccountRemoteUpdatedAt[slot] = pushResult.accountPayloads[slot].updatedAt;
          else delete nextAccountRemoteUpdatedAt[slot];
        });

        finalizeGistSync({
          metaPayload: pushResult.metaPayload,
          accountPayloads: pushResult.accountPayloads,
          deletedSlots: Object.keys(pushResult.files || {}).length
            ? pushResult.deletedSlots
            : [...new Set([...(pushResult.deletedSlots || []), ...slotsToPush])],
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
      const remote = await provider.pullSnapshot();
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
          const pushResult = await provider.pushChanges({
            grouped,
            slots: slotsToPush,
            includeMeta: true,
            metaUpdatedAt: nowIso(),
            remoteGrouped: remote.grouped || {},
            removeLegacyFile: !!remote.hasLegacy,
            accounts: state.accounts,
            accountLocalUpdatedAt: state.accountLocalUpdatedAt
          });
          const nextAccountRemoteUpdatedAt = { ...(remote.accountRemoteUpdatedAt || {}) };
          slotsToPush.forEach(slot => {
            if (pushResult.accountPayloads[slot]) nextAccountRemoteUpdatedAt[slot] = pushResult.accountPayloads[slot].updatedAt;
            else delete nextAccountRemoteUpdatedAt[slot];
          });
          finalizeGistSync({
            metaPayload: pushResult.metaPayload,
            accountPayloads: pushResult.accountPayloads,
            deletedSlots: pushResult.deletedSlots,
            syncedAccountsRevision: 0,
            syncedAccountRevisions: {},
            mergedOrders: state.orders,
            nextAccountRemoteUpdatedAt
          });
          await persistCache();
        } else if (remote.hasLegacy) {
          setSync('正在清理旧版文件…', 'saving');
          await provider.pushChanges({
            grouped: groupOrdersByAccountSlot(state.orders),
            slots: [],
            removeLegacyFile: true,
            accounts: state.accounts,
            accountLocalUpdatedAt: state.accountLocalUpdatedAt
          });
        }
      }

      setSync(`已同步 · ${state.orders.length} 条`, 'saved');
      return true;
    }

    async function syncFirestore(provider, { forcePull = false, optimisticFirestoreWrite = false } = {}) {
      if (state.dirty) {
        setSync('正在同步到 Firestore…', 'saving');
        if (optimisticFirestoreWrite) {
          const changeSet = buildOptimisticFirestoreChangeSet();
          const hasChanges = changeSet.upserts.length
            || changeSet.deletions.length
            || changeSet.accountUpserts.length
            || changeSet.accountDeletions.length;
          if (!hasChanges) {
            state.baseOrders = normalizeOrderList(state.orders);
            state.baseAccounts = uniqueAccounts(state.accounts);
            state.accountsDirty = false;
            state.accountsLocalUpdatedAt = '';
            state.accountsLastSyncedAt = nowIso();
            changeSet.touchedSlots.forEach(slot => {
              state.accountLastSyncedAt[slot] = state.accountsLastSyncedAt;
              clearAccountDirtyState(slot);
              delete state.accountLocalUpdatedAt[slot];
            });
            refreshDirtyState();
            await persistCache();
            syncQueued = true;
            syncQueuedOptimisticFirestoreWrite = false;
            setSync(`已同步 · ${state.orders.length} 条`, 'saved');
            return true;
          }
          const pushedOrders = normalizeOrderList(state.orders);
          const pushedAccounts = uniqueAccounts(state.accounts);
          const syncedAccountsRevision = state.accountsRevision;
          const syncedAccountRevisions = Object.fromEntries(
            changeSet.touchedSlots.map(slot => [slot, state.accountLocalRevisions[slot] || 0])
          );
          const pushResult = await provider.pushChanges({
            upserts: changeSet.upserts,
            deletions: changeSet.deletions,
            accountUpserts: changeSet.accountUpserts,
            accountDeletions: changeSet.accountDeletions,
            clientId: state.clientId || '',
            assignSeq: false,
            waitForCommit: false
          });
          const writeSeq = ++firestoreOptimisticWriteSeq;
          beginPendingFirestoreWrite();
          const commitPromise = Promise.resolve(pushResult.commitPromise);
          state.accountsLastRemoteUpdatedAt = pushResult.updatedAt;
          state.remoteCursor = pushResult.remoteCursor || pushResult.updatedAt || state.remoteCursor || '';
          refreshDirtyState();
          await persistCache();
          setSync(`已进入 Firestore 本地队列 · ${state.orders.length} 条`, 'saving');
          commitPromise
            .then(async () => {
              if (writeSeq < firestoreAppliedWriteSeq) return;
              firestoreAppliedWriteSeq = writeSeq;
              const syncedAt = nowIso();
              state.baseOrders = pushedOrders;
              state.baseAccounts = pushedAccounts;
              state.accountsLastSyncedAt = syncedAt;
              if (state.accountsDirty && state.accountsRevision === syncedAccountsRevision) {
                state.accountsDirty = false;
                state.accountsLocalUpdatedAt = '';
              } else if (state.accountsDirty) {
                syncQueued = true;
              }
              changeSet.touchedSlots.forEach(slot => {
                state.accountLastSyncedAt[slot] = syncedAt;
                if ((state.accountLocalRevisions[slot] || 0) === (syncedAccountRevisions[slot] || 0)) {
                  clearAccountDirtyState(slot);
                  delete state.accountLocalUpdatedAt[slot];
                } else if (state.dirtyAccounts[slot]) {
                  syncQueued = true;
                }
              });
              refreshDirtyState();
              await persistCache();
              setSync(state.dirty ? '本地已更新，继续等待同步…' : `已同步 · ${state.orders.length} 条`, state.dirty ? 'saving' : 'saved');
              if (!state.dirty) {
                syncQueued = true;
                syncQueuedOptimisticFirestoreWrite = false;
              }
            })
            .catch(error => {
              if (writeSeq < firestoreAppliedWriteSeq) return;
              setSync('Firestore 写入失败，已保留本地缓存', 'error');
              toast('Firestore 写入失败: ' + formatFirestoreError(error), 'error');
            })
            .finally(() => {
              finishPendingFirestoreWrite();
              if (hasPendingFirestoreWrites()) return;
              if (syncQueued || syncQueuedOptimisticFirestoreWrite || state.dirty) {
                const nextOptimistic = syncQueuedOptimisticFirestoreWrite || state.dirty;
                syncQueued = false;
                syncQueuedOptimisticFirestoreWrite = false;
                void syncNow({ optimisticFirestoreWrite: nextOptimistic });
              }
            });
          return true;
        }
        const remote = await provider.pullSnapshot({ cursor: state.remoteCursor || '' });
        const mergeResult = mergeFirestoreOrders({
          baseOrders: Array.isArray(state.baseOrders) ? state.baseOrders : [],
          localOrders: state.orders,
          remoteOrders: remote.orders,
          changedOrders: remote.changedOrders
        });
        const mergedOrders = mergeResult.orders;
        const mergedAccounts = mergeAccountNames({
          baseAccounts: Array.isArray(state.baseAccounts) ? state.baseAccounts : [],
          localAccounts: state.accounts,
          remoteAccounts: remote.accounts,
          remoteUpdatedAt: remote.accountsUpdatedAt,
          orderAccounts: listOrderAccounts(mergedOrders)
        });
        const changeSet = buildFirestoreChangeSet({
          mergedOrders,
          remoteOrders: remote.orders,
          deletedAtById: mergeResult.deletedAtById,
          mergedAccounts,
          remoteAccounts: remote.accounts
        });
        const dirtySlots = getDirtyAccountSlots();
        const touchedSlots = dirtySlots.length ? dirtySlots : Object.keys(state.accountLocalRevisions || {});
        const syncedAccountsRevision = state.accountsRevision;
        const syncedAccountRevisions = Object.fromEntries(
          touchedSlots.map(slot => [slot, state.accountLocalRevisions[slot] || 0])
        );
        const pushResult = await provider.pushChanges({
          ...changeSet,
          clientId: state.clientId || ''
        });
        const mergedOrdersWithAssigned = applyAssignedOrderFields(mergedOrders, pushResult.assignedOrders || []);

        finalizeFirestoreSync({
          mergedOrders: mergedOrdersWithAssigned,
          mergedAccounts,
          remote,
          pushResult,
          syncedAccountsRevision,
          syncedAccountRevisions,
          touchedSlots
        });
        await persistCache();
        renderAccTabs();
        renderTable();
        setSync(state.dirty ? '本地已更新，继续等待同步…' : `已同步 · ${state.orders.length} 条`, state.dirty ? 'saving' : 'saved');
        return !state.dirty;
      }

      setSync(forcePull ? '正在刷新云端数据…' : '正在检查云端更新…', 'saving');
      let remote = await provider.pullSnapshot({ cursor: forcePull ? '' : (state.remoteCursor || '') });
      if (state.dirty || hasPendingFirestoreWrites()) {
        syncQueued = true;
        syncQueuedOptimisticFirestoreWrite = true;
        setSync(state.dirty ? '本地已更新，等待写入 Firestore…' : 'Firestore 本地队列写入中…', 'saving');
        return false;
      }
      remote = await reconcileFirestoreMissingSeqs(provider, remote);
      const shouldApplyRemote = forcePull
        || !Array.isArray(state.baseOrders)
        || !sameOrdersSnapshot(state.baseOrders, remote.orders)
        || !sameAccountSet(state.baseAccounts || [], remote.accounts)
        || remote.remoteCursor !== (state.remoteCursor || '');

      if (shouldApplyRemote) await applyAndRenderRemoteSnapshot(remote);

      setSync(`已同步 · ${state.orders.length} 条`, 'saved');
      return true;
    }

    async function syncNow({ forcePull = false, optimisticFirestoreWrite = false } = {}) {
      const provider = state.remoteProvider;
      if (!provider) return false;
      if (typeof provider.isConnected === 'function' && !provider.isConnected()) return false;
      if (syncInFlight) {
        syncQueued = true;
        if (optimisticFirestoreWrite) syncQueuedOptimisticFirestoreWrite = true;
        return false;
      }
      if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }

      syncInFlight = true;
      try {
        if (provider.key === 'firestore') return await syncFirestore(provider, { forcePull, optimisticFirestoreWrite });
        throw new Error('当前只支持 Firebase Firestore 同步');
      } catch (error) {
        setSync(state.dirty ? '同步失败，已保留本地缓存' : '加载失败', 'error');
        toast((state.dirty ? '同步失败' : '加载失败') + ': ' + formatFirestoreError(error), 'error');
        return false;
      } finally {
        syncInFlight = false;
        if (syncQueued) {
          const nextOptimistic = syncQueuedOptimisticFirestoreWrite;
          syncQueued = false;
          syncQueuedOptimisticFirestoreWrite = false;
          void syncNow({ optimisticFirestoreWrite: nextOptimistic });
        }
      }
    }

    return {
      markAccountsDirty,
      markOrderAccountsDirty,
      resetTrackerState,
      persistCache,
      hydrateCache,
      renderLocalOrders,
      queueSync,
      cancelPendingSync,
      syncNow,
      commitLocalOrders,
      setRemoteProvider
    };
  }

  return {
    create
  };
})();
