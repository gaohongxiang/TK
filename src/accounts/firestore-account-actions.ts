import type {
  FirebaseCompatDocSnapshot,
  FirebaseCompatFirestore,
  FirebaseCompatWriteBatch
} from '../types/firestore.ts';

type AccountWriteOptions = {
  waitForCommit?: boolean;
};

type AccountRenameOptions = AccountWriteOptions & {
  accountOrder?: string[];
};

type AccountDeleteOptions = AccountWriteOptions & {
  accountOrder?: string[];
};

type DeferredAccountAction = {
  accounts: string[];
  commitPromise: Promise<unknown[]>;
};

type AccountActionResult = {
  accounts: string[];
  commitPromise?: Promise<unknown[]>;
};

type LooseRecord = Record<string, unknown>;

function normalizeAccountName(value: unknown): string {
  return String(value || '').trim();
}

function uniqueAccounts(values: unknown[] = []): string[] {
  return [...new Set(values.map(normalizeAccountName).filter(Boolean))];
}

function accountDocId(name: unknown = ''): string {
  const raw = normalizeAccountName(name);
  return raw ? encodeURIComponent(raw) : '__unassigned__';
}

function docId(doc: FirebaseCompatDocSnapshot, fallback = ''): string {
  return normalizeAccountName(doc.id || fallback);
}

function toPlainObject(value: unknown): LooseRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as LooseRecord : {};
}

function clonePlain<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildRenamedAccountOrder(accountOrder: string[] = [], oldName: string, newName: string): string[] {
  const current = uniqueAccounts(accountOrder);
  if (current.some(account => account !== oldName && account === newName)) {
    throw new Error(`账号「${newName}」已存在`);
  }
  const renamed = current.map(account => account === oldName ? newName : account);
  return uniqueAccounts(renamed.length ? renamed : [newName]);
}

function buildDeletedAccountOrder(accountOrder: string[] = [], name: string): string[] {
  return uniqueAccounts(accountOrder).filter(account => account !== name);
}

function commitMutations(
  db: FirebaseCompatFirestore,
  mutations: Array<(batch: FirebaseCompatWriteBatch) => void>,
  { waitForCommit = true }: AccountWriteOptions = {}
): Promise<unknown[]> {
  if (!mutations.length) return Promise.resolve([]);
  const commits: Promise<unknown>[] = [];
  const chunkSize = 400;
  for (let index = 0; index < mutations.length; index += chunkSize) {
    const batch = db.batch();
    mutations.slice(index, index + chunkSize).forEach(apply => apply(batch));
    commits.push(batch.commit());
  }
  const commitPromise = Promise.all(commits);
  if (!waitForCommit) commitPromise.catch(error => console.error('Firestore account action write failed', error));
  return commitPromise;
}

function setAccountOrderMutations(
  db: FirebaseCompatFirestore,
  accounts: string[],
  updatedAt: string,
  mutations: Array<(batch: FirebaseCompatWriteBatch) => void>
) {
  accounts.forEach((name, index) => {
    const id = accountDocId(name);
    mutations.push(batch => batch.set(db.collection('order_accounts').doc(id), {
      id,
      name,
      sortIndex: index,
      updatedAt,
      deletedAt: null,
      createdAt: updatedAt
    }, { merge: true }));
  });
}

async function renameProductAccounts(
  db: FirebaseCompatFirestore,
  oldName: string,
  newName: string,
  updatedAt: string,
  mutations: Array<(batch: FirebaseCompatWriteBatch) => void>
) {
  const snapshot = await db.collection('products').get();
  snapshot.docs.forEach(doc => {
    const data = toPlainObject(doc.data());
    if (normalizeAccountName(data.accountName) !== oldName) return;
    const id = docId(doc, data.tkId as string);
    if (!id) return;
    mutations.push(batch => batch.set(db.collection('products').doc(id), {
      accountName: newName,
      updatedAt
    }, { merge: true }));
  });
}

async function renameOrderAccounts(
  db: FirebaseCompatFirestore,
  oldName: string,
  newName: string,
  updatedAt: string,
  mutations: Array<(batch: FirebaseCompatWriteBatch) => void>
) {
  const snapshot = await db.collection('orders').get();
  snapshot.docs.forEach(doc => {
    const data = toPlainObject(doc.data());
    if (normalizeAccountName(data.accountName) !== oldName) return;
    const id = docId(doc, data.id as string);
    if (!id) return;
    mutations.push(batch => batch.set(db.collection('orders').doc(id), {
      accountName: newName,
      updatedAt
    }, { merge: true }));
  });
}

function renameCollectionDatasetAccount(data: LooseRecord, oldName: string, newName: string): LooseRecord | null {
  const datasets = clonePlain(toPlainObject(data.datasets));
  let changed = false;
  Object.values(datasets).forEach(item => {
    const dataset = toPlainObject(item);
    const row = toPlainObject(dataset.row);
    if (normalizeAccountName(row['账号']) === oldName || normalizeAccountName(data.accountName) === oldName) {
      row['账号'] = newName;
      dataset.row = row;
      changed = true;
    }
  });
  return changed ? datasets : null;
}

