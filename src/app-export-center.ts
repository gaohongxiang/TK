import JSZip from 'jszip';
import { initSharedFirebaseApp } from './firebase-app.ts';
import { TKFirestoreConnection } from './firestore-connection.ts';
import { getExportAccountOptions, buildExportRows, buildExportFilename, buildOrdersCsv, toAccountSlot as orderToAccountSlot } from './orders/export.ts';
import { computeOrderCreatorCommission, computeOrderEstimatedProfit, computeOrderPlatformFee } from './orders/shared.ts';
import { normalizePulledOrder } from './orders/provider-firestore.ts';
import { ProductLibraryExport, buildProductCsv } from './products/export.ts';
import { normalizePulledProduct } from './products/provider-firestore.ts';
import { normalizeAccountName, toAccountSlot, uniqueAccounts } from './products/accounts.ts';
import { normalizePulledFinanceRecord } from './finance/provider-firestore.ts';
import { PUBLIC_ACCOUNT_KEY, PUBLIC_ACCOUNT_LABEL } from './finance/summary.ts';
import { buildFinanceCsv, buildFinanceExportFilename, buildFinanceExportRows } from './finance/export.ts';
import { datasetsFromDocs } from './collection/provider-firestore.ts';
import { buildCollectionExportFile } from './collection/export.ts';
import { AnalyticsProviderFirestore } from './analytics/provider-firestore.ts';
import { aggregateAnalyticsSnapshots, buildAnalyticsExportCsv, buildAnalyticsExportFilename } from './analytics/export.ts';
import type { FirebaseCompatFirestore } from './types/firestore.ts';
import type { OrderRecord } from './orders/types.ts';
import type { ProductRecord } from './products/types.ts';
import type { FinanceRecord } from './finance/types.ts';
import type { CollectionRecordDoc, CollectionExcludedProductDoc } from './collection/provider-firestore.ts';
import type { AnalyticsProviderSnapshotSummary } from './analytics/provider-firestore.ts';
type ModulePermissionKey = 'products' | 'orders' | 'finance' | 'collection' | 'analytics';

type ExportModuleKey = 'orders' | 'products' | 'finance' | 'collection' | 'analytics';

type ExportOption = {
  key: string;
  label: string;
  count: number;
};

type ExportCenterSnapshot = {
  accounts: string[];
  orders: OrderRecord[];
  products: ProductRecord[];
  financeRecords: FinanceRecord[];
  collectionRecords: CollectionRecordDoc[];
  collectionRejects: CollectionExcludedProductDoc[];
  analyticsSnapshots: AnalyticsProviderSnapshotSummary[];
};

type ExportFile = {
  filename: string;
  csv: string;
  count: number;
};

type ExportCenterBuildInput = {
  selectedAccounts: Iterable<string>;
  selectedModules: Iterable<ExportModuleKey>;
  snapshot?: ExportCenterSnapshot | null;
  pricingContext?: unknown;
};

type LoadExportCenterSnapshotOptions = {
  modules?: Iterable<ExportModuleKey>;
};

type ExportCenterBuildResult = {
  files: ExportFile[];
  skipped: Array<{ module: ExportModuleKey; label: string; reason: string }>;
};

const ALL_ACCOUNT_KEY = '__all__';
const MODULE_OPTIONS: Array<{ key: ExportModuleKey; label: string; permission: ModulePermissionKey }> = [
  { key: 'orders', label: '订单', permission: 'orders' },
  { key: 'products', label: '商品', permission: 'products' },
  { key: 'finance', label: '收支', permission: 'finance' },
  { key: 'collection', label: '商品采编', permission: 'collection' },
  { key: 'analytics', label: '数据分析', permission: 'analytics' }
];

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeFilenamePart(value: unknown, fallback = '未命名') {
  return String(value || fallback).trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '') || fallback;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeSelectedAccounts(selectedAccounts: Iterable<string>) {
  return new Set([...selectedAccounts].map(value => String(value || '').trim()).filter(Boolean));
}

function normalizeSelectedModules(selectedModules: Iterable<ExportModuleKey>) {
  const allowed = new Set(MODULE_OPTIONS.map(module => module.key));
  return new Set([...selectedModules].filter(moduleKey => allowed.has(moduleKey)));
}

function getSelectedConcreteAccounts(selectedAccounts: Set<string>, allAccounts: string[]) {
  if (selectedAccounts.has(ALL_ACCOUNT_KEY)) return new Set(allAccounts);
  return new Set([...selectedAccounts].filter(key => key !== ALL_ACCOUNT_KEY));
}

