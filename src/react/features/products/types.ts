type ProductSku = {
  skuId?: string;
  skuName?: string;
  useProductDefaults?: boolean;
  weightG?: string | number;
  sizeText?: string;
  lengthCm?: string | number;
  widthCm?: string | number;
  heightCm?: string | number;
  estimatedShippingFee?: string | number;
  chargeWeightKg?: string | number;
  shippingNote?: string;
};

type ProductRecord = {
  tkId?: string;
  name?: string;
  accountName?: string;
  imageUrl?: string;
  link1688?: string;
  cargoType?: string;
  createdAt?: string;
  updatedAt?: string;
  defaults?: Record<string, unknown>;
  skus?: ProductSku[];
  [key: string]: unknown;
};

type ProductsTableHelpers = {
  clampPage: (currentPage: number, pageSize: number, totalItems: number) => { currentPage: number; totalPages: number; pageSize: number };
  deriveDisplayedProducts: (options: {
    products: ProductRecord[];
    activeAccount?: string;
    searchQuery?: string;
    sortOrder?: string;
  }) => ProductRecord[];
  formatSkuCount: (product: ProductRecord) => string;
  formatText: (value: unknown) => string;
  getCargoTypeLabel: (value: unknown) => string;
  getProductDefaults: (product: ProductRecord) => Record<string, unknown>;
  getProductSkus: (product: ProductRecord) => ProductSku[];
  mergeProductSku: (product: ProductRecord, sku: ProductSku) => ProductRecord & ProductSku;
  formatSize: (product: ProductRecord | ProductSku) => string;
  formatWeight: (value: unknown) => string;
  formatSkuLabel: (sku: ProductSku) => string;
  formatSkuShippingFee: (product: ProductRecord, sku: ProductSku) => string;
};

type ProductsTableRenderOptions = {
  toolbar?: HTMLElement | null;
  footerToolbar?: HTMLElement | null;
  wrap?: HTMLElement | null;
  products?: ProductRecord[];
  activeAccount?: string;
  searchQuery?: string;
  sortOrder?: string;
  pageSize?: number;
  currentPage?: number;
  expandedTkIds?: Record<string, boolean>;
  pageSizeOptions?: number[];
  onSearchChange?: (value: string) => void;
  onPageSizeChange?: (value: string | number) => void;
  onPageChange?: (delta: number, totalPages?: number) => void;
  onSortToggle?: () => void;
  onToggleExpand?: (tkId: string) => void;
  onCopyLink?: (link: string) => void;
  onEdit?: (tkId: string) => void;
  onDelete?: (tkId: string) => void;
  helpers: ProductsTableHelpers;
};

export type {
  ProductRecord,
  ProductSku,
  ProductsTableHelpers,
  ProductsTableRenderOptions
};
