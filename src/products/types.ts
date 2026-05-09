type ProductCargoType = 'general' | 'special' | string;

type ProductLogisticsDefaults = {
  cargoType?: ProductCargoType;
  weightG?: string | number;
  sizeText?: string;
  lengthCm?: string | number;
  widthCm?: string | number;
  heightCm?: string | number;
  estimatedShippingFee?: string | number;
  chargeWeightKg?: string | number;
  shippingNote?: string | null;
  [key: string]: unknown;
};

type ProductSku = ProductLogisticsDefaults & {
  skuId?: string;
  skuName?: string | null;
  useProductDefaults?: boolean;
};

type ProductRecord = ProductLogisticsDefaults & {
  tkId?: string;
  name?: string | null;
  accountName?: string | null;
  imageUrl?: string | null;
  link1688?: string | null;
  defaults?: ProductLogisticsDefaults;
  skus?: ProductSku[];
  createdAt?: string;
  updatedAt?: string;
};

type ProductAccount = string;

type ProductExportAccountOption = {
  key: string;
  label: string;
  count: number;
};

type ProductExportRow = Array<string | number | null | undefined>;

type ProductExportState = {
  accounts?: ProductAccount[];
  activeAccount?: string;
};

type ProductExportHelpers = {
  getDisplayedProducts?: (options?: { activeAccount?: string }) => ProductRecord[];
  normalizeAccountName?: (value: unknown) => string;
  uniqueAccounts?: (values?: unknown[]) => string[];
  toAccountSlot?: (value: unknown) => string;
};

type ProductExportApi = {
  buildProductExportFilename: (selectedOptions?: ProductExportAccountOption[]) => string;
  buildProductExportRows: (selectedSet?: Set<string> | Iterable<string>) => ProductExportRow[];
  getProductExportAccountOptions: () => ProductExportAccountOption[];
};

type ProductSortOrder = 'asc' | 'desc' | string;

type DeriveDisplayedProductsOptions = {
  products?: ProductRecord[];
  activeAccount?: string;
  searchQuery?: string;
  sortOrder?: ProductSortOrder;
};

type ProductProviderPullResult = {
  products: ProductRecord[];
  accounts: string[];
  lastRemoteUpdatedAt: string;
};

type ProductProviderWriteOptions = {
  waitForCommit?: boolean;
};

type ProductProviderDeferredWrite<T> = {
  product?: T;
  deleted?: boolean;
  commitPromise: Promise<unknown>;
};

type ProductProviderApi = {
  key: 'firestore';
  parseConfigInput: (raw: unknown) => ProductFirestoreConfig | null;
  hydrateConfig: (raw?: unknown) => ProductHydratedFirestoreConfig;
  getDisplayName: (config?: unknown) => string;
  init: (rawConfig?: unknown) => Promise<ProductHydratedFirestoreConfig>;
  pullProducts: () => Promise<ProductProviderPullResult>;
  upsertProduct: (
    product: ProductRecord,
    options?: ProductProviderWriteOptions
  ) => Promise<ProductRecord | ProductProviderDeferredWrite<ProductRecord>>;
  deleteProduct: (
    tkId: string,
    options?: ProductProviderWriteOptions
  ) => Promise<boolean | ProductProviderDeferredWrite<never>>;
};

type ProductFirestoreConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  [key: string]: string | undefined;
};

type ProductHydratedFirestoreConfig = {
  config: ProductFirestoreConfig | null;
  configText: string;
  projectId: string;
  user: string;
};

type ProductProviderCreateOptions = {
  state?: Record<string, unknown>;
  helpers?: {
    nowIso?: () => string;
  };
  window?: Partial<Window> & {
    firebase?: FirebaseCompatNamespace;
  };
};

type FirebaseCompatDocSnapshot = {
  data: () => Record<string, unknown>;
};

type FirebaseCompatQuerySnapshot = {
  docs: FirebaseCompatDocSnapshot[];
};

