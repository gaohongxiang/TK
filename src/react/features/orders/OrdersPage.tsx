import { Alert, AlertDescription } from '@/components/ui/alert';
import { AccountDeleteDialog, AccountEditDialog } from '@/components/ui/account-manage-dialogs';
import { AccountTabsBar } from '@/components/ui/account-tabs-bar';
import { AddAccountDialog } from '@/components/ui/add-account-dialog';
import { Badge, badgeToneMap } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormRow } from '@/components/ui/form';
import { HelpItem, HelpStack } from '@/components/ui/help-stack';
import { InlineToken } from '@/components/ui/inline-token';
import { Input } from '@/components/ui/input';
import { ModuleListState } from '@/components/ui/module-list-state';
import { DecimalInput, IntegerInput } from '@/components/ui/number-input';
import {
  ModuleAccountTabs,
  ModuleHeader,
  ModuleStatusBar,
  ModuleTableShell,
  ModuleToolbar,
  ModuleWorkspace
} from '@/components/ui/module-workspace';
import { SearchHelpButton } from '@/components/ui/search-help';
import { Select } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { refreshButtonClass, statusStripClass, statusStripLeftClass, storageHelpButtonClass, syncStatusClass } from '@/components/ui/status-strip';
import { TableFrame, TablePager, TableSearch, TableSortButton, TableToolbar, TableViewport } from '@/components/ui/table-tools';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { showAppToast } from '@/app/toast';
import { useStaleAutoRefresh } from '@/lib/stale-auto-refresh';
import { TKFirestoreConnection } from '../../../firestore-connection.ts';
import {
  formatFirestoreRulesUpdateMessage,
  isPermissionDenied
} from '../../../firestore-rules-compatibility.ts';
import { OrderTrackerProviderFirestore } from '../../../orders/provider-firestore.ts';
import { ProductLibraryProviderFirestore } from '../../../products/provider-firestore.ts';
import {
  addDays,
  buildOrderItemsSummary,
  computeOrderActualProfit,
  computeOrderCreatorCommission,
  computeOrderEstimatedProfit,
  computeOrderPlatformFee,
  computeWarning,
  detectCourierCompany,
  getOrderSalePricingMode,
  isFreeShippingTransferOrder,
  isOrderRefunded,
  normalizeOrderItems,
  normalizeOrderSalePricingMode,
  normalizeOrderRecord,
  parseOrderMoneyValue,
  todayStr
} from '../../../orders/shared.ts';
import {
  buildOrderCourierSummary,
  deriveDisplayedOrders,
  derivePurchaseSummary,
  formatJpySummaryMetric,
  formatSummaryMetric,
  formatTableCellValue,
  formatTableMoneyValue,
  getProfitCellToneClass,
  isCreatorOrder
} from '../../../orders/table.ts';
import { SETTINGS_CHANGED_EVENT, ensureGlobalSettingsStore } from '../../../global-settings.ts';
import { buildFirestoreSyncStatus } from '../../../firestore-sync-status.ts';
import { TKShippingCore } from '../../../shipping-core.ts';
import { cn } from '@/lib/utils';
import {
  CalendarDays,
  Copy,
  HelpCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import type { ProductLogisticsDefaults, ProductRecord, ProductSku } from '../../../products/types.ts';
import type { OrderFormDraftItem, OrderRecord, OrderSummaryMetric } from '../../../orders/types.ts';

type OrderItemDraft = OrderFormDraftItem & {
  useOrderCourier: null;
};

type OrderDraft = {
  accountName: string;
  orderNo: string;
  orderedAt: string;
  purchaseDate: string;
  latestWarehouseAt: string;
  warningText: string;
  isRefunded: boolean;
  salePricingMode: string;
  salePrice: string;
  purchasePrice: string;
  estimatedShippingFee: string;
  estimatedProfit: string;
  settlementAmount: string;
  actualProfit: string;
  creatorCommissionRate: string;
  creatorCommission: string;
  orderStatus: string;
  weightText: string;
  manualWeightText: boolean;
  sizeText: string;
  manualSizeText: boolean;
  shippingFeeMode: 'auto' | 'manual';
  manualEstimatedShippingFee: boolean;
  note: string;
  items: OrderItemDraft[];
};

type PricingContext = ReturnType<ReturnType<typeof ensureGlobalSettingsStore>['getPricingContext']>;

const LS_KEY = 'tk.orders.runtime.v1';
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
const ACCOUNT_UPDATED_EVENT = 'tk-accounts-changed';
const ORDER_STATUS_OPTIONS = ['未采购', '已采购', '在途', '已入仓', '已送达', '已完成', '订单取消'];
const SALE_PRICING_MODE_BUYER_PAID = 'buyer_paid_shipping';
const SALE_PRICING_MODE_TRANSFER = 'free_shipping_transfer';
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

function getRuntimeClientId() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (saved?.clientId) return String(saved.clientId);
    const clientId = uid();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...(saved || {}), clientId }));
    return clientId;
  } catch (error) {
    return uid();
  }
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

function mergeAssignedOrders(localOrders: OrderRecord[], assignedOrders: OrderRecord[] = []) {
  const assignedById = new Map(
    assignedOrders
      .map(order => [String(order?.id || '').trim(), order] as const)
      .filter(([id]) => id)
  );
  if (!assignedById.size) return localOrders;
  let changed = false;
  const merged = localOrders.map(order => {
    const assigned = assignedById.get(String(order?.id || '').trim());
    if (!assigned) return order;
    changed = true;
    return normalizeOrderRecord({ ...order, ...assigned });
  });
  return changed ? merged : localOrders;
}

function getOrderPageForId({
  orders,
  activeAccount,
  searchQuery,
  sortOrder,
  pageSize,
  orderId
}: {
  orders: OrderRecord[];
  activeAccount: string;
  searchQuery: string;
  sortOrder: string;
  pageSize: number;
  orderId: unknown;
}) {
  const id = String(orderId || '').trim();
  if (!id) return null;
  const { sorted } = deriveDisplayedOrders({ orders, activeAccount, searchQuery, sortOrder });
  const index = sorted.findIndex(order => String(order?.id || '').trim() === id);
  if (index < 0) return null;
  return Math.floor(index / Math.max(1, Number(pageSize) || 50)) + 1;
}

function formatNumericValue(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toFixed(2).replace(/\.?0+$/, '');
}

function isSameMoneyValue(left: unknown, right: unknown) {
  const leftNumber = parseOrderMoneyValue(left);
  const rightNumber = parseOrderMoneyValue(right);
  return leftNumber !== null && rightNumber !== null && Math.abs(leftNumber - rightNumber) < 0.005;
}

function isPositiveIntegerText(value: unknown) {
  return /^[1-9]\d*$/.test(String(value ?? '').trim());
}

function parseItemQuantity(value: unknown) {
  const text = String(value ?? '').trim();
  return isPositiveIntegerText(text) ? Number(text) : 0;
}

function normalizeQuantityInput(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (!/^\d+$/.test(text)) return null;
  return text.replace(/^0+/, '');
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

function formatProductSize(source: ProductLogisticsDefaults | null) {
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
  const hasQuantity = Object.prototype.hasOwnProperty.call(item, 'quantity');
  return {
    ...createEmptyOrderItem(),
    ...item,
    lineId: String(item.lineId || '').trim() || uid(),
    productTkId: String(item.productTkId || '').trim(),
    productSkuId: String(item.productSkuId || '').trim(),
    productSkuName: String(item.productSkuName || '').trim(),
    productName: String(item.productName || '').trim(),
    quantity: hasQuantity ? String(item.quantity ?? '').trim() : '1',
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
    quantity: String(order['数量'] || ''),
    unitSalePrice: String(order['售价'] || ''),
    unitPurchasePrice: String(order['采购价格'] || ''),
    unitWeightG: String(order['重量'] || ''),
    unitSizeText: order['尺寸'],
    courierCompany: order['快递公司'],
    trackingNo: order['快递单号']
  })];
}

function buildDraftFromOrder(order: OrderRecord | null, activeAccount: string, accounts: string[]): OrderDraft {
  const orderedAt = String(order?.['下单时间'] || todayStr());
  const status = String(order?.['订单状态'] || '').trim();
  const savedEstimatedShippingFee = String(order?.['预估运费'] || '');
  const preserveSavedShippingFee = !!order && !!savedEstimatedShippingFee.trim();
  const shippingFeeMode = preserveSavedShippingFee || String(order?.estimatedShippingFeeMode || '').trim() === 'manual' ? 'manual' : 'auto';
  return {
    accountName: String(order?.['账号'] || (activeAccount !== '__all__' ? activeAccount : accounts[0] || '')),
    orderNo: String(order?.['订单号'] || ''),
    orderedAt,
    purchaseDate: String(order?.['采购日期'] || todayStr()),
    latestWarehouseAt: String(order?.['最晚到仓时间'] || (orderedAt ? addDays(orderedAt, 6) : '')),
    warningText: String(order?.['订单预警'] || ''),
    isRefunded: String(order?.['是否退款'] || '').trim() === '1',
    salePricingMode: getOrderSalePricingMode(order || {}),
    salePrice: String(order?.['售价'] || ''),
    purchasePrice: String(order?.['采购价格'] || ''),
    estimatedShippingFee: savedEstimatedShippingFee,
    estimatedProfit: String(order?.['预估利润'] || ''),
    settlementAmount: String(order?.['结算金额'] || ''),
    actualProfit: String(order?.['实际利润'] || ''),
    creatorCommissionRate: String(order?.['达人佣金率'] || ''),
    creatorCommission: String(order?.['达人佣金'] || ''),
    orderStatus: status,
    weightText: String(order?.['重量'] || ''),
    manualWeightText: !!String(order?.['重量'] || '').trim(),
    sizeText: String(order?.['尺寸'] || ''),
    manualSizeText: !!String(order?.['尺寸'] || '').trim(),
    shippingFeeMode,
    manualEstimatedShippingFee: shippingFeeMode === 'manual',
    note: String(order?.['备注'] || order?.note || ''),
    items: getOrderItemsFromOrder(order)
  };
}

