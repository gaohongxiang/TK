import type {
  FirebaseCompatDocSnapshot,
  FirebaseCompatFirestore,
  FirebaseCompatWriteBatch
} from './types/firestore.ts';

type FirestoreSyncScope = 'orders' | 'products' | 'finance' | 'collection' | 'analytics' | 'app' | string;

type FirestoreSyncState = {
  scope: FirestoreSyncScope;
  revision: string;
  updatedAt: string;
  updatedByClientId: string;
  updatedByEmail: string;
  schemaVersion: number;
};

type TouchSyncStateOptions = {
  clientId?: string;
  email?: string;
  revision?: string;
  updatedAt?: string;
};

type SubscribeSyncStateOptions = {
  currentRevision?: string;
  clientId?: string;
};

function syncStateDocId(scope: FirestoreSyncScope): string {
  return String(scope || '').trim() || 'app';
}

function syncStateRef(db: FirebaseCompatFirestore, scope: FirestoreSyncScope) {
  return db.collection('sync_state').doc(syncStateDocId(scope));
}

function normalizeSyncState(raw: unknown = {}, fallbackScope: FirestoreSyncScope = 'app'): FirestoreSyncState {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const updatedAt = String(data.updatedAt || '').trim();
  const revision = String(data.revision || updatedAt || '').trim();
  return {
    scope: syncStateDocId(String(data.scope || fallbackScope)),
    revision,
    updatedAt,
    updatedByClientId: String(data.updatedByClientId || data.lastClientId || '').trim(),
    updatedByEmail: String(data.updatedByEmail || '').trim(),
    schemaVersion: Number(data.schemaVersion) || 1
  };
}

function syncStateFromSnapshot(snapshot: FirebaseCompatDocSnapshot | null | undefined, fallbackScope: FirestoreSyncScope): FirestoreSyncState {
  return normalizeSyncState(snapshot?.exists ? snapshot.data() : { scope: fallbackScope }, fallbackScope);
}

async function readSyncState(db: FirebaseCompatFirestore, scope: FirestoreSyncScope): Promise<FirestoreSyncState> {
  const snapshot = await syncStateRef(db, scope).get();
  return syncStateFromSnapshot(snapshot, scope);
}

function buildSyncStateDoc(scope: FirestoreSyncScope, options: TouchSyncStateOptions = {}): FirestoreSyncState {
  const updatedAt = String(options.updatedAt || new Date().toISOString()).trim();
  const revision = String(options.revision || updatedAt).trim();
  return {
    scope: syncStateDocId(scope),
    revision,
    updatedAt,
    updatedByClientId: String(options.clientId || '').trim(),
    updatedByEmail: String(options.email || '').trim(),
    schemaVersion: 1
  };
}

function touchSyncState(
  db: FirebaseCompatFirestore,
  batch: FirebaseCompatWriteBatch,
  scope: FirestoreSyncScope,
  options: TouchSyncStateOptions = {}
) {
  batch.set(syncStateRef(db, scope), buildSyncStateDoc(scope, options), { merge: true });
}

const DEFAULT_BUSINESS_SYNC_SCOPES = ['orders', 'products', 'collection', 'finance', 'analytics'] as const;

function touchSyncScopes(
  db: FirebaseCompatFirestore,
  batch: FirebaseCompatWriteBatch,
  scopes: readonly FirestoreSyncScope[] = DEFAULT_BUSINESS_SYNC_SCOPES,
  options: TouchSyncStateOptions = {}
) {
  [...new Set(scopes.map(syncStateDocId).filter(Boolean))].forEach(scope => {
    touchSyncState(db, batch, scope, options);
  });
}

function subscribeSyncState(
  db: FirebaseCompatFirestore,
  scope: FirestoreSyncScope,
  onExternalChange: (state: FirestoreSyncState) => void,
  onError: (error: unknown) => void = () => {},
  options: SubscribeSyncStateOptions = {}
) {
  const ref = syncStateRef(db, scope);
  if (!ref.onSnapshot) {
    return () => {};
  }
  let lastRevision = String(options.currentRevision || '').trim();
  const currentClientId = String(options.clientId || '').trim();
  return ref.onSnapshot(
    { includeMetadataChanges: true },
    snapshot => {
      const state = syncStateFromSnapshot(snapshot, scope);
      if (!state.revision || state.revision === lastRevision) return;
      lastRevision = state.revision;
      if (currentClientId && state.updatedByClientId === currentClientId) return;
      onExternalChange(state);
    },
    onError
  );
}

export {
  DEFAULT_BUSINESS_SYNC_SCOPES,
  buildSyncStateDoc,
  normalizeSyncState,
  readSyncState,
  subscribeSyncState,
  syncStateDocId,
  syncStateFromSnapshot,
  syncStateRef,
  touchSyncScopes,
  touchSyncState
};

export type {
  FirestoreSyncScope,
  FirestoreSyncState,
  SubscribeSyncStateOptions,
  TouchSyncStateOptions
};
