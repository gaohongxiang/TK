import type {
  ProductDefaultsDoc,
  ProductFirestoreConfig,
  ProductFirestoreDoc,
  ProductHydratedFirestoreConfig,
  ProductLogisticsDefaults,
  ProductProviderApi,
  ProductProviderAccountWriteOptions,
  ProductProviderCreateOptions,
  ProductProviderWriteOptions,
  ProductRecord,
  ProductSku,
  ProductSkuDoc
} from './types.ts';
import { deleteAccountLabel, renameAccountAcrossModules } from '../accounts/firestore-account-actions.ts';
import type { FirebaseCompatApp, FirebaseCompatFirestore } from '../types/firestore.ts';

type LooseRecord = Record<string, unknown>;

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

function sanitizeConfig(raw: unknown): ProductFirestoreConfig | null {
  const cfg = toPlainObject(raw);
  if (!cfg) return null;
  const next: Partial<ProductFirestoreConfig> = {};
  ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId', 'measurementId'].forEach(key => {
    const value = String(cfg[key] || '').trim();
    if (value) next[key as keyof ProductFirestoreConfig] = value;
  });
  if (!next.apiKey || !next.projectId || !next.appId) return null;
  if (!next.authDomain) next.authDomain = `${next.projectId}.firebaseapp.com`;
  return next as ProductFirestoreConfig;
}