async function renameCollectionAccounts(
  db: FirebaseCompatFirestore,
  oldName: string,
  newName: string,
  updatedAt: string,
  mutations: Array<(batch: FirebaseCompatWriteBatch) => void>
) {
  const recordsSnapshot = await db.collection('collection_records').get();
  recordsSnapshot.docs.forEach(doc => {
    const data = toPlainObject(doc.data());
    const datasets = renameCollectionDatasetAccount(data, oldName, newName);
    if (normalizeAccountName(data.accountName) !== oldName && !datasets) return;
    const id = docId(doc, data.productKey as string);
    if (!id) return;
    mutations.push(batch => batch.set(db.collection('collection_records').doc(id), {
      accountName: newName,
      ...(datasets ? { datasets } : {}),
      updatedAt
    }, { merge: true }));
  });

  const rejectsSnapshot = await db.collection('collection_excluded_products').get();
  rejectsSnapshot.docs.forEach(doc => {
    const data = toPlainObject(doc.data());
    if (normalizeAccountName(data.accountName) !== oldName) return;
    const id = docId(doc, data.productKey as string);
    if (!id) return;
    mutations.push(batch => batch.set(db.collection('collection_excluded_products').doc(id), {
      accountName: newName,
      updatedAt
    }, { merge: true }));
  });
}

async function renameAnalyticsAccounts(
  db: FirebaseCompatFirestore,
  oldName: string,
  newName: string,
  updatedAt: string,
  mutations: Array<(batch: FirebaseCompatWriteBatch) => void>
) {
  const snapshot = await db.collection('analytics_snapshots').get();
  snapshot.docs.forEach(doc => {
    const data = toPlainObject(doc.data());
    if (normalizeAccountName(data.accountName) !== oldName) return;
    const id = docId(doc, data.id as string);
    if (!id) return;
    mutations.push(batch => batch.set(db.collection('analytics_snapshots').doc(id), {
      accountName: newName,
      updatedAt
    }, { merge: true }));
  });
}

async function renameFinanceAccounts(
  db: FirebaseCompatFirestore,
  oldName: string,
  newName: string,
  updatedAt: string,
  mutations: Array<(batch: FirebaseCompatWriteBatch) => void>
) {
  const snapshot = await db.collection('finance_records').get();
  snapshot.docs.forEach(doc => {
    const data = toPlainObject(doc.data());
    if (normalizeAccountName(data.accountName) !== oldName) return;
    const id = docId(doc, data.id as string);
    if (!id) return;
    mutations.push(batch => batch.set(db.collection('finance_records').doc(id), {
      accountName: newName,
      updatedAt
    }, { merge: true }));
  });
}

async function renameAccountAcrossModules(
  db: FirebaseCompatFirestore,
  oldValue: string,
  newValue: string,
  nowIso: () => string,
  { accountOrder = [], waitForCommit = true }: AccountRenameOptions = {}
): Promise<AccountActionResult | DeferredAccountAction> {
  const oldName = normalizeAccountName(oldValue);
  const newName = normalizeAccountName(newValue);
  if (!oldName) throw new Error('原账号名称不能为空');
  if (!newName) throw new Error('账号名称不能为空');
  if (oldName === newName) return { accounts: uniqueAccounts(accountOrder) };

  const accounts = buildRenamedAccountOrder(accountOrder, oldName, newName);
  const updatedAt = nowIso();
  const mutations: Array<(batch: FirebaseCompatWriteBatch) => void> = [];

  mutations.push(batch => batch.set(db.collection('order_accounts').doc(accountDocId(oldName)), {
    id: accountDocId(oldName),
    name: oldName,
    updatedAt,
    deletedAt: updatedAt
  }, { merge: true }));
  setAccountOrderMutations(db, accounts, updatedAt, mutations);

  await Promise.all([
    renameProductAccounts(db, oldName, newName, updatedAt, mutations),
    renameOrderAccounts(db, oldName, newName, updatedAt, mutations),
    renameCollectionAccounts(db, oldName, newName, updatedAt, mutations),
    renameAnalyticsAccounts(db, oldName, newName, updatedAt, mutations),
    renameFinanceAccounts(db, oldName, newName, updatedAt, mutations)
  ]);

  const commitPromise = commitMutations(db, mutations, { waitForCommit });
  if (waitForCommit) await commitPromise;
  return waitForCommit ? { accounts } : { accounts, commitPromise };
}

async function deleteAccountLabel(
  db: FirebaseCompatFirestore,
  value: string,
  nowIso: () => string,
  { accountOrder = [], waitForCommit = true }: AccountDeleteOptions = {}
): Promise<AccountActionResult | DeferredAccountAction> {
  const name = normalizeAccountName(value);
  if (!name) throw new Error('账号名称不能为空');
  const accounts = buildDeletedAccountOrder(accountOrder, name);
  const updatedAt = nowIso();
  const mutations: Array<(batch: FirebaseCompatWriteBatch) => void> = [];

  mutations.push(batch => batch.set(db.collection('order_accounts').doc(accountDocId(name)), {
    id: accountDocId(name),
    name,
    updatedAt,
    deletedAt: updatedAt
  }, { merge: true }));
  setAccountOrderMutations(db, accounts, updatedAt, mutations);

  const commitPromise = commitMutations(db, mutations, { waitForCommit });
  if (waitForCommit) await commitPromise;
  return waitForCommit ? { accounts } : { accounts, commitPromise };
}

export {
  accountDocId,
  buildDeletedAccountOrder,
  buildRenamedAccountOrder,
  deleteAccountLabel,
  normalizeAccountName,
  renameAccountAcrossModules,
  renameFinanceAccounts,
  uniqueAccounts
};
export type {
  AccountActionResult,
  AccountDeleteOptions,
  AccountRenameOptions,
  DeferredAccountAction
};
