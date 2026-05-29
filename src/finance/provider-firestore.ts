import {
  normalizeConfigText,
  parseConfigInput
} from '../firestore-connection.ts';
import { initSharedFirebaseApp } from '../firebase-app.ts';
import {
  accountDocId,
  deleteAccountLabel,
  renameAccountAcrossModules,
  uniqueAccounts
} from '../accounts/firestore-account-actions.ts';
import {
  normalizePulledOrder,
  toIsoString,
  toNullableText
} from '../orders/provider-firestore.ts';
import { readSyncState, subscribeSyncState, touchSyncState } from '../firestore-sync-state.ts';
import { normalizeFinanceRecord, todayStr as defaultTodayStr } from './summary.ts';
import type {
  FirebaseCompatApp,
  FirebaseCompatFirestore,
  FirebaseCompatQuerySnapshot
} from '../types/firestore.ts';
import type {
  FinanceProviderApi,
  FinanceProviderCreateOptions,
  FinanceProviderDeleteOptions,
  FinanceProviderDeleteResult,
  FinanceProviderSnapshot,
  FinanceProviderUpsertOptions,
  FinanceProviderUpsertResult,
  FinanceRecord,
  FinanceRecordDoc,
  FinanceRecordDraft,
  HydratedFirebaseConfig,
  SerializedFinanceProviderConfig
} from './types.ts';

type LooseRecord = Record<string, unknown>;

function toPlainObject(value: unknown): LooseRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as LooseRecord : {};
}

function hydrateConfig(raw: unknown = {}): HydratedFirebaseConfig {
  const source = toPlainObject(raw);
  const parsed = parseConfigInput(source?.configText || source?.firestoreConfigText || source?.firebaseConfig || source?.config || raw);
  return {
    config: parsed,
    configText: parsed ? JSON.stringify(parsed, null, 2) : '',
    projectId: parsed?.projectId || String(source?.projectId || source?.firestoreProjectId || '').trim(),
    user: String(source?.user || '').trim()
  };
}

function serializeConfig(config: unknown): SerializedFinanceProviderConfig {
  const next = hydrateConfig(config || {});
  return {
    firestoreConfigText: next.configText,
    firestoreProjectId: next.projectId,
    user: next.user
  };
}

function getDisplayName(config: unknown = {}): string {
  const next = hydrateConfig(config);
  if (next.user) return `${next.user} · Firestore`;
  if (next.projectId) return `${next.projectId} · Firestore`;
  return 'Firebase Firestore';
}

