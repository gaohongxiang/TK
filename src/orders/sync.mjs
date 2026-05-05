import {
  cloneOrder,
  getOrderUpdatedAt,
  normalizeOrderList,
  ordersEqual
} from './shared.mjs';

function latestIso(values) {
  return (values || []).filter(Boolean).sort().slice(-1)[0] || '';
}

function normalizeAccounts(accounts, { uniqueAccounts = values => [...new Set((values || []).filter(Boolean))] } = {}) {
  return uniqueAccounts(accounts || []).sort();
}

function sameAccountSet(left, right, options) {
  const a = normalizeAccounts(left, options);
  const b = normalizeAccounts(right, options);
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

function computeDirtyState(state = {}) {
  return !!(state.accountsDirty || Object.values(state.dirtyAccounts || {}).some(Boolean));
}

function getDirtyAccountSlots(state = {}) {
  return Object.keys(state.dirtyAccounts || {}).filter(slot => state.dirtyAccounts[slot]);
}

function getLocalDeletionTimestamp(baseOrder, {
  state = {},
  toAccountSlot = account => account || '__unassigned__',
  nowIso = () => new Date().toISOString()
} = {}) {
  const slot = toAccountSlot(baseOrder?.['账号']);
  return state.accountLocalUpdatedAt?.[slot] || state.localUpdatedAt || nowIso();
}

function buildOptimisticFirestoreChangeSet({
  state = {},
  toAccountSlot = account => account || '__unassigned__'
} = {}) {
  const dirtySlots = getDirtyAccountSlots(state);
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
      deletedAt: getLocalDeletionTimestamp(order, { state, toAccountSlot })
    }));
  const localAccounts = normalizeAccounts(state.accounts || []);
  const baseAccountSet = new Set(normalizeAccounts(state.baseAccounts || []));
  const localAccountSet = new Set(localAccounts);
  return {
    touchedSlots,
    upserts,
    deletions,
    accountUpserts: localAccounts.filter(name => !baseAccountSet.has(name)),
    accountDeletions: [...baseAccountSet].filter(name => !localAccountSet.has(name))
  };
}

function mergeFirestoreOrders({
  baseOrders = [],
  localOrders = [],
  remoteOrders = [],
  changedOrders = [],
  state = {},
  toAccountSlot = account => account || '__unassigned__',
  nowIso = () => new Date().toISOString()
} = {}) {
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
    const localTs = local ? getOrderUpdatedAt(local) : getLocalDeletionTimestamp(base, { state, toAccountSlot, nowIso });
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
  orderAccounts = [],
  accountsLocalUpdatedAt = '',
  uniqueAccounts = values => [...new Set((values || []).filter(Boolean))]
} = {}) {
  const base = normalizeAccounts(baseAccounts, { uniqueAccounts });
  const local = normalizeAccounts(localAccounts, { uniqueAccounts });
  const remote = normalizeAccounts(remoteAccounts, { uniqueAccounts });
  const localChanged = !sameAccountSet(base, local, { uniqueAccounts });
  const remoteChanged = !sameAccountSet(base, remote, { uniqueAccounts });
  let picked = local;

  if (!localChanged && remoteChanged) {
    picked = remote;
  } else if (localChanged && !remoteChanged) {
    picked = local;
  } else if (localChanged && remoteChanged && !sameAccountSet(local, remote, { uniqueAccounts })) {
    picked = Date.parse(accountsLocalUpdatedAt || 0) >= Date.parse(remoteUpdatedAt || 0)
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
  remoteAccounts = [],
  uniqueAccounts = values => [...new Set((values || []).filter(Boolean))],
  nowIso = () => new Date().toISOString()
} = {}) {
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

function shouldApplyRemoteSnapshot({
  forcePull = false,
  baseOrders = [],
  remoteOrders = [],
  baseAccounts = [],
  remoteAccounts = [],
  remoteCursor = '',
  stateRemoteCursor = ''
} = {}) {
  return forcePull
    || !Array.isArray(baseOrders)
    || !sameOrdersSnapshot(baseOrders, remoteOrders)
    || !sameAccountSet(baseAccounts || [], remoteAccounts)
    || remoteCursor !== (stateRemoteCursor || '');
}

function create() {
  return {
    applyAssignedOrderFields,
    buildFirestoreChangeSet,
    buildOptimisticFirestoreChangeSet,
    computeDirtyState,
    getOrdersMissingSeq,
    latestIso,
    mergeAccountNames,
    mergeFirestoreOrders,
    normalizeAccounts,
    sameAccountSet,
    sameOrdersSnapshot,
    shouldApplyRemoteSnapshot
  };
}

const OrderTrackerSync = {
  create
};

export {
  OrderTrackerSync,
  buildOptimisticFirestoreChangeSet,
  mergeFirestoreOrders,
  buildFirestoreChangeSet,
  applyAssignedOrderFields,
  computeDirtyState,
  create,
  getDirtyAccountSlots,
  getOrdersMissingSeq,
  latestIso,
  mergeAccountNames,
  normalizeAccounts,
  parseOrderSeq,
  sameAccountSet,
  sameOrdersSnapshot,
  shouldApplyRemoteSnapshot
};
