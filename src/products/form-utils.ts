import type {
  ProductBatchSkuDraft,
  ProductLogisticsDefaults,
  ProductPricingContext,
  ProductShippingCore,
  ProductShippingSnapshot,
  ProductSizeParseResult,
  ProductSku
} from './types.ts';

function formatDecimal(value: unknown, digits = 2): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(digits).replace(/\.?0+$/, '') : '';
}

function parseSizeInput(value: unknown): ProductSizeParseResult {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return {
      sizeText: '',
      lengthCm: '',
      widthCm: '',
      heightCm: '',
      isComplete: false
    };
  }

  const matched = raw
    .replace(/[Xx＊*]/g, '×')
    .match(/\d+(?:\.\d+)?/g);

  if (!matched || matched.length < 3) {
    return {
      sizeText: raw,
      lengthCm: '',
      widthCm: '',
      heightCm: '',
      isComplete: false
    };
  }

  const [lengthCm, widthCm, heightCm] = matched.slice(0, 3).map(part => formatDecimal(part, 1));
  return {
    sizeText: `${lengthCm}×${widthCm}×${heightCm}`,
    lengthCm,
    widthCm,
    heightCm,
    isComplete: true
  };
}

function formatSizeInput(product: ProductLogisticsDefaults = {}): string {
  const values = [product?.lengthCm, product?.widthCm, product?.heightCm]
    .map(value => formatDecimal(value, 1))
    .filter(Boolean);
  return values.length === 3 ? values.join('×') : '';
}

function parseBatchTokens(value: unknown): string[] {
  return Array.from(new Set(
    String(value || '')
      .split(/[\n,，、\/|]+/)
      .map(part => part.trim())
      .filter(Boolean)
  ));
}

function buildBatchSkuDrafts(...axisInputs: unknown[]): ProductBatchSkuDraft[] {
  const axes = axisInputs
    .map(parseBatchTokens)
    .filter(axis => axis.length);
  if (!axes.length) return [];
  return axes.reduce((groups, axis) => (
    groups.flatMap(group => axis.map(label => [...group, label]))
  ), [[]]).map(labels => ({
    skuName: labels.join(' / ')
  }));
}

function tokenizeSkuName(value: unknown): string[] {
  return String(value || '')
    .toLowerCase()
    .split(/[\s/／、，,|_-]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function matchesBatchSkuName(skuName: unknown, matchText: unknown): boolean {
  const query = String(matchText || '').trim().toLowerCase();
  if (!query) return false;
  const normalizedName = String(skuName || '').trim().toLowerCase();
  if (!normalizedName) return false;
  if (normalizedName === query) return true;
  const tokens = tokenizeSkuName(normalizedName);
  if (tokens.includes(query)) return true;
  if (query.length >= 2 && normalizedName.includes(query)) return true;
  return false;
}

function resolveProductDimensions(product: ProductLogisticsDefaults = {}): ProductSizeParseResult {
  const parsedFromText = parseSizeInput(product?.sizeText);
  if (parsedFromText.isComplete) return parsedFromText;
  const values = [product?.lengthCm, product?.widthCm, product?.heightCm]
    .map(value => formatDecimal(value, 1))
    .filter(Boolean);
  return {
    sizeText: values.length === 3 ? values.join('×') : String(product?.sizeText || '').trim(),
    lengthCm: values[0] || '',
    widthCm: values[1] || '',
    heightCm: values[2] || '',
    isComplete: values.length === 3
  };
}

function buildEstimatedShippingSnapshot({
  shippingCore,
  product = {},
  pricingContext = {}
}: {
  shippingCore?: ProductShippingCore;
  product?: ProductLogisticsDefaults;
  pricingContext?: ProductPricingContext;
}): ProductShippingSnapshot {
  if (!shippingCore?.computeShippingQuote || !shippingCore?.computeCalculatedShippingCost) {
    return {
      estimatedShippingFee: '',
      chargeWeightKg: '',
      shippingNote: '运费核心未就绪'
    };
  }

  const dimensions = resolveProductDimensions(product);

  const quote = shippingCore.computeShippingQuote({
    cargoType: product?.cargoType || 'general',
    actualWeight: product?.weightG,
    length: dimensions.lengthCm,
    width: dimensions.widthCm,
    height: dimensions.heightCm,
    rate: pricingContext?.rate
  });
  const finalFee = shippingCore.computeCalculatedShippingCost({
    quote,
    multiplier: pricingContext?.shippingMultiplier,
    labelFee: pricingContext?.labelFee
  });
  return {
    estimatedShippingFee: finalFee === null ? '' : Number(finalFee).toFixed(2),
    chargeWeightKg: quote?.chargeWeightKg == null ? '' : formatDecimal(quote.chargeWeightKg, 2),
    shippingNote: (quote?.alerts || []).find(alert => (
      alert?.text
      && alert.text !== '请输入实重后再计算运费。'
      && alert.text !== '尺寸未填写完整，当前仅按实重预估，未校验体积重。'
    ))?.text || ''
  };
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

const ProductLibraryFormUtils = {
  buildBatchSkuDrafts,
  buildEstimatedShippingSnapshot,
  formatDecimal,
  formatSizeInput,
  matchesBatchSkuName,
  parseBatchTokens,
  parseSizeInput,
  resolveProductDimensions,
  skuUsesProductDefaults,
  tokenizeSkuName
};

export {
  ProductLibraryFormUtils,
  parseSizeInput,
  buildBatchSkuDrafts,
  buildEstimatedShippingSnapshot,
  formatDecimal,
  formatSizeInput,
  matchesBatchSkuName,
  parseBatchTokens,
  resolveProductDimensions,
  skuUsesProductDefaults,
  tokenizeSkuName
};
