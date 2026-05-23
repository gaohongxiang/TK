import type {
  AnalyticsAnalysis,
  AnalyticsChannel,
  AnalyticsKpis,
  AnalyticsRecord
} from './types.ts';
import type {
  FirebaseCompatApp,
  FirebaseCompatFirestore,
  FirebaseCompatNamespace,
  FirebaseConfig,
  HydratedFirebaseConfig
} from '../types/firestore.ts';
import {
  accountDocId,
  deleteAccountLabel,
  renameAccountAcrossModules,
  uniqueAccounts
} from '../accounts/firestore-account-actions.ts';
import { initSharedFirebaseApp } from '../firebase-app.ts';

type LooseRecord = Record<string, unknown>;
type AnalyticsSnapshotDoc = {
  id: string;
  accountName: string;
  period: string;
  filename: string;
  recordCount: number;
  activeCount: number;
  kpis: AnalyticsKpis;
  channelTotals: AnalyticsChannel[];
  createdAt: string;
  updatedAt: string;
};
type AnalyticsRecordDoc = AnalyticsRecord & {
  snapshotId: string;
  updatedAt: string;
};
type AnalyticsProviderCreateOptions = {
  state?: LooseRecord;
  helpers?: {
    nowIso?: () => string;
  };
  window?: (Partial<Window> & { firebase?: FirebaseCompatNamespace }) | typeof globalThis;
};
type AnalyticsProviderSaveOptions = {
  accountName?: string;
  filename?: string;
};
type AnalyticsProviderWriteOptions = {
  waitForCommit?: boolean;
};
type AnalyticsProviderAccountWriteOptions = AnalyticsProviderWriteOptions & {
  sortIndex?: number;
};
type AnalyticsProviderSnapshot = {
  analysis: AnalyticsAnalysis;
  accountName: string;
  filename: string;
  snapshotId: string;
  updatedAt: string;
};
type AnalyticsProviderSnapshotSummary = {
  snapshotId: string;
  accountName: string;
  period: string;
  filename: string;
  recordCount: number;
  activeCount: number;
  updatedAt: string;
};

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

