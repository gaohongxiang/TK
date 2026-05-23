import type { FirebaseConfig, FirebaseWindow, HydratedFirebaseConfig } from '../types/firestore.ts';
import type { TKShippingCore } from '../shipping-core.ts';

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
  note?: string | null;
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
  hasPendingWrites?: boolean;
  fromCache?: boolean;
};

type ProductProviderWriteOptions = {
  waitForCommit?: boolean;
};

type ProductProviderAccountWriteOptions = ProductProviderWriteOptions & {
  sortIndex?: number;
};

type ProductProviderDeferredWrite<T> = {
  product?: T;
  deleted?: boolean;
  commitPromise: Promise<unknown>;
};

type ProductProviderDeferredAccountWrite = {
  account: string;
  commitPromise: Promise<unknown>;
};

type ProductProviderApi = {
  key: 'firestore';
  parseConfigInput: (raw: unknown) => FirebaseConfig | null;
  hydrateConfig: (raw?: unknown) => HydratedFirebaseConfig;
  getDisplayName: (config?: unknown) => string;
  init: (rawConfig?: unknown) => Promise<HydratedFirebaseConfig>;
  pullProducts: () => Promise<ProductProviderPullResult>;
  subscribeSnapshot: (
    onNext: (snapshot: ProductProviderPullResult) => void,
    onError?: (error: unknown) => void
  ) => () => void;
  upsertProduct: (
    product: ProductRecord,
    options?: ProductProviderWriteOptions
  ) => Promise<ProductRecord | ProductProviderDeferredWrite<ProductRecord>>;
  deleteProduct: (
    tkId: string,
    options?: ProductProviderWriteOptions
  ) => Promise<boolean | ProductProviderDeferredWrite<never>>;
  upsertAccount: (
    name: string,
    options?: ProductProviderAccountWriteOptions
  ) => Promise<string | ProductProviderDeferredAccountWrite>;
  saveAccountOrder: (
    names: string[],
    options?: ProductProviderWriteOptions
  ) => Promise<number | { count: number; commitPromise: Promise<unknown> }>;
  renameAccount: (
    oldName: string,
    newName: string,
    options?: ProductProviderWriteOptions & { accountOrder?: string[] }
  ) => Promise<{ accounts: string[]; commitPromise?: Promise<unknown[]> }>;
  deleteAccount: (
    name: string,
    options?: ProductProviderWriteOptions & { accountOrder?: string[] }
  ) => Promise<{ accounts: string[]; commitPromise?: Promise<unknown[]> }>;
};

type ProductProviderCreateOptions = {
  state?: Record<string, unknown>;
  helpers?: {
    nowIso?: () => string;
  };
  window?: FirebaseWindow;
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
  note: string | null;
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

type ProductShippingCore = Pick<typeof TKShippingCore, 'computeShippingQuote' | 'computeCalculatedShippingCost'>;

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
  FirebaseConfig as ProductFirestoreConfig,
  ProductFirestoreDoc,
  HydratedFirebaseConfig as ProductHydratedFirestoreConfig,
  ProductLogisticsDefaults,
  ProductPricingContext,
  ProductProviderApi,
  ProductProviderAccountWriteOptions,
  ProductProviderCreateOptions,
  ProductProviderDeferredAccountWrite,
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