function usesBuiltInLocalCache(): boolean {
  return true;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function toNullableDecimal(value: unknown): number | null {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function toSortIndex(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function latestIso(values: unknown[] = []): string {
  return (values || []).map(value => String(value || '')).filter(Boolean).sort().slice(-1)[0] || '';
}

function buildFinanceDoc(record: FinanceRecord, options: { nowIso?: () => string } = {}): FinanceRecordDoc {
  const nowIso = options.nowIso || (() => new Date().toISOString());
  const createdAt = toIsoString(record.createdAt || '', nowIso()) || nowIso();
  const updatedAt = toIsoString(record.updatedAt || '', createdAt) || createdAt;
  return {
    id: String(record.id || '').trim(),
    kind: record.kind === 'actual_income' ? 'actual_income' : 'cost',
    accountName: toNullableText(record.accountName),
    category: toNullableText(record.category),
    amount: toNullableDecimal(record.amount),
    occurredAt: toNullableText(record.occurredAt),
    note: toNullableText(record.note),
    createdAt,
    updatedAt,
    deletedAt: record.deletedAt ? toIsoString(record.deletedAt, updatedAt) : null
  };
}

function normalizePulledFinanceRecord(raw: unknown, options: { nowIso?: () => string; todayStr?: () => string } = {}): FinanceRecord {
  return normalizeFinanceRecord(raw, options);
}

function create({ state = {}, helpers = {}, window: rootWindow = globalThis.window }: FinanceProviderCreateOptions = {}): FinanceProviderApi {
  const nowIso = helpers.nowIso || (() => new Date().toISOString());
  const todayStr = helpers.todayStr || defaultTodayStr;
  let app: FirebaseCompatApp | null = null;
  let db: FirebaseCompatFirestore | null = null;

  async function requireDb(): Promise<FirebaseCompatFirestore> {
    if (!db) throw new Error('Firestore 尚未初始化');
    return db;
  }

  async function getQuerySnapshot(query: { get: (options?: unknown) => Promise<FirebaseCompatQuerySnapshot> }): Promise<FirebaseCompatQuerySnapshot> {
    if (!query || typeof query.get !== 'function') throw new Error('Firestore 查询不可用');
    try {
      return await query.get({ source: 'server' });
    } catch (error) {
      return query.get();
    }
  }

  async function init(config: unknown): Promise<SerializedFinanceProviderConfig> {
    const next = hydrateConfig(config);
    if (!next.config || !next.projectId) throw new Error('请粘贴完整的 firebaseConfig');
    if (!rootWindow?.firebase?.initializeApp) throw new Error('Firebase 浏览器客户端未加载');

    const shared = initSharedFirebaseApp(next.config, rootWindow, '__tkFinanceFirestoreConfigured');
    app = shared.app;
    db = shared.db;

    state.firestoreConfigText = next.configText;
    state.firestoreProjectId = next.projectId;
    state.user = next.projectId;
    return serializeConfig(state);
  }

  function isReady(): boolean {
    return !!db;
  }

  function isConnected(): boolean {
    return !!db;
  }

  async function signOut(): Promise<void> {}

  function buildSnapshotFromQuerySnapshots(
    recordsSnap: FirebaseCompatQuerySnapshot,
    ordersSnap: FirebaseCompatQuerySnapshot,
    accountsSnap: FirebaseCompatQuerySnapshot,
    syncState: { revision?: string; updatedByClientId?: string } | null = null
  ): FinanceProviderSnapshot {
    const records = recordsSnap.docs
      .map(doc => normalizePulledFinanceRecord({ ...(doc.data() || {}), id: String(doc.data()?.id || doc.id || '') }, { nowIso, todayStr }))
      .filter(record => !record.deletedAt);
    const orders = ordersSnap.docs
      .map(doc => normalizePulledOrder(doc.data() || {}, { nowIso }))
      .filter(order => !order.deletedAt);
    const accounts = uniqueAccounts(accountsSnap.docs
      .map((doc, index) => ({ data: doc.data() || {}, fallbackIndex: index }))
      .filter(row => !row.data.deletedAt)
      .map(row => ({
        name: String(row.data.name || '').trim(),
        sortIndex: toSortIndex(row.data.sortIndex, row.fallbackIndex)
      }))
      .filter(row => row.name)
      .sort((left, right) => left.sortIndex - right.sortIndex || left.name.localeCompare(right.name))
      .map(row => row.name));

    return {
      records,
      orders,
      accounts,
      updatedAt: latestIso([
        ...records.map(record => record.updatedAt),
        ...orders.map(order => order.updatedAt),
        ...accountsSnap.docs.map(doc => String(doc.data()?.updatedAt || ''))
      ]),
      hasPendingWrites: !!(recordsSnap.metadata?.hasPendingWrites || ordersSnap.metadata?.hasPendingWrites || accountsSnap.metadata?.hasPendingWrites),
      fromCache: !!(recordsSnap.metadata?.fromCache || ordersSnap.metadata?.fromCache || accountsSnap.metadata?.fromCache),
      syncRevision: syncState?.revision || '',
      syncUpdatedByClientId: syncState?.updatedByClientId || ''
    };
  }

  async function pullSnapshot(): Promise<FinanceProviderSnapshot> {
    const currentDb = await requireDb();
    const [recordsSnap, ordersSnap, accountsSnap, syncState] = await Promise.all([
      getQuerySnapshot(currentDb.collection('finance_records').orderBy('occurredAt', 'desc')),
      getQuerySnapshot(currentDb.collection('orders')),
      getQuerySnapshot(currentDb.collection('order_accounts')),
      readSyncState(currentDb, 'finance')
    ]);

    return buildSnapshotFromQuerySnapshots(recordsSnap, ordersSnap, accountsSnap, syncState);
  }

  function subscribeSnapshot(
    onNext: (snapshot: FinanceProviderSnapshot) => void,
    onError: (error: unknown) => void = () => {},
    options: { currentRevision?: string; clientId?: string } = {}
  ) {
    let active = true;
    let unsubscribeSyncState: (() => void) | null = null;

    requireDb().then(currentDb => {
      if (!active) return;
      unsubscribeSyncState = subscribeSyncState(currentDb, 'finance', state => {
        if (!active) return;
        onNext({
          records: [],
          orders: [],
          accounts: [],
          updatedAt: state.updatedAt,
          hasPendingWrites: false,
          fromCache: false,
          hasExternalChanges: true,
          syncRevision: state.revision,
          syncUpdatedByClientId: state.updatedByClientId
        });
      }, onError, options);
    }).catch(onError);

    return () => {
      active = false;
      if (unsubscribeSyncState) unsubscribeSyncState();
    };
  }

  async function upsertRecord(record: Partial<FinanceRecord> | FinanceRecordDraft, { waitForCommit = true, clientId = '' }: FinanceProviderUpsertOptions = {}): Promise<FinanceProviderUpsertResult> {
    const currentDb = await requireDb();
    const updatedAt = nowIso();
    const normalized = normalizeFinanceRecord({
      ...record,
      id: String((record as Partial<FinanceRecord>)?.id || '').trim() || uid(),
      updatedAt,
      createdAt: String((record as Partial<FinanceRecord>)?.createdAt || '').trim() || updatedAt
    }, { nowIso, todayStr });
    const doc = buildFinanceDoc(normalized, { nowIso });
    const batch = currentDb.batch();
    batch.set(currentDb.collection('finance_records').doc(doc.id), doc, { merge: true });
    touchSyncState(currentDb, batch, 'finance', { updatedAt, clientId });
    const commitPromise = batch.commit();
    if (!waitForCommit) commitPromise.catch(error => console.error('Firestore finance local queue write failed', error));
    if (waitForCommit) await commitPromise;
    return {
      record: normalized,
      updatedAt,
      ...(waitForCommit ? {} : { commitPromise })
    };
  }

  async function deleteRecord(id: string, { waitForCommit = true, clientId = '' }: FinanceProviderDeleteOptions = {}): Promise<FinanceProviderDeleteResult> {
    const currentDb = await requireDb();
    const normalizedId = String(id || '').trim();
    if (!normalizedId) throw new Error('记录 ID 不能为空');
    const updatedAt = nowIso();
    const batch = currentDb.batch();
    batch.set(currentDb.collection('finance_records').doc(normalizedId), {
      id: normalizedId,
      updatedAt,
      deletedAt: updatedAt
    }, { merge: true });
    touchSyncState(currentDb, batch, 'finance', { updatedAt, clientId });
    const commitPromise = batch.commit();
    if (!waitForCommit) commitPromise.catch(error => console.error('Firestore finance delete local queue write failed', error));
    if (waitForCommit) await commitPromise;
    return {
      id: normalizedId,
      updatedAt,
      ...(waitForCommit ? {} : { commitPromise })
    };
  }

  async function renameAccount(oldName: string, newName: string, options: { accountOrder?: string[]; waitForCommit?: boolean; clientId?: string } = {}) {
    const currentDb = await requireDb();
    return renameAccountAcrossModules(currentDb, oldName, newName, nowIso, options);
  }

  async function deleteAccount(name: string, options: { accountOrder?: string[]; waitForCommit?: boolean; clientId?: string } = {}) {
    const currentDb = await requireDb();
    return deleteAccountLabel(currentDb, name, nowIso, options);
  }

  return {
    key: 'firestore',
    label: 'Firebase Firestore',
    parseConfigInput,
    normalizeConfigText,
    serializeConfig,
    getDisplayName,
    usesBuiltInLocalCache,
    init,
    isReady,
    isConnected,
    signOut,
    pullSnapshot,
    subscribeSnapshot,
    upsertRecord,
    deleteRecord,
    renameAccount,
    deleteAccount
  } as FinanceProviderApi;
}

const FinanceProviderFirestore = {
  create
};

export {
  FinanceProviderFirestore,
  buildFinanceDoc,
  create,
  getDisplayName,
  hydrateConfig,
  normalizeConfigText,
  normalizePulledFinanceRecord,
  parseConfigInput,
  serializeConfig,
  usesBuiltInLocalCache
};
