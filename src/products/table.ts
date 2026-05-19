import type { DeriveDisplayedProductsOptions, ProductLogisticsDefaults, ProductRecord, ProductSku, ProductSortOrder } from './types.ts';
import {
  matchesParsedSearchQuery,
  normalizeSearchValue,
  parseSearchQuery
} from '../search-query.ts';

function toNumber(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatText(value: unknown): string {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatMoney(value: unknown): string {
  const amount = toNumber(value);
  return amount === null ? '-' : `¥ ${amount.toFixed(2)}`;
}

function getProductSkus(product: ProductRecord = {}): ProductSku[] {
  return Array.isArray(product?.skus) ? product.skus.filter(sku => String(sku?.skuId || '').trim()) : [];
}

function getProductDefaults(product: ProductRecord = {}): ProductLogisticsDefaults {
  return product?.defaults && typeof product.defaults === 'object'
    ? product.defaults
    : product;
}

function skuUsesProductDefaults(sku: ProductSku = {}): boolean {
  if (sku?.useProductDefaults === true) return true;
  if (sku?.useProductDefaults === false) return false;
  const hasOwnSpec = !!String(sku?.weightG || '').trim()
    || !!String(sku?.sizeText || '').trim()
    || !!String(sku?.lengthCm || '').trim()
    || !!String(sku?.widthCm || '').trim()
    || !!String(sku?.heightCm || '').trim()
    || !!String(sku?.estimatedShippingFee || '').trim()
    || !!String(sku?.chargeWeightKg || '').trim()
    || !!String(sku?.shippingNote || '').trim();
  return !hasOwnSpec;
}

function mergeProductSku(product: ProductRecord = {}, sku: ProductSku = {}): ProductRecord & ProductSku {
  const defaults = getProductDefaults(product);
  if (!skuUsesProductDefaults(sku)) return { ...product, ...sku };
  return {
    ...product,
    ...defaults,
    ...sku,
    weightG: sku?.weightG || defaults?.weightG || '',
    lengthCm: sku?.lengthCm || defaults?.lengthCm || '',
    widthCm: sku?.widthCm || defaults?.widthCm || '',
    heightCm: sku?.heightCm || defaults?.heightCm || '',
    estimatedShippingFee: sku?.estimatedShippingFee || defaults?.estimatedShippingFee || '',
    chargeWeightKg: sku?.chargeWeightKg || defaults?.chargeWeightKg || '',
    shippingNote: sku?.shippingNote || defaults?.shippingNote || '',
    sizeText: sku?.sizeText || defaults?.sizeText || ''
  };
}

function formatSize(product: ProductLogisticsDefaults): string {
  const direct = String(product?.sizeText || '').trim();
  if (direct) return direct.replace(/\*/g, '×');
  const values = [product?.lengthCm, product?.widthCm, product?.heightCm]
    .map(toNumber)
    .filter(value => value !== null);
  return values.length === 3 ? values.join(' * ') : '-';
}

function formatWeight(value: unknown): string {
  const amount = toNumber(value);
  return amount === null ? '-' : String(amount);
}

function formatSkuCount(product: ProductRecord): string {
  const count = getProductSkus(product).length;
  return count > 0 ? `${count} 个` : '-';
}

function formatSkuLabel(sku: ProductSku = {}): string {
  const name = formatText(sku?.skuName);
  const skuId = String(sku?.skuId || '').trim();
  return skuId && skuId !== '-' ? `${name} · ${skuId}` : name;
}

function formatSkuShippingFee(product: ProductRecord, sku: ProductSku): string {
  const record = mergeProductSku(product, sku);
  return formatMoney(record?.estimatedShippingFee);
}

function getCargoTypeLabel(value: unknown): string {
  return value === 'special' ? '特货' : '普货';
}

function parseProductSortTime(product: ProductRecord): number {
  const value = String(product?.createdAt || product?.updatedAt || '').trim();
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareProducts(a: ProductRecord, b: ProductRecord, sortOrder: ProductSortOrder = 'asc'): number {
  const leftTime = parseProductSortTime(a);
  const rightTime = parseProductSortTime(b);
  if (leftTime !== rightTime) return sortOrder === 'asc' ? leftTime - rightTime : rightTime - leftTime;
  const byTkId = String(a?.tkId ?? '').localeCompare(String(b?.tkId ?? ''), 'zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base'
  });
  return sortOrder === 'asc' ? byTkId : -byTkId;
}

function getProductSearchText(product: ProductRecord): unknown[] {
  return [
    product?.accountName,
    product?.tkId,
    product?.name,
    product?.note,
    product?.link1688,
    getCargoTypeLabel(getProductDefaults(product)?.cargoType),
    ...getProductSkus(product).flatMap(sku => [sku?.skuId, sku?.skuName])
  ];
}

function deriveDisplayedProducts({ products = [], activeAccount = '__all__', searchQuery = '', sortOrder = 'asc' }: DeriveDisplayedProductsOptions = {}): ProductRecord[] {
  const list = Array.isArray(products) ? products : [];
  const accountFiltered = activeAccount && activeAccount !== '__all__'
    ? list.filter(product => String(product?.accountName || '').trim() === activeAccount)
    : list;
  const sortProducts = (items: ProductRecord[]) => [...items].sort((a, b) => compareProducts(a, b, sortOrder));
  const query = parseSearchQuery(searchQuery, {
    enableBareDate: false,
    dateAliases: {}
  });
  if (!query.textTokens.length && !query.dateFilters.length) {
    return sortProducts(accountFiltered);
  }
  return accountFiltered.filter(product => matchesParsedSearchQuery({
    query,
    record: product,
    getText: getProductSearchText,
    getDate: () => ''
  })).sort((a, b) => compareProducts(a, b, sortOrder));
}

const ProductLibraryTable = {
  normalizeSearchValue,
  toNumber,
  formatText,
  formatMoney,
  getProductSkus,
  getProductDefaults,
  skuUsesProductDefaults,
  mergeProductSku,
  formatSize,
  formatWeight,
  formatSkuCount,
  formatSkuLabel,
  formatSkuShippingFee,
  getCargoTypeLabel,
  getProductSearchText,
  parseProductSortTime,
  compareProducts,
  deriveDisplayedProducts
};

export {
  ProductLibraryTable,
  compareProducts,
  deriveDisplayedProducts,
  formatMoney,
  formatSize,
  formatSkuCount,
  formatSkuLabel,
  formatSkuShippingFee,
  formatText,
  formatWeight,
  getCargoTypeLabel,
  getProductSearchText,
  getProductDefaults,
  getProductSkus,
  mergeProductSku,
  normalizeSearchValue,
  parseProductSortTime,
  skuUsesProductDefaults,
  toNumber
};