type FirebaseCompatDocRef = {
  set: (data: unknown, options?: unknown) => Promise<unknown>;
  delete: () => Promise<unknown>;
};

type FirebaseCompatCollectionRef = {
  orderBy: (field: string, direction?: string) => FirebaseCompatCollectionRef;
  get: () => Promise<FirebaseCompatQuerySnapshot>;
  doc: (id: string) => FirebaseCompatDocRef;
};

type FirebaseCompatFirestore = {
  settings?: (options: unknown) => void;
  enablePersistence?: (options?: unknown) => Promise<unknown>;
  collection: (name: string) => FirebaseCompatCollectionRef;
};

type FirebaseCompatApp = {
  name: string;
  firestore: () => FirebaseCompatFirestore;
  __tkProductsFirestoreConfigured?: boolean;
};

type FirebaseCompatNamespace = {
  apps?: FirebaseCompatApp[];
  initializeApp: (config: ProductFirestoreConfig, name?: string) => FirebaseCompatApp;
};

type ProductSkuDoc = {
  skuId: string;
  skuName: string | null;
  useProductDefaults: boolean;
  weightG: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  estimatedShippingFee: number | null;
  chargeWeightKg: number | null;
  shippingNote: string | null;
};

type ProductDefaultsDoc = {
  cargoType: string;
  weightG: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  estimatedShippingFee: number | null;
  chargeWeightKg: number | null;
  shippingNote: string | null;
};

type ProductFirestoreDoc = {
  tkId: string;
  accountName: string | null;
  name: string | null;
  imageUrl: string | null;
  link1688: string | null;
  defaults: ProductDefaultsDoc;
  skus: ProductSkuDoc[];
  createdAt: string;
  updatedAt: string;
};

type ProductSizeParseResult = {
  sizeText: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  isComplete: boolean;
};

type ProductShippingCore = {
  computeShippingQuote?: (options: {
    cargoType: unknown;
    actualWeight: unknown;
    length: unknown;
    width: unknown;
    height: unknown;
    rate: unknown;
    [key: string]: unknown;
  }) => {
    chargeWeightKg?: number | string | null;
    alerts?: Array<{ text?: string }>;
    [key: string]: unknown;
  };
  computeCalculatedShippingCost?: (options: {
    quote?: unknown;
    multiplier?: unknown;
    labelFee?: unknown;
    [key: string]: unknown;
  }) => number | string | null;
};

type ProductPricingContext = {
  rate?: number | string;
  shippingMultiplier?: number | string;
  labelFee?: number | string;
  [key: string]: unknown;
};

type ProductShippingSnapshot = {
  estimatedShippingFee: string;
  chargeWeightKg: string;
  shippingNote: string;
};

type ProductBatchSkuDraft = {
  skuName: string;
};

export type {
  DeriveDisplayedProductsOptions,
  ProductAccount,
  ProductBatchSkuDraft,
  ProductCargoType,
  ProductDefaultsDoc,
  ProductExportAccountOption,
  ProductExportApi,
  ProductExportHelpers,
  ProductExportRow,
  ProductExportState,
  FirebaseCompatApp,
  FirebaseCompatCollectionRef,
  FirebaseCompatDocRef,
  FirebaseCompatDocSnapshot,
  FirebaseCompatFirestore,
  FirebaseCompatNamespace,
  FirebaseCompatQuerySnapshot,
  ProductFirestoreConfig,
  ProductFirestoreDoc,
  ProductHydratedFirestoreConfig,
  ProductLogisticsDefaults,
  ProductPricingContext,
  ProductProviderApi,
  ProductProviderCreateOptions,
  ProductProviderDeferredWrite,
  ProductProviderPullResult,
  ProductProviderWriteOptions,
  ProductRecord,
  ProductShippingCore,
  ProductShippingSnapshot,
  ProductSizeParseResult,
  ProductSku,
  ProductSkuDoc,
  ProductSortOrder
};
