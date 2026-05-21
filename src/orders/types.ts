import type { FirebaseConfig, FirebaseWindow, HydratedFirebaseConfig } from '../types/firestore.ts';

type OrderSortOrder = 'asc' | 'desc' | string;

type OrderStatus = '未采购' | '已采购' | '在途' | '已入仓' | '已送达' | '已完成' | '订单取消' | string;

type OrderItem = {
  lineId?: string;
  productTkId?: string;
  productSkuId?: string;
  productSkuName?: string;
  productName?: string;
  quantity?: string | number;
  unitPurchasePrice?: string | number | null;
  unitSalePrice?: string | number | null;
  unitWeightG?: string | number | null;
  unitSizeText?: string | null;
  useOrderCourier?: boolean | null;
  courierCompany?: string | null;
  trackingNo?: string | null;
  [key: string]: unknown;
};

type NormalizedOrderItem = {
  lineId: string;
  productTkId: string;
  productSkuId: string;
  productSkuName: string;
  productName: string;
  quantity: string;
  unitPurchasePrice: string;
  unitSalePrice: string;
  unitWeightG: string;
  unitSizeText: string;
  useOrderCourier: boolean | null;
  courierCompany: string;
  trackingNo: string;
};

type OrderRecord = {
  id?: string;
  seq?: number | string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  deletedAt?: string;
  deleted_at?: string;
  isRefunded?: boolean | string | number;
  refunded?: boolean | string | number;
  salePrice?: string | number | null;
  purchasePrice?: string | number | null;
  estimatedShippingFee?: string | number | null;
  estimatedShippingFeeMode?: 'auto' | 'manual' | string | null;
  estimatedProfit?: string | number | null;
  creatorCommissionRate?: string | number | null;
  creatorCommission?: string | number | null;
  items?: OrderItem[];
  __needsOrderCleanup?: boolean;
  '账号'?: string | null;
  '下单时间'?: string | null;
  '采购日期'?: string | null;
  '最晚到仓时间'?: string | null;
  '订单预警'?: string | null;
  '订单号'?: string | null;
  '商品TK ID'?: string | null;
  '商品SKU ID'?: string | null;
  '商品SKU名称'?: string | null;
  '产品名称'?: string | null;
  '数量'?: string | number | null;
  '是否退款'?: string | number | boolean | null;
  '达人佣金率'?: string | number | null;
  '达人佣金'?: string | number | null;
  '采购价格'?: string | number | null;
  '售价'?: string | number | null;
  '预估运费'?: string | number | null;
  '预估利润'?: string | number | null;
  '重量'?: string | number | null;
  '尺寸'?: string | null;
  '订单状态'?: OrderStatus | null;
  '入仓状态'?: OrderStatus | null;
  '快递公司'?: string | null;
  '快递单号'?: string | null;
  '备注'?: string | null;
  [key: string]: unknown;
};

type OrderAccount = string;

type OrderNormalizerOptions = {
  constants?: Partial<OrderConstants>;
  nextUid?: () => string;
};

type OrderItemNormalizerOptions = {
  nextUid?: () => string;
};

type OrderConstants = {
  UNASSIGNED_ACCOUNT_SLOT: string;
  ACCOUNT_FILE_PREFIX: string;
  ACCOUNT_FILE_SUFFIX: string;
  COURIER_AUTO_DETECTORS: CourierDetector[];
};

type CourierDetector = {
  name: string;
  test: RegExp | ((value: string) => boolean);
};

type OrderWarning = {
  text: string;
  cls: 'muted' | 'ok' | 'danger' | 'info' | string;
};

type OrderItemTotals = {
  quantity: number;
  purchase: number;
  sale: number;
  weight: number;
};

type OrderItemSummaryParts = {
  productName: string;
  skuName: string;
  quantity: number;
};

type OrderSummaryMetric = {
  total: number;
  count: number;
};

