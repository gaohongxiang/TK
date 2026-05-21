import { parseConfigInput } from './firestore-connection.ts';
import type { FirebaseCompatFirestore, FirebaseCompatNamespace } from './types/firestore.ts';

type FirestoreRulesModuleKey = string;
type FirestoreRuleNeed = string;

type FirestoreRulesTarget = {
  collectionName: string;
  readNeed?: FirestoreRuleNeed;
  writeNeed?: FirestoreRuleNeed;
};

type FirestoreRulesCheckResult = {
  ok: boolean;
  needsUpdate: boolean;
  moduleKey: FirestoreRulesModuleKey;
  missing: FirestoreRuleNeed[];
  missingLabels: string[];
  summary: string;
  message: string;
};

type FirestoreRulesCheckOptions = {
  window?: Partial<Window> & { firebase?: FirebaseCompatNamespace };
};

type FirestoreRulesModuleDefinition = {
  key: FirestoreRulesModuleKey;
  issueSummary: string;
  targets: FirestoreRulesTarget[];
  labels?: Record<FirestoreRuleNeed, string>;
};

const ruleNeedLabels: Record<FirestoreRuleNeed, string> = {
  'rules.version': '确认数据库规则版本',
  'products.read': '读取商品资料',
  'products.write': '保存商品资料',
  'orders.read': '读取订单资料',
  'orders.write': '保存订单资料',
  'order_accounts.read': '读取账号标签',
  'order_accounts.write': '保存账号标签',
  'sync_state.read': '读取同步状态',
  'sync_state.write': '保存同步状态',
  'finance_records.read': '读取收支记录',
  'finance_records.write': '保存收支记录',
  'collection_records.read': '读取采编记录',
  'collection_records.write': '保存采编记录和店小秘采集/编辑状态',
  'collection_excluded_products.read': '读取拒绝品记录',
  'collection_excluded_products.write': '保存拒绝品记录',
  'analytics_snapshots.read': '读取数据分析快照',
  'analytics_snapshots.write': '保存数据分析快照',
  'analytics_records.read': '读取数据分析商品明细',
  'analytics_records.write': '保存数据分析商品明细'
};

const moduleRegistry = new Map<FirestoreRulesModuleKey, FirestoreRulesModuleDefinition>();

function registerFirestoreRulesModule(definition: FirestoreRulesModuleDefinition) {
  const key = String(definition?.key || '').trim();
  const targets = Array.isArray(definition?.targets) ? definition.targets : [];
  if (!key || !targets.length) throw new Error('数据库权限检查模块配置不完整');
  moduleRegistry.set(key, {
    key,
    issueSummary: String(definition.issueSummary || '当前模块保存不可用').trim() || '当前模块保存不可用',
    targets,
    labels: definition.labels || {}
  });
  Object.assign(ruleNeedLabels, definition.labels || {});
}

function getFirestoreRulesModule(moduleKey: FirestoreRulesModuleKey) {
  const definition = moduleRegistry.get(moduleKey);
  if (!definition) throw new Error(`数据库权限检查模块未注册：${moduleKey}`);
  return definition;
}

[
  {
    key: 'products',
    issueSummary: '商品保存不可用',
    targets: [
      { collectionName: 'products', readNeed: 'products.read', writeNeed: 'products.write' },
      { collectionName: 'order_accounts', readNeed: 'order_accounts.read', writeNeed: 'order_accounts.write' }
    ]
  },
  {
    key: 'orders',
    issueSummary: '订单保存不可用',
    targets: [
      { collectionName: 'orders', readNeed: 'orders.read', writeNeed: 'orders.write' },
      { collectionName: 'order_accounts', readNeed: 'order_accounts.read', writeNeed: 'order_accounts.write' },
      { collectionName: 'sync_state', readNeed: 'sync_state.read', writeNeed: 'sync_state.write' },
      { collectionName: 'products', readNeed: 'products.read' }
    ]
  },
  {
    key: 'finance',
    issueSummary: '收支管理保存不可用',
    targets: [
      { collectionName: 'finance_records', readNeed: 'finance_records.read', writeNeed: 'finance_records.write' },
      { collectionName: 'orders', readNeed: 'orders.read' },
      { collectionName: 'order_accounts', readNeed: 'order_accounts.read' }
    ]
  },
  {
    key: 'collection',
    issueSummary: '商品采编保存不可用',
    targets: [
      { collectionName: 'collection_records', readNeed: 'collection_records.read', writeNeed: 'collection_records.write' },
      { collectionName: 'collection_excluded_products', readNeed: 'collection_excluded_products.read', writeNeed: 'collection_excluded_products.write' }
    ]
  },
  {
    key: 'analytics',
    issueSummary: '数据分析保存不可用',
    targets: [
      { collectionName: 'analytics_snapshots', readNeed: 'analytics_snapshots.read', writeNeed: 'analytics_snapshots.write' },
      { collectionName: 'analytics_records', readNeed: 'analytics_records.read', writeNeed: 'analytics_records.write' }
    ]
  }
].forEach(registerFirestoreRulesModule);