function getExportAccountOptionsFromSnapshot(snapshot: ExportCenterSnapshot | null | undefined): ExportOption[] {
  const accounts = uniqueAccounts([
    ...(snapshot?.accounts || []),
    ...(snapshot?.orders || []).map(order => order?.['账号']),
    ...(snapshot?.products || []).map(product => product?.accountName),
    ...(snapshot?.financeRecords || []).map(record => record?.accountName),
    ...(snapshot?.collectionRecords || []).map(record => record?.accountName),
    ...(snapshot?.analyticsSnapshots || []).map(item => item?.accountName)
  ]);
  return [
    { key: ALL_ACCOUNT_KEY, label: '全部店铺', count: accounts.length },
    ...accounts.map(account => ({ key: account, label: account, count: countAccountRows(snapshot, account) }))
  ];
}

function countAccountRows(snapshot: ExportCenterSnapshot | null | undefined, account: string) {
  const normalized = normalizeAccountName(account);
  return (snapshot?.orders || []).filter(order => normalizeAccountName(order?.['账号']) === normalized).length
    + (snapshot?.products || []).filter(product => normalizeAccountName(product?.accountName) === normalized).length
    + (snapshot?.financeRecords || []).filter(record => normalizeAccountName(record?.accountName) === normalized).length
    + (snapshot?.collectionRecords || []).filter(record => normalizeAccountName(record?.accountName) === normalized).length
    + (snapshot?.analyticsSnapshots || []).filter(item => normalizeAccountName(item?.accountName) === normalized).length;
}

function getModuleOptionsForPermissions(canAccess: (moduleKey: ModulePermissionKey) => boolean): ExportOption[] {
  return MODULE_OPTIONS
    .filter(module => canAccess(module.permission))
    .map(module => ({ key: module.key, label: module.label, count: 0 }));
}

async function getDbFromGlobalConfig(): Promise<FirebaseCompatFirestore> {
  const config = TKFirestoreConnection.getConfig();
  if (!config?.configText) throw new Error('请先连接 Firebase 项目');
  return initSharedFirebaseApp(config.configText, globalThis.window, '__tkRulesCheckFirestoreConfigured').db;
}

async function getCollectionDocs<T extends Record<string, unknown> = Record<string, unknown>>(db: FirebaseCompatFirestore, collectionName: string, orderBy = '') {
  const ref = db.collection(collectionName);
  const query = orderBy ? ref.orderBy(orderBy, 'desc') : ref;
  const snapshot = await query.get();
  return snapshot.docs.map(doc => {
    const data = doc.data() || {};
    return { ...data, id: String(data.id || doc.id || '') };
  }) as unknown as T[];
}

async function loadExportCenterSnapshot({ modules }: LoadExportCenterSnapshotOptions = {}): Promise<ExportCenterSnapshot> {
  const db = await getDbFromGlobalConfig();
  const moduleSet = modules ? normalizeSelectedModules(modules) : new Set(MODULE_OPTIONS.map(module => module.key));
  const shouldLoad = (moduleKey: ExportModuleKey) => moduleSet.has(moduleKey);
  const [
    accountDocs,
    orderDocs,
    productDocs,
    financeDocs,
    collectionDocs,
    collectionRejectDocs,
    analyticsSnapshotDocs
  ] = await Promise.all([
    getCollectionDocs(db, 'order_accounts'),
    shouldLoad('orders') ? getCollectionDocs(db, 'orders') : Promise.resolve([]),
    shouldLoad('products') ? getCollectionDocs(db, 'products') : Promise.resolve([]),
    shouldLoad('finance') ? getCollectionDocs(db, 'finance_records', 'occurredAt') : Promise.resolve([]),
    shouldLoad('collection') ? getCollectionDocs<CollectionRecordDoc>(db, 'collection_records') : Promise.resolve([]),
    shouldLoad('collection') ? getCollectionDocs<CollectionExcludedProductDoc>(db, 'collection_excluded_products') : Promise.resolve([]),
    shouldLoad('analytics') ? getCollectionDocs(db, 'analytics_snapshots', 'updatedAt') : Promise.resolve([])
  ]);
  const accounts = uniqueAccounts(accountDocs
    .filter(row => !row.deletedAt)
    .sort((left, right) => Number(left.sortIndex || 0) - Number(right.sortIndex || 0))
    .map(row => row.name));
  return {
    accounts,
    orders: orderDocs.map(doc => normalizePulledOrder(doc)).filter(order => !order.deletedAt),
    products: productDocs.map(doc => normalizePulledProduct(doc)),
    financeRecords: financeDocs.map(doc => normalizePulledFinanceRecord(doc)).filter(record => !record.deletedAt),
    collectionRecords: collectionDocs,
    collectionRejects: collectionRejectDocs,
    analyticsSnapshots: analyticsSnapshotDocs
      .map(doc => ({
        snapshotId: String(doc.id || doc.snapshotId || '').trim(),
        accountName: String(doc.accountName || '').trim(),
        period: String(doc.period || '').trim(),
        filename: String(doc.filename || '').trim(),
        recordCount: Number(doc.recordCount || 0) || 0,
        activeCount: Number(doc.activeCount || 0) || 0,
        updatedAt: String(doc.updatedAt || '').trim()
      }))
      .filter(snapshot => snapshot.snapshotId)
  };
}

