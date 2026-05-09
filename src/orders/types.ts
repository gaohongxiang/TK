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
  OrderItem,
  OrderItemNormalizerOptions,
  OrderItemSummaryParts,
  OrderItemTotals,
  OrderNormalizerOptions,
  OrderRecord,
  OrderSizeParseResult,
  OrderSortOrder,
  OrderStatus,
  OrderSummaryMetric,
  OrderWarning,
  PurchaseSummary,
  SelectOrdersForExportOptions
};
