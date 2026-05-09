import type { ProductLogisticsDefaults, ProductRecord, ProductSku } from '../../../products/types.ts';

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
  getProductDefaults: (product: ProductRecord) => ProductLogisticsDefaults;
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