function buildOrdersFile(snapshot: ExportCenterSnapshot, selectedAccounts: Set<string>, pricingContext: unknown): ExportFile | null {
  const selectedOrderKeys = new Set([...selectedAccounts].map(account => orderToAccountSlot(account)));
  const orders = snapshot.orders.filter(order => selectedOrderKeys.has(orderToAccountSlot(order?.['账号'])));
  if (!orders.length) return null;
  const rows = buildExportRows({
    orders,
    exchangeRate: pricingContext,
    computeOrderPlatformFeeFn: computeOrderPlatformFee,
    computeOrderCreatorCommissionFn: computeOrderCreatorCommission,
    computeOrderEstimatedProfitFn: computeOrderEstimatedProfit
  });
  const options = getExportAccountOptions({ accounts: snapshot.accounts, orders })
    .filter(option => selectedOrderKeys.has(String(option.key)));
  return {
    filename: buildExportFilename(options),
    csv: buildOrdersCsv({ rows, includeBom: true }),
    count: rows.length
  };
}

function buildProductsFile(snapshot: ExportCenterSnapshot, selectedAccounts: Set<string>): ExportFile | null {
  const selectedProductKeys = new Set([...selectedAccounts].map(account => toAccountSlot(account)));
  const exporter = ProductLibraryExport.create({
    state: { accounts: snapshot.accounts },
    helpers: {
      getDisplayedProducts: () => snapshot.products,
      normalizeAccountName,
      uniqueAccounts,
      toAccountSlot
    }
  });
  const rows = exporter.buildProductExportRows(selectedProductKeys);
  if (!rows.length) return null;
  const selectedOptions = exporter.getProductExportAccountOptions()
    .filter(option => selectedProductKeys.has(String(option.key)));
  return {
    filename: exporter.buildProductExportFilename(selectedOptions),
    csv: buildProductCsv(rows, { includeBom: true }),
    count: rows.length
  };
}

function buildFinanceFile(snapshot: ExportCenterSnapshot, selectedAccounts: Set<string>): ExportFile | null {
  const allStoreAccounts = new Set(uniqueAccounts(snapshot.accounts));
  const includesAllStores = allStoreAccounts.size > 0 && [...allStoreAccounts].every(account => selectedAccounts.has(account));
  const includePublic = includesAllStores || selectedAccounts.has(PUBLIC_ACCOUNT_KEY);
  const rows = buildFinanceExportRows(snapshot.financeRecords, { activeAccount: '__all__' })
    .filter(row => selectedAccounts.has(String(row[2] || '').trim()) || (includePublic && row[2] === PUBLIC_ACCOUNT_LABEL));
  if (!rows.length) return null;
  return {
    filename: buildFinanceExportFilename(selectedAccounts.size === 1 ? [...selectedAccounts][0] : '__all__'),
    csv: buildFinanceCsv(rows, { includeBom: true }),
    count: rows.length
  };
}

function buildCollectionFile(snapshot: ExportCenterSnapshot, selectedAccounts: Set<string>): ExportFile | null {
  const datasets = datasetsFromDocs(snapshot.collectionRecords, snapshot.collectionRejects);
  return buildCollectionExportFile(datasets.records, selectedAccounts);
}

