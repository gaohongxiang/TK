import type {
  FirebaseCompatApp,
  FirebaseCompatFirestore,
  FirebaseCompatNamespace,
  FirebaseCompatQuerySnapshot,
  FirebaseConfig,
  HydratedFirebaseConfig
} from '../types/firestore.ts';
import { deleteAccountLabel, renameAccountAcrossModules } from '../accounts/firestore-account-actions.ts';
import { initSharedFirebaseApp } from '../firebase-app.ts';

type CollectionDatasetKey = 'records' | 'rejects';
type CollectionRecordDatasetKey = 'records';
type LooseRecord = Record<string, unknown>;
type CollectionCsvRow = Record<string, string>;
type CollectionDataset = {
  filename: string;
  headers: string[];
  rows: CollectionCsvRow[];
};
type CollectionDatasetMap = Record<CollectionDatasetKey, CollectionDataset | null>;
type CollectionProviderSnapshot = CollectionDatasetMap & {
  accounts: string[];
  hasPendingWrites?: boolean;
  fromCache?: boolean;
};
type CollectionProviderCreateOptions = {
  state?: LooseRecord;
  helpers?: {
    nowIso?: () => string;
  };
  window?: (Partial<Window> & { firebase?: FirebaseCompatNamespace }) | typeof globalThis;
};
type CollectionProviderWriteOptions = {
  waitForCommit?: boolean;
};
type CollectionProviderPullDatasetsOptions = {
  includeRejects?: boolean;
};
type CollectionProviderAccountWriteOptions = CollectionProviderWriteOptions & {
  sortIndex?: number;
};
type CollectionProviderDeferredAccountWrite = {
  account: string;
  commitPromise: Promise<unknown>;
};
type CollectionRecordDatasetDoc = {
  filename: string;
  headers: string[];
  row: CollectionCsvRow;
  updatedAt: string;
};
type CollectionRecordDoc = {
  productKey: string;
  accountName: string | null;
  productId: string | null;
  productUrl: string | null;
  fastmossUrl: string | null;
  shopName: string | null;
  productName: string | null;
  editedTitle?: string | null;
  editStatus?: string | null;
  editedAt?: string | null;
  editJudgement?: string | null;
  collectStatus: string | null;
  collectedToDxm: boolean;
  collectedAt: string | null;
  collectFailureReason: string | null;
  note: string | null;
  lastDatasetKey: CollectionRecordDatasetKey;
  source: string;
  createdAt: string;
  updatedAt: string;
  datasets: Partial<Record<CollectionRecordDatasetKey, CollectionRecordDatasetDoc>>;
};
type CollectionExcludedProductDoc = {
  productKey: string;
  accountName: string | null;
  productId: string | null;
  productUrl: string | null;
  fastmossUrl: string | null;
  shopName: string | null;
  productName: string | null;
  productCategory: string | null;
  productSales7d: string | null;
  shopRevenueJpy: string | null;
  rejectReason: string | null;
  filename: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

const DATASET_KEYS: CollectionDatasetKey[] = ['records', 'rejects'];
const RECORD_DATASET_KEYS: CollectionRecordDatasetKey[] = ['records'];
const DEFAULT_FILENAMES: Record<CollectionDatasetKey, string> = {
  records: 'collection_records.csv',
  rejects: 'selection_rejects.csv'
};

function toPlainObject(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as LooseRecord;
}

function toSortIndex(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function runLooseObjectParser(text: string): unknown {
  try {
    return Function(`"use strict"; return (${text});`)();
  } catch (error) {
    return null;
  }
}

function sanitizeConfig(raw: unknown): FirebaseConfig | null {
  const cfg = toPlainObject(raw);
  if (!cfg) return null;
  const next: Partial<FirebaseConfig> = {};
  ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId', 'measurementId'].forEach(key => {
    const value = String(cfg[key] || '').trim();
    if (value) next[key as keyof FirebaseConfig] = value;
  });
  if (!next.apiKey || !next.projectId || !next.appId) return null;
  if (!next.authDomain) next.authDomain = `${next.projectId}.firebaseapp.com`;
  return next as FirebaseConfig;
}

