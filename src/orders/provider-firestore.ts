import {
  normalizeOrderItems as normalizeSharedOrderItems
} from './shared.ts';
import type {
  OrderFirestoreConfig,
  OrderFirestoreDoc,
  OrderHydratedFirestoreConfig,
  OrderItemDoc,
  OrderItemSummaryParts,
  OrderItemTotals,
  OrderProviderApi,
  OrderProviderCreateOptions,
  OrderProviderPushChangesOptions,
  OrderProviderPushResult,
  OrderProviderSnapshot,
  OrderRecord,
  SerializedOrderProviderConfig
} from './types.ts';
import type {
  FirebaseCompatApp,
  FirebaseCompatCollectionRef,
  FirebaseCompatDocRef,
  FirebaseCompatDocSnapshot,
  FirebaseCompatFirestore,
  FirebaseCompatQuerySnapshot,
  FirebaseCompatWriteBatch
} from '../types/firestore.ts';

type LooseRecord = Record<string, unknown>;

function latestIso(values: unknown[] = []): string {
  return (values || []).map(value => String(value || '')).filter(Boolean).sort().slice(-1)[0] || '';
}

function toPlainObject(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as LooseRecord;
}

function runLooseObjectParser(text: string): unknown {
  try {
    return Function(`"use strict"; return (${text});`)();
  } catch (error) {
    return null;
  }
}

function sanitizeConfig(raw: unknown): OrderFirestoreConfig | null {
  const cfg = toPlainObject(raw);
  if (!cfg) return null;
  const next: Partial<OrderFirestoreConfig> = {};
  ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId', 'measurementId'].forEach(key => {
    const value = String(cfg[key] || '').trim();
    if (value) next[key as keyof OrderFirestoreConfig] = value;
  });
  if (!next.apiKey || !next.projectId || !next.appId) return null;
  if (!next.authDomain) next.authDomain = `${next.projectId}.firebaseapp.com`;
  return next as OrderFirestoreConfig;
}

function parseConfigInput(raw: unknown): OrderFirestoreConfig | null {
  if (!raw) return null;
  if (typeof raw === 'object') {
    const cfg = toPlainObject(raw);
    return cfg ? sanitizeConfig(cfg) : null;
  }

  const text = String(raw || '').trim();
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  const body = text.slice(start, end + 1);

  const fromJson = (() => {
    try {
      return JSON.parse(body);
    } catch (error) {
      return null;
    }
  })();
  if (fromJson) return sanitizeConfig(fromJson);

  return sanitizeConfig(runLooseObjectParser(body));
}

function normalizeConfigText(raw: unknown): string {
  const parsed = parseConfigInput(raw);
  return parsed ? JSON.stringify(parsed, null, 2) : '';
}

function hydrateConfig(raw: unknown = {}): OrderHydratedFirestoreConfig {
  const source = toPlainObject(raw) || {};
  const parsed = parseConfigInput(source?.configText || source?.firestoreConfigText || source?.firebaseConfig || source?.config || raw);
  return {
    config: parsed,
    configText: parsed ? JSON.stringify(parsed, null, 2) : '',
    projectId: parsed?.projectId || String(source?.projectId || source?.firestoreProjectId || '').trim(),
    user: String(source?.user || '').trim()
  };
}