function computeItemTotals(items: OrderItemDraft[]) {
  return items.reduce((acc, item) => {
    const quantity = parseItemQuantity(item.quantity);
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

function computeEstimatedShippingWithContext(
  draft: OrderDraft,
  products: ProductRecord[],
  pricingContext: PricingContext
) {
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

function computeAutoFieldsWithContext(
  draft: OrderDraft,
  products: ProductRecord[],
  pricingContext: PricingContext
) {
  const items = draft.items.map(normalizeDraftItem);
  const totals = computeItemTotals(items);
  const latestWarehouseAt = draft.orderedAt ? addDays(draft.orderedAt, 6) : '';
  const singleSize = items.length === 1 ? items[0].unitSizeText : '';
  const weightText = draft.manualWeightText ? draft.weightText : (totals.weight ? formatNumericValue(totals.weight) : draft.weightText);
  const sizeText = draft.manualSizeText ? draft.sizeText : (singleSize || draft.sizeText);
  const estimatedShippingFee = draft.manualEstimatedShippingFee
    ? draft.estimatedShippingFee
    : computeEstimatedShippingWithContext({ ...draft, items, weightText, sizeText }, products, pricingContext);
  const tempOrder = {
    '下单时间': draft.orderedAt,
    '最晚到仓时间': latestWarehouseAt,
    '订单状态': draft.orderStatus
  };
  const warningText = computeWarning(tempOrder).text;
  const commission = computeOrderCreatorCommission({
    '售价': draft.salePrice,
    '售价口径': draft.salePricingMode,
    '达人佣金率': draft.creatorCommissionRate,
    '是否退款': draft.isRefunded ? '1' : ''
  }, pricingContext);
  const profit = computeOrderEstimatedProfit({
    '售价': draft.salePrice,
    '售价口径': draft.salePricingMode,
    '采购价格': draft.purchasePrice || (totals.purchase ? formatNumericValue(totals.purchase) : ''),
    '预估运费': estimatedShippingFee,
    '达人佣金率': draft.creatorCommissionRate,
    '是否退款': draft.isRefunded ? '1' : ''
  }, pricingContext);
  const actualProfit = computeOrderActualProfit({
    '结算金额': draft.settlementAmount,
    '采购价格': draft.purchasePrice || (totals.purchase ? formatNumericValue(totals.purchase) : '')
  }, pricingContext);
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
    estimatedProfit: profit === null ? '' : formatNumericValue(profit),
    actualProfit: actualProfit === null ? '' : formatNumericValue(actualProfit)
  };
}

function computeShippingRuleDraft(
  draft: OrderDraft,
  products: ProductRecord[],
  pricingContext: PricingContext
) {
  return computeAutoFieldsWithContext({
    ...draft,
    shippingFeeMode: 'auto',
    manualEstimatedShippingFee: false
  }, products, pricingContext);
}

function shouldRefreshShippingFee(draft: OrderDraft, ruleDraft: OrderDraft) {
  return !!ruleDraft.estimatedShippingFee && !isSameMoneyValue(draft.estimatedShippingFee, ruleDraft.estimatedShippingFee);
}

function shouldPreserveCurrentShippingFee(
  draft: OrderDraft,
  products: ProductRecord[],
  pricingContext: PricingContext
) {
  return draft.manualEstimatedShippingFee || shouldRefreshShippingFee(draft, computeShippingRuleDraft(draft, products, pricingContext));
}

function preserveEstimatedShippingFee(draft: OrderDraft) {
  return {
    ...draft,
    shippingFeeMode: 'manual' as const,
    manualEstimatedShippingFee: true
  };
}

function applyShippingRefreshPolicy(
  nextDraft: OrderDraft,
  currentDraft: OrderDraft,
  products: ProductRecord[],
  pricingContext: PricingContext,
  resetShipping = false
) {
  if (nextDraft.manualEstimatedShippingFee) {
    return preserveEstimatedShippingFee(nextDraft);
  }
  if (resetShipping) {
    return { ...nextDraft, shippingFeeMode: 'auto' as const, manualEstimatedShippingFee: false };
  }
  if (shouldPreserveCurrentShippingFee(currentDraft, products, pricingContext)) {
    return preserveEstimatedShippingFee(nextDraft);
  }
  return nextDraft;
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
const orderActionsClass = 'orders-react-actions inline-flex min-w-[78px] items-center justify-between gap-3';
const orderItemFieldClass = 'ot-item-field ot-item-span-3 col-span-3 min-w-0';
const orderItemLabelClass = 'min-h-0 !text-[10.5px] !leading-[1.2] tracking-[.04em]';
const orderItemInputClass = '!h-10 !min-h-10 text-center';
const orderItemSelectClass = '!h-10 !min-h-10 rounded-[10px] border-[color-mix(in_srgb,var(--border)_82%,white)] bg-[color-mix(in_srgb,var(--panel2)_38%,white)] px-3 text-center';
const orderItemInlineActionsClass = 'ot-item-inline-actions ml-1.5 inline-flex items-center gap-1.5';
const orderItemInlineButtonClass = 'ot-item-inline-btn ot-item-copy-btn inline-flex h-4 w-4 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[var(--accent)] hover:text-[color-mix(in_srgb,var(--accent)_82%,black)] [&_svg]:h-3.5 [&_svg]:w-3.5';
const orderInlineHintClass = 'ot-inline-hint ml-1.5 inline whitespace-nowrap text-[11px] font-medium text-[var(--muted)]';
const orderTrashListClass = 'orders-trash-list grid max-h-[420px] gap-2 overflow-auto pr-1';
const orderTrashItemClass = 'orders-trash-item grid gap-2 rounded-xl border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--panel2)_34%,transparent)] p-3';
const orderTrashItemHeadClass = 'flex items-start justify-between gap-3';
const orderTrashItemTitleClass = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-[var(--text)]';
const orderTrashItemMetaClass = 'flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]';
const orderTrashActionsClass = 'flex shrink-0 flex-wrap items-center justify-end gap-2';
const orderMoneyRowClass = 'quint ot-money-row-top mt-[18px] !grid-cols-[76px_repeat(4,minmax(0,1fr))] gap-[10px] max-[1100px]:!grid-cols-3 max-[768px]:!grid-cols-1 max-[768px]:mt-3';
const orderMetaRowClass = 'quint ot-meta-row mt-[18px] !grid-cols-[76px_repeat(4,minmax(0,1fr))] gap-[10px] max-[1100px]:!grid-cols-3 max-[768px]:!grid-cols-1 max-[768px]:mt-3';
const orderSettlementRowClass = 'triple ot-settlement-row mt-[18px] !grid-cols-3 gap-[10px] max-[768px]:!grid-cols-1 max-[768px]:mt-3';
const orderShippingRuleClass = 'ot-shipping-rule flex min-h-[42px] min-w-0 items-center rounded-xl border border-[var(--border)] bg-[var(--panel2)] px-3 py-1 text-[12px] leading-tight text-[var(--muted)] shadow-[inset_0_0_0_1px_rgba(255,255,255,.18)]';
const orderShippingRuleTextClass = 'min-w-0 flex-1 truncate whitespace-nowrap';
const orderShippingRuleButtonClass = 'ml-1 inline-flex h-[20px] rounded-md px-1.5 py-0 align-[-3px] text-[10px] font-medium tracking-normal';
const orderShippingHelpButtonClass = '-ml-0.5 inline-flex h-[17px] w-[17px] rounded-full border border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--panel))] p-0 text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_14%,var(--panel))] [&_svg]:h-3 [&_svg]:w-3';
const orderProfitLabelClass = '!flex-nowrap';
const orderRefundToggleClass = 'ot-refund-toggle flex min-h-10 w-[76px] cursor-pointer items-center justify-start bg-transparent p-0';
const orderRefundInputClass = 'absolute opacity-0 pointer-events-none';
const orderRefundKnobClass = 'ot-refund-toggle-knob relative h-10 w-[76px] flex-none rounded-full bg-[color-mix(in_srgb,var(--panel2)_84%,white_16%)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--line)_88%,white_12%)] transition-[background-color,box-shadow,transform] after:absolute after:left-1 after:top-1 after:h-8 after:w-8 after:rounded-full after:bg-white after:shadow-[0_1px_4px_rgba(15,23,42,.18)] after:transition-[left] group-hover:bg-[color-mix(in_srgb,var(--panel2)_74%,white_26%)]';
const orderRefundKnobCheckedClass = 'bg-[linear-gradient(135deg,#f0b1b1,#de6a6a)] shadow-[inset_0_0_0_1px_rgba(196,78,78,.18)] after:left-[calc(100%-36px)]';
const orderTransferToggleClass = 'ot-transfer-toggle flex min-h-10 w-[76px] cursor-pointer items-center justify-start bg-transparent p-0';
const orderTransferInputClass = 'absolute opacity-0 pointer-events-none';
const orderTransferKnobClass = 'ot-transfer-toggle-knob relative h-10 w-[76px] flex-none rounded-full bg-[color-mix(in_srgb,var(--panel2)_84%,white_16%)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--line)_88%,white_12%)] transition-[background-color,box-shadow,transform] after:absolute after:left-1 after:top-1 after:h-8 after:w-8 after:rounded-full after:bg-white after:shadow-[0_1px_4px_rgba(15,23,42,.18)] after:transition-[left] group-hover:bg-[color-mix(in_srgb,var(--panel2)_74%,white_26%)]';
const orderTransferKnobCheckedClass = 'bg-[linear-gradient(135deg,#dff7ec,#73d8aa)] shadow-[inset_0_0_0_1px_rgba(69,172,121,.20)] after:left-[calc(100%-36px)]';
const orderSaleFieldClass = 'ot-sale-field';
const orderSaleInputWrapClass = 'ot-sale-input-wrap relative';
const orderSaleInputRefundClass = 'ot-sale-input-refund pointer-events-none absolute inset-0 hidden items-center justify-between gap-2.5 rounded-xl bg-[color-mix(in_srgb,#fff5f5_78%,var(--panel2)_22%)] px-3 shadow-[inset_0_0_0_1px_rgba(196,78,78,.16)]';
const orderSaleInputOriginalClass = 'ot-sale-input-original tabular-nums text-[var(--muted)] line-through decoration-[1.2px]';
const orderSaleInputZeroClass = 'ot-sale-input-zero tabular-nums font-bold text-[#c44e4e]';
const orderSaleCellClass = 'ot-sale-cell inline-flex w-full flex-col items-center gap-0.5 text-center';
const orderSaleCurrentClass = 'ot-sale-current font-semibold text-[#c44e4e]';
const orderOrderNoCellClass = 'ot-order-no-cell inline-flex min-w-0 flex-nowrap items-center gap-1.5';
const orderOrderNoTextClass = 'ot-order-no-text min-w-0';
const orderNoteCellClass = 'orders-react-note-cell max-w-[220px]';
const orderNoteTextClass = 'block truncate text-[12.5px] text-[var(--muted)]';
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
const orderSummaryActualLedgerClass = cn(orderSummaryLedgerClass, 'grid-cols-[minmax(170px,1fr)_minmax(170px,1fr)] max-[900px]:grid-cols-2 max-[640px]:grid-cols-1');
const orderSummaryLedgerItemClass = 'ot-summary-ledger-item min-w-0';
const orderSummaryLedgerIncomeClass = cn(orderSummaryLedgerItemClass, 'is-income');
const orderSummaryLedgerExpenseClass = cn(orderSummaryLedgerItemClass, 'is-expense');
const orderSummaryLedgerLabelClass = 'ot-summary-ledger-label block text-[10.5px] uppercase tracking-[.18em] text-[var(--muted)]';
const orderSummaryLedgerValueClass = 'ot-summary-ledger-value mt-[7px] block text-lg font-bold leading-[1.15] text-[var(--text)]';
const orderSummaryLedgerIncomeValueClass = cn(orderSummaryLedgerValueClass, 'text-[var(--ok)]');
const orderSummaryLedgerExpenseValueClass = cn(orderSummaryLedgerValueClass, 'text-[var(--expense)]');
const orderSummaryLedgerNoteClass = 'ot-summary-ledger-note mt-[7px] block text-[10.5px] leading-[1.35] tracking-normal text-[var(--muted)]';

function orderSummaryHeroClassForMetric(metric: OrderSummaryMetric) {
  if (metric?.total > 0) return cn(orderSummaryHeroClass, 'is-profit-positive border-[color-mix(in_srgb,var(--ok)_82%,var(--border))]');
  if (metric?.total < 0) return cn(orderSummaryHeroClass, 'is-profit-negative border-[color-mix(in_srgb,var(--expense)_84%,var(--border))]');
  return cn(orderSummaryHeroClass, 'is-neutral');
}

function orderSummaryHeroValueClassForMetric(metric: OrderSummaryMetric) {
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
    isFreeShippingTransferOrder(order) ? { key: 'transfer', label: '转嫁', title: '包邮转嫁订单' } : null,
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
  pricingContext,
  onDraftChange
}: {
  draft: OrderDraft;
  products: ProductRecord[];
  pricingContext: PricingContext;
  onDraftChange: (draft: OrderDraft) => void;
}) {
  function updateItem(
    index: number,
    patch: Partial<OrderItemDraft>,
    resetAuto: { weight?: boolean; size?: boolean; shipping?: boolean } = {}
  ) {
    const nextItems = draft.items.map((item, currentIndex) => (
      currentIndex === index ? normalizeDraftItem({ ...item, ...patch }) : item
    ));
    const nextDraft = {
      ...draft,
      manualWeightText: resetAuto.weight ? false : draft.manualWeightText,
      manualSizeText: resetAuto.size ? false : draft.manualSizeText,
      items: nextItems
    };
    onDraftChange(computeAutoFieldsWithContext(
      applyShippingRefreshPolicy(nextDraft, draft, products, pricingContext, !!resetAuto.shipping),
      products,
      pricingContext
    ));
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
    }, { weight: true, size: true, shipping: true });
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
    }, { weight: true, size: true, shipping: true });
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
                const nextDraft = {
                  ...draft,
                  manualWeightText: false,
                  manualSizeText: false,
                  items: nextItems.length ? nextItems : [createEmptyOrderItem()]
                };
                onDraftChange(computeAutoFieldsWithContext(
                  applyShippingRefreshPolicy(nextDraft, draft, products, pricingContext, true),
                  products,
                  pricingContext
                ));
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
              <IntegerInput
                density="skuInline"
                pattern="[1-9][0-9]*"
                className={orderItemInputClass}
                data-item-field="quantity"
                required
                value={item.quantity}
                onChange={value => {
                  const quantity = normalizeQuantityInput(value);
                  if (quantity === null) return;
                  updateItem(index, { quantity }, { weight: true, shipping: true });
                }}
              />
            </FormField>
            <FormField label="单件重量(g)" labelClassName={orderItemLabelClass} className={orderItemFieldClass}>
              <Input density="skuInline" className={orderItemInputClass} data-item-field="unitWeightG" value={item.unitWeightG} onChange={event => updateItem(index, { unitWeightG: event.target.value }, { weight: true, shipping: true })} />
            </FormField>
            <FormField label="单件尺寸(cm)" labelClassName={orderItemLabelClass} className={orderItemFieldClass}>
              <Input density="skuInline" className={orderItemInputClass} data-item-field="unitSizeText" value={item.unitSizeText} placeholder="20×15×10" onChange={event => updateItem(index, { unitSizeText: event.target.value }, { size: true, shipping: true })} />
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
  pricingContext
}: {
  orders: OrderRecord[];
  activeAccount: string;
  searchQuery: string;
  sortOrder: string;
  pricingContext: PricingContext;
}) {
  const summary = derivePurchaseSummary({
    orders,
    activeAccount,
    searchQuery,
    sortOrder,
    exchangeRate: pricingContext,
    computeOrderPlatformFee,
    computeOrderCreatorCommission,
    computeOrderEstimatedProfit,
    computeOrderActualProfit
  });
  const expenseValue = (summary.filteredTotal || 0) + (summary.filteredShippingTotal || 0) + (summary.filteredPlatformFeeTotal || 0) + (summary.filteredCreatorCommissionTotal || 0);

  function buildIncomeNote(grossMetric: OrderSummaryMetric, refundMetric: OrderSummaryMetric) {
    if (!refundMetric?.count) return `销售 ${formatSummaryMetric(grossMetric)}`;
    return `销售 ${formatSummaryMetric(grossMetric)} - 退款 ${formatSummaryMetric(refundMetric)}`;
  }

  function buildExpenseNote(
    purchaseMetric: OrderSummaryMetric,
    shippingMetric: OrderSummaryMetric,
    platformFeeMetric: OrderSummaryMetric,
    creatorCommissionMetric: OrderSummaryMetric
  ) {
    return `采购 ${formatSummaryMetric(purchaseMetric)} + 运费 ${formatSummaryMetric(shippingMetric)} + 平台 ${formatSummaryMetric(platformFeeMetric)} + 达人 ${formatSummaryMetric(creatorCommissionMetric)}`;
  }

  function buildEstimatedMeta(count: number, refundMetric: OrderSummaryMetric) {
    return `当前范围 · 共 ${count} 条${refundMetric?.count ? ` · 含 ${refundMetric.count} 条退款` : ''}`;
  }

  function buildActualMeta() {
    return `当前范围 · 已结算 ${summary.filteredSettledCount} 单 · 未结算 ${summary.filteredUnsettledCount} 单`;
  }

  function estimatedCard() {
    return (
      <section className={orderSummarySectionClass}>
        <div className={orderSummaryHeadClass}>
          <div className={orderSummaryLabelClass}>预估口径</div>
          <div className={orderSummaryMetaClass}>{buildEstimatedMeta(summary.filteredCount, summary.filteredRefundMetric)}</div>
        </div>
        <div className={orderSummaryHeroClassForMetric(summary.filteredProfitMetric)}>
          <span className={orderSummaryHeroLabelClass}>预估利润</span>
          <strong className={orderSummaryHeroValueClassForMetric(summary.filteredProfitMetric)}>{formatSummaryMetric(summary.filteredProfitMetric)}</strong>
        </div>
        <div className={orderSummaryLedgerClass}>
          <div className={orderSummaryLedgerIncomeClass}>
            <span className={orderSummaryLedgerLabelClass}>收入</span>
            <strong className={orderSummaryLedgerIncomeValueClass}>{formatSummaryMetric(summary.filteredSaleMetric)}</strong>
            <span className={orderSummaryLedgerNoteClass}>{buildIncomeNote(summary.filteredGrossSaleMetric, summary.filteredRefundMetric)}</span>
          </div>
          <div className={orderSummaryLedgerExpenseClass}>
            <span className={orderSummaryLedgerLabelClass}>支出</span>
            <strong className={orderSummaryLedgerExpenseValueClass}>{summary.filteredCount ? `¥ ${expenseValue.toFixed(2)}` : '-'}</strong>
            <span className={orderSummaryLedgerNoteClass}>{buildExpenseNote(summary.filteredPurchaseMetric, summary.filteredShippingMetric, summary.filteredPlatformFeeMetric, summary.filteredCreatorCommissionMetric)}</span>
          </div>
        </div>
      </section>
    );
  }

  function actualCard() {
    return (
      <section className={orderSummarySectionClass}>
        <div className={orderSummaryHeadClass}>
          <div className={orderSummaryLabelClass}>真实口径</div>
          <div className={orderSummaryMetaClass}>{buildActualMeta()}</div>
        </div>
        <div className={orderSummaryHeroClassForMetric(summary.filteredActualProfitMetric)}>
          <span className={orderSummaryHeroLabelClass}>实际利润</span>
          <strong className={orderSummaryHeroValueClassForMetric(summary.filteredActualProfitMetric)}>{formatSummaryMetric(summary.filteredActualProfitMetric)}</strong>
        </div>
        <div className={orderSummaryActualLedgerClass}>
          <div className={orderSummaryLedgerIncomeClass}>
            <span className={orderSummaryLedgerLabelClass}>结算金额</span>
            <strong className={orderSummaryLedgerIncomeValueClass}>{formatJpySummaryMetric(summary.filteredSettlementJpyMetric)}</strong>
            <span className={orderSummaryLedgerNoteClass}>折合 {formatSummaryMetric(summary.filteredSettlementCnyMetric)}</span>
          </div>
          <div className={orderSummaryLedgerExpenseClass}>
            <span className={orderSummaryLedgerLabelClass}>真实成本</span>
            <strong className={orderSummaryLedgerExpenseValueClass}>{formatSummaryMetric(summary.filteredActualCostMetric)}</strong>
            <span className={orderSummaryLedgerNoteClass}>采购价 + 贴单费，仅统计已结算订单</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className={orderSummarySurfaceClass}>
      <div className={orderSummaryGridClass}>
        {estimatedCard()}
        {actualCard()}
      </div>
    </div>
  );
}

function OrdersTable({
  orders,
  activeAccount,
  searchQuery,
  searchHelpOpen,
  sortOrder,
  pageSize,
  currentPage,
  pricingContext,
  onSearchChange,
  onSearchHelpOpenChange,
  onPageSizeChange,
  onPageChange,
  onSortToggle,
  onEdit,
  onDelete
}: {
  orders: OrderRecord[];
  activeAccount: string;
  searchQuery: string;
  searchHelpOpen: boolean;
  sortOrder: string;
  pageSize: number;
  currentPage: number;
  pricingContext: PricingContext;
  onSearchChange: (value: string) => void;
  onSearchHelpOpenChange: (open: boolean) => void;
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
              hint="搜索订单 / 产品 / 快递；日期如 05-01 或 cg:05-01"
              value={searchQuery}
              onChange={onSearchChange}
              after={(
                <SearchHelpButton
                  id="ot-search-help-btn"
                  modalId="ot-search-help-modal"
                  title="订单搜索说明"
                  open={searchHelpOpen}
                  onOpenChange={onSearchHelpOpenChange}
                  items={[
                    { label: '裸文本', children: 'NOMA、雨衣、5834、顺丰。会搜索订单号、账号、产品、快递、备注、状态等字段。' },
                    { label: '结算状态', children: '已结算、未结算、yjs、wjs。' },
                    { label: '裸日期', children: '05-18 等于 下单:2026-05-18。' },
                    { label: '定语日期', children: '采购:05-18、到仓:05-25；也可用英文键盘别名 cg:05-18、dc:05-25。' },
                    { label: '别名', children: 'xd=下单，cg=采购，dc=到仓。' },
                    { label: '符号兼容', children: '别名大小写不敏感，支持中文冒号、~ 或 ～、05/01 或 05.01、全角 ＞＝ / ＜＝。' },
                    { label: '范围', children: '下单:05-01～05-18，或 xd:05-01~05-18。' },
                    { label: '比较', children: '下单:>=05-01、采购:<=05-18，或 xd:>=05-01、cg:<=05-18。' },
                    { label: '组合', children: 'NOMA 雨衣 xd:05-01~05-18 cg:>=05-18。' }
                  ]}
                />
              )}
            />
          )}
          right={(
            <div className="inline-flex flex-wrap items-center gap-4 max-[768px]:gap-3">
              <TableSortButton id="ot-sort-btn" className="orders-react-sort" title={sortTitle} onClick={onSortToggle}>
                排序 {sortIcon}
              </TableSortButton>
              <ProductPager pageSize={pageState.pageSize} currentPage={pageState.currentPage} totalPages={pageState.totalPages} onPageSizeChange={onPageSizeChange} onPageChange={onPageChange} />
            </div>
          )}
        />
      </div>
      <TableViewport>
        <div id="ot-table-container">
          {!sorted.length ? (
            <ModuleListState
              tone="empty"
              title={searchQuery ? '没有匹配的订单' : activeAccount !== '__all__' ? `账号「${activeAccount}」下还没有订单` : '还没有订单'}
              description={searchQuery ? '试试更换关键词' : '点击右上角「+ 新增订单」开始记录'}
            />
          ) : (
            <TableFrame>
              <Table className="orders-react-table mt-1.5 min-w-[1360px] text-[13px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap [&_tbody_tr.is-refunded:hover]:bg-[rgba(196,78,78,.09)] [&_tbody_tr.is-refunded]:bg-[rgba(196,78,78,.055)] [&_tbody_tr:hover]:bg-[rgba(110,168,255,.05)] max-[768px]:text-[13px] max-[768px]:[&_td]:px-1.5 max-[768px]:[&_td]:py-[9px] max-[768px]:[&_th]:px-1.5 max-[768px]:[&_th]:py-[9px] max-[768px]:[&_th]:text-[10.5px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    {isAll ? <TableHead>账号</TableHead> : null}
                    <TableHead>下单时间</TableHead>
                    <TableHead>采购日期</TableHead>
                    <TableHead>最晚到仓</TableHead>
                    <TableHead>订单预警</TableHead>
                    <TableHead>订单号</TableHead>
                    <TableHead>产品名称</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>售价(円)</TableHead>
                    <TableHead>采购额(¥)</TableHead>
                    <TableHead>预估总海外运费(¥)</TableHead>
                    <TableHead>预估利润(¥)</TableHead>
                    <TableHead>结算金额(円)</TableHead>
                    <TableHead>实际利润(¥)</TableHead>
                    <TableHead>总重量</TableHead>
                    <TableHead>总尺寸</TableHead>
                    <TableHead>订单状态</TableHead>
                    <TableHead>快递公司</TableHead>
                    <TableHead>快递单号</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((order, index) => {
                    const absoluteIndex = startIndex + index;
                    const seqNum = sortOrder === 'asc' ? absoluteIndex + 1 : sorted.length - absoluteIndex;
                    const warn = computeWarning(order);
                    const profit = computeOrderEstimatedProfit(order, pricingContext);
                    const actualProfit = computeOrderActualProfit(order, pricingContext);
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
                        <TableCell>{formatTableCellValue(order['结算金额'])}</TableCell>
                        <TableCell><span className={getProfitValueClass(getProfitCellToneClass(actualProfit))}>{formatTableMoneyValue(actualProfit) || '-'}</span></TableCell>
                        <TableCell>{formatTableCellValue(order['重量'])}</TableCell>
                        <TableCell>{formatTableCellValue(order['尺寸'])}</TableCell>
                        <TableCell>{formatTableCellValue(order['订单状态'])}</TableCell>
                        <TableCell title={courierSummary}>{formatTableCellValue(courierSummary)}</TableCell>
                        <TableCell title={trackingSummary}>{formatTableCellValue(trackingSummary)}</TableCell>
                        <TableCell className={orderNoteCellClass} title={String(order['备注'] || '')}>
                          <span className={orderNoteTextClass}>{formatTableCellValue(order['备注'])}</span>
                        </TableCell>
                        <TableCell>
                          <div className={orderActionsClass}>
                            <Button size="smIcon" data-edit={String(order.id)} title="编辑订单" aria-label="编辑订单" onClick={() => onEdit(String(order.id))}>
                              <Pencil size={14} strokeWidth={2} />
                            </Button>
                            <Button size="smIcon" variant="danger" data-del={String(order.id)} title="删除订单" aria-label="删除订单" onClick={() => onDelete(String(order.id))}>
                              <Trash2 size={14} strokeWidth={2} />
                            </Button>
                          </div>
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

type OrderDateInputProps = ComponentProps<typeof Input>;

const orderDateInputWrapClass = 'relative w-full';
const orderDateInputClass = 'cursor-pointer pr-11 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:my-auto [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0';
const orderDateInputIconClass = 'pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text)]';

function showNativeDatePicker(input: HTMLInputElement) {
  const showPicker = (input as HTMLInputElement & { showPicker?: () => void }).showPicker;
  if (typeof showPicker !== 'function') {
    input.focus();
    return;
  }
  try {
    showPicker.call(input);
  } catch {
    input.focus();
  }
}

function OrderDateInput({ className, onClick, ...props }: OrderDateInputProps) {
  return (
    <div className={orderDateInputWrapClass}>
      <Input
        {...props}
        type="date"
        className={cn(orderDateInputClass, className)}
        onClick={event => {
          onClick?.(event);
          if (event.defaultPrevented || event.currentTarget.readOnly || event.currentTarget.disabled) return;
          showNativeDatePicker(event.currentTarget);
        }}
      />
      <CalendarDays className={orderDateInputIconClass} size={18} strokeWidth={2} aria-hidden="true" />
    </div>
  );
}

function OrderModal({
  open,
  draft,
  accounts,
  products,
  pricingContext,
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
  pricingContext: PricingContext;
  editingId: string;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: OrderDraft) => void;
  onSubmit: () => void;
  onAddAccount: () => void;
}) {
  const [shippingHelpOpen, setShippingHelpOpen] = useState(false);
  const ruleDraft = useMemo(() => computeShippingRuleDraft(draft, products, pricingContext), [draft, products, pricingContext]);
  const showRefreshShippingFee = shouldRefreshShippingFee(draft, ruleDraft);
  const pricingRuleText = pricingContext.rate
    ? `汇率 ${formatNumericValue(pricingContext.rate)} / 倍率 ${formatNumericValue(pricingContext.shippingMultiplier)} / 贴单 ${formatNumericValue(pricingContext.labelFee)}`
    : '请先在利润计算器填写汇率';

  function updateDraft(patch: Partial<OrderDraft>, auto = true) {
    const next = { ...draft, ...patch };
    onDraftChange(auto ? computeAutoFieldsWithContext(
      applyShippingRefreshPolicy(next, draft, products, pricingContext),
      products,
      pricingContext
    ) : next);
  }

  const orderDialog = (
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
              <OrderDateInput name="下单时间" required value={draft.orderedAt} onChange={event => updateDraft({ orderedAt: event.target.value })} />
            </FormField>
            <FormField label="采购日期">
              <OrderDateInput name="采购日期" value={draft.purchaseDate} onChange={event => updateDraft({ purchaseDate: event.target.value }, false)} />
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
              <Button
                id="ot-add-item-btn"
                onClick={() => {
                  const nextDraft = {
                    ...draft,
                    manualWeightText: false,
                    manualSizeText: false,
                    items: [...draft.items, createEmptyOrderItem()]
                  };
                  onDraftChange(computeAutoFieldsWithContext(
                    applyShippingRefreshPolicy(nextDraft, draft, products, pricingContext, true),
                    products,
                    pricingContext
                  ));
                }}
              >
                + 添加明细
              </Button>
            </div>
            <OrderItemsEditor draft={draft} products={products} pricingContext={pricingContext} onDraftChange={onDraftChange} />
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
              <Input name="重量" value={draft.weightText} onChange={event => updateDraft({ weightText: event.target.value, manualWeightText: true })} />
            </FormField>
            <FormField label={<>总尺寸(cm) <span className={orderInlineHintClass}>多个订单明细时请自行调整尺寸</span></>}>
              <Input name="尺寸" value={draft.sizeText} onChange={event => updateDraft({ sizeText: event.target.value, manualSizeText: true })} />
            </FormField>
          </FormRow>
          <FormRow columns={5} className={orderMoneyRowClass}>
            <FormField label="包邮转嫁" className="ot-transfer-field">
              <label className={cn('group', orderTransferToggleClass)} title="订单售价已包含原 350円 买家运费时打开">
                <input
                  className={orderTransferInputClass}
                  type="checkbox"
                  id="ot-free-shipping-transfer"
                  name="售价口径"
                  value={SALE_PRICING_MODE_TRANSFER}
                  checked={draft.salePricingMode === SALE_PRICING_MODE_TRANSFER}
                  onChange={event => updateDraft({
                    salePricingMode: event.target.checked ? SALE_PRICING_MODE_TRANSFER : SALE_PRICING_MODE_BUYER_PAID
                  })}
                />
                <span className={cn(orderTransferKnobClass, draft.salePricingMode === SALE_PRICING_MODE_TRANSFER ? orderTransferKnobCheckedClass : '')} aria-hidden="true"></span>
              </label>
            </FormField>
            <FormField label="售价（円）" className={cn(orderSaleFieldClass, draft.isRefunded ? 'is-refunded' : '')}>
              <div className={orderSaleInputWrapClass}>
                <DecimalInput className={draft.isRefunded ? 'opacity-0 pointer-events-none' : ''} id="ot-total-sale" name="售价" min="0" step="0.01" readOnly={draft.isRefunded} value={draft.salePrice} onChange={value => updateDraft({ salePrice: value })} />
                <div className={cn(orderSaleInputRefundClass, draft.isRefunded ? 'flex' : '')} aria-hidden="true">
                  <span className={orderSaleInputOriginalClass}>{draft.salePrice || '-'}</span>
                  <span className={orderSaleInputZeroClass}>0</span>
                </div>
              </div>
            </FormField>
            <FormField label="采购额（¥）">
              <DecimalInput id="ot-total-purchase" name="采购价格" min="0" step="0.01" value={draft.purchasePrice} onChange={value => updateDraft({ purchasePrice: value })} />
            </FormField>
            <FormField
              label={(
                <>
                  预估总海外运费（¥）
                  <Button
                    variant="plain"
                    className={orderShippingHelpButtonClass}
                    aria-controls="ot-shipping-rule-help-modal"
                    aria-haspopup="dialog"
                    aria-label="预估海外运费规则说明"
                    title="预估海外运费规则说明"
                    onClick={() => setShippingHelpOpen(true)}
                  >
                    <HelpCircle size={12} strokeWidth={2} aria-hidden="true" />
                  </Button>
                </>
              )}
            >
              <DecimalInput name="预估运费" min="0" step="0.01" value={draft.estimatedShippingFee} onChange={value => updateDraft({ estimatedShippingFee: value, shippingFeeMode: 'manual', manualEstimatedShippingFee: true })} />
            </FormField>
            <FormField
              label={(
                <>
                  参数
                  {showRefreshShippingFee ? (
                    <Button
                      size="none"
                      variant="accentSoft"
                      className={orderShippingRuleButtonClass}
                      title="根据当前参数刷新运费"
                      aria-label="根据当前参数刷新运费"
                      onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        onDraftChange(ruleDraft);
                      }}
                    >
                      <RotateCcw size={12} strokeWidth={2} aria-hidden="true" />
                      根据当前参数刷新运费
                    </Button>
                  ) : null}
                </>
              )}
            >
              <div className={orderShippingRuleClass} id="ot-shipping-rule-preview">
                <span className={orderShippingRuleTextClass}>{pricingRuleText}</span>
              </div>
            </FormField>
          </FormRow>
          <FormRow columns={5} className={orderMetaRowClass}>
            <FormField label="是否退款" className="ot-refund-field">
              <label className={cn('group', orderRefundToggleClass)}>
                <input className={orderRefundInputClass} type="checkbox" id="ot-is-refunded" name="是否退款" value="1" checked={draft.isRefunded} onChange={event => updateDraft({ isRefunded: event.target.checked })} />
                <span className={cn(orderRefundKnobClass, draft.isRefunded ? orderRefundKnobCheckedClass : '')} aria-hidden="true"></span>
              </label>
            </FormField>
            <FormField label="达人佣金率（%）">
              <DecimalInput name="达人佣金率" min="0" step="0.01" value={draft.creatorCommissionRate} onChange={value => updateDraft({ creatorCommissionRate: value })} />
            </FormField>
            <FormField label={<>达人佣金（¥） <InlineToken>自动</InlineToken></>}>
              <DecimalInput name="达人佣金" step="0.01" readOnly value={draft.creatorCommission} />
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
          <FormRow columns={3} className={orderSettlementRowClass}>
            <FormField label={<>预估利润（¥） <InlineToken>自动</InlineToken></>} labelClassName={orderProfitLabelClass}>
              <DecimalInput name="预估利润" step="0.01" readOnly value={draft.estimatedProfit} />
            </FormField>
            <FormField label="结算金额（円）">
              <DecimalInput name="结算金额" min="0" step="0.01" value={draft.settlementAmount} onChange={value => updateDraft({ settlementAmount: value })} />
            </FormField>
            <FormField label={<>实际利润（¥） <InlineToken>自动</InlineToken></>} labelClassName={orderProfitLabelClass}>
              <DecimalInput name="实际利润" step="0.01" readOnly value={draft.actualProfit} />
            </FormField>
          </FormRow>
          <FormRow columns={1} className="mt-[18px] max-[768px]:mt-3">
            <FormField label="备注" full>
              <Textarea
                name="备注"
                value={draft.note}
                placeholder="可记录采购沟通、异常处理、售后风险等"
                className="min-h-20 resize-y"
                onChange={event => updateDraft({ note: event.target.value }, false)}
              />
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
  const shippingRuleHelpDialog = (
    <Dialog
      id="ot-shipping-rule-help-modal"
      open={shippingHelpOpen}
      onOpenChange={setShippingHelpOpen}
      titleId="ot-shipping-rule-help-title"
    >
      <DialogContent className="max-w-[540px]">
        <DialogTitle id="ot-shipping-rule-help-title">预估海外运费规则</DialogTitle>
        <HelpStack>
          <HelpItem label="计算输入">使用订单总重量、总尺寸和货物类型匹配海外运费规则；多明细订单的总尺寸需要手动确认。</HelpItem>
          <HelpItem label="计费重量">规则会在实重和体积重之间取用于计费的重量，具体卡区、普货/特货费用由运费规则表决定。</HelpItem>
          <HelpItem label="金额换算">规则金额按当前汇率、运费倍率和贴单费计算为人民币，参数来自利润计算器。</HelpItem>
          <HelpItem label="订单处理">自动运费会随当前汇率、倍率和贴单费刷新；已有保存运费的老订单和手动改过运费的订单会保留原值。</HelpItem>
          <HelpItem label="刷新按钮">手动或老订单的金额不一致时，可点击“根据当前参数刷新运费”改回规则值。</HelpItem>
        </HelpStack>
        <DialogActions>
          <Button variant="primary" onClick={() => setShippingHelpOpen(false)}>知道了</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
  return (
    <>
      {orderDialog}
      {shippingRuleHelpDialog}
    </>
  );
}

function OrderTrashModal({
  open,
  orders,
  onOpenChange,
  onRestore,
  onPermanentlyDelete
}: {
  open: boolean;
  orders: OrderRecord[];
  onOpenChange: (open: boolean) => void;
  onRestore: (id: string) => void;
  onPermanentlyDelete: (id: string) => void;
}) {
  return (
    <Dialog id="ot-trash-modal" open={open} titleId="ot-trash-title" onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px]">
        <DialogTitle id="ot-trash-title">已删除订单</DialogTitle>
        <Alert variant="info" className={modalCopyClass}>
          <AlertDescription>这里显示被标记删除的订单。恢复只会清除当前订单的删除标记；彻底删除会从 Firestore 删除文档，不能从这里恢复。</AlertDescription>
        </Alert>
        {!orders.length ? (
          <ModuleListState tone="empty" title="没有已删除订单" description="被删除的订单会在这里显示，可直接恢复。" />
        ) : (
          <div id="ot-trash-list" className={orderTrashListClass}>
            {orders.map(order => {
              const id = String(order.id || '').trim();
              return (
                <div className={orderTrashItemClass} key={id || String(order.deletedAt)}>
                  <div className={orderTrashItemHeadClass}>
                    <div className="min-w-0">
                      <div className={orderTrashItemTitleClass} title={String(order['产品名称'] || order['订单号'] || id)}>
                        {formatTableCellValue(order['产品名称']) || formatTableCellValue(order['订单号']) || id}
                      </div>
                      <div className={orderTrashItemMetaClass}>
                        <span>账号：{formatTableCellValue(order['账号'])}</span>
                        <span>订单号：{formatTableCellValue(order['订单号'])}</span>
                        <span>下单：{formatTableCellValue(order['下单时间'])}</span>
                        <span>删除：{formatTableCellValue(order.deletedAt)}</span>
                      </div>
                    </div>
                    <div className={orderTrashActionsClass}>
                      <Button size="sm" variant="primary" disabled={!id} onClick={() => onRestore(id)}>
                        <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />恢复
                      </Button>
                      <Button size="sm" variant="danger" disabled={!id} onClick={() => onPermanentlyDelete(id)}>
                        <Trash2 size={14} strokeWidth={2} aria-hidden="true" />彻底删除
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <DialogActions>
          <Button id="ot-trash-close" onClick={() => onOpenChange(false)}>关闭</Button>
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

function OrdersPage({ active = true }: { active?: boolean }) {
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
  const unsubscribeSnapshotRef = useRef<(() => void) | null>(null);
  const markRemoteStaleRef = useRef<() => void>(() => {});
  const clientIdRef = useRef('');
  const syncRevisionRef = useRef('');
  const initialConfig = readGlobalConfig();
  const [connected, setConnected] = useState(() => !!initialConfig?.configText);
  const [loading, setLoading] = useState(() => !!initialConfig?.configText);
  const [syncText, setSyncText] = useState(() => {
    const status = buildFirestoreSyncStatus(initialConfig?.configText ? 'refreshing' : 'unconnected');
    return status.text;
  });
  const [syncClass, setSyncClass] = useState(() => {
    const status = buildFirestoreSyncStatus(initialConfig?.configText ? 'refreshing' : 'unconnected');
    return status.className;
  });
  const [projectId, setProjectId] = useState(() => initialConfig?.projectId || '');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [deletedOrders, setDeletedOrders] = useState<OrderRecord[]>([]);
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
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [editingAccountName, setEditingAccountName] = useState('');
  const [editingAccountValue, setEditingAccountValue] = useState('');
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
  const [deletingAccountName, setDeletingAccountName] = useState('');
  const [trashOpen, setTrashOpen] = useState(false);
  const [storageHelpOpen, setStorageHelpOpen] = useState(false);
  const [searchHelpOpen, setSearchHelpOpen] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [copyingRules, setCopyingRules] = useState(false);
  const [pricingContext, setPricingContext] = useState(() => ensureGlobalSettingsStore().getPricingContext());
  const exchangeRate = pricingContext.rate;

  const allAccounts = accounts;
  const accountTabItems = useMemo(() => allAccounts.map(account => ({
    key: account,
    label: account,
    count: orders.filter(order => normalizeAccountName(order['账号']) === account).length
  })), [allAccounts, orders]);

  const notifyAccountsChanged = useCallback((detail: Record<string, unknown> = {}) => {
    window.dispatchEvent(new CustomEvent(ACCOUNT_UPDATED_EVENT, {
      detail: {
        source: 'orders',
        projectId,
        ...detail
      }
    }));
  }, [projectId]);

  const formatFirestoreError = useCallback((error: unknown, fallback = '订单管理操作失败') => {
    const err = error as { code?: string; message?: string };
    const message = String(err?.message || '').trim();
    if (isPermissionDenied(error)) {
      return formatFirestoreRulesUpdateMessage('orders', ['orders.read', 'orders.write', 'products.read']);
    }
    return message || fallback;
  }, []);

  const markPermissionBlocked = useCallback(() => {
    if (unsubscribeSnapshotRef.current) {
      unsubscribeSnapshotRef.current();
      unsubscribeSnapshotRef.current = null;
    }
    setConnected(true);
    setPermissionBlocked(true);
    setOrders([]);
    setDeletedOrders([]);
    setAccounts([]);
    setProducts([]);
    setSyncText('');
    setSyncClass('error');
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
      if (isPermissionDenied(error)) throw error;
      showToast(formatFirestoreError(error, '商品资料加载失败'), 'error');
      return [];
    }
  }, [formatFirestoreError]);

  const connectUsingGlobalConfig = useCallback(async () => {
    const cfg = readGlobalConfig();
    if (!cfg?.configText) {
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }
      setConnected(false);
      setPermissionBlocked(false);
      const status = buildFirestoreSyncStatus('unconnected');
      setSyncText(status.text);
      setSyncClass(status.className);
      return false;
    }
    setLoading(true);
    const refreshingStatus = buildFirestoreSyncStatus('refreshing');
    setSyncText(refreshingStatus.text);
    setSyncClass(refreshingStatus.className);
    try {
      await providerRef.current.init({ configText: cfg.configText });
      const [snapshot] = await Promise.all([
        providerRef.current.pullSnapshot({ cursor: '' }),
        loadProducts()
      ]);
      setOrders(snapshot.orders || []);
      setDeletedOrders(snapshot.deletedOrders || []);
      setAccounts(snapshot.accounts || []);
      syncRevisionRef.current = String(snapshot.syncRevision || '');
      setProjectId(cfg.projectId || '');
      setConnected(true);
      setPermissionBlocked(false);
      const status = buildFirestoreSyncStatus(snapshot.hasPendingWrites ? 'queueing' : 'confirmed', {
        action: '订单更改',
        count: (snapshot.orders || []).length,
        unit: '条'
      });
      setSyncText(status.text);
      setSyncClass(status.className);
      if (unsubscribeSnapshotRef.current) unsubscribeSnapshotRef.current();
      unsubscribeSnapshotRef.current = providerRef.current.subscribeSnapshot(nextSnapshot => {
        if (!nextSnapshot.hasExternalChanges) return;
        syncRevisionRef.current = String(nextSnapshot.syncRevision || syncRevisionRef.current);
        const staleStatus = buildFirestoreSyncStatus('stale');
        setSyncText(staleStatus.text);
        setSyncClass(staleStatus.className);
        markRemoteStaleRef.current();
      }, error => {
        if (isPermissionDenied(error)) {
          markPermissionBlocked();
          return;
        }
        const failedStatus = buildFirestoreSyncStatus('failed', {
          error: formatFirestoreError(error, '订单实时同步失败')
        });
        setSyncText(failedStatus.text);
        setSyncClass(failedStatus.className);
        showToast(formatFirestoreError(error, '订单实时同步失败'), 'error');
      }, {
        clientId: clientIdRef.current,
        currentRevision: syncRevisionRef.current
      });
      return true;
    } catch (error) {
      if (isPermissionDenied(error)) {
        setProjectId(cfg.projectId || '');
        markPermissionBlocked();
        return false;
      }
      setConnected(false);
      setSyncText('加载失败');
      setSyncClass('error');
      showToast(formatFirestoreError(error, '恢复连接失败'), 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [formatFirestoreError, loadProducts, markPermissionBlocked]);

  const remoteStaleRefresh = useStaleAutoRefresh({
    canRefresh: connected && !permissionBlocked && !loading && !modalOpen && !accountModalOpen && !accountEditOpen && !accountDeleteOpen && !trashOpen,
    onRefresh: connectUsingGlobalConfig,
    onRefreshError: error => {
      if (isPermissionDenied(error)) {
        markPermissionBlocked();
        return;
      }
      const failedStatus = buildFirestoreSyncStatus('failed', { error: formatFirestoreError(error, '自动刷新失败') });
      setSyncText(failedStatus.text);
      setSyncClass(failedStatus.className);
      showToast(formatFirestoreError(error, '自动刷新失败'), 'error');
    }
  });

  useEffect(() => {
    markRemoteStaleRef.current = remoteStaleRefresh.markStale;
    return () => {
      markRemoteStaleRef.current = () => {};
    };
  }, [remoteStaleRefresh.markStale]);

  const displaySyncText = useMemo(() => {
    if (syncClass !== 'stale') return syncText;
    return buildFirestoreSyncStatus('stale', {
      autoRefreshSeconds: remoteStaleRefresh.remainingSeconds
    }).text;
  }, [remoteStaleRefresh.remainingSeconds, syncClass, syncText]);

  useEffect(() => {
    clientIdRef.current = getRuntimeClientId();
    void connectUsingGlobalConfig();
  }, [connectUsingGlobalConfig]);

  useEffect(() => {
    const store = ensureGlobalSettingsStore();
    setPricingContext(store.getPricingContext());
    const refreshPricingContext = () => {
      setPricingContext(store.getPricingContext());
    };
    const unsubscribe = store.subscribe(refreshPricingContext);
    window.addEventListener(SETTINGS_CHANGED_EVENT, refreshPricingContext);
    return () => {
      unsubscribe();
      window.removeEventListener(SETTINGS_CHANGED_EVENT, refreshPricingContext);
    };
  }, [modalOpen, products]);

  useEffect(() => {
    if (!modalOpen) return;
    setDraft(previous => computeAutoFieldsWithContext(previous, products, pricingContext));
  }, [modalOpen, pricingContext, products]);

  useEffect(() => {
    const handleConnectionChange = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean }>).detail || {};
      if (detail.connected === false || !readGlobalConfig()?.configText) {
        if (unsubscribeSnapshotRef.current) {
          unsubscribeSnapshotRef.current();
          unsubscribeSnapshotRef.current = null;
        }
        setConnected(false);
        setPermissionBlocked(false);
        setOrders([]);
        setDeletedOrders([]);
        setProducts([]);
        setProjectId('');
        const status = buildFirestoreSyncStatus('unconnected');
        setSyncText(status.text);
        setSyncClass(status.className);
        return;
      }
      void connectUsingGlobalConfig();
    };
    const handleProductsChanged = () => {
      void loadProducts();
    };
    const handleAccountsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string; action?: string; oldAccount?: string; account?: string; accounts?: string[] }>).detail || {};
      if (detail.source === 'orders' || !readGlobalConfig()?.configText) return;
      if (Array.isArray(detail.accounts)) {
        const nextAccounts = uniqueAccounts(detail.accounts);
        setAccounts(nextAccounts);
        setActiveAccount(current => current === '__all__' || nextAccounts.includes(current) ? current : '__all__');
        setCurrentPage(1);
      }
      if (detail.action === 'rename' && detail.oldAccount && detail.account) {
        const oldName = normalizeAccountName(detail.oldAccount);
        const newName = normalizeAccountName(detail.account);
        setOrders(previous => previous.map(order => (
          normalizeAccountName(order['账号']) === oldName ? { ...order, '账号': newName } : order
        )));
      }
      if (detail.action === 'reorder' || detail.action === 'upsert' || detail.action === 'rename' || detail.action === 'delete') return;
      void connectUsingGlobalConfig();
    };
    window.addEventListener('tk-firestore-config-changed', handleConnectionChange);
    window.addEventListener('tk-products-changed', handleProductsChanged);
    window.addEventListener(ACCOUNT_UPDATED_EVENT, handleAccountsChanged);
    return () => {
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }
      window.removeEventListener('tk-firestore-config-changed', handleConnectionChange);
      window.removeEventListener('tk-products-changed', handleProductsChanged);
      window.removeEventListener(ACCOUNT_UPDATED_EVENT, handleAccountsChanged);
    };
  }, [connectUsingGlobalConfig, loadProducts]);

  useEffect(() => {
    if (!active || !connected || !readGlobalConfig()?.configText) return;
    void connectUsingGlobalConfig();
  }, [active, connected, connectUsingGlobalConfig]);

  useEffect(() => {
    if (activeAccount === '__all__' || allAccounts.includes(activeAccount)) return;
    setActiveAccount('__all__');
    setCurrentPage(1);
  }, [activeAccount, allAccounts]);

  async function copyFirestoreRules() {
    setCopyingRules(true);
    try {
      await TKFirestoreConnection.copyRules();
      showToast('Firestore 规则已复制');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '规则复制失败', 'error');
    } finally {
      setCopyingRules(false);
    }
  }

  function openOrderModal(id = '') {
    const order = id ? orders.find(item => String(item.id) === id) || null : null;
    setEditingId(id);
    setDraft(computeAutoFieldsWithContext(buildDraftFromOrder(order, activeAccount, allAccounts), products, pricingContext));
    setModalOpen(true);
    void loadProducts();
  }

  function markOrdersSynced(count = orders.length) {
    const status = buildFirestoreSyncStatus('confirmed', {
      action: '订单更改',
      count,
      unit: '条'
    });
    setSyncText(status.text);
    setSyncClass(status.className);
  }

  function markOrdersUnconnected() {
    const status = buildFirestoreSyncStatus('unconnected');
    setSyncText(status.text);
    setSyncClass(status.className);
  }

  function markOrderWriteFailed(error: unknown, fallback: string, statusError = 'Firestore 写入失败，已保留本地视图') {
    if (isPermissionDenied(error)) {
      markPermissionBlocked();
    } else {
      const failedStatus = buildFirestoreSyncStatus('failed', { error: statusError });
      setSyncText(failedStatus.text);
      setSyncClass(failedStatus.className);
    }
    showToast(formatFirestoreError(error, fallback), 'error');
  }

  async function persistOrderUpsert(payload: OrderRecord, nextOrders: OrderRecord[], nextAccounts = allAccounts) {
    setOrders(nextOrders);
    setAccounts(nextAccounts);
    const queueStatus = buildFirestoreSyncStatus('queueing', { action: '订单保存' });
    setSyncText(queueStatus.text);
    setSyncClass(queueStatus.className);
    const cfg = readGlobalConfig();
    if (!cfg?.configText) {
      markOrdersUnconnected();
      return;
    }
    const accountName = normalizeAccountName(payload['账号']);
    let result: Awaited<ReturnType<typeof providerRef.current.pushChanges>>;
    try {
      result = await providerRef.current.pushChanges({
        upserts: [payload],
        accountUpserts: accountName ? [accountName] : [],
        clientId: clientIdRef.current,
        assignSeq: true,
        waitForCommit: false
      });
    } catch (error) {
      markOrderWriteFailed(error, '写入失败');
      return;
    }
    setPermissionBlocked(false);
    const displayedOrders = mergeAssignedOrders(nextOrders, result?.assignedOrders || []);
    setOrders(displayedOrders);
    const focusedPage = getOrderPageForId({
      orders: displayedOrders,
      activeAccount,
      searchQuery,
      sortOrder,
      pageSize,
      orderId: payload.id
    });
    if (focusedPage !== null) setCurrentPage(focusedPage);
    result?.commitPromise?.then(() => {
      setPermissionBlocked(false);
      markOrdersSynced(displayedOrders.length);
    }).catch(error => {
      if (isPermissionDenied(error)) markPermissionBlocked();
      const failedStatus = buildFirestoreSyncStatus('failed', { error: 'Firestore 写入失败，已保留本地视图' });
      setSyncText(failedStatus.text);
      setSyncClass(failedStatus.className);
      showToast(formatFirestoreError(error, '写入失败'), 'error');
    });
  }

  async function persistOrderDeletion(deletedOrder: OrderRecord | null, nextOrders: OrderRecord[]) {
    const deletedId = String(deletedOrder?.id || '').trim();
    if (!deletedId) return;
    const deletedAt = nowIso();
    const nextDeletedOrders = [
      normalizeOrderRecord({ ...deletedOrder, deletedAt, updatedAt: deletedAt }),
      ...deletedOrders.filter(order => String(order.id) !== deletedId)
    ];
    setOrders(nextOrders);
    setDeletedOrders(nextDeletedOrders);
    const queueStatus = buildFirestoreSyncStatus('queueing', { action: '订单删除' });
    setSyncText(queueStatus.text);
    setSyncClass(queueStatus.className);
    const cfg = readGlobalConfig();
    if (!cfg?.configText) {
      markOrdersUnconnected();
      return;
    }
    let result: Awaited<ReturnType<typeof providerRef.current.pushChanges>>;
    try {
      result = await providerRef.current.pushChanges({
        deletions: [{
          id: deletedId,
          accountName: deletedOrder?.['账号'] || '',
          deletedAt
        }],
        clientId: clientIdRef.current,
        assignSeq: false,
        waitForCommit: false
      });
    } catch (error) {
      markOrderWriteFailed(error, '删除失败', 'Firestore 删除失败，已保留本地视图');
      return;
    }
    setPermissionBlocked(false);
    result?.commitPromise?.then(() => {
      setPermissionBlocked(false);
      markOrdersSynced(nextOrders.length);
    }).catch(error => {
      if (isPermissionDenied(error)) markPermissionBlocked();
      const failedStatus = buildFirestoreSyncStatus('failed', { error: 'Firestore 删除失败，已保留本地视图' });
      setSyncText(failedStatus.text);
      setSyncClass(failedStatus.className);
      showToast(formatFirestoreError(error, '删除失败'), 'error');
    });
  }

  async function submitOrder() {
    const ruleDraft = computeShippingRuleDraft(draft, products, pricingContext);
    const shouldPreserveShippingFee = shouldRefreshShippingFee(draft, ruleDraft);
    const draftForSubmit = shouldPreserveShippingFee ? preserveEstimatedShippingFee(draft) : draft;
    const autoDraft = computeAutoFieldsWithContext(draftForSubmit, products, pricingContext);
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
      if (!isPositiveIntegerText(item.quantity)) {
        showToast('每条明细的数量必须是大于等于 1 的整数', 'error');
        return;
      }
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
      '售价口径': normalizeOrderSalePricingMode(autoDraft.salePricingMode),
      salePricingMode: normalizeOrderSalePricingMode(autoDraft.salePricingMode),
      '达人佣金率': autoDraft.creatorCommissionRate,
      '达人佣金': autoDraft.creatorCommission,
      '采购价格': autoDraft.purchasePrice,
      '售价': autoDraft.salePrice,
      '预估运费': autoDraft.estimatedShippingFee,
      estimatedShippingFeeMode: autoDraft.shippingFeeMode,
      '预估利润': autoDraft.estimatedProfit,
      '结算金额': autoDraft.settlementAmount,
      '实际利润': autoDraft.actualProfit,
      '重量': autoDraft.weightText,
      '尺寸': autoDraft.sizeText,
      '订单状态': autoDraft.orderStatus,
      '快递公司': uniqueCompanies.length === 1 ? uniqueCompanies[0] : '',
      '快递单号': uniqueTrackings.length === 1 ? uniqueTrackings[0] : '',
      '备注': autoDraft.note.trim(),
      items: autoDraft.items
    });
    const nextOrders = editingId
      ? orders.map(order => String(order.id) === editingId ? payload : order)
      : [payload, ...orders];
    setModalOpen(false);
    setEditingId('');
    await persistOrderUpsert(payload, nextOrders, allAccounts);
    showToast('已保存到本地');
  }

  async function deleteOrder(id: string) {
    if (!window.confirm('确定删除这条订单？删除后会进入“已删除订单”，可以在列表里恢复。')) return;
    const deletedOrder = orders.find(order => String(order.id) === id) || null;
    const nextOrders = orders.filter(order => String(order.id) !== id);
    await persistOrderDeletion(deletedOrder, nextOrders);
    showToast('已删除');
  }

  async function restoreOrder(id: string) {
    const restored = deletedOrders.find(order => String(order.id) === id) || null;
    if (!restored) return;
    const payload = normalizeOrderRecord({
      ...restored,
      deletedAt: '',
      updatedAt: nowIso()
    });
    const nextDeletedOrders = deletedOrders.filter(order => String(order.id) !== id);
    const nextOrders = [payload, ...orders.filter(order => String(order.id) !== id)];
    setDeletedOrders(nextDeletedOrders);
    setOrders(nextOrders);
    const queueStatus = buildFirestoreSyncStatus('queueing', { action: '订单恢复' });
    setSyncText(queueStatus.text);
    setSyncClass(queueStatus.className);
    const cfg = readGlobalConfig();
    if (!cfg?.configText) {
      markOrdersUnconnected();
      return;
    }
    let result: Awaited<ReturnType<typeof providerRef.current.pushChanges>>;
    try {
      result = await providerRef.current.pushChanges({
        upserts: [payload],
        clientId: clientIdRef.current,
        assignSeq: false,
        waitForCommit: false
      });
    } catch (error) {
      markOrderWriteFailed(error, '恢复失败', 'Firestore 恢复失败，已保留本地视图');
      return;
    }
    setPermissionBlocked(false);
    const focusedPage = getOrderPageForId({
      orders: nextOrders,
      activeAccount,
      searchQuery,
      sortOrder,
      pageSize,
      orderId: id
    });
    if (focusedPage !== null) setCurrentPage(focusedPage);
    result?.commitPromise?.then(() => {
      setPermissionBlocked(false);
      markOrdersSynced(nextOrders.length);
    }).catch(error => {
      if (isPermissionDenied(error)) markPermissionBlocked();
      const failedStatus = buildFirestoreSyncStatus('failed', { error: 'Firestore 恢复失败，已保留本地视图' });
      setSyncText(failedStatus.text);
      setSyncClass(failedStatus.className);
      showToast(formatFirestoreError(error, '恢复失败'), 'error');
    });
    setTrashOpen(false);
    showToast('订单已恢复');
  }

  async function permanentlyDeleteOrder(id: string) {
    const deletedOrder = deletedOrders.find(order => String(order.id) === id) || null;
    if (!deletedOrder) return;
    if (!window.confirm('确定彻底删除这条订单？此操作会从 Firestore 删除文档，删除后不能从“已删除订单”恢复。')) return;
    const nextDeletedOrders = deletedOrders.filter(order => String(order.id) !== id);
    setDeletedOrders(nextDeletedOrders);
    const queueStatus = buildFirestoreSyncStatus('queueing', { action: '订单彻底删除' });
    setSyncText(queueStatus.text);
    setSyncClass(queueStatus.className);
    const cfg = readGlobalConfig();
    if (!cfg?.configText) {
      markOrdersUnconnected();
      showToast('已从本地已删除列表移除');
      return;
    }
    let result: Awaited<ReturnType<typeof providerRef.current.permanentlyDeleteOrder>>;
    try {
      result = await providerRef.current.permanentlyDeleteOrder(id, { clientId: clientIdRef.current, waitForCommit: false });
    } catch (error) {
      setDeletedOrders(previous => previous.some(order => String(order.id) === id) ? previous : [deletedOrder, ...previous]);
      markOrderWriteFailed(error, '彻底删除失败', 'Firestore 彻底删除失败，已恢复到已删除列表');
      return;
    }
    setPermissionBlocked(false);
    result?.commitPromise?.then(() => {
      setPermissionBlocked(false);
      markOrdersSynced(orders.length);
    }).catch(error => {
      setDeletedOrders(previous => previous.some(order => String(order.id) === id) ? previous : [deletedOrder, ...previous]);
      if (isPermissionDenied(error)) markPermissionBlocked();
      const failedStatus = buildFirestoreSyncStatus('failed', { error: 'Firestore 彻底删除失败，已恢复到已删除列表' });
      setSyncText(failedStatus.text);
      setSyncClass(failedStatus.className);
      showToast(formatFirestoreError(error, '彻底删除失败'), 'error');
    });
    showToast('已提交彻底删除');
  }

  async function addAccount() {
    const name = newAccountName.trim();
    if (!name) return;
    if (allAccounts.includes(name)) {
      showToast('该账号已存在', 'error');
      return;
    }
    const nextAccounts = uniqueAccounts([...allAccounts, name]);
    setAccounts(nextAccounts);
    setActiveAccount(name);
    setCurrentPage(1);
    setDraft(previous => ({ ...previous, accountName: name }));
    setNewAccountName('');
    setAccountModalOpen(false);
    setPermissionBlocked(false);
    const queueStatus = buildFirestoreSyncStatus('queueing', { action: '账号保存' });
    setSyncText(queueStatus.text);
    setSyncClass(queueStatus.className);
    notifyAccountsChanged({ action: 'upsert', account: name, accounts: nextAccounts });
    try {
      const result = await providerRef.current.pushChanges({
        accountUpserts: [name],
        accountSortOrder: nextAccounts,
        clientId: clientIdRef.current,
        assignSeq: false,
        waitForCommit: false
      });
      result?.commitPromise?.then(() => {
        setPermissionBlocked(false);
        markOrdersSynced(orders.length);
        notifyAccountsChanged({ action: 'commit', account: name, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        const failedStatus = buildFirestoreSyncStatus('failed', { error: 'Firestore 写入失败，已保留本地视图' });
        setSyncText(failedStatus.text);
        setSyncClass(failedStatus.className);
        showToast(formatFirestoreError(error, '账号保存失败'), 'error');
      });
      showToast('账号已添加');
    } catch (error) {
      markOrderWriteFailed(error, '账号保存失败');
    }
  }

  async function reorderAccounts(nextOrder: string[]) {
    const nextAccounts = uniqueAccounts(nextOrder);
    if (!nextAccounts.length) return;
    setAccounts(nextAccounts);
    notifyAccountsChanged({ action: 'reorder', accounts: nextAccounts });
    try {
      const result = await providerRef.current.pushChanges({
        accountSortOrder: nextAccounts,
        clientId: clientIdRef.current,
        assignSeq: false,
        waitForCommit: false
      });
      const syncedCount = orders.length;
      result?.commitPromise?.then(() => {
        markOrdersSynced(syncedCount);
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        showToast(formatFirestoreError(error, '账号排序保存失败'), 'error');
      });
    } catch (error) {
      markOrderWriteFailed(error, '账号排序保存失败', 'Firestore 账号排序保存失败，已保留本地视图');
    }
  }

  function openEditAccount(account: string) {
    setEditingAccountName(account);
    setEditingAccountValue(account);
    setAccountEditOpen(true);
  }

  function openDeleteAccount(account: string) {
    setDeletingAccountName(account);
    setAccountDeleteOpen(true);
  }

  async function renameAccount() {
    const oldName = editingAccountName.trim();
    const newName = editingAccountValue.trim();
    if (!oldName || !newName) return;
    if (oldName === newName) {
      setAccountEditOpen(false);
      return;
    }
    if (allAccounts.some(account => account !== oldName && account === newName)) {
      showToast('该账号已存在', 'error');
      return;
    }
    const nextAccounts = allAccounts.map(account => account === oldName ? newName : account);
    const nextOrders = orders.map(order => (
      normalizeAccountName(order['账号']) === oldName ? { ...order, '账号': newName } : order
    ));
    setAccounts(nextAccounts);
    setOrders(nextOrders);
    if (activeAccount === oldName) setActiveAccount(newName);
    setCurrentPage(1);
    setAccountEditOpen(false);
    setEditingAccountName('');
    setEditingAccountValue('');
    setPermissionBlocked(false);
    const queueStatus = buildFirestoreSyncStatus('queueing', { action: '账号名保存' });
    setSyncText(queueStatus.text);
    setSyncClass(queueStatus.className);
    notifyAccountsChanged({ action: 'rename', oldAccount: oldName, account: newName, accounts: nextAccounts });
    try {
      const result = await providerRef.current.renameAccount(oldName, newName, { accountOrder: allAccounts, clientId: clientIdRef.current, waitForCommit: false });
      if (result?.commitPromise) result.commitPromise.then(() => {
        setPermissionBlocked(false);
        markOrdersSynced(nextOrders.length);
        notifyAccountsChanged({ action: 'commit', account: newName, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        const failedStatus = buildFirestoreSyncStatus('failed', { error: 'Firestore 写入失败，已保留本地视图' });
        setSyncText(failedStatus.text);
        setSyncClass(failedStatus.className);
        showToast(formatFirestoreError(error, '账号名保存失败'), 'error');
      });
      showToast('账号名已更新');
    } catch (error) {
      markOrderWriteFailed(error, '账号名保存失败');
    }
  }

  async function deleteAccount() {
    const name = deletingAccountName.trim();
    if (!name) return;
    const nextAccounts = allAccounts.filter(account => account !== name);
    setAccounts(nextAccounts);
    setActiveAccount(current => current === name ? '__all__' : current);
    setCurrentPage(1);
    setAccountDeleteOpen(false);
    setDeletingAccountName('');
    setPermissionBlocked(false);
    const queueStatus = buildFirestoreSyncStatus('queueing', { action: '账号名删除' });
    setSyncText(queueStatus.text);
    setSyncClass(queueStatus.className);
    notifyAccountsChanged({ action: 'delete', account: name, accounts: nextAccounts });
    try {
      const result = await providerRef.current.deleteAccount(name, { accountOrder: allAccounts, clientId: clientIdRef.current, waitForCommit: false });
      if (result?.commitPromise) result.commitPromise.then(() => {
        setPermissionBlocked(false);
        markOrdersSynced(orders.length);
        notifyAccountsChanged({ action: 'commit-delete', account: name, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) markPermissionBlocked();
        const failedStatus = buildFirestoreSyncStatus('failed', { error: 'Firestore 写入失败，已保留本地视图' });
        setSyncText(failedStatus.text);
        setSyncClass(failedStatus.className);
        showToast(formatFirestoreError(error, '账号名删除失败'), 'error');
      });
      showToast('账号名已删除，数据仍在全部里');
    } catch (error) {
      markOrderWriteFailed(error, '账号名删除失败');
    }
  }

  return (
    <>
      <ModuleWorkspace className="orders-page" data-react-orders-page-ready="true">
        <ModuleHeader
          title="订单管理"
          description="记录每笔订单的商品、采购、物流、售价和状态，按账号汇总收入、支出、退款、预估利润和结算利润。"
        />

        <Card id="ot-main" className={!connected ? orderSetupCardClass : undefined}>
          <ModuleStatusBar id="ot-header-status-row" className={cn(orderHeaderRowClass, 'ot-header-status-row')}>
            <div className={statusStripClass}>
              <div className={statusStripLeftClass}>
              {connected && !permissionBlocked ? <Badge id="ot-sync" className={syncStatusClass(syncClass)}>{displaySyncText}</Badge> : null}
              <Button id="ot-refresh" variant="plain" className={refreshButtonClass(loading)} aria-label="刷新订单数据" title="刷新订单数据" disabled={loading} aria-busy={loading ? 'true' : 'false'} onClick={() => void remoteStaleRefresh.refreshNow()}>
                <RefreshCw size={15} strokeWidth={2} aria-hidden="true" className={loading ? 'is-spinning' : ''} />
              </Button>
              <Button id="ot-storage-help-btn" variant="plain" className={storageHelpButtonClass} aria-controls="ot-storage-help-modal" aria-haspopup="dialog" aria-label="数据存储说明" title="数据存储说明" onClick={() => setStorageHelpOpen(true)}>
                <HelpCircle size={15} strokeWidth={2} aria-hidden="true" />
              </Button>
            </div>
          </div>
          </ModuleStatusBar>
          {!connected ? (
          <ModuleListState
            tone="connect"
            title="连接数据库"
            description="订单管理和商品管理共用同一个 Firestore 项目。先连接一次，两个模块都会直接复用。"
            actions={[{ id: 'ot-open-connection', label: '连接 Firebase', variant: 'primary', onClick: () => TKFirestoreConnection.open() }]}
          />
          ) : permissionBlocked ? (
          <ModuleListState
            tone="permission"
            title="数据库权限不足"
            description="当前数据库权限不足，订单管理保存不可用。复制最新 Firestore 规则发布后刷新页面。"
            actions={[
              { label: '打开 Firebase Console', onClick: () => TKFirestoreConnection.openConsole() },
              { label: copyingRules ? '复制中…' : '复制 Firestore 规则', variant: 'primary', disabled: copyingRules, onClick: () => void copyFirestoreRules() }
            ]}
          />
          ) : (
            <>
              <ModuleToolbar id="ot-header-summary-row" className={cn(orderHeaderRowClass, 'ot-header-summary-row')}>
              <div id="ot-summary-container" className={orderSummaryContainerClass}>
                <OrdersSummary orders={orders} activeAccount={activeAccount} searchQuery={searchQuery} sortOrder={sortOrder} pricingContext={pricingContext} />
              </div>
              </ModuleToolbar>
              <ModuleAccountTabs id="ot-header-accounts-row" className={cn(orderHeaderRowClass, 'ot-header-accounts-row')}>
              <AccountTabsBar
                id="ot-acc-tabs"
                activeKey={activeAccount}
                allCount={orders.length}
                allTabsId="ot-acc-tabs-all"
                scrollId="ot-acc-tabs-scroll"
                items={accountTabItems}
                addAccountButton={{ id: 'ot-tab-add', title: '添加账号', onClick: () => setAccountModalOpen(true) }}
                onEditAccount={openEditAccount}
                onDeleteAccount={openDeleteAccount}
                onReorder={reorderAccounts}
                actionsId="ot-acc-actions"
                onChange={account => { setActiveAccount(account); setCurrentPage(1); }}
                actions={(
                  <>
                    <Button id="ot-trash" onClick={() => setTrashOpen(true)}><RotateCcw size={14} strokeWidth={2} aria-hidden="true" />已删除订单列表{deletedOrders.length ? ` ${deletedOrders.length}` : ''}</Button>
                    <Button id="ot-add" variant="primary" onClick={() => openOrderModal()}><Plus size={14} strokeWidth={2} aria-hidden="true" />新增订单</Button>
                  </>
                )}
              />
              </ModuleAccountTabs>
              <ModuleTableShell>
                <OrdersTable
              orders={orders}
              activeAccount={activeAccount}
              searchQuery={searchQuery}
              searchHelpOpen={searchHelpOpen}
              sortOrder={sortOrder}
              pageSize={pageSize}
              currentPage={currentPage}
              pricingContext={pricingContext}
              onSearchChange={value => { setSearchQuery(value); setCurrentPage(1); }}
              onSearchHelpOpenChange={setSearchHelpOpen}
              onPageSizeChange={value => { setPageSize(Math.max(1, Number(value) || 50)); setCurrentPage(1); }}
              onPageChange={delta => setCurrentPage(page => Math.max(1, page + delta))}
              onSortToggle={() => { setSortOrder(value => value === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
              onEdit={openOrderModal}
              onDelete={deleteOrder}
            />
              </ModuleTableShell>
            </>
          )}
        </Card>
      </ModuleWorkspace>

      <OrderModal
        open={modalOpen}
        draft={draft}
        accounts={allAccounts}
        products={products}
        pricingContext={pricingContext}
        editingId={editingId}
        onOpenChange={open => { setModalOpen(open); if (!open) setEditingId(''); }}
        onDraftChange={setDraft}
        onSubmit={submitOrder}
        onAddAccount={() => setAccountModalOpen(true)}
      />
      <AddAccountDialog
        modalId="ot-add-acc-modal"
        formId="ot-add-acc-form"
        inputId="ot-new-acc-input"
        open={accountModalOpen}
        value={newAccountName}
        onValueChange={setNewAccountName}
        onOpenChange={setAccountModalOpen}
        onConfirm={addAccount}
      />
      <AccountEditDialog
        modalId="ot-edit-acc-modal"
        formId="ot-edit-acc-form"
        inputId="ot-edit-acc-input"
        open={accountEditOpen}
        accountName={editingAccountName}
        value={editingAccountValue}
        onValueChange={setEditingAccountValue}
        onOpenChange={setAccountEditOpen}
        onConfirm={renameAccount}
      />
      <AccountDeleteDialog
        modalId="ot-delete-acc-modal"
        open={accountDeleteOpen}
        accountName={deletingAccountName}
        onOpenChange={setAccountDeleteOpen}
        onConfirm={deleteAccount}
      />
      <OrderTrashModal
        open={trashOpen}
        orders={deletedOrders}
        onOpenChange={setTrashOpen}
        onRestore={id => void restoreOrder(id)}
        onPermanentlyDelete={id => void permanentlyDeleteOrder(id)}
      />
      <StorageHelpModal open={storageHelpOpen} onOpenChange={setStorageHelpOpen} />
    </>
  );
}

export { OrdersPage };