type DeriveDisplayedOrdersOptions = {
  orders?: OrderRecord[];
  activeAccount?: string;
  searchQuery?: string;
  sortOrder?: OrderSortOrder;
};

type DeriveDisplayedOrdersResult = {
  isAll: boolean;
  sorted: OrderRecord[];
};

type DerivePurchaseSummaryOptions = DeriveDisplayedOrdersOptions & {
  exchangeRate?: unknown;
  computeOrderSaleCny?: (order: OrderRecord, exchangeRate?: unknown) => number | null;
  computeOrderCreatorCommission?: (order: OrderRecord, exchangeRate?: unknown) => number | null;
  computeOrderEstimatedProfit?: (order: OrderRecord, exchangeRate?: unknown) => number | null;
};

type PurchaseSummary = {
  filteredCount: number;
  allCount: number;
  filteredTotal: number;
  allTotal: number;
  filteredSaleTotal: number;
  allSaleTotal: number;
  filteredShippingTotal: number;
  allShippingTotal: number;
  filteredCreatorCommissionTotal: number;
  allCreatorCommissionTotal: number;
  filteredProfitTotal: number;
  allProfitTotal: number;
  filteredPurchaseMetric: OrderSummaryMetric;
  allPurchaseMetric: OrderSummaryMetric;
  filteredSaleMetric: OrderSummaryMetric;
  allSaleMetric: OrderSummaryMetric;
  filteredGrossSaleMetric: OrderSummaryMetric;
  allGrossSaleMetric: OrderSummaryMetric;
  filteredShippingMetric: OrderSummaryMetric;
  allShippingMetric: OrderSummaryMetric;
  filteredCreatorCommissionMetric: OrderSummaryMetric;
  allCreatorCommissionMetric: OrderSummaryMetric;
  filteredRefundMetric: OrderSummaryMetric;
  allRefundMetric: OrderSummaryMetric;
  filteredProfitMetric: OrderSummaryMetric;
  allProfitMetric: OrderSummaryMetric;
};

type OrderExportAccountOption = {
  key: string;
  label: string;
  count: number;
};

type OrderExportRow = Array<string | number | null | undefined>;

type OrderExportConstants = {
  UNASSIGNED_ACCOUNT_SLOT: string;
};

type BuildOrderExportRowsOptions = {
  orders?: OrderRecord[];
  exchangeRate?: unknown;
  computeWarningFn?: (order: OrderRecord) => OrderWarning;
  computeOrderCreatorCommissionFn?: (order: OrderRecord, exchangeRate?: unknown) => number | null;
  computeOrderEstimatedProfitFn?: (order: OrderRecord, exchangeRate?: unknown) => number | null;
};

type BuildOrdersCsvOptions = {
  rows?: OrderExportRow[];
  headers?: string[];
  includeBom?: boolean;
};

type BuildExportFilenameOptions = {
  today?: () => string;
};

type SelectOrdersForExportOptions = {
  orders?: OrderRecord[];
  selectedKeys?: Iterable<string>;
  constants?: Partial<OrderExportConstants>;
};

type GetExportAccountOptionsInput = {
  accounts?: unknown[];
  orders?: OrderRecord[];
  constants?: Partial<OrderExportConstants>;
};

type OrderFormDraftItem = NormalizedOrderItem;

type OrderSizeParseResult = {
  lengthCm: number | '';
  widthCm: number | '';
  heightCm: number | '';
};

type OrderProviderCreateOptions = {
  state?: Record<string, unknown>;
  helpers?: {
    nowIso?: () => string;
    normalizeOrderList?: (list: OrderRecord[]) => OrderRecord[];
    uniqueAccounts?: (list: unknown[]) => string[];
  };
  window?: FirebaseWindow;
};

type SerializedOrderProviderConfig = {
  firestoreConfigText: string;
  firestoreProjectId: string;
  user: string;
};

type OrderProviderSnapshot = {
  orders: OrderRecord[];
  accounts: string[];
  changedOrders: OrderRecord[];
  changedAccounts: Array<{ name: string; updatedAt: string; deletedAt: string }>;
  updatedAt: string;
  accountsUpdatedAt: string;
  remoteCursor: string;
};