function serializeConfig(config: unknown): SerializedOrderProviderConfig {
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

function getCacheKey(): null {
  return null;
}

function usesBuiltInLocalCache(): boolean {
  return true;
}

function toNullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function toNullableInteger(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableDecimal(value: unknown): number | null {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function toBoolean(value: unknown): boolean {
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
}

function toIsoString(value: unknown, fallback = ''): string {
  if (!value && fallback) return fallback;
  if (!value) return '';
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
  }
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return fallback || '';
}

function parseSeq(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function stripDuplicatedSkuSuffix(productName: unknown, skuName: unknown): string {
  const rawProductName = String(productName || '').trim();
  const rawSkuName = String(skuName || '').trim();
  if (!rawProductName || !rawSkuName) return rawProductName;
  let next = rawProductName;
  [` - ${rawSkuName}`, ` / ${rawSkuName}`].forEach(suffix => {
    if (next.endsWith(suffix)) next = next.slice(0, -suffix.length).trim();
  });
  return next;
}

type ProviderOrderItem = OrderItemDoc & {
  useOrderCourier?: boolean | null;
};

function normalizeOrderItems(items: ProviderOrderItem[] = [], { nowIso = () => new Date().toISOString() }: { nowIso?: () => string } = {}): ProviderOrderItem[] {
  if (!Array.isArray(items)) return [];
  return items.map(item => ({
    lineId: String(item?.lineId || '').trim() || nowIso(),
    productTkId: String(item?.productTkId || '').trim(),
    productSkuId: String(item?.productSkuId || '').trim(),
    productSkuName: String(item?.productSkuName || '').trim(),
    productName: stripDuplicatedSkuSuffix(item?.productName || '', item?.productSkuName || ''),
    quantity: toNullableInteger(item?.quantity) || 1,
    unitPurchasePrice: toNullableDecimal(item?.unitPurchasePrice),
    unitSalePrice: toNullableDecimal(item?.unitSalePrice),
    unitWeightG: toNullableDecimal(item?.unitWeightG),
    unitSizeText: toNullableText(item?.unitSizeText),
    useOrderCourier: item?.useOrderCourier === true
      ? true
      : item?.useOrderCourier === false
        ? false
        : null,
    courierCompany: toNullableText(item?.courierCompany),
    trackingNo: toNullableText(item?.trackingNo)
  }));
}

function buildCourierSummary(items: ProviderOrderItem[] = [], field: 'company' | 'tracking' = 'company', options?: { nowIso?: () => string }): string {
  const values = normalizeOrderItems(items, options)
    .map(item => (
      field === 'company'
        ? String(item?.courierCompany || '').trim()
        : String(item?.trackingNo || '').trim()
    ))
    .filter(Boolean);
  return Array.from(new Set(values)).join(' / ');
}

function rawOrderNeedsCanonicalCleanup(data: LooseRecord = {}, options?: { nowIso?: () => string }): boolean {
  const rawItems = Array.isArray(data?.items) ? data.items : [];
  const hasLegacyTopLevelItemFields = [
    data?.productTkId,
    data?.productSkuId,
    data?.productSkuName
  ].some(value => String(value || '').trim());
  const hasLegacyTopLevelCourierFields = [
    data?.courierCompany,
    data?.trackingNo
  ].some(value => String(value || '').trim());
  if (!rawItems.length) {
    return hasLegacyTopLevelItemFields
      || hasLegacyTopLevelCourierFields
      || !!String(data?.productName || '').trim();
  }
  return hasLegacyTopLevelItemFields
    || hasLegacyTopLevelCourierFields
    || rawItems.some(item => {
      const skuName = String(item?.productSkuName || '').trim();
      const productName = String(item?.productName || '').trim();
      return ('useOrderCourier' in (item || {}))
        || ('unitPurchasePrice' in (item || {}) && item?.unitPurchasePrice == null)
        || ('unitSalePrice' in (item || {}) && item?.unitSalePrice == null)
        || stripDuplicatedSkuSuffix(productName, skuName) !== productName;
    });
}

function getOrderItemSummaryParts(item: ProviderOrderItem = { lineId: '', quantity: null }): OrderItemSummaryParts {
  const rawProductName = String(item?.productName || '').trim();
  const skuName = String(item?.productSkuName || '').trim();
  const quantity = toNullableInteger(item?.quantity) || 1;
  let productName = rawProductName;
  if (productName && skuName) {
    [` - ${skuName}`, ` / ${skuName}`].forEach(suffix => {
      if (productName.endsWith(suffix)) {
        productName = productName.slice(0, -suffix.length).trim();
      }
    });
  }
  return {
    productName,
    skuName,
    quantity
  };
}

function deriveOrderItemTotals(items: ProviderOrderItem[] = [], options?: { nowIso?: () => string }): OrderItemTotals {
  return normalizeOrderItems(items, options).reduce<OrderItemTotals>((acc, item) => ({
    quantity: acc.quantity + (item.quantity || 0),
    purchase: acc.purchase + ((item.unitPurchasePrice || 0) * (item.quantity || 0)),
    sale: acc.sale + ((item.unitSalePrice || 0) * (item.quantity || 0)),
    weight: acc.weight + ((item.unitWeightG || 0) * (item.quantity || 0))
  }), {
    quantity: 0,
    purchase: 0,
    sale: 0,
    weight: 0
  });
}

function buildOrderItemsSummary(items: ProviderOrderItem[] = [], options?: { nowIso?: () => string }): string {
  const groups: Array<{
    key: string;
    productName: string;
    entries: Array<{ skuName: string; quantity: number }>;
  }> = [];
  normalizeOrderItems(items, options).forEach(item => {
    const meta = getOrderItemSummaryParts(item);
    const key = meta.productName || meta.skuName;
    if (!key) return;
    let group = groups.find(entry => entry.key === key);
    if (!group) {
      group = {
        key,
        productName: meta.productName || key,
        entries: []
      };
      groups.push(group);
    }
    group.entries.push({
      skuName: meta.skuName,
      quantity: meta.quantity
    });
  });
  return groups.map(group => {
    const hasSku = group.entries.some(entry => entry.skuName);
    if (!hasSku) {
      const totalQty = group.entries.reduce((sum, entry) => sum + entry.quantity, 0);
      return totalQty > 1 ? `${group.productName} ×${totalQty}` : group.productName;
    }
    const entryText = group.entries.map(entry => (
      `${entry.skuName}${entry.quantity > 1 ? ` ×${entry.quantity}` : ''}`
    )).join('，');
    return `${group.productName}（${entryText}）`;
  }).join(' / ');
}

function getOrderCreatedAt(order: OrderRecord, { nowIso = () => new Date().toISOString() }: { nowIso?: () => string } = {}): string {
  const direct = String(order?.createdAt || order?.created_at || '').trim();
  if (direct) return toIsoString(direct, nowIso());
  const updated = String(order?.updatedAt || order?.updated_at || '').trim();
  if (updated) return toIsoString(updated, nowIso());
  return nowIso();
}

function normalizePulledOrder(raw: unknown, options: { nowIso?: () => string } = {}): OrderRecord {
  const data = toPlainObject(raw) || {};
  const seq = parseSeq(data?.seq);
  const items = normalizeOrderItems(Array.isArray(data?.items) ? data.items as ProviderOrderItem[] : [], options);
  const totals = deriveOrderItemTotals(items, options);
  const totalQuantity = items.length ? totals.quantity : (data?.quantity ?? '');
  const totalPurchase = (data?.purchasePrice ?? '') !== '' && data?.purchasePrice != null
    ? data?.purchasePrice
    : (items.length ? totals.purchase : data?.purchasePrice);
  const totalSale = (data?.salePrice ?? '') !== '' && data?.salePrice != null
    ? data?.salePrice
    : (items.length ? totals.sale : data?.salePrice);
  const productSummary = items.length ? buildOrderItemsSummary(items, options) : (data?.productName || '');
  const courierSummary = items.length ? buildCourierSummary(items, 'company', options) : (data?.courierCompany || '');
  const trackingSummary = items.length ? buildCourierSummary(items, 'tracking', options) : (data?.trackingNo || '');
  return {
    id: String(data?.id || '').trim(),
    ...(seq !== null ? { seq } : {}),
    ...(items.length ? { items } : {}),
    __needsOrderCleanup: rawOrderNeedsCanonicalCleanup(data, options),
    createdAt: toIsoString(data?.createdAt || data?.created_at || ''),
    updatedAt: toIsoString(data?.updatedAt || data?.updated_at || ''),
    deletedAt: toIsoString(data?.deletedAt || data?.deleted_at || ''),
    '账号': String(data?.accountName || ''),
    '下单时间': String(data?.orderedAt || ''),
    '采购日期': String(data?.purchaseDate || ''),
    '最晚到仓时间': String(data?.latestWarehouseAt || ''),
    '订单预警': String(data?.warningText || ''),
    '订单号': String(data?.orderNo || ''),
    '商品TK ID': items.length === 1 ? String(items[0]?.productTkId || '') : String(data?.productTkId || ''),
    '商品SKU ID': items.length === 1 ? String(items[0]?.productSkuId || '') : String(data?.productSkuId || ''),
    '商品SKU名称': items.length === 1 ? String(items[0]?.productSkuName || '') : String(data?.productSkuName || ''),
    '产品名称': String(productSummary || ''),
    '数量': totalQuantity == null || totalQuantity === '' ? '' : String(totalQuantity),
    '是否退款': data?.isRefunded ? '1' : '',
    '达人佣金率': data?.creatorCommissionRate == null ? '' : String(data.creatorCommissionRate),
    '达人佣金': data?.creatorCommission == null ? '' : String(data.creatorCommission),
    '采购价格': totalPurchase == null || totalPurchase === '' ? '' : String(totalPurchase),
    '售价': totalSale == null || totalSale === '' ? '' : String(totalSale),
    '预估运费': data?.estimatedShippingFee == null ? '' : String(data.estimatedShippingFee),
    '预估利润': data?.estimatedProfit == null ? '' : String(data.estimatedProfit),
    '重量': String(data?.weightText || ''),
    '尺寸': String(data?.sizeText || ''),
    '订单状态': String(data?.orderStatus || ''),
    '快递公司': String(courierSummary || ''),
    '快递单号': String(trackingSummary || '')
  };
}

function buildOrderDoc(order: OrderRecord, options: { nowIso?: () => string } = {}): OrderFirestoreDoc {
  const nowIso = options.nowIso || (() => new Date().toISOString());
  const seq = parseSeq(order?.seq);
  const createdAt = getOrderCreatedAt(order, { nowIso });
  const updatedAt = toIsoString(order?.updatedAt || order?.updated_at, createdAt || nowIso()) || nowIso();
  const items = normalizeOrderItems(Array.isArray(order?.items) ? order.items as ProviderOrderItem[] : [], { nowIso });
  const totals = deriveOrderItemTotals(items, { nowIso });
  const productSummary = items.length ? buildOrderItemsSummary(items, { nowIso }) : toNullableText(order?.['产品名称']);
  const topLevelWeight = toNullableText(order?.['重量']);
  const topLevelSize = toNullableText(order?.['尺寸']);
  const topLevelPurchase = toNullableDecimal(order?.['采购价格']);
  const topLevelSale = toNullableDecimal(order?.['售价']);
  return {
    id: String(order?.id || '').trim(),
    ...(seq !== null ? { seq } : {}),
    createdAt,
    updatedAt,
    deletedAt: null,
    accountName: toNullableText(order?.['账号']),
    orderedAt: toNullableText(order?.['下单时间']),
    purchaseDate: toNullableText(order?.['采购日期']),
    latestWarehouseAt: toNullableText(order?.['最晚到仓时间']),
    warningText: toNullableText(order?.['订单预警']),
    orderNo: toNullableText(order?.['订单号']),
    productName: productSummary,
    quantity: items.length ? totals.quantity : toNullableInteger(order?.['数量']),
    isRefunded: toBoolean(order?.['是否退款']),
    creatorCommissionRate: toNullableDecimal(order?.['达人佣金率']),
    creatorCommission: toNullableDecimal(order?.['达人佣金']),
    purchasePrice: topLevelPurchase ?? (items.length ? Number(totals.purchase.toFixed(2)) : null),
    salePrice: topLevelSale ?? (items.length ? Number(totals.sale.toFixed(2)) : null),
    estimatedShippingFee: toNullableDecimal(order?.['预估运费']),
    estimatedProfit: toNullableDecimal(order?.['预估利润']),
    weightText: topLevelWeight || (items.length && totals.weight ? Number(totals.weight.toFixed(2)).toString() : null),
    sizeText: topLevelSize || (items.length === 1 ? toNullableText(items[0]?.unitSizeText || '') : null),
    orderStatus: toNullableText(order?.['订单状态']),
    items: items.length ? items.map(item => {
      const row: OrderItemDoc = {
        lineId: item.lineId,
        quantity: toNullableInteger(item.quantity)
      };
      const productTkId = toNullableText(item.productTkId);
      const productSkuId = toNullableText(item.productSkuId);
      const productSkuName = toNullableText(item.productSkuName);
      const productName = toNullableText(stripDuplicatedSkuSuffix(item.productName, item.productSkuName));
      const unitPurchasePrice = toNullableDecimal(item.unitPurchasePrice);
      const unitSalePrice = toNullableDecimal(item.unitSalePrice);
      const unitWeightG = toNullableDecimal(item.unitWeightG);
      const unitSizeText = toNullableText(item.unitSizeText);
      const courierCompany = toNullableText(item.courierCompany);
      const trackingNo = toNullableText(item.trackingNo);
      if (productTkId) row.productTkId = productTkId;
      if (productSkuId) row.productSkuId = productSkuId;
      if (productSkuName) row.productSkuName = productSkuName;
      if (productName) row.productName = productName;
      if (unitPurchasePrice !== null) row.unitPurchasePrice = unitPurchasePrice;
      if (unitSalePrice !== null) row.unitSalePrice = unitSalePrice;
      if (unitWeightG !== null) row.unitWeightG = unitWeightG;
      if (unitSizeText) row.unitSizeText = unitSizeText;
      if (courierCompany) row.courierCompany = courierCompany;
      if (trackingNo) row.trackingNo = trackingNo;
      return row;
    }) : null
  };
}

function sortOrdersForSeqAssignment(left: OrderRecord, right: OrderRecord, options?: { nowIso?: () => string }): number {
  const leftCreatedAt = Date.parse(getOrderCreatedAt(left, options) || '');
  const rightCreatedAt = Date.parse(getOrderCreatedAt(right, options) || '');
  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

  const leftUpdatedAt = Date.parse(String(left?.updatedAt || left?.updated_at || '').trim() || '');
  const rightUpdatedAt = Date.parse(String(right?.updatedAt || right?.updated_at || '').trim() || '');
  if (leftUpdatedAt !== rightUpdatedAt) return leftUpdatedAt - rightUpdatedAt;

  return String(left?.id || '').localeCompare(String(right?.id || ''));
}

function create({ state = {}, helpers = {}, window: rootWindow = globalThis.window }: OrderProviderCreateOptions = {}): OrderProviderApi {
  const nowIso = helpers.nowIso || (() => new Date().toISOString());
  const normalizeOrderList = helpers.normalizeOrderList || (list => (Array.isArray(list) ? list : []));
  const uniqueAccounts = helpers.uniqueAccounts || (list => (
    Array.isArray(list) ? [...new Set(list.map(item => String(item || '').trim()).filter(Boolean))] : []
  ));
  let app: FirebaseCompatApp | null = null;
  let db: FirebaseCompatFirestore | null = null;

  function orderRef(currentDb: FirebaseCompatFirestore, id: unknown): FirebaseCompatDocRef {
    return currentDb.collection('orders').doc(String(id || '').trim());
  }

  function accountDocId(name: unknown = ''): string {
    const raw = String(name || '').trim();
    return raw ? encodeURIComponent(raw) : '__unassigned__';
  }

  function accountRef(currentDb: FirebaseCompatFirestore, name: unknown): FirebaseCompatDocRef {
    return currentDb.collection('order_accounts').doc(accountDocId(name));
  }

  function syncStateRef(currentDb: FirebaseCompatFirestore): FirebaseCompatDocRef {
    return currentDb.collection('sync_state').doc('app');
  }

  async function requireDb(): Promise<FirebaseCompatFirestore> {
    if (!db) throw new Error('Firestore 尚未初始化');
    return db;
  }

  async function getQuerySnapshot(query: FirebaseCompatCollectionRef): Promise<FirebaseCompatQuerySnapshot> {
    if (!query || typeof query.get !== 'function') throw new Error('Firestore 查询不可用');
    try {
      return await query.get({ source: 'server' });
    } catch (error) {
      return query.get();
    }
  }

  async function getDocSnapshot(docRef: FirebaseCompatDocRef): Promise<FirebaseCompatDocSnapshot> {
    if (!docRef || typeof docRef.get !== 'function') throw new Error('Firestore 文档不可用');
    try {
      return await docRef.get({ source: 'server' });
    } catch (error) {
      return docRef.get();
    }
  }

  async function fetchOrderDocs(currentDb: FirebaseCompatFirestore): Promise<OrderRecord[]> {
    const snapshot = await getQuerySnapshot(currentDb.collection('orders'));
    return snapshot.docs.map(doc => normalizePulledOrder(doc.data() || {}, { nowIso }));
  }

  async function fetchMaxSeq(currentDb: FirebaseCompatFirestore): Promise<number> {
    const orders = await fetchOrderDocs(currentDb);
    return orders.reduce((max, order) => Math.max(max, parseSeq(order?.seq) || 0), 0);
  }

  async function assignOrderSeqs(currentDb: FirebaseCompatFirestore, orders: OrderRecord[] = []): Promise<OrderRecord[]> {
    const normalized = normalizeOrderList(orders).map(order => ({ ...order }));
    if (!normalized.length) return normalized;

    const remoteMaxSeq = await fetchMaxSeq(currentDb);
    let nextSeq = Math.max(
      remoteMaxSeq,
      ...normalized.map(order => parseSeq(order?.seq) || 0)
    );

    normalized
      .filter(order => parseSeq(order?.seq) === null)
      .sort((left, right) => sortOrdersForSeqAssignment(left, right, { nowIso }))
      .forEach(order => {
        nextSeq += 1;
        order.seq = nextSeq;
      });

    return normalized;
  }

  function commitMutations(
    currentDb: FirebaseCompatFirestore,
    mutations: Array<(batch: FirebaseCompatWriteBatch) => void>,
    { waitForCommit = true }: { waitForCommit?: boolean } = {}
  ): Promise<unknown[]> {
    if (!mutations.length) return Promise.resolve([]);
    const chunkSize = 400;
    const commits: Promise<unknown>[] = [];
    for (let index = 0; index < mutations.length; index += chunkSize) {
      const batch = currentDb.batch();
      mutations.slice(index, index + chunkSize).forEach(apply => apply(batch));
      const commitPromise = batch.commit();
      commits.push(commitPromise);
    }
    const allCommits = Promise.all(commits);
    if (!waitForCommit) allCommits.catch(error => console.error('Firestore local queue write failed', error));
    return allCommits;
  }

  async function init(config: unknown): Promise<SerializedOrderProviderConfig> {
    const next = hydrateConfig(config);
    if (!next.config || !next.projectId) throw new Error('请粘贴完整的 firebaseConfig');
    if (!rootWindow?.firebase?.initializeApp) throw new Error('Firebase 浏览器客户端未加载');

    const appName = `tk-orders-${next.projectId}`;
    app = rootWindow.firebase.apps.find(item => item.name === appName) || rootWindow.firebase.initializeApp(next.config, appName);
    db = app.firestore();
    if (!app.__tkOrdersFirestoreConfigured) {
      if (typeof db.settings === 'function') {
        try {
          db.settings({ ignoreUndefinedProperties: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error || '');
          if (!/settings can no longer be changed|already been started/i.test(message)) throw error;
        }
      }

      if (typeof db.enablePersistence === 'function') {
        try {
          await db.enablePersistence({ synchronizeTabs: true });
        } catch (error) {}
      }

      app.__tkOrdersFirestoreConfigured = true;
    }

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

  async function pullSnapshot({ cursor = '' }: { cursor?: string } = {}): Promise<OrderProviderSnapshot> {
    const currentDb = await requireDb();
    const [ordersSnap, accountsSnap, syncStateSnap] = await Promise.all([
      getQuerySnapshot(currentDb.collection('orders')),
      getQuerySnapshot(currentDb.collection('order_accounts')),
      getDocSnapshot(syncStateRef(currentDb))
    ]);

    const allOrderRecords = ordersSnap.docs.map(doc => normalizePulledOrder(doc.data() || {}, { nowIso }));
    const activeOrders = normalizeOrderList(
      allOrderRecords
        .filter(order => !order.deletedAt)
        .sort((left, right) => (parseSeq(left.seq) || Number.MAX_SAFE_INTEGER) - (parseSeq(right.seq) || Number.MAX_SAFE_INTEGER))
    );
    const changedOrders = normalizeOrderList(
      allOrderRecords.filter(order => {
        const updatedAt = order.deletedAt || order.updatedAt || '';
        return !cursor || updatedAt > cursor;
      })
    );

    const accountRows = accountsSnap.docs.map(doc => {
      const data = doc.data() || {};
      return {
        name: String(data?.name || '').trim(),
        updatedAt: toIsoString(data?.updatedAt || ''),
        deletedAt: toIsoString(data?.deletedAt || '')
      };
    });
    const changedAccounts = accountRows.filter(account => {
      const updatedAt = account.deletedAt || account.updatedAt || '';
      return !cursor || updatedAt > cursor;
    });
    const activeAccounts = uniqueAccounts(accountRows.filter(row => !row.deletedAt).map(row => row.name));
    const accountUpdatedAt = latestIso(accountRows.filter(row => !row.deletedAt).map(row => row.updatedAt));

    const syncMeta = syncStateSnap.exists ? (syncStateSnap.data() || {}) : {};
    const remoteCursor = latestIso([
      cursor,
      toIsoString(syncMeta.updatedAt || ''),
      ...allOrderRecords.map(order => order.deletedAt || order.updatedAt || ''),
      ...accountRows.map(account => account.deletedAt || account.updatedAt || '')
    ]);

    return {
      orders: activeOrders,
      accounts: activeAccounts,
      changedOrders,
      changedAccounts,
      updatedAt: remoteCursor,
      accountsUpdatedAt: accountUpdatedAt,
      remoteCursor
    };
  }

  async function pushChanges({
    upserts = [],
    deletions = [],
    accountUpserts = [],
    accountDeletions = [],
    clientId = '',
    assignSeq = true,
    waitForCommit = true
  }: OrderProviderPushChangesOptions = {}): Promise<OrderProviderPushResult> {
    const currentDb = await requireDb();
    const updatedAt = nowIso();
    const assignedOrders = assignSeq ? await assignOrderSeqs(currentDb, upserts) : normalizeOrderList(upserts);
    const mutations: Array<(batch: FirebaseCompatWriteBatch) => void> = [];

    assignedOrders.forEach(order => {
      const row = buildOrderDoc({
        ...order,
        updatedAt
      }, { nowIso });
      mutations.push(batch => batch.set(orderRef(currentDb, row.id), row));
    });

    deletions.forEach(item => {
      const deletedAt = toIsoString(item?.deletedAt || updatedAt, updatedAt) || updatedAt;
      const id = String(item?.id || '').trim();
      if (!id) return;
      mutations.push(batch => batch.set(orderRef(currentDb, id), {
        id,
        accountName: toNullableText(item?.accountName || ''),
        updatedAt: deletedAt,
        deletedAt
      }, { merge: true }));
    });

    accountUpserts.forEach(name => {
      const normalized = String(name || '').trim();
      if (!normalized) return;
      mutations.push(batch => batch.set(accountRef(currentDb, normalized), {
        id: accountDocId(normalized),
        name: normalized,
        updatedAt,
        deletedAt: null,
        createdAt: updatedAt
      }, { merge: true }));
    });

    accountDeletions.forEach(name => {
      const normalized = String(name || '').trim();
      if (!normalized) return;
      mutations.push(batch => batch.set(accountRef(currentDb, normalized), {
        id: accountDocId(normalized),
        name: normalized,
        updatedAt,
        deletedAt: updatedAt
      }, { merge: true }));
    });

    mutations.push(batch => batch.set(syncStateRef(currentDb), {
      scope: 'app',
      updatedAt,
      lastClientId: String(clientId || '').trim(),
      schemaVersion: 1
    }, { merge: true }));

    const commitPromise = commitMutations(currentDb, mutations, { waitForCommit });
    if (waitForCommit) await commitPromise;
    return {
      updatedAt,
      remoteCursor: updatedAt,
      assignedOrders,
      commitPromise
    };
  }

  return {
    key: 'firestore',
    label: 'Firebase Firestore',
    parseConfigInput,
    normalizeConfigText,
    serializeConfig,
    getCacheKey,
    getDisplayName,
    usesBuiltInLocalCache,
    init,
    isReady,
    isConnected,
    signOut,
    pullSnapshot,
    pushChanges
  };
}

const OrderTrackerProviderFirestore = {
  create
};

export {
  OrderTrackerProviderFirestore,
  buildCourierSummary,
  buildOrderDoc,
  buildOrderItemsSummary,
  create,
  deriveOrderItemTotals,
  getDisplayName,
  hydrateConfig,
  latestIso,
  normalizeConfigText,
  normalizeOrderItems,
  normalizePulledOrder,
  parseConfigInput,
  rawOrderNeedsCanonicalCleanup,
  sanitizeConfig,
  serializeConfig,
  stripDuplicatedSkuSuffix,
  toBoolean,
  toIsoString,
  toNullableDecimal,
  toNullableInteger,
  toNullableText,
  usesBuiltInLocalCache
};
