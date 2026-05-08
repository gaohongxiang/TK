import { Alert, AlertDescription } from '@/components/ui/alert';
import { AccountTabsBar } from '@/components/ui/account-tabs-bar';
import { Badge, badgeToneMap } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ExportOptions } from '@/components/ui/export-options';
import { FormField, FormRow } from '@/components/ui/form';
import { HelpItem, HelpStack } from '@/components/ui/help-stack';
import { InlineToken } from '@/components/ui/inline-token';
import { Input } from '@/components/ui/input';
import { PageHero } from '@/components/ui/page-hero';
import { Select } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { refreshButtonClass, statusStripClass, statusStripLeftClass, statusStripRightClass, storageHelpButtonClass, syncStatusClass } from '@/components/ui/status-strip';
import { EmptyState, TableFrame, TablePager, TableSearch, TableSortButton, TableToolbar, TableViewport } from '@/components/ui/table-tools';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showAppToast } from '@/app/toast';
import { TKFirestoreConnection } from '../../../firestore-connection.ts';
import { OrderTrackerProviderFirestore } from '../../../orders/provider-firestore.ts';
import { ProductLibraryProviderFirestore } from '../../../products/provider-firestore.ts';
import {
  addDays,
  buildOrderItemsSummary,
  computeOrderCreatorCommission,
  computeOrderEstimatedProfit,
  computeWarning,
  detectCourierCompany,
  isOrderRefunded,
  normalizeOrderItems,
  normalizeOrderRecord,
  parseOrderMoneyValue,
  todayStr
} from '../../../orders/shared.ts';
import {
  buildExportFilename,
  buildExportRows,
  buildOrdersCsv,
  getExportAccountOptions
} from '../../../orders/export.ts';
import {
  buildOrderCourierSummary,
  deriveDisplayedOrders,
  derivePurchaseSummary,
  formatSummaryMetric,
  formatTableCellValue,
  formatTableMoneyValue,
  getProfitCellToneClass,
  isCreatorOrder
} from '../../../orders/table.ts';
import { ensureGlobalSettingsStore } from '../../../global-settings.ts';
import { TKShippingCore } from '../../../shipping-core.ts';
import { cn } from '@/lib/utils';
import {
  Copy,
  FileDown,
  HelpCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductRecord, ProductSku } from '../products/types';

type OrderRecord = Record<string, any>;

type OrderItemDraft = {
  lineId: string;
  productTkId: string;
  productSkuId: string;
  productSkuName: string;
  productName: string;
  quantity: string;
  unitSalePrice: string;
  unitPurchasePrice: string;
  unitWeightG: string;
  unitSizeText: string;
  useOrderCourier: null;
  courierCompany: string;
  trackingNo: string;
};

type OrderDraft = {
  accountName: string;
  orderNo: string;
  orderedAt: string;
  purchaseDate: string;
  latestWarehouseAt: string;
  warningText: string;
  isRefunded: boolean;
  salePrice: string;
  purchasePrice: string;
  estimatedShippingFee: string;
  estimatedProfit: string;
  creatorCommissionRate: string;
  creatorCommission: string;
  orderStatus: string;
  weightText: string;
  sizeText: string;
  items: OrderItemDraft[];
};