function parseConfigInput(raw: unknown): FirebaseConfig | null {
  if (!raw) return null;
  if (typeof raw === 'object') return sanitizeConfig(raw);
  const text = String(raw || '').trim();
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  const body = text.slice(start, end + 1);
  try {
    return sanitizeConfig(JSON.parse(body));
  } catch (error) {}
  return sanitizeConfig(runLooseObjectParser(body));
}

function hydrateConfig(raw: unknown = {}): HydratedFirebaseConfig {
  const source = toPlainObject(raw) || {};
  const parsed = parseConfigInput(source?.configText || source?.firestoreConfigText || source?.firebaseConfig || raw);
  return {
    config: parsed,
    configText: parsed ? JSON.stringify(parsed, null, 2) : '',
    projectId: parsed?.projectId || String(source?.projectId || source?.firestoreProjectId || '').trim(),
    user: String(source?.user || '').trim()
  };
}

function toNullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function getRowValue(row: LooseRecord, names: string[]) {
  for (const name of names) {
    const value = String(row[name] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function normalizeProductUrl(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    return text.replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

function extractProductId(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const patterns = [
    /\/(?:view\/product|product)\/(\d{8,})/i,
    /\/e-commerce\/detail\/(\d{8,})/i,
    /(?:product_id|productId|item_id|itemId|id)[=:](\d{8,})/i,
    /\b(\d{16,22})\b/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function normalizeTkProductUrl(value: unknown, productId = '') {
  const url = normalizeProductUrl(value);
  if (/tiktok\.com/i.test(url)) return url;
  const id = extractProductId(productId || url);
  return id ? `https://www.tiktok.com/view/product/${id}` : '';
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

function getProductKey(row: LooseRecord) {
  const productId = getRowValue(row, ['商品ID', 'product_id', 'item_id', 'productId']);
  const productUrl = normalizeTkProductUrl(getRowValue(row, ['核心 TK 链接', '商品链接', 'product_url', 'tk_product_url', '链接']), productId);
  const fallback = [
    getRowValue(row, ['商品名称']),
    getRowValue(row, ['店铺名', 'shop_name']),
    productUrl
  ].filter(Boolean).join('|');
  const source = productId || productUrl || fallback;
  return `tk_${stableHash(source || JSON.stringify(row))}`;
}

function getAccountName(row: LooseRecord) {
  return getRowValue(row, ['账号', '所属账号', '目标账号', 'account', 'accountName', 'account_name']);
}

function getScopedProductKey(row: LooseRecord) {
  const productKey = getProductKey(row);
  const accountName = getAccountName(row);
  return accountName ? `acc_${stableHash(accountName)}_${productKey}` : productKey;
}

function normalizeCsvRow(row: LooseRecord): CollectionCsvRow {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, String(value ?? '')]));
}

function mergeHeaders(current: string[], next: string[]) {
  return Array.from(new Set([...current, ...next].map(value => String(value || '').trim()).filter(Boolean)));
}

function normalizeCollectStatus(row: LooseRecord) {
  const status = getRowValue(row, ['采集状态']);
  if (status === '已采集') return '已采集';
  if (status === '采集失败') return '采集失败';
  return '';
}

function getCollectFailureReason(row: LooseRecord, collectStatus = normalizeCollectStatus(row)) {
  if (collectStatus !== '采集失败') return '';
  return getRowValue(row, ['选品判断']);
}

function buildCollectSelectionJudgement(row: LooseRecord, collectStatus: string, collectFailureReason: string) {
  if (collectStatus === '采集失败') return collectFailureReason || '';
  return getRowValue(row, ['选品判断']) || '符合当前选品规则，已采集到店小秘。';
}

function removeCollectionEditFields(row: CollectionCsvRow) {
  for (const key of ['店小秘编辑状态', '编辑时间', '编辑标题', '编辑判断']) {
    delete row[key];
  }
}

function normalizeEditStatus(row: LooseRecord) {
  const status = getRowValue(row, ['店小秘编辑状态']);
  if (getRowValue(row, ['编辑标题'])) return '已编辑';
  if (status === '已编辑') return '已编辑';
  if (status === '编辑失败') return '编辑失败';
  return '未编辑';
}

function buildEditJudgement(row: LooseRecord, editStatus: string) {
  return getRowValue(row, ['编辑判断']);
}

function removeCollectionRecordHiddenFields(row: CollectionCsvRow) {
  for (const key of ['店铺总销售额（日元）', '店铺总销售额', 'shop_revenue_jpy']) delete row[key];
}

function isCollectedToDxm(row: LooseRecord) {
  return normalizeCollectStatus(row) === '已采集';
}

function buildRecordDoc(datasetKey: 'records', dataset: CollectionDataset, row: LooseRecord, nowIso: string): CollectionRecordDoc {
  const normalizedRow = normalizeCsvRow(row);
  const productName = getRowValue(normalizedRow, ['商品名称']);
  const productId = getRowValue(normalizedRow, ['商品ID', 'product_id', 'item_id', 'productId']);
  const productUrl = normalizeTkProductUrl(getRowValue(normalizedRow, ['核心 TK 链接', '商品链接', 'product_url', 'tk_product_url', '链接']), productId);
  const collectStatus = normalizeCollectStatus(normalizedRow);
  const collectFailureReason = toNullableText(getCollectFailureReason(normalizedRow, collectStatus));
  normalizedRow['采集状态'] = collectStatus;
  const selectionJudgement = buildCollectSelectionJudgement(normalizedRow, collectStatus, collectFailureReason || '');
  if (selectionJudgement) normalizedRow['选品判断'] = selectionJudgement;
  removeCollectionEditFields(normalizedRow);
  removeCollectionRecordHiddenFields(normalizedRow);
  return {
    productKey: getScopedProductKey(normalizedRow),
    accountName: toNullableText(getAccountName(normalizedRow)),
    productId: toNullableText(productId),
    productUrl: toNullableText(productUrl),
    fastmossUrl: toNullableText(getRowValue(normalizedRow, ['FastMoss 链接', 'fastmoss_url', '店铺链接', 'shop_url'])),
    shopName: toNullableText(getRowValue(normalizedRow, ['店铺名', 'shop_name'])),
    productName: toNullableText(getRowValue(normalizedRow, ['商品名称'])),
    collectStatus,
    collectedToDxm: isCollectedToDxm(normalizedRow),
    collectedAt: toNullableText(getRowValue(normalizedRow, ['采集时间'])),
    collectFailureReason,
    note: toNullableText(getRowValue(normalizedRow, ['备注', 'note'])),
    lastDatasetKey: datasetKey,
    source: 'fastmoss',
    createdAt: nowIso,
    updatedAt: nowIso,
    datasets: {
      [datasetKey]: {
        filename: dataset.filename || DEFAULT_FILENAMES[datasetKey],
        headers: mergeHeaders(dataset.headers || [], Object.keys(normalizedRow)),
        row: normalizedRow,
        updatedAt: nowIso
      }
    }
  };
}

function buildExcludedProductDoc(dataset: CollectionDataset, row: LooseRecord, nowIso: string): CollectionExcludedProductDoc {
  const normalizedRow = normalizeCsvRow(row);
  const productId = getRowValue(normalizedRow, ['商品ID', 'product_id', 'item_id', 'productId']);
  const productUrl = normalizeTkProductUrl(getRowValue(normalizedRow, ['核心 TK 链接', '商品链接', 'product_url', 'tk_product_url', '链接']), productId);
  return {
    productKey: getScopedProductKey(normalizedRow),
    accountName: toNullableText(getAccountName(normalizedRow)),
    productId: toNullableText(productId),
    productUrl: toNullableText(productUrl),
    fastmossUrl: toNullableText(getRowValue(normalizedRow, ['FastMoss 链接', 'fastmoss_url', '店铺链接', 'shop_url'])),
    shopName: toNullableText(getRowValue(normalizedRow, ['店铺名', 'shop_name'])),
    productName: toNullableText(getRowValue(normalizedRow, ['商品名称'])),
    productCategory: toNullableText(getRowValue(normalizedRow, ['商品类目', 'category', 'product_category'])),
    productSales7d: toNullableText(getRowValue(normalizedRow, ['商品近7天销量', '商品近 7 天销量', 'day7_sales', 'day7_sold_count'])),
    shopRevenueJpy: toNullableText(getRowValue(normalizedRow, ['店铺总销售额（日元）', '店铺总销售额', 'shop_revenue_jpy'])),
    rejectReason: toNullableText(getRowValue(normalizedRow, ['拒绝原因'])),
    filename: dataset.filename || DEFAULT_FILENAMES.rejects,
    source: 'fastmoss',
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

function excludedDatasetFromDocs(docs: CollectionExcludedProductDoc[]): CollectionDataset | null {
  if (!docs.length) return null;
  const headers = ['账号', '拒绝原因', '商品名称', '店铺名', '商品类目', '商品近7天销量', '店铺总销售额（日元）', '商品链接', '拒绝时间'];
  return {
    filename: DEFAULT_FILENAMES.rejects,
    headers,
    rows: docs.map(doc => ({
      '账号': doc.accountName || '',
      '拒绝原因': doc.rejectReason || '',
      '商品名称': doc.productName || '',
      '店铺名': doc.shopName || '',
      '商品类目': doc.productCategory || '',
      '商品近7天销量': doc.productSales7d || '',
      '店铺总销售额（日元）': doc.shopRevenueJpy || '',
      '商品链接': doc.productUrl || '',
      '拒绝时间': doc.updatedAt || doc.createdAt || ''
    }))
  };
}

function putIfValue(row: CollectionCsvRow, key: string, value: unknown) {
  const text = String(value ?? '').trim();
  if (text && !row[key]) row[key] = text;
}

function recordRowFromDoc(doc: CollectionRecordDoc) {
  const row: CollectionCsvRow = {};
  for (const datasetKey of RECORD_DATASET_KEYS) {
    const datasetRow = doc.datasets?.[datasetKey]?.row;
    if (datasetRow) Object.assign(row, normalizeCsvRow(datasetRow));
  }
  putIfValue(row, '账号', doc.accountName);
  putIfValue(row, '商品名称', doc.productName);
  putIfValue(row, '店铺名', doc.shopName);
  putIfValue(row, '核心 TK 链接', doc.productUrl);
  putIfValue(row, '商品链接', doc.productUrl);
  putIfValue(row, 'FastMoss 链接', doc.fastmossUrl);
  putIfValue(row, '商品名称', doc.productName);
  row['采集状态'] = doc.collectStatus || normalizeCollectStatus(row);
  row['采集时间'] = doc.collectedAt || row['采集时间'] || '';
  if (doc.collectStatus === '采集失败' && doc.collectFailureReason) {
    row['选品判断'] = doc.collectFailureReason;
  }
  if (!row['选品判断']) {
    row['选品判断'] = doc.collectStatus === '采集失败' && doc.collectFailureReason ? doc.collectFailureReason : '';
  }
  row['编辑时间'] = doc.editedAt || row['编辑时间'] || '';
  putIfValue(row, '编辑标题', doc.editedTitle);
  row['店小秘编辑状态'] = normalizeEditStatus(row);
  row['编辑判断'] = doc.editJudgement || row['编辑判断'] || '';
  removeCollectionRecordHiddenFields(row);
  return row;
}

function getRecordSortTime(doc: CollectionRecordDoc) {
  const row = doc.datasets?.records?.row || {};
  return Date.parse(String(
    doc.collectedAt
      || row['采集时间']
      || doc.updatedAt
      || doc.createdAt
      || ''
  ));
}

function sortRecordsByCollectedAtDesc(left: CollectionRecordDoc, right: CollectionRecordDoc) {
  const leftTime = getRecordSortTime(left);
  const rightTime = getRecordSortTime(right);
  const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
  const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
  if (safeLeft !== safeRight) return safeRight - safeLeft;
  return String(right.productKey || '').localeCompare(String(left.productKey || ''));
}

function recordsDatasetFromDocs(docs: CollectionRecordDoc[]): CollectionDataset | null {
  if (!docs.length) return null;
  const rows = [...docs].sort(sortRecordsByCollectedAtDesc).map(recordRowFromDoc);
  const defaultHeaders = ['账号', '选品分', '商品名称', '店铺名', '商品价格', '商品近7天销量', '采集时间', '采集状态', '选品判断', '店小秘编辑状态', '编辑时间', '编辑标题', '编辑判断'];
  return {
    filename: DEFAULT_FILENAMES.records,
    headers: rows.reduce((headers, row) => mergeHeaders(headers, Object.keys(row)), defaultHeaders),
    rows
  };
}

function datasetsFromDocs(docs: CollectionRecordDoc[], rejectDocs: CollectionExcludedProductDoc[] = []): CollectionDatasetMap {
  const next = Object.fromEntries(DATASET_KEYS.map(key => [key, null])) as CollectionDatasetMap;
  next.records = recordsDatasetFromDocs(docs);
  next.rejects = excludedDatasetFromDocs(rejectDocs);
  return next;
}

function accountsFromSnapshot(snapshot: FirebaseCompatQuerySnapshot): string[] {
  return [...new Set(snapshot.docs
    .map((doc, index) => ({ data: doc.data() || {}, fallbackIndex: index }))
    .filter(row => !row.data.deletedAt)
    .map(row => ({
      name: String(row.data.name || '').trim(),
      sortIndex: toSortIndex(row.data.sortIndex, row.fallbackIndex)
    }))
    .filter(row => row.name)
    .sort((left, right) => left.sortIndex - right.sortIndex || left.name.localeCompare(right.name))
    .map(row => row.name))];
}

function buildProviderSnapshot(
  recordsSnapshot: FirebaseCompatQuerySnapshot,
  accountsSnapshot: FirebaseCompatQuerySnapshot,
  rejectsSnapshot: FirebaseCompatQuerySnapshot | null = null
): CollectionProviderSnapshot {
  const datasets = datasetsFromDocs(
    recordsSnapshot.docs.map(doc => doc.data() as CollectionRecordDoc),
    rejectsSnapshot?.docs.map(doc => doc.data() as CollectionExcludedProductDoc) || []
  );
  return {
    ...datasets,
    accounts: accountsFromSnapshot(accountsSnapshot),
    hasPendingWrites: !!(recordsSnapshot.metadata?.hasPendingWrites || accountsSnapshot.metadata?.hasPendingWrites || rejectsSnapshot?.metadata?.hasPendingWrites),
    fromCache: !!(recordsSnapshot.metadata?.fromCache || accountsSnapshot.metadata?.fromCache || rejectsSnapshot?.metadata?.fromCache)
  };
}

function create({ state = {}, helpers = {}, window: rootWindow = globalThis.window }: CollectionProviderCreateOptions = {}) {
  const nowIso = helpers.nowIso || (() => new Date().toISOString());
  let app: FirebaseCompatApp | null = null;
  let db: FirebaseCompatFirestore | null = null;

  async function requireDb(): Promise<FirebaseCompatFirestore> {
    if (!db) throw new Error('Firestore 尚未初始化');
    return db;
  }

  async function init(rawConfig: unknown = state): Promise<HydratedFirebaseConfig> {
    const next = hydrateConfig(rawConfig);
    if (!next.config) throw new Error('请先填写有效的 firebaseConfig');

    const firebaseNs = (rootWindow as { firebase?: FirebaseCompatNamespace } | undefined)?.firebase || null;
    if (!firebaseNs?.initializeApp) throw new Error('Firebase SDK 尚未加载');

    const shared = initSharedFirebaseApp(next.config, rootWindow, '__tkCollectionFirestoreConfigured');
    app = shared.app;
    db = shared.db;
    state.firestoreConfigText = next.configText;
    state.firestoreProjectId = next.projectId;
    state.user = next.user;
    return next;
  }

  async function pullDatasets({ includeRejects = true }: CollectionProviderPullDatasetsOptions = {}): Promise<CollectionDatasetMap> {
    const currentDb = await requireDb();
    const rejectsPromise = includeRejects
      ? currentDb.collection('collection_excluded_products').orderBy('updatedAt', 'desc').get()
      : Promise.resolve(null);
    const [snapshot, rejectsSnapshot] = await Promise.all([
      currentDb.collection('collection_records').orderBy('collectedAt', 'desc').get(),
      rejectsPromise
    ]);
    return datasetsFromDocs(
      snapshot.docs.map(doc => doc.data() as CollectionRecordDoc),
      rejectsSnapshot?.docs.map(doc => doc.data() as CollectionExcludedProductDoc) || []
    );
  }

  async function pullAccounts(): Promise<string[]> {
    const currentDb = await requireDb();
    const snapshot = await currentDb.collection('order_accounts').get();
    return accountsFromSnapshot(snapshot);
  }

  function subscribeSnapshot(onNext: (snapshot: CollectionProviderSnapshot) => void, onError: (error: unknown) => void = () => {}) {
    let active = true;
    let recordsSnap: FirebaseCompatQuerySnapshot | null = null;
    let accountsSnap: FirebaseCompatQuerySnapshot | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribeRecords: (() => void) | null = null;
    let unsubscribeAccounts: (() => void) | null = null;

    const emit = () => {
      if (!active || !recordsSnap || !accountsSnap) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!active || !recordsSnap || !accountsSnap) return;
        onNext(buildProviderSnapshot(recordsSnap, accountsSnap));
      }, 0);
    };

    requireDb().then(currentDb => {
      if (!active) return;
      const recordsQuery = currentDb.collection('collection_records').orderBy('collectedAt', 'desc');
      const accountsQuery = currentDb.collection('order_accounts');
      if (!recordsQuery.onSnapshot || !accountsQuery.onSnapshot) {
        Promise.all([
          currentDb.collection('collection_records').orderBy('collectedAt', 'desc').get(),
          currentDb.collection('order_accounts').get()
        ]).then(([recordsSnapshot, accountsSnapshot]) => {
          if (active) onNext(buildProviderSnapshot(recordsSnapshot, accountsSnapshot));
        }).catch(onError);
        return;
      }
      unsubscribeRecords = recordsQuery.onSnapshot(
        { includeMetadataChanges: true },
        snapshot => {
          recordsSnap = snapshot;
          emit();
        },
        onError
      );
      unsubscribeAccounts = accountsQuery.onSnapshot(
        { includeMetadataChanges: true },
        snapshot => {
          accountsSnap = snapshot;
          emit();
        },
        onError
      );
    }).catch(onError);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (unsubscribeRecords) unsubscribeRecords();
      if (unsubscribeAccounts) unsubscribeAccounts();
    };
  }

  function accountDocId(name: unknown = ''): string {
    const raw = String(name || '').trim();
    return raw ? encodeURIComponent(raw) : '__unassigned__';
  }

  function trackWritePromise(promise: Promise<unknown>, label: string, { waitForCommit = true }: CollectionProviderWriteOptions = {}): Promise<unknown> {
    const commitPromise = Promise.resolve(promise);
    if (!waitForCommit) commitPromise.catch(error => console.error(label, error));
    return commitPromise;
  }

  async function upsertAccount(name: string, { sortIndex, waitForCommit = true }: CollectionProviderAccountWriteOptions = {}): Promise<string | CollectionProviderDeferredAccountWrite> {
    const currentDb = await requireDb();
    const normalized = String(name || '').trim();
    if (!normalized) throw new Error('账号名称不能为空');
    const updatedAt = nowIso();
    const id = accountDocId(normalized);
    const commitPromise = trackWritePromise(
      currentDb.collection('order_accounts').doc(id).set({
        id,
        name: normalized,
        ...(Number.isFinite(Number(sortIndex)) ? { sortIndex: Number(sortIndex) } : {}),
        updatedAt,
        deletedAt: null,
        createdAt: updatedAt
      }, { merge: true }),
      'Firestore collection account local queue write failed',
      { waitForCommit }
    );
    if (waitForCommit) await commitPromise;
    return waitForCommit ? normalized : { account: normalized, commitPromise };
  }

  async function saveAccountOrder(names: string[] = [], { waitForCommit = true }: CollectionProviderWriteOptions = {}) {
    const currentDb = await requireDb();
    const normalizedNames = [...new Set(names.map(name => String(name || '').trim()).filter(Boolean))];
    if (!normalizedNames.length) return waitForCommit ? 0 : { count: 0, commitPromise: Promise.resolve() };
    const updatedAt = nowIso();
    const batch = currentDb.batch();
    normalizedNames.forEach((name, index) => {
      const id = accountDocId(name);
      batch.set(currentDb.collection('order_accounts').doc(id), {
        id,
        name,
        sortIndex: index,
        updatedAt,
        deletedAt: null,
        createdAt: updatedAt
      }, { merge: true });
    });
    const commitPromise = trackWritePromise(batch.commit(), 'Firestore collection account order local queue write failed', { waitForCommit });
    if (waitForCommit) await commitPromise;
    return waitForCommit ? normalizedNames.length : { count: normalizedNames.length, commitPromise };
  }

  async function renameAccount(oldName: string, newName: string, options: CollectionProviderWriteOptions & { accountOrder?: string[] } = {}) {
    const currentDb = await requireDb();
    return renameAccountAcrossModules(currentDb, oldName, newName, nowIso, options);
  }

  async function deleteAccount(name: string, options: CollectionProviderWriteOptions & { accountOrder?: string[] } = {}) {
    const currentDb = await requireDb();
    return deleteAccountLabel(currentDb, name, nowIso, options);
  }

  async function upsertDatasetRows(datasetKey: CollectionDatasetKey, dataset: CollectionDataset, { waitForCommit = true }: CollectionProviderWriteOptions = {}) {
    const currentDb = await requireDb();
    const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
    if (!rows.length) return waitForCommit ? 0 : { count: 0, commitPromise: Promise.resolve() };
    const batch = currentDb.batch();
    if (datasetKey === 'rejects') {
      const rejects = rows.map(row => buildExcludedProductDoc(dataset, row, nowIso()));
      for (const doc of rejects) {
        batch.set(currentDb.collection('collection_excluded_products').doc(doc.productKey), doc, { merge: true });
      }
      const commitPromise = trackWritePromise(batch.commit(), 'Firestore collection excluded product local queue write failed', { waitForCommit });
      if (waitForCommit) await commitPromise;
      return waitForCommit ? rejects.length : { count: rejects.length, commitPromise };
    }
    const records = rows.map(row => buildRecordDoc(datasetKey, dataset, row, nowIso()));
    for (const doc of records) {
      batch.set(currentDb.collection('collection_records').doc(doc.productKey), doc, { merge: true });
    }
    const commitPromise = trackWritePromise(batch.commit(), 'Firestore collection local queue write failed', { waitForCommit });
    if (waitForCommit) await commitPromise;
    return waitForCommit ? records.length : { count: records.length, commitPromise };
  }

  return {
    key: 'firestore',
    hydrateConfig,
    init,
    pullAccounts,
    pullDatasets,
    subscribeSnapshot,
    upsertAccount,
    saveAccountOrder,
    renameAccount,
    deleteAccount,
    upsertDatasetRows
  };
}

const CollectionProviderFirestore = {
  create
};

const CollectionProviderFirestoreUtils = {
  buildRecordDoc,
  buildExcludedProductDoc,
  datasetsFromDocs,
  getAccountName,
  getProductKey,
  getScopedProductKey,
  hydrateConfig,
  normalizeProductUrl,
  parseConfigInput
};

export {
  CollectionProviderFirestore,
  CollectionProviderFirestoreUtils,
  buildRecordDoc,
  create,
  datasetsFromDocs,
  getAccountName,
  getProductKey,
  getScopedProductKey,
  hydrateConfig,
  normalizeProductUrl,
  parseConfigInput
};

export type {
  CollectionCsvRow,
  CollectionDataset,
  CollectionDatasetKey,
  CollectionDatasetMap,
  CollectionExcludedProductDoc,
  CollectionProviderPullDatasetsOptions,
  CollectionProviderAccountWriteOptions,
  CollectionProviderDeferredAccountWrite,
  CollectionRecordDoc
};