function sanitizeDocId(value: unknown) {
  const text = String(value || '').trim();
  return text.replace(/[/.#[\]\s]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

function buildSnapshotId(period: string, filename: string, updatedAt = '') {
  const periodPart = sanitizeDocId(period) || 'unknown-period';
  const filePart = sanitizeDocId(filename) || 'analytics';
  const timePart = sanitizeDocId(updatedAt) || Date.now().toString(36);
  return `${periodPart}_${filePart}_${timePart}_${stableHash(`${period}|${filename}|${timePart}`)}`;
}

function buildAnalyticsSnapshotDoc(analysis: AnalyticsAnalysis, { accountName = '', filename = '', nowIso = new Date().toISOString(), snapshotId = '' } = {}): AnalyticsSnapshotDoc {
  const id = snapshotId || buildSnapshotId(analysis.period, filename, nowIso);
  return {
    id,
    accountName: String(accountName || '').trim(),
    period: analysis.period || '',
    filename,
    recordCount: analysis.records.length,
    activeCount: analysis.activeCount,
    kpis: analysis.kpis,
    channelTotals: analysis.channelTotals,
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

function buildAnalyticsRecordDoc(snapshotId: string, record: AnalyticsRecord, updatedAt = new Date().toISOString()): AnalyticsRecordDoc {
  return {
    ...record,
    snapshotId,
    updatedAt
  };
}

function normalizeSnapshotDoc(doc: LooseRecord, fallbackId = ''): AnalyticsSnapshotDoc {
  return {
    id: String(doc.id || fallbackId || '').trim(),
    accountName: String(doc.accountName || '').trim(),
    period: String(doc.period || '').trim(),
    filename: String(doc.filename || '').trim(),
    recordCount: Number(doc.recordCount || 0) || 0,
    activeCount: Number(doc.activeCount || 0) || 0,
    kpis: (toPlainObject(doc.kpis) || {}) as AnalyticsKpis,
    channelTotals: Array.isArray(doc.channelTotals) ? doc.channelTotals as AnalyticsChannel[] : [],
    createdAt: String(doc.createdAt || '').trim(),
    updatedAt: String(doc.updatedAt || '').trim()
  };
}

function snapshotDocToSummary(doc: AnalyticsSnapshotDoc): AnalyticsProviderSnapshotSummary {
  return {
    snapshotId: doc.id,
    accountName: doc.accountName,
    period: doc.period,
    filename: doc.filename,
    recordCount: doc.recordCount,
    activeCount: doc.activeCount,
    updatedAt: doc.updatedAt
  };
}

function normalizeRecordDoc(doc: LooseRecord): AnalyticsRecord {
  return {
    id: String(doc.id || '').trim(),
    name: String(doc.name || '').trim(),
    status: String(doc.status || '').trim(),
    gmv: Number(doc.gmv || 0) || 0,
    units: Number(doc.units || 0) || 0,
    orders: Number(doc.orders || 0) || 0,
    exposureTotal: Number(doc.exposureTotal || 0) || 0,
    pageViewsTotal: Number(doc.pageViewsTotal || 0) || 0,
    customersTotal: Number(doc.customersTotal || 0) || 0,
    overallCtr: Number(doc.overallCtr || 0) || 0,
    overallConversion: Number(doc.overallConversion || 0) || 0,
    channels: (toPlainObject(doc.channels) || {}) as AnalyticsRecord['channels'],
    diagnosis: (toPlainObject(doc.diagnosis) || { tone: 'normal', label: '常规观察', action: '' }) as AnalyticsRecord['diagnosis']
  };
}

function create({ state = {}, helpers = {}, window: rootWindow = globalThis.window }: AnalyticsProviderCreateOptions = {}) {
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

    const shared = initSharedFirebaseApp(next.config, rootWindow, '__tkAnalyticsFirestoreConfigured');
    app = shared.app;
    db = shared.db;
    state.firestoreConfigText = next.configText;
    state.firestoreProjectId = next.projectId;
    state.user = next.user;
    return next;
  }

  async function pullAccounts(): Promise<string[]> {
    const currentDb = await requireDb();
    const snapshot = await currentDb.collection('order_accounts').get();
    return snapshot.docs
      .map((doc, index) => ({ data: doc.data() || {}, fallbackIndex: index }))
      .filter(row => !row.data.deletedAt)
      .map(row => ({
        name: String(row.data.name || '').trim(),
        sortIndex: Number.isFinite(Number(row.data.sortIndex)) ? Number(row.data.sortIndex) : row.fallbackIndex
      }))
      .filter(row => row.name)
      .sort((left, right) => left.sortIndex - right.sortIndex || left.name.localeCompare(right.name))
      .map(row => row.name);
  }

  function trackWritePromise(promise: Promise<unknown>, label: string, { waitForCommit = true }: AnalyticsProviderWriteOptions = {}): Promise<unknown> {
    const commitPromise = Promise.resolve(promise);
    if (!waitForCommit) commitPromise.catch(error => console.error(label, error));
    return commitPromise;
  }

  async function upsertAccount(name: string, { sortIndex, waitForCommit = true }: AnalyticsProviderAccountWriteOptions = {}) {
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
      'Firestore analytics account local queue write failed',
      { waitForCommit }
    );
    if (waitForCommit) await commitPromise;
    return waitForCommit ? normalized : { account: normalized, commitPromise };
  }

  async function saveAccountOrder(names: string[] = [], { waitForCommit = true }: AnalyticsProviderWriteOptions = {}) {
    const currentDb = await requireDb();
    const normalizedNames = uniqueAccounts(names);
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
    const commitPromise = trackWritePromise(batch.commit(), 'Firestore analytics account order local queue write failed', { waitForCommit });
    if (waitForCommit) await commitPromise;
    return waitForCommit ? normalizedNames.length : { count: normalizedNames.length, commitPromise };
  }

  async function renameAccount(oldName: string, newName: string, options: AnalyticsProviderWriteOptions & { accountOrder?: string[] } = {}) {
    const currentDb = await requireDb();
    return renameAccountAcrossModules(currentDb, oldName, newName, nowIso, options);
  }

  async function deleteAccount(name: string, options: AnalyticsProviderWriteOptions & { accountOrder?: string[] } = {}) {
    const currentDb = await requireDb();
    return deleteAccountLabel(currentDb, name, nowIso, options);
  }

  async function listSavedAnalyses(): Promise<AnalyticsProviderSnapshotSummary[]> {
    const currentDb = await requireDb();
    const snapshotsRef = currentDb.collection('analytics_snapshots').orderBy('updatedAt', 'desc');
    const snapshot = await snapshotsRef.get();
    return snapshot.docs
      .map(doc => snapshotDocToSummary(normalizeSnapshotDoc(doc.data(), doc.id)))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  async function pullAnalysisBySnapshot(snapshotId: string): Promise<AnalyticsProviderSnapshot | null> {
    const currentDb = await requireDb();
    const id = String(snapshotId || '').trim();
    if (!id) return null;
    const snapshotDocRef = currentDb.collection('analytics_snapshots').doc(id);
    const latest = await snapshotDocRef.get();
    if (!latest?.exists) return null;
    const snapshotDoc = normalizeSnapshotDoc(latest.data(), latest.id || id);
    const recordsSnapshot = await currentDb.collection('analytics_records').orderBy('gmv', 'desc').get();
    const records = recordsSnapshot.docs
      .map(doc => doc.data() as LooseRecord)
      .filter(doc => String(doc.snapshotId || '') === snapshotDoc.id)
      .map(normalizeRecordDoc)
      .sort((a, b) => b.gmv - a.gmv || b.exposureTotal - a.exposureTotal);
    return {
      analysis: {
        period: snapshotDoc.period,
        records,
        activeCount: snapshotDoc.activeCount,
        channelTotals: snapshotDoc.channelTotals,
        kpis: snapshotDoc.kpis
      },
      accountName: snapshotDoc.accountName,
      filename: snapshotDoc.filename,
      snapshotId: snapshotDoc.id,
      updatedAt: snapshotDoc.updatedAt
    };
  }

  async function pullAnalysesBySnapshots(snapshotIds: string[]): Promise<AnalyticsProviderSnapshot[]> {
    const currentDb = await requireDb();
    const ids = [...new Set(snapshotIds.map(id => String(id || '').trim()).filter(Boolean))];
    if (!ids.length) return [];
    const [snapshotDocs, recordsSnapshot] = await Promise.all([
      Promise.all(ids.map(async id => {
        const doc = await currentDb.collection('analytics_snapshots').doc(id).get();
        return doc?.exists ? normalizeSnapshotDoc(doc.data(), doc.id || id) : null;
      })),
      currentDb.collection('analytics_records').orderBy('gmv', 'desc').get()
    ]);
    const recordsBySnapshot = new Map<string, AnalyticsRecord[]>();
    recordsSnapshot.docs.forEach(doc => {
      const data = doc.data() as LooseRecord;
      const snapshotId = String(data.snapshotId || '').trim();
      if (!ids.includes(snapshotId)) return;
      const rows = recordsBySnapshot.get(snapshotId) || [];
      rows.push(normalizeRecordDoc(data));
      recordsBySnapshot.set(snapshotId, rows);
    });
    return snapshotDocs
      .filter((doc): doc is AnalyticsSnapshotDoc => !!doc)
      .map(snapshotDoc => {
        const records = (recordsBySnapshot.get(snapshotDoc.id) || [])
          .sort((a, b) => b.gmv - a.gmv || b.exposureTotal - a.exposureTotal);
        return {
          analysis: {
            period: snapshotDoc.period,
            records,
            activeCount: snapshotDoc.activeCount,
            channelTotals: snapshotDoc.channelTotals,
            kpis: snapshotDoc.kpis
          },
          accountName: snapshotDoc.accountName,
          filename: snapshotDoc.filename,
          snapshotId: snapshotDoc.id,
          updatedAt: snapshotDoc.updatedAt
        };
      });
  }

  async function pullLatestAnalysis(): Promise<AnalyticsProviderSnapshot | null> {
    const snapshots = await listSavedAnalyses();
    return snapshots[0] ? pullAnalysisBySnapshot(snapshots[0].snapshotId) : null;
  }

  async function saveAnalysis(analysis: AnalyticsAnalysis, { accountName = '', filename = '' }: AnalyticsProviderSaveOptions = {}) {
    const currentDb = await requireDb();
    const updatedAt = nowIso();
    const snapshotDoc = buildAnalyticsSnapshotDoc(analysis, { accountName, filename, nowIso: updatedAt });
    let batch = currentDb.batch();
    let pending = 0;
    const commitPending = async () => {
      if (!pending) return;
      await batch.commit();
      batch = currentDb.batch();
      pending = 0;
    };
    const queueSet = (collectionName: string, docId: string, data: unknown) => {
      batch.set(currentDb.collection(collectionName).doc(docId), data, { merge: true });
      pending += 1;
    };
    queueSet('analytics_snapshots', snapshotDoc.id, snapshotDoc);
    for (const [index, record] of analysis.records.entries()) {
      const productId = sanitizeDocId(record.id || record.name) || `row_${index + 1}`;
      const docId = `${snapshotDoc.id}_${productId}`;
      queueSet('analytics_records', docId, buildAnalyticsRecordDoc(snapshotDoc.id, record, updatedAt));
      if (pending >= 450) await commitPending();
    }
    await commitPending();
    return {
      ok: true,
      snapshotId: snapshotDoc.id,
      recordCount: analysis.records.length,
      updatedAt
    };
  }

  return {
    key: 'firestore',
    hydrateConfig,
    init,
    listSavedAnalyses,
    pullAccounts,
    pullAnalysisBySnapshot,
    pullAnalysesBySnapshots,
    pullLatestAnalysis,
    saveAnalysis,
    upsertAccount,
    saveAccountOrder,
    renameAccount,
    deleteAccount
  };
}

const AnalyticsProviderFirestore = {
  create
};

export {
  AnalyticsProviderFirestore,
  buildAnalyticsRecordDoc,
  buildAnalyticsSnapshotDoc,
  buildSnapshotId,
  create,
  hydrateConfig,
  parseConfigInput
};

export type {
  AnalyticsProviderSaveOptions,
  AnalyticsProviderSnapshot,
  AnalyticsProviderSnapshotSummary,
  AnalyticsRecordDoc,
  AnalyticsSnapshotDoc
};