async function buildAnalyticsFiles(snapshot: ExportCenterSnapshot, selectedAccounts: Set<string>): Promise<ExportFile[]> {
  const config = TKFirestoreConnection.getConfig();
  if (!config?.configText) return [];
  const provider = AnalyticsProviderFirestore.create();
  await provider.init({ firestoreConfigText: config.configText });
  const files: ExportFile[] = [];
  for (const account of selectedAccounts) {
    const accountSlot = toAccountSlot(account);
    const summaries = snapshot.analyticsSnapshots.filter(item => toAccountSlot(item.accountName) === accountSlot);
    if (!summaries.length) continue;
    const pulled = await provider.pullAnalysesBySnapshots(summaries.map(item => item.snapshotId));
    if (!pulled.length) continue;
    const analysis = pulled.length === 1
      ? pulled[0].analysis
      : aggregateAnalyticsSnapshots(pulled.map(item => ({
        analysis: item.analysis,
        snapshotId: item.snapshotId,
        period: item.analysis.period || item.filename,
        updatedAt: item.updatedAt
      })));
    files.push({
      filename: buildAnalyticsExportFilename(analysis, account),
      csv: buildAnalyticsExportCsv(analysis, { includeBom: true }),
      count: analysis.records.length
    });
  }
  return files;
}

async function buildExportFiles({
  selectedAccounts,
  selectedModules,
  snapshot,
  pricingContext = null
}: ExportCenterBuildInput): Promise<ExportCenterBuildResult> {
  const accountSet = normalizeSelectedAccounts(selectedAccounts);
  const moduleSet = normalizeSelectedModules(selectedModules);
  const source = snapshot || await loadExportCenterSnapshot({ modules: moduleSet });
  const concreteAccounts = getSelectedConcreteAccounts(accountSet, source.accounts);
  const files: ExportFile[] = [];
  const skipped: ExportCenterBuildResult['skipped'] = [];

  if (!concreteAccounts.size) throw new Error('请选择至少一个店铺');
  if (!moduleSet.size) throw new Error('请选择至少一个模块');

  function pushFile(moduleKey: ExportModuleKey, file: ExportFile | ExportFile[] | null) {
    const moduleLabel = MODULE_OPTIONS.find(item => item.key === moduleKey)?.label || moduleKey;
    const list = Array.isArray(file) ? file : file ? [file] : [];
    if (!list.length) skipped.push({ module: moduleKey, label: moduleLabel, reason: '当前范围没有可导出数据' });
    else files.push(...list.map(item => ({
      ...item,
      filename: `${moduleLabel}_${item.filename}`
    })));
  }

  if (moduleSet.has('orders')) pushFile('orders', buildOrdersFile(source, concreteAccounts, pricingContext));
  if (moduleSet.has('products')) pushFile('products', buildProductsFile(source, concreteAccounts));
  if (moduleSet.has('finance')) pushFile('finance', buildFinanceFile(source, concreteAccounts));
  if (moduleSet.has('collection')) pushFile('collection', buildCollectionFile(source, concreteAccounts));
  if (moduleSet.has('analytics')) pushFile('analytics', await buildAnalyticsFiles(source, concreteAccounts));

  return { files, skipped };
}

async function downloadExportFiles(files: ExportFile[], selectedAccounts: Iterable<string>, selectedModules: Iterable<string>) {
  if (!files.length) throw new Error('当前选择下没有可导出的数据');
  if (files.length === 1) {
    downloadBlob(files[0].filename, new Blob([files[0].csv], { type: 'text/csv;charset=utf-8;' }));
    return { kind: 'csv', filename: files[0].filename };
  }
  const zip = new JSZip();
  files.forEach(file => zip.file(file.filename, file.csv));
  const accountPart = [...selectedAccounts].includes(ALL_ACCOUNT_KEY) ? '全部店铺' : `${[...selectedAccounts][0] || '店铺'}等${[...selectedAccounts].length}个店铺`;
  const modulePart = [...selectedModules].length === MODULE_OPTIONS.length ? '全部模块' : `${[...selectedModules][0] || '模块'}等${[...selectedModules].length}个模块`;
  const filename = `TK数据导出_${sanitizeFilenamePart(accountPart)}_${sanitizeFilenamePart(modulePart)}_${nowDate()}.zip`;
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(filename, blob);
  return { kind: 'zip', filename };
}

const AppExportCenter = {
  ALL_ACCOUNT_KEY,
  MODULE_OPTIONS,
  buildExportFiles,
  downloadExportFiles,
  getExportAccountOptionsFromSnapshot,
  getModuleOptionsForPermissions,
  loadExportCenterSnapshot
};

export {
  ALL_ACCOUNT_KEY,
  MODULE_OPTIONS,
  AppExportCenter,
  buildExportFiles,
  downloadExportFiles,
  getExportAccountOptionsFromSnapshot,
  getModuleOptionsForPermissions,
  loadExportCenterSnapshot
};
export type {
  ExportCenterBuildInput,
  ExportCenterBuildResult,
  ExportCenterSnapshot,
  ExportFile,
  ExportModuleKey,
  ExportOption
};
