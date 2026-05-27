import type { OrderRecord } from '../orders/types.ts';
import type { FirebaseConfig, FirebaseWindow, HydratedFirebaseConfig } from '../types/firestore.ts';

type FinanceRecordKind = 'actual_income' | 'cost';

type FinanceRecord = {
  id: string;
  kind: FinanceRecordKind;
  accountName: string;
  category: string;
  amount: number;
  occurredAt: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

type FinanceRecordDraft = {
  kind: FinanceRecordKind;
  accountName: string;
  category: string;
  amount: string;
  occurredAt: string;
  note: string;
};

type FinanceRecordDoc = {
  id: string;
  kind: FinanceRecordKind;
  accountName: string | null;
  category: string | null;
  amount: number | null;
  occurredAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

type FinanceProviderCreateOptions = {
  state?: Record<string, unknown>;
  helpers?: {
    nowIso?: () => string;
    todayStr?: () => string;
  };
  window?: FirebaseWindow;
};

type SerializedFinanceProviderConfig = {
  firestoreConfigText: string;
  firestoreProjectId: string;
  user: string;
};

type FinanceProviderSnapshot = {
  records: FinanceRecord[];
  orders: OrderRecord[];
  accounts: string[];
  updatedAt: string;
  hasPendingWrites?: boolean;
  fromCache?: boolean;
};

type FinanceProviderUpsertOptions = {
  waitForCommit?: boolean;
};

type FinanceProviderDeleteOptions = {
  waitForCommit?: boolean;
};

type FinanceProviderUpsertResult = {
  record: FinanceRecord;
  updatedAt: string;
  commitPromise?: Promise<unknown>;
};

type FinanceProviderDeleteResult = {
  id: string;
  updatedAt: string;
  commitPromise?: Promise<unknown>;
};

type FinanceProviderApi = {
  key: string;
  label: string;
  parseConfigInput: (raw: unknown) => FirebaseConfig | null;
  normalizeConfigText: (raw: unknown) => string;
  serializeConfig: (config: unknown) => SerializedFinanceProviderConfig;
  getDisplayName: (config?: unknown) => string;
  usesBuiltInLocalCache: () => boolean;
  init: (config: unknown) => Promise<SerializedFinanceProviderConfig>;
  isReady: () => boolean;
  isConnected: () => boolean;
  signOut: () => Promise<void>;
  pullSnapshot: () => Promise<FinanceProviderSnapshot>;
  subscribeSnapshot: (
    onNext: (snapshot: FinanceProviderSnapshot) => void,
    onError?: (error: unknown) => void
  ) => () => void;
  upsertRecord: (record: Partial<FinanceRecord> | FinanceRecordDraft, options?: FinanceProviderUpsertOptions) => Promise<FinanceProviderUpsertResult>;
  deleteRecord: (id: string, options?: FinanceProviderDeleteOptions) => Promise<FinanceProviderDeleteResult>;
  renameAccount: (
    oldName: string,
    newName: string,
    options?: { accountOrder?: string[]; waitForCommit?: boolean }
  ) => Promise<{ accounts: string[]; commitPromise?: Promise<unknown[]> }>;
  deleteAccount: (
    name: string,
    options?: { accountOrder?: string[]; waitForCommit?: boolean }
  ) => Promise<{ accounts: string[]; commitPromise?: Promise<unknown[]> }>;
};

type FinanceSummaryMetric = {
  total: number;
  count: number;
};

type FinanceSummary = {
  estimatedIncome: FinanceSummaryMetric;
  actualIncome: FinanceSummaryMetric;
  repaymentIncome: FinanceSummaryMetric;
  costs: FinanceSummaryMetric;
  orderPurchaseCost: FinanceSummaryMetric;
  orderLabelFee: FinanceSummaryMetric;
  cashOrderCost: FinanceSummaryMetric;
  depositsPaid: FinanceSummaryMetric;
  depositsReturned: FinanceSummaryMetric;
  depositLosses: FinanceSummaryMetric;
  estimatedNetProfit: number;
  cashNetProfit: number;
  pendingIncome: number;
  depositBalance: number;
  orderCount: number;
};

type FinanceFilters = {
  activeAccount?: string;
  month?: string;
  query?: string;
};

export type {
  FinanceFilters,
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
  FinanceRecordKind,
  FinanceSummary,
  FinanceSummaryMetric,
  HydratedFirebaseConfig,
  SerializedFinanceProviderConfig
};