function parseConfigInput(raw: unknown): ProductFirestoreConfig | null {
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

function hydrateConfig(raw: unknown = {}): ProductHydratedFirestoreConfig {
  const source = toPlainObject(raw) || {};
  const parsed = parseConfigInput(source?.configText || source?.firestoreConfigText || source?.firebaseConfig || raw);
  return {
    config: parsed,
    configText: parsed ? JSON.stringify(parsed, null, 2) : '',
    projectId: parsed?.projectId || String(source?.projectId || source?.firestoreProjectId || '').trim(),
    user: String(source?.user || '').trim()
  };
}

function getDisplayName(config: unknown = {}): string {
  const next = hydrateConfig(config);
  if (next.user) return `${next.user} · Firestore`;
  if (next.projectId) return `${next.projectId} · Firestore`;
  return 'Firebase Firestore';
}

function toNullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function toNullableDecimal(value: unknown): number | null {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function toNullableInteger(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
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

function toSortIndex(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePulledSku(raw: unknown): ProductSku {
  const data = toPlainObject(raw) || {};
  const hasOwnSpec = data?.weightG != null
    || data?.lengthCm != null
    || data?.widthCm != null
    || data?.heightCm != null
    || data?.estimatedShippingFee != null
    || data?.chargeWeightKg != null
    || !!String(data?.shippingNote || '').trim();
  return {
    skuId: String(data?.skuId || '').trim(),
    skuName: String(data?.skuName || ''),
    useProductDefaults: data?.useProductDefaults == null ? !hasOwnSpec : data.useProductDefaults !== false,
    weightG: data?.weightG == null ? '' : String(data.weightG),
    lengthCm: data?.lengthCm == null ? '' : String(data.lengthCm),
    widthCm: data?.widthCm == null ? '' : String(data.widthCm),
    heightCm: data?.heightCm == null ? '' : String(data.heightCm),
    estimatedShippingFee: data?.estimatedShippingFee == null ? '' : String(data.estimatedShippingFee),
    chargeWeightKg: data?.chargeWeightKg == null ? '' : String(data.chargeWeightKg),
    shippingNote: String(data?.shippingNote || '')
  };
}

function buildSkuDoc(sku: ProductSku): ProductSkuDoc {
  return {
    skuId: String(sku?.skuId || '').trim(),
    skuName: toNullableText(sku?.skuName),
    useProductDefaults: sku?.useProductDefaults !== false,
    weightG: toNullableInteger(sku?.weightG),
    lengthCm: toNullableDecimal(sku?.lengthCm),
    widthCm: toNullableDecimal(sku?.widthCm),
    heightCm: toNullableDecimal(sku?.heightCm),
    estimatedShippingFee: toNullableDecimal(sku?.estimatedShippingFee),
    chargeWeightKg: toNullableDecimal(sku?.chargeWeightKg),
    shippingNote: toNullableText(sku?.shippingNote)
  };
}

function normalizeProductDefaults(raw: unknown): ProductLogisticsDefaults {
  const data = toPlainObject(raw) || {};
  const defaults = toPlainObject(data?.defaults) || data || {};
  return {
    cargoType: String(defaults?.cargoType || 'general'),
    weightG: defaults?.weightG == null ? '' : String(defaults.weightG),
    lengthCm: defaults?.lengthCm == null ? '' : String(defaults.lengthCm),
    widthCm: defaults?.widthCm == null ? '' : String(defaults.widthCm),
    heightCm: defaults?.heightCm == null ? '' : String(defaults.heightCm),
    estimatedShippingFee: defaults?.estimatedShippingFee == null ? '' : String(defaults.estimatedShippingFee),
    chargeWeightKg: defaults?.chargeWeightKg == null ? '' : String(defaults.chargeWeightKg),
    shippingNote: String(defaults?.shippingNote || '')
  };
}

function buildProductDefaultsDoc(defaults: ProductLogisticsDefaults): ProductDefaultsDoc {
  return {
    cargoType: toNullableText(defaults?.cargoType) || 'general',
    weightG: toNullableInteger(defaults?.weightG),
    lengthCm: toNullableDecimal(defaults?.lengthCm),
    widthCm: toNullableDecimal(defaults?.widthCm),
    heightCm: toNullableDecimal(defaults?.heightCm),
    estimatedShippingFee: toNullableDecimal(defaults?.estimatedShippingFee),
    chargeWeightKg: toNullableDecimal(defaults?.chargeWeightKg),
    shippingNote: toNullableText(defaults?.shippingNote)
  };
}

function normalizePulledProduct(raw: unknown): ProductRecord {
  const data = toPlainObject(raw) || {};
  const defaults = normalizeProductDefaults(data);
  return {
    tkId: String(data?.tkId || '').trim(),
    accountName: String(data?.accountName || ''),
    name: String(data?.name || ''),
    note: String(data?.note || ''),
    imageUrl: String(data?.imageUrl || ''),
    link1688: String(data?.link1688 || ''),
    defaults,
    skus: Array.isArray(data?.skus) ? data.skus.map(normalizePulledSku).filter(sku => sku.skuId) : [],
    createdAt: toIsoString(data?.createdAt || ''),
    updatedAt: toIsoString(data?.updatedAt || '')
  };
}

function buildProductDoc(product: ProductRecord, { nowIso = () => new Date().toISOString() }: { nowIso?: () => string } = {}): ProductFirestoreDoc {
  const createdAt = toIsoString(product?.createdAt || '', nowIso()) || nowIso();
  const updatedAt = toIsoString(product?.updatedAt || '', createdAt) || nowIso();
  const defaults = buildProductDefaultsDoc(product?.defaults || product);
  return {
    tkId: String(product?.tkId || '').trim(),
    accountName: toNullableText(product?.accountName),
    name: toNullableText(product?.name),
    note: toNullableText(product?.note),
    imageUrl: toNullableText(product?.imageUrl),
    link1688: toNullableText(product?.link1688),
    defaults,
    skus: Array.isArray(product?.skus) ? product.skus.map(buildSkuDoc).filter(sku => sku.skuId) : [],
    createdAt,
    updatedAt
  };
}

function create({ state = {}, helpers = {}, window: rootWindow = globalThis.window }: ProductProviderCreateOptions = {}): ProductProviderApi {
  const nowIso = helpers.nowIso || (() => new Date().toISOString());
  let app: FirebaseCompatApp | null = null;
  let db: FirebaseCompatFirestore | null = null;

  async function requireDb(): Promise<FirebaseCompatFirestore> {
    if (!db) throw new Error('Firestore 尚未初始化');
    return db;
  }

  function accountDocId(name: unknown = ''): string {
    const raw = String(name || '').trim();
    return raw ? encodeURIComponent(raw) : '__unassigned__';
  }

  async function init(rawConfig: unknown = state): Promise<ProductHydratedFirestoreConfig> {
    const next = hydrateConfig(rawConfig);
    if (!next.config) throw new Error('请先填写有效的 firebaseConfig');

    const firebaseNs = rootWindow?.firebase || null;
    if (!firebaseNs?.initializeApp) throw new Error('Firebase SDK 尚未加载');

    const appName = `tk-products-${next.projectId}`;
    app = (firebaseNs.apps || []).find(item => item.name === appName) || firebaseNs.initializeApp(next.config, appName);
    db = app.firestore();
    if (!app.__tkProductsFirestoreConfigured) {
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
      app.__tkProductsFirestoreConfigured = true;
    }
    state.firestoreConfigText = next.configText;
    state.firestoreProjectId = next.projectId;
    state.user = next.user;
    return next;
  }

  async function pullProducts() {
    const currentDb = await requireDb();
    const [snapshot, accountsSnapshot] = await Promise.all([
      currentDb.collection('products').orderBy('updatedAt', 'desc').get(),
      currentDb.collection('order_accounts').get()
    ]);
    const accounts = accountsSnapshot.docs
      .map((doc, index) => ({ data: doc.data() || {}, fallbackIndex: index }))
      .filter(row => !row.data.deletedAt)
      .map(row => ({
        name: String(row.data.name || '').trim(),
        sortIndex: toSortIndex(row.data.sortIndex, row.fallbackIndex)
      }))
      .filter(row => row.name)
      .sort((left, right) => left.sortIndex - right.sortIndex || left.name.localeCompare(right.name))
      .map(row => row.name)
      .filter(Boolean);
    const lastRemoteUpdatedAt = snapshot.docs
      .map(doc => String(doc.data()?.updatedAt || ''))
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || '';
    return {
      products: snapshot.docs.map(doc => normalizePulledProduct(doc.data())),
      accounts,
      lastRemoteUpdatedAt
    };
  }

  function trackWritePromise(promise: Promise<unknown>, label: string, { waitForCommit = true }: ProductProviderWriteOptions = {}): Promise<unknown> {
    const commitPromise = Promise.resolve(promise);
    if (!waitForCommit) commitPromise.catch(error => console.error(label, error));
    return commitPromise;
  }

  async function upsertProduct(product: ProductRecord, { waitForCommit = true }: ProductProviderWriteOptions = {}) {
    const currentDb = await requireDb();
    const doc = buildProductDoc(product, { nowIso });
    if (!doc.tkId) throw new Error('商品 TK ID 不能为空');
    const commitPromise = trackWritePromise(
      currentDb.collection('products').doc(doc.tkId).set(doc, { merge: true }),
      'Firestore product local queue write failed',
      { waitForCommit }
    );
    if (waitForCommit) await commitPromise;
    const saved = normalizePulledProduct(doc);
    return waitForCommit ? saved : { product: saved, commitPromise };
  }

  async function deleteProduct(tkId: string, { waitForCommit = true }: ProductProviderWriteOptions = {}) {
    const currentDb = await requireDb();
    const id = String(tkId || '').trim();
    if (!id) throw new Error('商品 TK ID 不能为空');
    const commitPromise = trackWritePromise(
      currentDb.collection('products').doc(id).delete(),
      'Firestore product delete local queue write failed',
      { waitForCommit }
    );
    if (waitForCommit) await commitPromise;
    return waitForCommit ? true : { deleted: true, commitPromise };
  }

  async function upsertAccount(name: string, { sortIndex, waitForCommit = true }: ProductProviderAccountWriteOptions = {}) {
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
      'Firestore account local queue write failed',
      { waitForCommit }
    );
    if (waitForCommit) await commitPromise;
    return waitForCommit ? normalized : { account: normalized, commitPromise };
  }

  async function saveAccountOrder(names: string[] = [], { waitForCommit = true }: ProductProviderWriteOptions = {}) {
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
    const commitPromise = trackWritePromise(
      batch.commit(),
      'Firestore account order local queue write failed',
      { waitForCommit }
    );
    if (waitForCommit) await commitPromise;
    return waitForCommit ? normalizedNames.length : { count: normalizedNames.length, commitPromise };
  }

  async function renameAccount(oldName: string, newName: string, options: ProductProviderWriteOptions & { accountOrder?: string[] } = {}) {
    const currentDb = await requireDb();
    return renameAccountAcrossModules(currentDb, oldName, newName, nowIso, options);
  }

  async function deleteAccount(name: string, options: ProductProviderWriteOptions & { accountOrder?: string[] } = {}) {
    const currentDb = await requireDb();
    return deleteAccountLabel(currentDb, name, nowIso, options);
  }

  return {
    key: 'firestore',
    parseConfigInput,
    hydrateConfig,
    getDisplayName: (config = state) => getDisplayName(config),
    init,
    pullProducts,
    upsertProduct,
    deleteProduct,
    upsertAccount,
    saveAccountOrder,
    renameAccount,
    deleteAccount
  };
}

const ProductLibraryProviderFirestore = {
  create
};

const ProductLibraryProviderFirestoreUtils = {
  buildProductDefaultsDoc,
  buildProductDoc,
  buildSkuDoc,
  getDisplayName,
  hydrateConfig,
  normalizeProductDefaults,
  normalizePulledProduct,
  normalizePulledSku,
  parseConfigInput,
  sanitizeConfig,
  toIsoString,
  toNullableDecimal,
  toNullableInteger,
  toNullableText
};

export {
  ProductLibraryProviderFirestore,
  ProductLibraryProviderFirestoreUtils,
  create,
  parseConfigInput,
  normalizePulledProduct,
  buildProductDefaultsDoc,
  buildProductDoc,
  buildSkuDoc,
  getDisplayName,
  hydrateConfig,
  normalizeProductDefaults,
  normalizePulledSku,
  sanitizeConfig,
  toIsoString,
  toNullableDecimal,
  toNullableInteger,
  toNullableText
};