const LS_KEY = 'tk.orders.runtime.v1';
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
const UNASSIGNED_ACCOUNT_SLOT = '__unassigned__';
const ORDER_STATUS_OPTIONS = ['未采购', '已采购', '在途', '已入仓', '已送达', '已完成', '订单取消'];
const modalCopyClass = 'mb-4 text-[13px] leading-[1.75] text-[var(--muted)]';
const COURIER_AUTO_DETECTORS = [
  { name: '顺丰快递', test: (value: string) => /^SF[0-9A-Z]+$/i.test(value) || /^SFP[0-9A-Z]+$/i.test(value) },
  { name: '极兔快递', test: (value: string) => /^JT[0-9A-Z]+$/i.test(value) },
  { name: '中通快递', test: (value: string) => /^ZTO[0-9A-Z]+$/i.test(value) },
  { name: '圆通快递', test: (value: string) => /^YTO[0-9A-Z]+$/i.test(value) },
  { name: '申通快递', test: (value: string) => /^STO[0-9A-Z]+$/i.test(value) },
  { name: '韵达快递', test: (value: string) => /^YD[0-9A-Z]+$/i.test(value) },
  { name: '安能物流', test: (value: string) => /^ANE[0-9A-Z]+$/i.test(value) },
  { name: '邮政快递', test: (value: string) => /^EMS[0-9A-Z]+$/i.test(value) || /^[A-Z]{2}\d{9}CN$/i.test(value) }
];
const COURIER_OPTIONS = [
  '',
  '顺丰快递',
  '极兔快递',
  '中通快递',
  '圆通快递',
  '申通快递',
  '韵达快递',
  '邮政快递',
  '安能物流',
  '京东快递',
  '德邦快递',
  '百世快递',
  '其他'
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeAccountName(value: unknown) {
  return String(value || '').trim();
}

function uniqueAccounts(values: unknown[] = []) {
  return [...new Set(values.map(normalizeAccountName).filter(Boolean))];
}

function toAccountSlot(value: unknown) {
  return normalizeAccountName(value) || UNASSIGNED_ACCOUNT_SLOT;
}

function readGlobalConfig() {
  return TKFirestoreConnection.getConfig() || null;
}

function showToast(message: string, type: 'ok' | 'error' = 'ok') {
  showAppToast(message, type);
}

function clampPage(currentPage: number, pageSize: number, totalItems: number) {
  const safePageSize = Math.max(1, Number(pageSize) || 50);
  const totalPages = Math.max(1, Math.ceil((totalItems || 0) / safePageSize));
  const nextCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
  return { currentPage: nextCurrentPage, totalPages, pageSize: safePageSize };
}

function formatNumericValue(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toFixed(2).replace(/\.?0+$/, '');
}

function parseSizeText(value: unknown) {
  const parts = String(value || '')
    .replace(/[Xx＊*]/g, '×')
    .match(/\d+(?:\.\d+)?/g) || [];
  const [lengthCm, widthCm, heightCm] = parts.slice(0, 3);
  return {
    lengthCm: lengthCm || '',
    widthCm: widthCm || '',
    heightCm: heightCm || ''
  };
}

function getProductDefaults(product: ProductRecord | null = {}) {
  return product?.defaults && typeof product.defaults === 'object' ? product.defaults : product || {};
}

function getProductSkus(product: ProductRecord | null = {}) {
  return Array.isArray(product?.skus)
    ? product.skus.filter(sku => String(sku?.skuId || '').trim())
    : [];
}

function skuUsesProductDefaults(sku: ProductSku = {}) {
  if (sku.useProductDefaults === true) return true;
  if (sku.useProductDefaults === false) return false;
  return ![
    sku.weightG,
    sku.sizeText,
    sku.lengthCm,
    sku.widthCm,
    sku.heightCm,
    sku.estimatedShippingFee,
    sku.chargeWeightKg,
    sku.shippingNote
  ].some(value => String(value || '').trim());
}

function resolveProductSnapshotSource(product: ProductRecord | null, sku: ProductSku | null = null) {
  if (!product) return null;
  const defaults = getProductDefaults(product);
  if (!sku) return defaults;
  if (!skuUsesProductDefaults(sku)) return sku;
  return {
    ...defaults,
    ...sku,
    weightG: sku.weightG || defaults.weightG || '',
    lengthCm: sku.lengthCm || defaults.lengthCm || '',
    widthCm: sku.widthCm || defaults.widthCm || '',
    heightCm: sku.heightCm || defaults.heightCm || '',
    estimatedShippingFee: sku.estimatedShippingFee || defaults.estimatedShippingFee || '',
    chargeWeightKg: sku.chargeWeightKg || defaults.chargeWeightKg || '',
    shippingNote: sku.shippingNote || defaults.shippingNote || ''
  };
}

function formatProductSize(source: Record<string, any> | null) {
  if (!source) return '';
  const direct = String(source.sizeText || '').trim();
  if (direct) return direct.replace(/\*/g, '×');
  const values = [source.lengthCm, source.widthCm, source.heightCm].map(value => String(value || '').trim()).filter(Boolean);
  return values.length === 3 ? values.join('×') : '';
}

function createEmptyOrderItem(): OrderItemDraft {
  return {
    lineId: uid(),
    productTkId: '',
    productSkuId: '',
    productSkuName: '',
    productName: '',
    quantity: '1',
    unitSalePrice: '',
    unitPurchasePrice: '',
    unitWeightG: '',
    unitSizeText: '',
    useOrderCourier: null,
    courierCompany: '',
    trackingNo: ''
  };
}

function normalizeDraftItem(item: Partial<OrderItemDraft> = {}): OrderItemDraft {
  return {
    ...createEmptyOrderItem(),
    ...item,
    lineId: String(item.lineId || '').trim() || uid(),
    productTkId: String(item.productTkId || '').trim(),
    productSkuId: String(item.productSkuId || '').trim(),
    productSkuName: String(item.productSkuName || '').trim(),
    productName: String(item.productName || '').trim(),
    quantity: String(item.quantity || '1').trim() || '1',
    unitSalePrice: String(item.unitSalePrice || '').trim(),
    unitPurchasePrice: String(item.unitPurchasePrice || '').trim(),
    unitWeightG: String(item.unitWeightG || '').trim(),
    unitSizeText: String(item.unitSizeText || '').trim(),
    useOrderCourier: null,
    courierCompany: String(item.courierCompany || '').trim(),
    trackingNo: String(item.trackingNo || '').trim()
  };
}

function getOrderItemsFromOrder(order: OrderRecord | null): OrderItemDraft[] {
  const items = normalizeOrderItems(order?.items || []);
  if (items.length) {
    return items.map(item => normalizeDraftItem({
      lineId: item.lineId,
      productTkId: item.productTkId,
      productSkuId: item.productSkuId,
      productSkuName: item.productSkuName,
      productName: item.productName,
      quantity: String(item.quantity || '1'),
      unitSalePrice: item.unitSalePrice,
      unitPurchasePrice: item.unitPurchasePrice,
      unitWeightG: item.unitWeightG,
      unitSizeText: item.unitSizeText,
      courierCompany: item.courierCompany,
      trackingNo: item.trackingNo
    }));
  }
  if (!order) return [createEmptyOrderItem()];
  return [normalizeDraftItem({
    productTkId: order['商品TK ID'],
    productSkuId: order['商品SKU ID'],
    productSkuName: order['商品SKU名称'],
    productName: order['产品名称'],
    quantity: order['数量'],
    unitSalePrice: order['售价'],
    unitPurchasePrice: order['采购价格'],
    unitWeightG: order['重量'],
    unitSizeText: order['尺寸'],
    courierCompany: order['快递公司'],
    trackingNo: order['快递单号']
  })];
}

function buildDraftFromOrder(order: OrderRecord | null, activeAccount: string, accounts: string[]): OrderDraft {
  const orderedAt = String(order?.['下单时间'] || todayStr());
  const status = String(order?.['订单状态'] || '').trim();
  return {
    accountName: String(order?.['账号'] || (activeAccount !== '__all__' ? activeAccount : accounts[0] || '')),
    orderNo: String(order?.['订单号'] || ''),
    orderedAt,
    purchaseDate: String(order?.['采购日期'] || todayStr()),
    latestWarehouseAt: String(order?.['最晚到仓时间'] || (orderedAt ? addDays(orderedAt, 6) : '')),
    warningText: String(order?.['订单预警'] || ''),
    isRefunded: String(order?.['是否退款'] || '').trim() === '1',
    salePrice: String(order?.['售价'] || ''),
    purchasePrice: String(order?.['采购价格'] || ''),
    estimatedShippingFee: String(order?.['预估运费'] || ''),
    estimatedProfit: String(order?.['预估利润'] || ''),
    creatorCommissionRate: String(order?.['达人佣金率'] || ''),
    creatorCommission: String(order?.['达人佣金'] || ''),
    orderStatus: status,
    weightText: String(order?.['重量'] || ''),
    sizeText: String(order?.['尺寸'] || ''),
    items: getOrderItemsFromOrder(order)
  };
}

function computeItemTotals(items: OrderItemDraft[]) {
  return items.reduce((acc, item) => {
    const quantity = Number.parseInt(String(item.quantity || '').trim(), 10) || 0;
    const unitPurchase = parseOrderMoneyValue(item.unitPurchasePrice) || 0;
    const unitSale = parseOrderMoneyValue(item.unitSalePrice) || 0;
    const unitWeight = parseOrderMoneyValue(item.unitWeightG) || 0;
    return {
      quantity: acc.quantity + quantity,
      purchase: acc.purchase + unitPurchase * quantity,
      sale: acc.sale + unitSale * quantity,
      weight: acc.weight + unitWeight * quantity
    };
  }, { quantity: 0, purchase: 0, sale: 0, weight: 0 });
}

function findProduct(products: ProductRecord[], accountName: string, tkId: string) {
  const normalizedTkId = String(tkId || '').trim();
  if (!normalizedTkId) return null;
  const normalizedAccount = normalizeAccountName(accountName);
  return products.find(product => (
    String(product.tkId || '').trim() === normalizedTkId
    && (!normalizedAccount || normalizeAccountName(product.accountName) === normalizedAccount)
  )) || products.find(product => String(product.tkId || '').trim() === normalizedTkId) || null;
}

function computeEstimatedShipping(draft: OrderDraft, products: ProductRecord[]) {
  const pricingContext = ensureGlobalSettingsStore().getPricingContext();
  if (!pricingContext?.rate) return '';
  const actualWeight = parseOrderMoneyValue(draft.weightText);
  if (actualWeight === null || actualWeight <= 0) return '';
  const itemCargoTypes = draft.items.map(item => {
    const product = findProduct(products, draft.accountName, item.productTkId);
    const sku = product && item.productSkuId
      ? getProductSkus(product).find(row => String(row.skuId || '').trim() === item.productSkuId) || null
      : null;
    const source = resolveProductSnapshotSource(product, sku);
    return String(source?.cargoType || getProductDefaults(product || {})?.cargoType || '').trim();
  }).filter(Boolean);
  const cargoType = itemCargoTypes.includes('special') ? 'special' : 'general';
  const size = parseSizeText(draft.sizeText);
  const quote = TKShippingCore.computeShippingQuote({
    cargoType,
    actualWeight,
    length: size.lengthCm,
    width: size.widthCm,
    height: size.heightCm,
    rate: pricingContext.rate
  });
  const finalFee = TKShippingCore.computeCalculatedShippingCost({
    quote,
    multiplier: pricingContext.shippingMultiplier,
    labelFee: pricingContext.labelFee
  } as Parameters<typeof TKShippingCore.computeCalculatedShippingCost>[0]);
  return finalFee === null ? '' : formatNumericValue(finalFee);
}

function computeAutoFields(draft: OrderDraft, products: ProductRecord[]) {
  const items = draft.items.map(normalizeDraftItem);
  const totals = computeItemTotals(items);
  const latestWarehouseAt = draft.orderedAt ? addDays(draft.orderedAt, 6) : '';
  const singleSize = items.length === 1 ? items[0].unitSizeText : '';
  const weightText = totals.weight ? formatNumericValue(totals.weight) : draft.weightText;
  const sizeText = singleSize || draft.sizeText;
  const estimatedShippingFee = draft.estimatedShippingFee || computeEstimatedShipping({ ...draft, items, weightText, sizeText }, products);
  const tempOrder = {
    '下单时间': draft.orderedAt,
    '最晚到仓时间': latestWarehouseAt,
    '订单状态': draft.orderStatus
  };
  const warningText = computeWarning(tempOrder).text;
  const exchangeRate = ensureGlobalSettingsStore().getExchangeRate();
  const commission = computeOrderCreatorCommission({
    '售价': draft.salePrice,
    '达人佣金率': draft.creatorCommissionRate,
    '是否退款': draft.isRefunded ? '1' : ''
  }, exchangeRate);
  const profit = computeOrderEstimatedProfit({
    '售价': draft.salePrice,
    '采购价格': draft.purchasePrice || (totals.purchase ? formatNumericValue(totals.purchase) : ''),
    '预估运费': estimatedShippingFee,
    '达人佣金率': draft.creatorCommissionRate,
    '是否退款': draft.isRefunded ? '1' : ''
  }, exchangeRate);
  return {
    ...draft,
    items,
    latestWarehouseAt,
    warningText,
    purchasePrice: draft.purchasePrice || (totals.purchase ? formatNumericValue(totals.purchase) : ''),
    salePrice: draft.salePrice || (totals.sale ? formatNumericValue(totals.sale) : ''),
    weightText,
    sizeText,
    estimatedShippingFee,
    creatorCommission: commission === null ? '' : formatNumericValue(commission),
    estimatedProfit: profit === null ? '' : formatNumericValue(profit)
  };
}

function ProductCombo({
  value,
  accountName,
  products,
  onChange
}: {
  value: string;
  accountName: string;
  products: ProductRecord[];
  onChange: (value: string) => void;
}) {
  const filteredProducts = useMemo(() => {
    const normalizedAccount = normalizeAccountName(accountName);
    return products
      .filter(product => !normalizedAccount || normalizeAccountName(product.accountName) === normalizedAccount)
      .sort((left, right) => String(left.tkId || '').localeCompare(String(right.tkId || '')));
  }, [accountName, products]);
  const options = filteredProducts.map(product => {
    const tkId = String(product.tkId || '').trim();
    const name = String(product.name || '').trim() || '未命名商品';
    return {
      value: tkId,
      label: `${tkId} · ${name}`,
      searchLabel: `${tkId} ${name}`
    };
  }).filter(option => option.value);
  if (value && !options.some(option => option.value === value)) {
    options.push({ value, label: `${value}（已不存在）`, searchLabel: value });
  }
  return (
    <SearchableSelect
      hiddenField="productTkId"
      options={options}
      placeholder="- 不关联商品 -"
      role="product-combobox"
      searchPlaceholder="搜索商品ID / 名称"
      value={value}
      onChange={onChange}
    />
  );
}

function SkuCombo({
  value,
  product,
  onChange
}: {
  value: string;
  product: ProductRecord | null;
  onChange: (value: string) => void;
}) {
  const skus = getProductSkus(product || {});
  const options = skus.map(sku => {
    const skuId = String(sku.skuId || '').trim();
    const skuName = String(sku.skuName || '').trim() || skuId;
    return {
      value: skuId,
      label: `${skuName} · ${skuId}`,
      searchLabel: `${skuId} ${skuName}`
    };
  }).filter(option => option.value);
  if (value && !options.some(option => option.value === value)) {
    options.push({ value, label: `${value}（已不存在）`, searchLabel: value });
  }
  return (
    <SearchableSelect
      disabled={!product || !skus.length}
      hiddenField="productSkuId"
      options={options}
      placeholder={product && !skus.length ? '- 该商品没有 SKU -' : '- 请选择 SKU -'}
      role="sku-combobox"
      searchPlaceholder="搜索SKU ID / 名称"
      value={value}
      onChange={onChange}
    />
  );
}

const orderItemBlockClass = 'ot-item-block mt-2.5 mb-2 flex flex-col gap-3 overflow-visible';
const orderItemBlockHeadClass = 'ot-item-block-head flex items-end justify-between gap-[14px]';
const orderItemBlockCopyClass = 'ot-item-block-copy mt-1 text-xs leading-[1.55] text-[var(--muted)]';
const orderItemListClass = 'ot-item-list flex flex-col gap-2 overflow-visible';
const orderItemRowClass = 'ot-item-edit-row relative grid grid-cols-12 gap-2 rounded-[14px] border border-[color-mix(in_srgb,var(--border)_88%,white)] bg-[color-mix(in_srgb,var(--panel)_96%,white)] py-3 pl-3 pr-11';
const orderItemRemoveClass = 'ot-item-remove absolute right-2.5 top-2.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-[18px] leading-none text-[color-mix(in_srgb,var(--expense)_84%,white)] transition-[background,color] hover:bg-[color-mix(in_srgb,var(--expense)_10%,white)] hover:text-[var(--expense)]';
const orderItemFieldClass = 'ot-item-field ot-item-span-3 col-span-3 min-w-0';
const orderItemLabelClass = 'min-h-0 !text-[10.5px] !leading-[1.2] tracking-[.04em]';
const orderItemInputClass = '!h-10 !min-h-10 text-center';
const orderItemSelectClass = '!h-10 !min-h-10 rounded-[10px] border-[color-mix(in_srgb,var(--border)_82%,white)] bg-[color-mix(in_srgb,var(--panel2)_38%,white)] px-3 text-center';
const orderItemInlineActionsClass = 'ot-item-inline-actions ml-1.5 inline-flex items-center gap-1.5';
const orderItemInlineButtonClass = 'ot-item-inline-btn ot-item-copy-btn inline-flex h-4 w-4 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[var(--accent)] hover:text-[color-mix(in_srgb,var(--accent)_82%,black)] [&_svg]:h-3.5 [&_svg]:w-3.5';
const orderInlineHintClass = 'ot-inline-hint ml-1.5 inline whitespace-nowrap text-[11px] font-medium text-[var(--muted)]';
const orderMoneyRowClass = 'quint ot-money-row-top mt-[18px] !grid-cols-[minmax(72px,84px)_repeat(4,minmax(0,1fr))] max-[768px]:mt-3';
const orderMetaRowClass = 'quad ot-meta-row mt-[18px] !grid-cols-4 max-[768px]:mt-3';
const orderRefundToggleClass = 'ot-refund-toggle flex min-h-10 w-[76px] cursor-pointer items-center justify-start bg-transparent p-0';
const orderRefundInputClass = 'absolute opacity-0 pointer-events-none';
const orderRefundKnobClass = 'ot-refund-toggle-knob relative h-10 w-[76px] flex-none rounded-full bg-[color-mix(in_srgb,var(--panel2)_84%,white_16%)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--line)_88%,white_12%)] transition-[background-color,box-shadow,transform] after:absolute after:left-1 after:top-1 after:h-8 after:w-8 after:rounded-full after:bg-white after:shadow-[0_1px_4px_rgba(15,23,42,.18)] after:transition-[left] group-hover:bg-[color-mix(in_srgb,var(--panel2)_74%,white_26%)]';
const orderRefundKnobCheckedClass = 'bg-[linear-gradient(135deg,#f0b1b1,#de6a6a)] shadow-[inset_0_0_0_1px_rgba(196,78,78,.18)] after:left-[calc(100%-36px)]';
const orderSaleFieldClass = 'ot-sale-field';
const orderSaleInputWrapClass = 'ot-sale-input-wrap relative';
const orderSaleInputRefundClass = 'ot-sale-input-refund pointer-events-none absolute inset-0 hidden items-center justify-between gap-2.5 rounded-xl bg-[color-mix(in_srgb,#fff5f5_78%,var(--panel2)_22%)] px-3 shadow-[inset_0_0_0_1px_rgba(196,78,78,.16)]';
const orderSaleInputOriginalClass = 'ot-sale-input-original tabular-nums text-[var(--muted)] line-through decoration-[1.2px]';
const orderSaleInputZeroClass = 'ot-sale-input-zero tabular-nums font-bold text-[#c44e4e]';
const orderSaleCellClass = 'ot-sale-cell inline-flex w-full flex-col items-center gap-0.5 text-center';
const orderSaleCurrentClass = 'ot-sale-current font-semibold text-[#c44e4e]';
const orderOrderNoCellClass = 'ot-order-no-cell inline-flex min-w-0 flex-nowrap items-center gap-1.5';
const orderOrderNoTextClass = 'ot-order-no-text min-w-0';
const orderTagClass = 'ot-order-tag ot-order-tag-creator inline-flex h-[18px] items-center justify-center whitespace-nowrap rounded-full border border-[rgba(196,78,78,.22)] bg-[rgba(196,78,78,.12)] px-[7px] text-[10.5px] font-bold leading-none tracking-[.04em] text-[#b5525e] opacity-[.98]';
const orderSetupCardClass = 'ot-setup mx-auto max-w-[880px]';
const orderHeaderRowClass = 'ot-header-row mb-3.5 last:mb-0';
const orderSummaryContainerClass = 'mb-0';
const orderSummarySurfaceClass = 'ot-summary-surface rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(110,168,255,.07),rgba(138,255,207,.04))] px-0 py-[18px] max-[768px]:p-4';
const orderSummaryGridClass = 'ot-summary-grid relative grid grid-cols-2 gap-0 after:pointer-events-none after:absolute after:bottom-1.5 after:left-1/2 after:top-1.5 after:w-px after:-translate-x-1/2 after:bg-[color-mix(in_srgb,var(--border)_86%,white)] max-[768px]:grid-cols-1 max-[768px]:gap-3.5 max-[768px]:after:hidden max-[640px]:gap-3';
const orderSummarySectionClass = 'ot-summary-section min-w-0 px-[38px] pb-0.5 pt-1 max-[768px]:px-0 max-[768px]:py-0 [&+&]:border-l-0 max-[768px]:[&+&]:border-t max-[768px]:[&+&]:border-[color-mix(in_srgb,var(--border)_86%,white)] max-[768px]:[&+&]:pt-4';
const orderSummaryHeadClass = 'ot-summary-head flex items-start justify-between gap-3 max-[768px]:flex-col max-[768px]:gap-1';
const orderSummaryLabelClass = 'ot-summary-label text-[11.5px] font-semibold uppercase tracking-[.7px] text-[var(--muted)]';
const orderSummaryMetaClass = 'ot-summary-meta-inline text-right text-xs leading-[1.45] text-[var(--muted)] max-[768px]:text-left';
const orderSummaryHeroClass = 'ot-summary-hero mt-[18px] flex items-baseline justify-between gap-4 border-l-[3px] border-[color-mix(in_srgb,var(--accent)_50%,var(--border))] pl-4';
const orderSummaryHeroLabelClass = 'ot-summary-hero-label block flex-1 text-[13px] leading-normal text-[color-mix(in_srgb,var(--muted)_86%,var(--text))]';
const orderSummaryHeroValueClass = 'ot-summary-hero-value block flex-none text-right text-3xl font-extrabold leading-[1.05] tracking-normal text-[var(--text)] max-[640px]:text-[22px]';
const orderSummaryLedgerClass = 'ot-summary-ledger mt-[18px] grid grid-cols-[minmax(150px,.82fr)_minmax(230px,1.18fr)] gap-x-12 gap-y-3 border-t border-[color-mix(in_srgb,var(--border)_82%,white)] pt-3.5 max-[900px]:grid-cols-[minmax(140px,.9fr)_minmax(210px,1.1fr)] max-[900px]:gap-x-7 max-[640px]:grid-cols-1';
const orderSummaryLedgerItemClass = 'ot-summary-ledger-item min-w-0';
const orderSummaryLedgerIncomeClass = cn(orderSummaryLedgerItemClass, 'is-income');
const orderSummaryLedgerExpenseClass = cn(orderSummaryLedgerItemClass, 'is-expense');
const orderSummaryLedgerLabelClass = 'ot-summary-ledger-label block text-[10.5px] uppercase tracking-[.18em] text-[var(--muted)]';
const orderSummaryLedgerValueClass = 'ot-summary-ledger-value mt-[7px] block text-lg font-bold leading-[1.15] text-[var(--text)]';
const orderSummaryLedgerIncomeValueClass = cn(orderSummaryLedgerValueClass, 'text-[var(--ok)]');
const orderSummaryLedgerExpenseValueClass = cn(orderSummaryLedgerValueClass, 'text-[var(--expense)]');
const orderSummaryLedgerNoteClass = 'ot-summary-ledger-note mt-[7px] block text-[10.5px] leading-[1.35] tracking-normal text-[var(--muted)]';

function orderSummaryHeroClassForMetric(metric: any) {
  if (metric?.total > 0) return cn(orderSummaryHeroClass, 'is-profit-positive border-[color-mix(in_srgb,var(--ok)_82%,var(--border))]');
  if (metric?.total < 0) return cn(orderSummaryHeroClass, 'is-profit-negative border-[color-mix(in_srgb,var(--expense)_84%,var(--border))]');
  return cn(orderSummaryHeroClass, 'is-neutral');
}

function orderSummaryHeroValueClassForMetric(metric: any) {
  if (metric?.total > 0) return cn(orderSummaryHeroValueClass, 'text-[var(--ok)]');
  if (metric?.total < 0) return cn(orderSummaryHeroValueClass, 'text-[var(--expense)]');
  return orderSummaryHeroValueClass;
}

function getProfitValueClass(tone: string) {
  return cn(
    `ot-profit-value is-${tone}`,
    tone === 'profit-positive' ? 'font-bold text-[var(--ok)]' : '',
    tone === 'profit-negative' ? 'font-bold text-[var(--expense)]' : ''
  );
}

function OrderNoCell({ order }: { order: OrderRecord }) {
  const orderNo = formatTableCellValue(order['订单号']);
  const tags = [
    isCreatorOrder(order) ? { key: 'creator', label: '达人', title: '达人带货订单' } : null,
    isOrderRefunded(order) ? { key: 'refund', label: '退款', title: '退款订单' } : null
  ].filter(Boolean) as { key: string; label: string; title: string }[];
  if (!tags.length) return <>{orderNo}</>;
  return (
    <span className={orderOrderNoCellClass}>
      <span className={orderOrderNoTextClass}>{orderNo}</span>
      {tags.map(tag => (
        <span className={orderTagClass} title={tag.title} aria-label={tag.title} key={tag.key}>{tag.label}</span>
      ))}
    </span>
  );
}

function SaleCell({ order }: { order: OrderRecord }) {
  const saleText = String(order['售价'] ?? '').trim();
  if (!saleText) return <>-</>;
  if (!isOrderRefunded(order)) return <>{formatTableCellValue(saleText)}</>;
  return (
    <span className={orderSaleCellClass}>
      <span className={orderSaleCurrentClass}>0</span>
      <span className={orderSaleInputOriginalClass}>{saleText}</span>
    </span>
  );
}

function OrderItemsEditor({
  draft,
  products,
  onDraftChange
}: {
  draft: OrderDraft;
  products: ProductRecord[];
  onDraftChange: (draft: OrderDraft) => void;
}) {
  function updateItem(index: number, patch: Partial<OrderItemDraft>) {
    const nextItems = draft.items.map((item, currentIndex) => (
      currentIndex === index ? normalizeDraftItem({ ...item, ...patch }) : item
    ));
    onDraftChange(computeAutoFields({ ...draft, items: nextItems }, products));
  }

  function handleProductChange(index: number, productTkId: string) {
    const product = findProduct(products, draft.accountName, productTkId);
    updateItem(index, {
      productTkId,
      productSkuId: '',
      productSkuName: '',
      productName: product ? String(product.name || '').trim() : '',
      unitWeightG: '',
      unitSizeText: ''
    });
  }

  function handleSkuChange(index: number, productTkId: string, skuId: string) {
    const product = findProduct(products, draft.accountName, productTkId);
    const sku = product ? getProductSkus(product).find(item => String(item.skuId || '').trim() === skuId) || null : null;
    const source = resolveProductSnapshotSource(product, sku);
    updateItem(index, {
      productSkuId: skuId,
      productSkuName: sku ? String(sku.skuName || '').trim() : '',
      unitWeightG: source?.weightG ? String(source.weightG) : '',
      unitSizeText: formatProductSize(source)
    });
  }

  return (
    <div className={orderItemListClass} id="ot-item-list">
      {draft.items.map((item, index) => {
        const product = findProduct(products, draft.accountName, item.productTkId);
        return (
          <div className={orderItemRowClass} data-line-id={item.lineId} key={item.lineId}>
            <button
              type="button"
              className={orderItemRemoveClass}
              data-item-action="remove"
              aria-label="删除明细"
              title="删除明细"
              onClick={() => {
                const nextItems = draft.items.filter((_, currentIndex) => currentIndex !== index);
                onDraftChange(computeAutoFields({ ...draft, items: nextItems.length ? nextItems : [createEmptyOrderItem()] }, products));
              }}
            >
              ×
            </button>
            <FormField label="关联商品" labelClassName={orderItemLabelClass} className={orderItemFieldClass}>
              <ProductCombo value={item.productTkId} accountName={draft.accountName} products={products} onChange={value => handleProductChange(index, value)} />
            </FormField>
            <FormField label="关联SKU" labelClassName={orderItemLabelClass} className={orderItemFieldClass}>
              <SkuCombo value={item.productSkuId} product={product} onChange={value => handleSkuChange(index, item.productTkId, value)} />
              <input type="hidden" data-item-field="productSkuName" value={item.productSkuName} readOnly />
            </FormField>
            <FormField label="商品名称" labelClassName={orderItemLabelClass} className={orderItemFieldClass}>
              <Input density="skuInline" className={orderItemInputClass} data-item-field="productName" value={item.productName} onChange={event => updateItem(index, { productName: event.target.value })} />
            </FormField>
            <FormField label="快递公司" labelClassName={orderItemLabelClass} className={orderItemFieldClass}>
              <Select className={orderItemSelectClass} data-item-field="courierCompany" value={item.courierCompany} onChange={event => updateItem(index, { courierCompany: event.target.value })}>
                {COURIER_OPTIONS.map(option => <option value={option} key={option}>{option || '- 未填写 -'}</option>)}
              </Select>
            </FormField>
            <FormField label="数量" labelClassName={orderItemLabelClass} className={orderItemFieldClass}>
              <Input density="skuInline" type="number" className={orderItemInputClass} data-item-field="quantity" min="1" step="1" value={item.quantity} onChange={event => updateItem(index, { quantity: event.target.value })} />
            </FormField>
            <FormField label="单件重量(g)" labelClassName={orderItemLabelClass} className={orderItemFieldClass}>
              <Input density="skuInline" className={orderItemInputClass} data-item-field="unitWeightG" value={item.unitWeightG} onChange={event => updateItem(index, { unitWeightG: event.target.value })} />
            </FormField>
            <FormField label="单件尺寸(cm)" labelClassName={orderItemLabelClass} className={orderItemFieldClass}>
              <Input density="skuInline" className={orderItemInputClass} data-item-field="unitSizeText" value={item.unitSizeText} placeholder="20×15×10" onChange={event => updateItem(index, { unitSizeText: event.target.value })} />
            </FormField>
            <FormField
              className={orderItemFieldClass}
              labelClassName={orderItemLabelClass}
              label={
                <>
                快递单号
                <span className={orderItemInlineActionsClass}>
                  <button
                    type="button"
                    className={orderItemInlineButtonClass}
                    data-item-action="copy-tracking"
                    aria-label="复制当前明细快递单号"
                    title="复制当前明细快递单号"
                    onClick={() => {
                      if (!item.trackingNo) {
                        showToast('这条明细还没有快递单号', 'error');
                        return;
                      }
                      void TKFirestoreConnection.copyText(item.trackingNo).then(() => showToast('已复制快递单号')).catch(() => showToast('复制失败，请手动复制', 'error'));
                    }}
                  >
                    <Copy size={14} strokeWidth={2} />
                  </button>
                </span>
                </>
              }
            >
              <Input
                density="skuInline"
                className={orderItemInputClass}
                data-item-field="trackingNo"
                value={item.trackingNo}
                placeholder="填写这一条明细的单号"
                onChange={event => {
                  const trackingNo = event.target.value;
                  const detected = detectCourierCompany(trackingNo, COURIER_AUTO_DETECTORS);
                  updateItem(index, { trackingNo, courierCompany: detected || item.courierCompany });
                }}
              />
            </FormField>
          </div>
        );
      })}
    </div>
  );
}

function ProductPager({
  pageSize,
  currentPage,
  totalPages,
  onPageSizeChange,
  onPageChange
}: {
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onPageSizeChange: (value: number) => void;
  onPageChange: (delta: number) => void;
}) {
  return (
    <TablePager
      pageSize={pageSize}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageSizeChange={onPageSizeChange}
      onPageChange={onPageChange}
    />
  );
}

function OrdersSummary({
  orders,
  activeAccount,
  searchQuery,
  sortOrder,
  exchangeRate
}: {
  orders: OrderRecord[];
  activeAccount: string;
  searchQuery: string;
  sortOrder: string;
  exchangeRate: number | null;
}) {
  const summary = derivePurchaseSummary({
    orders,
    activeAccount,
    searchQuery,
    sortOrder,
    exchangeRate,
    computeOrderCreatorCommission,
    computeOrderEstimatedProfit
  } as Parameters<typeof derivePurchaseSummary>[0]);
  const expenseValue = (summary.filteredTotal || 0) + (summary.filteredShippingTotal || 0) + (summary.filteredCreatorCommissionTotal || 0);
  const allExpenseValue = (summary.allTotal || 0) + (summary.allShippingTotal || 0) + (summary.allCreatorCommissionTotal || 0);

  function buildIncomeNote(grossMetric: any, refundMetric: any) {
    if (!refundMetric?.count) return `销售 ${formatSummaryMetric(grossMetric)}`;
    return `销售 ${formatSummaryMetric(grossMetric)} - 退款 ${formatSummaryMetric(refundMetric)}`;
  }

  function buildExpenseNote(purchaseMetric: any, shippingMetric: any, creatorCommissionMetric: any) {
    return `采购 ${formatSummaryMetric(purchaseMetric)} · 运费 ${formatSummaryMetric(shippingMetric)} · 达人 ${formatSummaryMetric(creatorCommissionMetric)}`;
  }

  function buildSummaryMeta(prefix: string, count: number, refundMetric: any) {
    return `${prefix} · 共 ${count} 条${refundMetric?.count ? ` · 含 ${refundMetric.count} 条退款` : ''}`;
  }

  function card(
    title: string,
    profitMetric: any,
    saleMetric: any,
    grossMetric: any,
    refundMetric: any,
    purchaseMetric: any,
    shippingMetric: any,
    creatorCommissionMetric: any,
    expenseTotal: number,
    count: number,
    meta: string
  ) {
    return (
      <section className={orderSummarySectionClass}>
        <div className={orderSummaryHeadClass}>
          <div className={orderSummaryLabelClass}>{title}</div>
          <div className={orderSummaryMetaClass}>{meta}</div>
        </div>
        <div className={orderSummaryHeroClassForMetric(profitMetric)}>
          <span className={orderSummaryHeroLabelClass}>预估总利润</span>
          <strong className={orderSummaryHeroValueClassForMetric(profitMetric)}>{formatSummaryMetric(profitMetric)}</strong>
        </div>
        <div className={orderSummaryLedgerClass}>
          <div className={orderSummaryLedgerIncomeClass}>
            <span className={orderSummaryLedgerLabelClass}>收入</span>
            <strong className={orderSummaryLedgerIncomeValueClass}>{formatSummaryMetric(saleMetric)}</strong>
            <span className={orderSummaryLedgerNoteClass}>{buildIncomeNote(grossMetric, refundMetric)}</span>
          </div>
          <div className={orderSummaryLedgerExpenseClass}>
            <span className={orderSummaryLedgerLabelClass}>支出</span>
            <strong className={orderSummaryLedgerExpenseValueClass}>{count ? `¥ ${expenseTotal.toFixed(2)}` : '-'}</strong>
            <span className={orderSummaryLedgerNoteClass}>{buildExpenseNote(purchaseMetric, shippingMetric, creatorCommissionMetric)}</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className={orderSummarySurfaceClass}>
      <div className={orderSummaryGridClass}>
        {card(
          activeAccount !== '__all__' || searchQuery ? `当前筛选${activeAccount !== '__all__' ? ` · 账号：${activeAccount}` : ''}${searchQuery ? ` · 搜索：${searchQuery}` : ''}` : '当前筛选',
          summary.filteredProfitMetric,
          summary.filteredSaleMetric,
          summary.filteredGrossSaleMetric,
          summary.filteredRefundMetric,
          summary.filteredPurchaseMetric,
          summary.filteredShippingMetric,
          summary.filteredCreatorCommissionMetric,
          expenseValue,
          summary.filteredCount,
          buildSummaryMeta('受账号标签和搜索影响', summary.filteredCount, summary.filteredRefundMetric)
        )}
        {card(
          '全部订单',
          summary.allProfitMetric,
          summary.allSaleMetric,
          summary.allGrossSaleMetric,
          summary.allRefundMetric,
          summary.allPurchaseMetric,
          summary.allShippingMetric,
          summary.allCreatorCommissionMetric,
          allExpenseValue,
          summary.allCount,
          buildSummaryMeta('不受账号、搜索、分页影响', summary.allCount, summary.allRefundMetric)
        )}
      </div>
    </div>
  );
}

function OrdersTable({
  orders,
  activeAccount,
  searchQuery,
  sortOrder,
  pageSize,
  currentPage,
  exchangeRate,
  onSearchChange,
  onPageSizeChange,
  onPageChange,
  onSortToggle,
  onEdit,
  onDelete
}: {
  orders: OrderRecord[];
  activeAccount: string;
  searchQuery: string;
  sortOrder: string;
  pageSize: number;
  currentPage: number;
  exchangeRate: number | null;
  onSearchChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  onPageChange: (delta: number) => void;
  onSortToggle: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { isAll, sorted } = useMemo(() => deriveDisplayedOrders({ orders, activeAccount, searchQuery, sortOrder }), [activeAccount, orders, searchQuery, sortOrder]);
  const pageState = clampPage(currentPage, pageSize, sorted.length);
  const startIndex = (pageState.currentPage - 1) * pageState.pageSize;
  const paged = sorted.slice(startIndex, startIndex + pageState.pageSize);
  const sortIcon = sortOrder === 'asc' ? '↑' : '↓';
  const sortTitle = sortOrder === 'asc' ? '当前正序（最早在上），点击切换' : '当前倒序（最新在上），点击切换';

  return (
    <>
      <div id="ot-table-toolbar-container">
        <TableToolbar
          left={(
            <TableSearch
              id="ot-table-search-input"
              hint="搜索下单时间 / 订单号 / 产品 / 快递"
              value={searchQuery}
              onChange={onSearchChange}
            />
          )}
          right={(
            <ProductPager pageSize={pageState.pageSize} currentPage={pageState.currentPage} totalPages={pageState.totalPages} onPageSizeChange={onPageSizeChange} onPageChange={onPageChange} />
          )}
        />
      </div>
      <TableViewport>
        <div id="ot-table-container">
          {!sorted.length ? (
            <EmptyState
              title={searchQuery ? '没有匹配的订单' : activeAccount !== '__all__' ? `账号「${activeAccount}」下还没有订单` : '还没有订单'}
              description={searchQuery ? '试试更换关键词' : '点击右上角「+ 新增订单」开始记录'}
            />
          ) : (
            <TableFrame>
              <Table className="orders-react-table mt-1.5 min-w-[1100px] text-[13px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap [&_tbody_tr.is-refunded:hover]:bg-[rgba(196,78,78,.09)] [&_tbody_tr.is-refunded]:bg-[rgba(196,78,78,.055)] [&_tbody_tr:hover]:bg-[rgba(110,168,255,.05)] max-[768px]:text-[13px] max-[768px]:[&_td]:px-1.5 max-[768px]:[&_td]:py-[9px] max-[768px]:[&_th]:px-1.5 max-[768px]:[&_th]:py-[9px] max-[768px]:[&_th]:text-[10.5px]">
                <TableHeader>
                  <TableRow>
                    <TableHead><TableSortButton id="ot-sort-btn" className="orders-react-sort" title={sortTitle} onClick={onSortToggle}># {sortIcon}</TableSortButton></TableHead>
                    {isAll ? <TableHead>账号</TableHead> : null}
                    <TableHead>下单时间</TableHead>
                    <TableHead>采购日期</TableHead>
                    <TableHead>最晚到仓</TableHead>
                    <TableHead>订单预警</TableHead>
                    <TableHead>订单号</TableHead>
                    <TableHead>产品名称</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>总售价(円)</TableHead>
                    <TableHead>总采购额(¥)</TableHead>
                    <TableHead>预估总海外运费(¥)</TableHead>
                    <TableHead>预估总利润(¥)</TableHead>
                    <TableHead>总重量</TableHead>
                    <TableHead>总尺寸</TableHead>
                    <TableHead>订单状态</TableHead>
                    <TableHead>快递公司</TableHead>
                    <TableHead>快递单号</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((order, index) => {
                    const absoluteIndex = startIndex + index;
                    const seqNum = sortOrder === 'asc' ? absoluteIndex + 1 : sorted.length - absoluteIndex;
                    const warn = computeWarning(order);
                    const profit = computeOrderEstimatedProfit(order, exchangeRate);
                    const courierSummary = buildOrderCourierSummary(order, 'company', 'full');
                    const trackingSummary = buildOrderCourierSummary(order, 'tracking', 'full');
                    const warningTone = badgeToneMap[(warn.cls || 'muted') as keyof typeof badgeToneMap] || 'default';
                    return (
                      <TableRow key={String(order.id)} className={isOrderRefunded(order) ? 'is-refunded' : undefined}>
                        <TableCell className="text-[var(--muted)]">{seqNum}</TableCell>
                        {isAll ? <TableCell><Badge>{formatTableCellValue(order['账号'])}</Badge></TableCell> : null}
                        <TableCell>{formatTableCellValue(order['下单时间'])}</TableCell>
                        <TableCell>{formatTableCellValue(order['采购日期'])}</TableCell>
                        <TableCell>{formatTableCellValue(order['最晚到仓时间'])}</TableCell>
                        <TableCell><Badge variant={warningTone}>{warn.text || '-'}</Badge></TableCell>
                        <TableCell><OrderNoCell order={order} /></TableCell>
                        <TableCell className="orders-react-product-cell" title={String(order['产品名称'] || '')}>{formatTableCellValue(order['产品名称'])}</TableCell>
                        <TableCell>{formatTableCellValue(order['数量'])}</TableCell>
                        <TableCell><SaleCell order={order} /></TableCell>
                        <TableCell>{formatTableCellValue(order['采购价格'])}</TableCell>
                        <TableCell>{formatTableCellValue(order['预估运费'])}</TableCell>
                        <TableCell><span className={getProfitValueClass(getProfitCellToneClass(profit))}>{formatTableMoneyValue(profit) || '-'}</span></TableCell>
                        <TableCell>{formatTableCellValue(order['重量'])}</TableCell>
                        <TableCell>{formatTableCellValue(order['尺寸'])}</TableCell>
                        <TableCell>{formatTableCellValue(order['订单状态'])}</TableCell>
                        <TableCell title={courierSummary}>{formatTableCellValue(courierSummary)}</TableCell>
                        <TableCell title={trackingSummary}>{formatTableCellValue(trackingSummary)}</TableCell>
                        <TableCell>
                          <Button size="sm" data-edit={String(order.id)} onClick={() => onEdit(String(order.id))}>编辑</Button>
                          <Button size="sm" variant="danger" data-del={String(order.id)} onClick={() => onDelete(String(order.id))}>删除</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableFrame>
          )}
        </div>
      </TableViewport>
      <div id="ot-table-footer-toolbar-container">
        <TableToolbar
          bottom
          right={(
            <ProductPager pageSize={pageState.pageSize} currentPage={pageState.currentPage} totalPages={pageState.totalPages} onPageSizeChange={onPageSizeChange} onPageChange={onPageChange} />
          )}
        />
      </div>
    </>
  );
}

function OrderModal({
  open,
  draft,
  accounts,
  products,
  editingId,
  onOpenChange,
  onDraftChange,
  onSubmit,
  onAddAccount
}: {
  open: boolean;
  draft: OrderDraft;
  accounts: string[];
  products: ProductRecord[];
  editingId: string;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: OrderDraft) => void;
  onSubmit: () => void;
  onAddAccount: () => void;
}) {
  function updateDraft(patch: Partial<OrderDraft>, auto = true) {
    const next = { ...draft, ...patch };
    onDraftChange(auto ? computeAutoFields(next, products) : next);
  }

  return (
    <Dialog id="ot-modal" open={open} onOpenChange={onOpenChange} titleId="ot-modal-title">
      <DialogContent className="max-w-[880px]">
        <DialogTitle id="ot-modal-title">{editingId ? '编辑订单' : '新增订单'}</DialogTitle>
        <form id="ot-form" autoComplete="off" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
          <FormRow>
            <FormField label="账号 *">
              <Select name="账号" id="ot-acc-select" required value={draft.accountName} onChange={event => {
                if (event.target.value === '__ADD__') {
                  onAddAccount();
                  return;
                }
                updateDraft({ accountName: event.target.value });
              }}>
                <option value="">- 请选择 -</option>
                {accounts.map(account => <option value={account} key={account}>{account}</option>)}
                <option value="__ADD__">+ 添加账号</option>
              </Select>
            </FormField>
            <FormField label="订单号 *">
              <Input name="订单号" required value={draft.orderNo} onChange={event => updateDraft({ orderNo: event.target.value }, false)} />
            </FormField>
          </FormRow>
          <FormRow columns={3} className="triple mt-[18px] max-[768px]:mt-3">
            <FormField label="下单时间 *">
              <Input type="date" name="下单时间" required value={draft.orderedAt} onChange={event => updateDraft({ orderedAt: event.target.value })} />
            </FormField>
            <FormField label="采购日期">
              <Input type="date" name="采购日期" value={draft.purchaseDate} onChange={event => updateDraft({ purchaseDate: event.target.value }, false)} />
            </FormField>
            <FormField label={<>最晚到仓时间 <InlineToken>自动</InlineToken></>}>
              <Input type="date" name="最晚到仓时间" readOnly value={draft.latestWarehouseAt} />
            </FormField>
          </FormRow>
          <section className={orderItemBlockClass}>
            <div className={orderItemBlockHeadClass}>
              <div>
                <h4 className="m-0 text-sm">订单明细</h4>
                <div className={orderItemBlockCopyClass}>一个 TK 订单可以包含多个商品和多个 SKU；每条订单明细对应一个商品的一个 SKU。</div>
              </div>
              <Button id="ot-add-item-btn" onClick={() => onDraftChange(computeAutoFields({ ...draft, items: [...draft.items, createEmptyOrderItem()] }, products))}>+ 添加明细</Button>
            </div>
            <OrderItemsEditor draft={draft} products={products} onDraftChange={onDraftChange} />
            <input type="hidden" name="商品TK ID" id="ot-product-select" value={draft.items.length === 1 ? draft.items[0].productTkId : ''} readOnly />
            <input type="hidden" name="商品SKU ID" id="ot-sku-select" value={draft.items.length === 1 ? draft.items[0].productSkuId : ''} readOnly />
            <input type="hidden" name="商品SKU名称" id="ot-sku-name" value={draft.items.length === 1 ? draft.items[0].productSkuName : ''} readOnly />
            <input type="hidden" name="产品名称" id="ot-product-name-hidden" value={buildOrderItemsSummary(draft.items)} readOnly />
            <input type="hidden" name="数量" id="ot-total-quantity-hidden" value={computeItemTotals(draft.items).quantity || ''} readOnly />
          </section>
          <FormRow columns={3} className="triple">
            <FormField label="总件数">
              <Input id="ot-total-quantity" readOnly value={computeItemTotals(draft.items).quantity || ''} />
            </FormField>
            <FormField label={<>总重量(g) <span className={orderInlineHintClass} id="ot-weight-hint">{computeItemTotals(draft.items).quantity > 1 ? '已按各 SKU 单件重量 × 数量汇总' : ''}</span></>}>
              <Input name="重量" value={draft.weightText} onChange={event => updateDraft({ weightText: event.target.value })} />
            </FormField>
            <FormField label={<>总尺寸(cm) <span className={orderInlineHintClass}>多个订单明细时请自行调整尺寸</span></>}>
              <Input name="尺寸" value={draft.sizeText} onChange={event => updateDraft({ sizeText: event.target.value })} />
            </FormField>
          </FormRow>
          <FormRow columns={5} className={orderMoneyRowClass}>
            <FormField label="是否退款" className="ot-refund-field">
              <label className={cn('group', orderRefundToggleClass)}>
                <input className={orderRefundInputClass} type="checkbox" id="ot-is-refunded" name="是否退款" value="1" checked={draft.isRefunded} onChange={event => updateDraft({ isRefunded: event.target.checked })} />
                <span className={cn(orderRefundKnobClass, draft.isRefunded ? orderRefundKnobCheckedClass : '')} aria-hidden="true"></span>
              </label>
            </FormField>
            <FormField label="总售价（日元）" className={cn(orderSaleFieldClass, draft.isRefunded ? 'is-refunded' : '')}>
              <div className={orderSaleInputWrapClass}>
                <Input className={draft.isRefunded ? 'opacity-0 pointer-events-none' : ''} type="number" id="ot-total-sale" name="售价" min="0" step="0.01" readOnly={draft.isRefunded} value={draft.salePrice} onChange={event => updateDraft({ salePrice: event.target.value })} />
                <div className={cn(orderSaleInputRefundClass, draft.isRefunded ? 'flex' : '')} aria-hidden="true">
                  <span className={orderSaleInputOriginalClass}>{draft.salePrice || '-'}</span>
                  <span className={orderSaleInputZeroClass}>0</span>
                </div>
              </div>
            </FormField>
            <FormField label="总采购额（元）">
              <Input type="number" id="ot-total-purchase" name="采购价格" min="0" step="0.01" value={draft.purchasePrice} onChange={event => updateDraft({ purchasePrice: event.target.value })} />
            </FormField>
            <FormField label="预估总海外运费（元）">
              <Input type="number" name="预估运费" min="0" step="0.01" value={draft.estimatedShippingFee} onChange={event => updateDraft({ estimatedShippingFee: event.target.value })} />
            </FormField>
            <FormField label={<>预估利润（人民币） <InlineToken>自动</InlineToken></>}>
              <Input type="number" name="预估利润" step="0.01" readOnly value={draft.estimatedProfit} />
            </FormField>
          </FormRow>
          <FormRow columns={4} className={orderMetaRowClass}>
            <FormField label="达人佣金率（%）">
              <Input type="number" name="达人佣金率" min="0" step="0.01" value={draft.creatorCommissionRate} onChange={event => updateDraft({ creatorCommissionRate: event.target.value })} />
            </FormField>
            <FormField label={<>达人佣金（元） <InlineToken>自动</InlineToken></>}>
              <Input type="number" name="达人佣金" step="0.01" readOnly value={draft.creatorCommission} />
            </FormField>
            <FormField label="订单状态">
              <Select name="订单状态" value={draft.orderStatus} onChange={event => updateDraft({ orderStatus: event.target.value })}>
                <option value="">- 请选择 -</option>
                {ORDER_STATUS_OPTIONS.map(status => <option value={status} key={status}>{status}</option>)}
              </Select>
            </FormField>
            <FormField label={<>订单预警 <InlineToken>自动</InlineToken></>}>
              <Input name="订单预警" readOnly value={draft.warningText} />
            </FormField>
          </FormRow>
          <DialogActions>
            <Button id="ot-cancel" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" variant="primary">保存</Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddAccountModal({
  open,
  value,
  onValueChange,
  onOpenChange,
  onConfirm
}: {
  open: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog id="ot-add-acc-modal" open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogTitle>添加新账号</DialogTitle>
        <form id="ot-add-acc-form" autoComplete="off" onSubmit={event => { event.preventDefault(); onConfirm(); }}>
          <FormRow>
            <FormField label="新账号名称" full>
              <Input id="ot-new-acc-input" value={value} placeholder="例如：US-TK-01" required onChange={event => onValueChange(event.target.value)} />
            </FormField>
          </FormRow>
          <DialogActions>
            <Button id="ot-add-acc-cancel" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" variant="primary">确定</Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExportModal({
  open,
  options,
  selected,
  onSelectedChange,
  onOpenChange,
  onConfirm
}: {
  open: boolean;
  options: { key: string; label: string; count: number }[];
  selected: Set<string>;
  onSelectedChange: (value: Set<string>) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog id="ot-export-modal" open={open} titleId="ot-export-title" onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogTitle id="ot-export-title">选择要导出的账号</DialogTitle>
        <Alert variant="info" className={modalCopyClass}>
          <AlertDescription>可勾选一个或多个账号；如果有未关联订单，也可以单独导出。</AlertDescription>
        </Alert>
        <ExportOptions
          allCheckboxId="ot-export-all"
          checkboxClassName="ot-export-checkbox"
          countLabel={count => `${count} 条`}
          options={options}
          optionsId="ot-export-options"
          selected={selected}
          onSelectedChange={onSelectedChange}
        />
        <DialogActions>
          <Button id="ot-export-cancel" onClick={() => onOpenChange(false)}>取消</Button>
          <Button id="ot-export-confirm" variant="primary" onClick={onConfirm}>导出 CSV</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

function StorageHelpModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog id="ot-storage-help-modal" open={open} titleId="ot-storage-help-title" onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogTitle id="ot-storage-help-title">数据存储说明</DialogTitle>
        <HelpStack>
          <HelpItem label="本地优先">订单管理和商品管理都会先使用 Firestore 自带的离线缓存，再同步到你自己的 Firebase Firestore 项目。</HelpItem>
          <HelpItem label="可选远端">当前只支持 Firebase Firestore。工具本身不会把订单或商品资料存到我的数据库里。</HelpItem>
          <HelpItem label="恢复方式">请保存好自己的 <code>firebaseConfig</code>。换浏览器或换设备后，用同一套远端配置即可恢复。</HelpItem>
          <HelpItem label="团队共用">同一个 Firebase 项目可以给团队成员共用，但当前方案没有成员级权限隔离。</HelpItem>
        </HelpStack>
        <DialogActions>
          <Button id="ot-storage-help-close" variant="primary" onClick={() => onOpenChange(false)}>知道了</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

function OrdersPage() {
  const providerRef = useRef(OrderTrackerProviderFirestore.create({
    state: {},
    helpers: {
      nowIso,
      normalizeOrderList: (list: OrderRecord[]) => Array.isArray(list) ? list.map(order => normalizeOrderRecord(order)) : [],
      uniqueAccounts
    }
  }));
  const productProviderRef = useRef(ProductLibraryProviderFirestore.create({
    state: {},
    helpers: { nowIso }
  }));
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncText, setSyncText] = useState('未连接');
  const [syncClass, setSyncClass] = useState('');
  const [projectId, setProjectId] = useState('');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [activeAccount, setActiveAccount] = useState('__all__');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<OrderDraft>(() => buildDraftFromOrder(null, '__all__', []));
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set());
  const [storageHelpOpen, setStorageHelpOpen] = useState(false);
  const exchangeRate = ensureGlobalSettingsStore().getExchangeRate();

  const allAccounts = useMemo(() => uniqueAccounts([...accounts, ...orders.map(order => order['账号'])]).sort((left, right) => left.localeCompare(right)), [accounts, orders]);
  const exportOptions = useMemo(() => getExportAccountOptions({ accounts: allAccounts, orders, constants: { UNASSIGNED_ACCOUNT_SLOT } }).map(option => ({
    key: String(option.key),
    label: String(option.label),
    count: option.count
  })), [allAccounts, orders]);
  const accountTabItems = useMemo(() => allAccounts.map(account => ({
    key: account,
    label: account,
    count: orders.filter(order => normalizeAccountName(order['账号']) === account).length
  })), [allAccounts, orders]);

  const formatFirestoreError = useCallback((error: unknown, fallback = '订单管理操作失败') => {
    const err = error as { code?: string; message?: string };
    const message = String(err?.message || '').trim();
    if (String(err?.code || '').includes('permission-denied') || /Missing or insufficient permissions/i.test(message)) {
      const next = '当前 Firebase 项目的 Firestore 规则较旧，请重新复制并发布最新规则，确保 orders、order_accounts、sync_state 和 products 都已放行。';
      TKFirestoreConnection.notifyRulesUpdateNeeded(next);
      return next;
    }
    return message || fallback;
  }, []);

  const loadProducts = useCallback(async () => {
    const cfg = readGlobalConfig();
    if (!cfg?.configText) {
      setProducts([]);
      return [];
    }
    try {
      await productProviderRef.current.init({ configText: cfg.configText });
      const result = await productProviderRef.current.pullProducts();
      const nextProducts = Array.isArray(result.products) ? result.products : [];
      setProducts(nextProducts);
      return nextProducts;
    } catch (error) {
      setProducts([]);
      showToast(formatFirestoreError(error, '商品资料加载失败'), 'error');
      return [];
    }
  }, [formatFirestoreError]);

  const connectUsingGlobalConfig = useCallback(async () => {
    const cfg = readGlobalConfig();
    if (!cfg?.configText) {
      setConnected(false);
      setSyncText('未连接');
      setSyncClass('');
      return false;
    }
    setLoading(true);
    setSyncText('正在刷新云端数据…');
    setSyncClass('saving');
    try {
      await providerRef.current.init({ configText: cfg.configText });
      const [snapshot] = await Promise.all([
        providerRef.current.pullSnapshot({ cursor: '' }),
        loadProducts()
      ]);
      setOrders(snapshot.orders || []);
      setAccounts(uniqueAccounts([...(snapshot.accounts || []), ...(snapshot.orders || []).map((order: OrderRecord) => order['账号'])]));
      setProjectId(cfg.projectId || '');
      setConnected(true);
      setSyncText(`已同步 · ${(snapshot.orders || []).length} 条`);
      setSyncClass('saved');
      return true;
    } catch (error) {
      setConnected(false);
      setSyncText('加载失败');
      setSyncClass('error');
      showToast(formatFirestoreError(error, '恢复连接失败'), 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [formatFirestoreError, loadProducts]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!saved?.clientId) localStorage.setItem(LS_KEY, JSON.stringify({ clientId: uid() }));
    } catch (error) {}
    void connectUsingGlobalConfig();
  }, [connectUsingGlobalConfig]);

  useEffect(() => {
    const handleConnectionChange = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean }>).detail || {};
      if (detail.connected === false || !readGlobalConfig()?.configText) {
        setConnected(false);
        setOrders([]);
        setProducts([]);
        setProjectId('');
        setSyncText('未连接');
        setSyncClass('');
        return;
      }
      void connectUsingGlobalConfig();
    };
    const handleProductsChanged = () => {
      void loadProducts();
    };
    window.addEventListener('tk-firestore-config-changed', handleConnectionChange);
    window.addEventListener('tk-products-changed', handleProductsChanged);
    return () => {
      window.removeEventListener('tk-firestore-config-changed', handleConnectionChange);
      window.removeEventListener('tk-products-changed', handleProductsChanged);
    };
  }, [connectUsingGlobalConfig, loadProducts]);

  function openOrderModal(id = '') {
    const order = id ? orders.find(item => String(item.id) === id) || null : null;
    setEditingId(id);
    setDraft(computeAutoFields(buildDraftFromOrder(order, activeAccount, allAccounts), products));
    setModalOpen(true);
    void loadProducts();
  }

  async function persistOrders(nextOrders: OrderRecord[], nextAccounts = allAccounts, statusText = '已保存到 Firestore 本地队列…') {
    setOrders(nextOrders);
    setAccounts(nextAccounts);
    setSyncText(statusText);
    setSyncClass('saving');
    const cfg = readGlobalConfig();
    if (!cfg?.configText) return;
    const remote = await providerRef.current.pullSnapshot({ cursor: '' }).catch(() => ({ orders: [], accounts: [] }));
    const remoteMap = new Map((remote.orders || []).map((order: OrderRecord) => [String(order.id), order]));
    const nextMap = new Map(nextOrders.map(order => [String(order.id), order]));
    const upserts = nextOrders.filter(order => JSON.stringify(order) !== JSON.stringify(remoteMap.get(String(order.id)) || null));
    const deletions = (remote.orders || []).filter((order: OrderRecord) => !nextMap.has(String(order.id))).map((order: OrderRecord) => ({
      id: order.id,
      accountName: order['账号'] || '',
      deletedAt: nowIso()
    }));
    const nextAccountSet = new Set(nextAccounts);
    const remoteAccountSet = new Set(remote.accounts || []);
    const accountUpserts = nextAccounts.filter(account => !remoteAccountSet.has(account));
    const accountDeletions = (remote.accounts || []).filter((account: string) => !nextAccountSet.has(account));
    const result = await providerRef.current.pushChanges({
      upserts,
      deletions,
      accountUpserts,
      accountDeletions,
      clientId: '',
      assignSeq: true,
      waitForCommit: false
    });
    result?.commitPromise?.then(() => {
      setSyncText(`已同步 · ${nextOrders.length} 条`);
      setSyncClass('saved');
    }).catch(error => {
      setSyncText('Firestore 写入失败，已保留本地视图');
      setSyncClass('error');
      showToast(formatFirestoreError(error, '写入失败'), 'error');
    });
  }

  async function submitOrder() {
    const autoDraft = computeAutoFields(draft, products);
    if (!autoDraft.items.length) {
      showToast('请至少添加一条订单明细', 'error');
      return;
    }
    if (!autoDraft.orderNo.trim()) {
      showToast('请填写订单号', 'error');
      return;
    }
    for (const item of autoDraft.items) {
      const product = findProduct(products, autoDraft.accountName, item.productTkId);
      const relatedSkus = getProductSkus(product);
      if (!item.productTkId && !item.productName) {
        showToast('请填写每条明细的商品名称，或先关联商品', 'error');
        return;
      }
      if (product && relatedSkus.length && !item.productSkuId) {
        showToast(`商品「${product.name || item.productTkId}」有多个 SKU，请先选择具体规格`, 'error');
        return;
      }
    }
    const uniqueCompanies = Array.from(new Set(autoDraft.items.map(item => item.courierCompany).filter(Boolean)));
    const uniqueTrackings = Array.from(new Set(autoDraft.items.map(item => item.trackingNo).filter(Boolean)));
    const previous = editingId ? orders.find(order => String(order.id) === editingId) : null;
    const id = previous?.id || uid();
    const createdAt = previous?.createdAt || nowIso();
    const payload = normalizeOrderRecord({
      ...previous,
      id,
      createdAt,
      updatedAt: nowIso(),
      '账号': autoDraft.accountName,
      '下单时间': autoDraft.orderedAt,
      '采购日期': autoDraft.purchaseDate,
      '最晚到仓时间': autoDraft.latestWarehouseAt,
      '订单预警': autoDraft.warningText,
      '订单号': autoDraft.orderNo,
      '产品名称': buildOrderItemsSummary(autoDraft.items),
      '数量': String(computeItemTotals(autoDraft.items).quantity || ''),
      '是否退款': autoDraft.isRefunded ? '1' : '',
      '达人佣金率': autoDraft.creatorCommissionRate,
      '达人佣金': autoDraft.creatorCommission,
      '采购价格': autoDraft.purchasePrice,
      '售价': autoDraft.salePrice,
      '预估运费': autoDraft.estimatedShippingFee,
      '预估利润': autoDraft.estimatedProfit,
      '重量': autoDraft.weightText,
      '尺寸': autoDraft.sizeText,
      '订单状态': autoDraft.orderStatus,
      '快递公司': uniqueCompanies.length === 1 ? uniqueCompanies[0] : '',
      '快递单号': uniqueTrackings.length === 1 ? uniqueTrackings[0] : '',
      items: autoDraft.items
    });
    const nextOrders = editingId
      ? orders.map(order => String(order.id) === editingId ? payload : order)
      : [payload, ...orders];
    const nextAccounts = uniqueAccounts([...allAccounts, payload['账号']]);
    setModalOpen(false);
    setEditingId('');
    await persistOrders(nextOrders, nextAccounts, '已保存到 Firestore 本地队列…');
    showToast('已保存到本地');
  }

  async function deleteOrder(id: string) {
    if (!window.confirm('确定删除这条订单？删除后如需恢复，需要从你的 Firestore 历史记录或备份手动恢复。')) return;
    const nextOrders = orders.filter(order => String(order.id) !== id);
    await persistOrders(nextOrders, allAccounts, '已删除，本地已更新，等待同步…');
    showToast('已删除');
  }

  function addAccount() {
    const name = newAccountName.trim();
    if (!name) return;
    if (allAccounts.includes(name)) {
      showToast('该账号已存在', 'error');
      return;
    }
    const nextAccounts = uniqueAccounts([name, ...allAccounts]);
    setAccounts(nextAccounts);
    setDraft(previous => ({ ...previous, accountName: name }));
    setNewAccountName('');
    setAccountModalOpen(false);
  }

  function openExportModal() {
    if (!orders.length) {
      showToast('当前没有可导出的订单数据', 'error');
      return;
    }
    const selected: Set<string> = activeAccount !== '__all__'
      ? new Set([activeAccount])
      : new Set(exportOptions.map(option => String(option.key)));
    setExportSelected(selected);
    setExportOpen(true);
  }

  function confirmExport() {
    if (!exportSelected.size) {
      showToast('请至少选择一个账号', 'error');
      return;
    }
    const selectedKeys = [...exportSelected].map(String);
    const rowsSource = orders.filter(order => selectedKeys.includes(toAccountSlot(order['账号'])));
    if (!rowsSource.length) {
      showToast('当前选择下没有可导出的订单数据', 'error');
      return;
    }
    const rows = buildExportRows({ orders: rowsSource, exchangeRate, computeOrderCreatorCommissionFn: computeOrderCreatorCommission, computeOrderEstimatedProfitFn: computeOrderEstimatedProfit });
    const csv = buildOrdersCsv({ rows, includeBom: true });
    const selectedOptions = exportOptions.filter(option => exportSelected.has(String(option.key)));
    const filename = buildExportFilename(selectedOptions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportOpen(false);
    showToast('CSV 已开始导出');
  }

  return (
    <>
      <PageHero
        variant="orders"
        title="订单管理"
        kicker="采购 / 物流 / 入仓进度"
        description="集中管理采购、物流和入仓进度，并汇总销售额、支出与预估利润。"
        data-react-orders-page-ready="true"
      />

      {!connected ? (
        <Card className={orderSetupCardClass} id="ot-setup">
          <EmptyState
            className="py-[60px]"
            title="尚未连接 Firebase 数据源"
            description="订单管理和商品管理共用同一个 Firestore 项目。先连接一次，两个模块都会直接复用。"
          >
            <Button id="ot-open-connection" variant="primary" onClick={() => TKFirestoreConnection.open()}>连接 Firebase</Button>
          </EmptyState>
        </Card>
      ) : null}

      {connected ? <Card id="ot-main">
        <div id="ot-header-status-row" className={cn(orderHeaderRowClass, 'ot-header-status-row')}>
          <div className={statusStripClass}>
            <div className={statusStripLeftClass}>
              <Badge id="ot-user" className="min-h-[30px] text-[var(--text)] font-semibold">已连接 · {projectId || 'Firebase Firestore'}</Badge>
              <Badge id="ot-sync" className={syncStatusClass(syncClass)}>{syncText}</Badge>
              <Button id="ot-refresh" variant="plain" className={refreshButtonClass(loading)} aria-label="刷新订单数据" title="刷新订单数据" disabled={loading} aria-busy={loading ? 'true' : 'false'} onClick={() => void connectUsingGlobalConfig()}>
                <RefreshCw size={15} strokeWidth={2} aria-hidden="true" className={loading ? 'is-spinning' : ''} />
              </Button>
              <Button id="ot-storage-help-btn" variant="plain" className={storageHelpButtonClass} aria-controls="ot-storage-help-modal" aria-haspopup="dialog" aria-label="数据存储说明" title="数据存储说明" onClick={() => setStorageHelpOpen(true)}>
                <HelpCircle size={15} strokeWidth={2} aria-hidden="true" />
              </Button>
            </div>
            <div className={statusStripRightClass}>
              <Button id="ot-export" size="sm" onClick={openExportModal}><FileDown size={14} strokeWidth={2} aria-hidden="true" />导出 CSV</Button>
              <Button id="ot-disconnect-firestore" size="sm" variant="danger" data-firestore-disconnect onClick={() => TKFirestoreConnection.requestDisconnect()}>退出数据库</Button>
            </div>
          </div>
        </div>
        <div id="ot-header-summary-row" className={cn(orderHeaderRowClass, 'ot-header-summary-row')}>
          <div id="ot-summary-container" className={orderSummaryContainerClass}>
            <OrdersSummary orders={orders} activeAccount={activeAccount} searchQuery={searchQuery} sortOrder={sortOrder} exchangeRate={exchangeRate} />
          </div>
        </div>
        <div id="ot-header-accounts-row" className={cn(orderHeaderRowClass, 'ot-header-accounts-row')}>
          <AccountTabsBar
            id="ot-acc-tabs"
            activeKey={activeAccount}
            allCount={orders.length}
            allTabsId="ot-acc-tabs-all"
            scrollId="ot-acc-tabs-scroll"
            items={accountTabItems}
            addAccountButton={{ id: 'ot-tab-add', title: '添加账号', onClick: () => setAccountModalOpen(true) }}
            actionsId="ot-acc-actions"
            onChange={account => { setActiveAccount(account); setCurrentPage(1); }}
            actions={<Button id="ot-add" variant="primary" onClick={() => openOrderModal()}><Plus size={14} strokeWidth={2} aria-hidden="true" />新增订单</Button>}
          />
        </div>
        <OrdersTable
          orders={orders}
          activeAccount={activeAccount}
          searchQuery={searchQuery}
          sortOrder={sortOrder}
          pageSize={pageSize}
          currentPage={currentPage}
          exchangeRate={exchangeRate}
          onSearchChange={value => { setSearchQuery(value); setCurrentPage(1); }}
          onPageSizeChange={value => { setPageSize(Math.max(1, Number(value) || 50)); setCurrentPage(1); }}
          onPageChange={delta => setCurrentPage(page => Math.max(1, page + delta))}
          onSortToggle={() => { setSortOrder(value => value === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
          onEdit={openOrderModal}
          onDelete={deleteOrder}
        />
      </Card> : null}

      <OrderModal
        open={modalOpen}
        draft={draft}
        accounts={allAccounts}
        products={products}
        editingId={editingId}
        onOpenChange={open => { setModalOpen(open); if (!open) setEditingId(''); }}
        onDraftChange={setDraft}
        onSubmit={submitOrder}
        onAddAccount={() => setAccountModalOpen(true)}
      />
      <AddAccountModal open={accountModalOpen} value={newAccountName} onValueChange={setNewAccountName} onOpenChange={setAccountModalOpen} onConfirm={addAccount} />
      <ExportModal open={exportOpen} options={exportOptions} selected={exportSelected} onSelectedChange={setExportSelected} onOpenChange={setExportOpen} onConfirm={confirmExport} />
      <StorageHelpModal open={storageHelpOpen} onOpenChange={setStorageHelpOpen} />
    </>
  );
}

export { OrdersPage };