type OrderProviderPushChangesOptions = {
  upserts?: OrderRecord[];
  deletions?: Array<{ id?: string; accountName?: string; deletedAt?: string }>;
  accountUpserts?: string[];
  accountDeletions?: string[];
  accountSortOrder?: string[];
  clientId?: string;
  assignSeq?: boolean;
  waitForCommit?: boolean;
};

type OrderProviderPushResult = {
  updatedAt: string;
  remoteCursor: string;
  assignedOrders: OrderRecord[];
  commitPromise: Promise<unknown>;
};

type OrderProviderApi = {
  key: 'firestore';
  label: string;
  parseConfigInput: (raw: unknown) => FirebaseConfig | null;
  normalizeConfigText: (raw: unknown) => string;
  serializeConfig: (config: unknown) => SerializedOrderProviderConfig;
  getCacheKey: () => null;
  getDisplayName: (config?: unknown) => string;
  usesBuiltInLocalCache: () => boolean;
  init: (config: unknown) => Promise<SerializedOrderProviderConfig>;
  isReady: () => boolean;
  isConnected: () => boolean;
  signOut: () => Promise<void>;
  pullSnapshot: (options?: { cursor?: string }) => Promise<OrderProviderSnapshot>;
  pushChanges: (options?: OrderProviderPushChangesOptions) => Promise<OrderProviderPushResult>;
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

type OrderItemDoc = {
  lineId: string;
  quantity: number | null;
  productTkId?: string;
  productSkuId?: string;
  productSkuName?: string;
  productName?: string;
  unitPurchasePrice?: number;
  unitSalePrice?: number;
  unitWeightG?: number;
  unitSizeText?: string;
  courierCompany?: string;
  trackingNo?: string;
};

type OrderFirestoreDoc = {
  id: string;
  seq?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  accountName: string | null;
  orderedAt: string | null;
  purchaseDate: string | null;
  latestWarehouseAt: string | null;
  warningText: string | null;
  orderNo: string | null;
  productName: string | null;
  quantity: number | null;
  isRefunded: boolean;
  creatorCommissionRate: number | null;
  creatorCommission: number | null;
  purchasePrice: number | null;
  salePrice: number | null;
  estimatedShippingFee: number | null;
  estimatedShippingFeeMode: 'auto' | 'manual';
  estimatedProfit: number | null;
  weightText: string | null;
  sizeText: string | null;
  orderStatus: string | null;
  note: string | null;
  items: OrderItemDoc[] | null;
};

export type {
  BuildExportFilenameOptions,
  BuildOrderExportRowsOptions,
  BuildOrdersCsvOptions,
  CourierDetector,
  DeriveDisplayedOrdersOptions,
  DeriveDisplayedOrdersResult,
  DerivePurchaseSummaryOptions,
  GetExportAccountOptionsInput,
  NormalizedOrderItem,
  OrderAccount,
  OrderConstants,
  OrderExportAccountOption,
  OrderExportConstants,
  OrderExportRow,
  OrderFormDraftItem,
  OrderFirestoreDoc,
  OrderItem,
  OrderItemDoc,
  OrderItemNormalizerOptions,
  OrderItemSummaryParts,
  OrderItemTotals,
  OrderNormalizerOptions,
  OrderProviderApi,
  OrderProviderCreateOptions,
  OrderProviderPushChangesOptions,
  OrderProviderPushResult,
  OrderProviderSnapshot,
  OrderRecord,
  OrderSizeParseResult,
  OrderSortOrder,
  OrderStatus,
  OrderSummaryMetric,
  OrderWarning,
  PurchaseSummary,
  SerializedOrderProviderConfig,
  FirebaseConfig as OrderFirestoreConfig,
  HydratedFirebaseConfig as OrderHydratedFirestoreConfig,
  SelectOrdersForExportOptions
};