function getWindowRef(options: FirestoreRulesCheckOptions = {}): Partial<Window> & { firebase?: FirebaseCompatNamespace } {
  if (options.window) return options.window;
  const fallback = typeof window !== 'undefined' ? window : globalThis.window || globalThis;
  return fallback as unknown as Partial<Window> & { firebase?: FirebaseCompatNamespace };
}

function isPermissionDenied(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const code = String(err?.code || '').trim();
  const message = String(err?.message || '').trim() || (error instanceof Error ? error.message : String(error || ''));
  return code.includes('permission-denied') || /permission|Missing or insufficient permissions|PERMISSION_DENIED/i.test(message);
}

function uniqueLabels(needs: FirestoreRuleNeed[]) {
  return Array.from(new Set(needs.map(need => ruleNeedLabels[need] || '当前模块需要的数据库权限').filter(Boolean)));
}

function getFirestoreRulesUpdateSummary(moduleKey: FirestoreRulesModuleKey) {
  return `数据库规则需要更新 · ${getFirestoreRulesModule(moduleKey).issueSummary}`;
}

function formatFirestoreRulesUpdateMessage(moduleKey: FirestoreRulesModuleKey, missing: FirestoreRuleNeed[] = []) {
  const summary = getFirestoreRulesModule(moduleKey).issueSummary;
  return [
    `当前数据库权限不足，${summary}。`,
    '复制最新 Firestore 规则发布后刷新页面。'
  ].join(' ');
}

async function initRulesCheckDb(rawConfig: unknown, options: FirestoreRulesCheckOptions = {}): Promise<FirebaseCompatFirestore> {
  const config = parseConfigInput(rawConfig);
  if (!config?.projectId) throw new Error('请先填写有效的 firebaseConfig');
  const firebaseNs = getWindowRef(options)?.firebase || null;
  if (!firebaseNs?.initializeApp) throw new Error('Firebase SDK 尚未加载');
  const appName = `tk-rules-check-${config.projectId}`;
  const app = (firebaseNs.apps || []).find(item => item.name === appName) || firebaseNs.initializeApp(config, appName);
  const db = app.firestore();
  if (!app.__tkRulesCheckFirestoreConfigured && typeof db.settings === 'function') {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '');
      if (!/settings can no longer be changed|already been started/i.test(message)) throw error;
    }
    app.__tkRulesCheckFirestoreConfigured = true;
  }
  return db;
}

async function recordPermissionIssue(missing: Set<FirestoreRuleNeed>, need: FirestoreRuleNeed, operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    if (isPermissionDenied(error)) {
      missing.add(need);
      return;
    }
    throw error;
  }
}

async function checkTarget(db: FirebaseCompatFirestore, target: FirestoreRulesTarget, missing: Set<FirestoreRuleNeed>) {
  const collectionRef = db.collection(target.collectionName);
  if (target.readNeed) {
    const readQuery = typeof collectionRef.limit === 'function' ? collectionRef.limit(1) : collectionRef;
    await recordPermissionIssue(missing, target.readNeed, () => readQuery.get());
  }
}

async function checkFirestoreRulesCompatibility(rawConfig: unknown, moduleKey: FirestoreRulesModuleKey, options: FirestoreRulesCheckOptions = {}): Promise<FirestoreRulesCheckResult> {
  const definition = getFirestoreRulesModule(moduleKey);
  const db = await initRulesCheckDb(rawConfig, options);
  const missing = new Set<FirestoreRuleNeed>();

  for (const target of definition.targets) {
    await checkTarget(db, target, missing);
  }

  const missingList = Array.from(missing);
  return {
    ok: missingList.length === 0,
    needsUpdate: missingList.length > 0,
    moduleKey,
    missing: missingList,
    missingLabels: uniqueLabels(missingList),
    summary: missingList.length ? getFirestoreRulesUpdateSummary(moduleKey) : '数据库规则可用',
    message: missingList.length ? formatFirestoreRulesUpdateMessage(moduleKey, missingList) : ''
  };
}

export {
  checkFirestoreRulesCompatibility,
  formatFirestoreRulesUpdateMessage,
  getFirestoreRulesModule,
  getFirestoreRulesUpdateSummary,
  isPermissionDenied,
  registerFirestoreRulesModule,
  ruleNeedLabels
};
export type {
  FirestoreRuleNeed,
  FirestoreRulesModuleDefinition,
  FirestoreRulesCheckResult,
  FirestoreRulesModuleKey
};
