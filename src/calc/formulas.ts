function calcLegacyRow(state, origPrice, discount) {
  const feeRate = (state.fee || 0) / 100;
  const creatorRate = (state.creatorRate || 0) / 100;
  const cost = state.cost || 0;
  const rate = state.rate || 1;
  const shipping = state.shipping || 0;
  const jpyPrice = origPrice * discount * (1 - feeRate);
  const cnyGross = jpyPrice / rate;
  const creatorCommission = cnyGross * creatorRate;
  const cnyNet = cnyGross - creatorCommission - shipping;
  const margin = cost > 0 ? cnyNet / cost : NaN;
  return { discount, jpyPrice, cnyNet, creatorCommission, margin };
}

function deriveLegacyOrigPrice(state) {
  const feeRate = (state.fee || 0) / 100;
  const creatorRate = (state.creatorRate || 0) / 100;
  const cost = state.cost || 0;
  const rate = state.rate || 1;
  const shipping = state.shipping || 0;
  const targetMargin = state.targetMargin || 0;
  const anchor = state.anchor || 0.40;
  if (anchor === 0 || feeRate >= 1 || creatorRate >= 1) return 0;
  return Math.max(0, ((cost * targetMargin + shipping) * rate) / (anchor * (1 - feeRate) * (1 - creatorRate)));
}

const PRICING_VIEWS = {
  pricingNew: {
    fee: 'feeNew',
    rate: 'rateNew',
    discountsState: 'discountsNew',
    targetMarginState: 'targetMarginNew',
    anchorState: 'anchorNew',
    origPriceState: 'origPriceNew',
    anchor: 'anchorNew',
    tbody: 'tbodyNew'
  }
};

const DEFAULT_CUSTOMER_SHIPPING_JPY = 350;

function calcPricingRow({ state, totalCost, viewKey = 'pricingNew', origPrice, discount }) {
  const view = PRICING_VIEWS[viewKey];
  const feeRate = (state[view.fee] || 0) / 100;
  const creatorRate = (state.creatorRateNew || 0) / 100;
  const cost = totalCost || 0;
  const rate = state[view.rate] || 1;
  const jpyPrice = origPrice * discount * (1 - feeRate);
  const cnyGross = jpyPrice / rate;
  const creatorCommission = cnyGross * creatorRate;
  const cnyNet = cnyGross - creatorCommission;
  const profit = cnyNet - cost;
  const margin = cost > 0 ? cnyNet / cost : NaN;
  return { discount, jpyPrice, cnyNet, creatorCommission, profit, margin };
}

function derivePricingOrigPrice({ state, totalCost, viewKey = 'pricingNew' }) {
  const view = PRICING_VIEWS[viewKey];
  const feeRate = (state[view.fee] || 0) / 100;
  const creatorRate = (state.creatorRateNew || 0) / 100;
  const cost = totalCost || 0;
  const rate = state[view.rate] || 1;
  const targetMargin = state[view.targetMarginState] || 0;
  const anchor = state[view.anchorState] || 0.40;
  if (anchor === 0 || feeRate >= 1 || creatorRate >= 1) return 0;
  return Math.max(0, (cost * targetMargin * rate) / (anchor * (1 - feeRate) * (1 - creatorRate)));
}

function calcPricingV3Row({
  state,
  totalCost,
  origPrice,
  discount,
  customerShippingJpy = DEFAULT_CUSTOMER_SHIPPING_JPY
}) {
  const platformFeeRate = (state.feeNew || 0) / 100;
  const creatorRate = (state.creatorRateNew || 0) / 100;
  const cost = totalCost || 0;
  const rate = state.rateNew || 1;
  const jpyPrice = origPrice * discount;
  const cnyGross = jpyPrice / rate;
  const platformFee = ((jpyPrice + customerShippingJpy) * platformFeeRate) / rate;
  const creatorCommission = (jpyPrice * creatorRate) / rate;
  const cnyNet = cnyGross - platformFee - creatorCommission;
  const profit = cnyNet - cost;
  const margin = cost > 0 ? cnyNet / cost : NaN;
  return { discount, jpyPrice, cnyNet, platformFee, creatorCommission, profit, margin };
}

function derivePricingV3TransferOrigPrice({
  baseOrigPrice,
  transferDiscount,
  transferShippingJpy = DEFAULT_CUSTOMER_SHIPPING_JPY
}) {
  if (!Number.isFinite(baseOrigPrice) || baseOrigPrice <= 0) return 0;
  if (!Number.isFinite(transferDiscount) || transferDiscount <= 0) return baseOrigPrice;
  return Math.max(0, baseOrigPrice + transferShippingJpy / transferDiscount);
}

function calcPricingV3TransferRow({
  state,
  totalCost,
  baseOrigPrice,
  transferDiscount,
  discount,
  transferShippingJpy = DEFAULT_CUSTOMER_SHIPPING_JPY
}) {
  const transferOrigPrice = derivePricingV3TransferOrigPrice({
    baseOrigPrice,
    transferDiscount,
    transferShippingJpy
  });
  const row = calcPricingV3Row({
    state,
    totalCost,
    origPrice: transferOrigPrice,
    discount,
    customerShippingJpy: 0
  });
  const baseJpyPrice = baseOrigPrice * discount;
  const rate = state.rateNew || 1;
  const transferredJpy = row.jpyPrice - baseJpyPrice;
  const effectiveJpyPrice = Math.max(0, row.jpyPrice - Math.max(0, transferShippingJpy || 0));
  const cnyGross = effectiveJpyPrice / rate;
  const cnyNet = cnyGross - row.platformFee - row.creatorCommission;
  const profit = cnyNet - (totalCost || 0);
  const margin = totalCost > 0 ? cnyNet / totalCost : NaN;
  return {
    ...row,
    cnyNet,
    profit,
    margin,
    transferOrigPrice,
    transferredJpy,
    effectiveJpyPrice
  };
}

function derivePricingV3OrigPrice({
  state,
  totalCost,
  customerShippingJpy = DEFAULT_CUSTOMER_SHIPPING_JPY
}) {
  const platformFeeRate = (state.feeNew || 0) / 100;
  const creatorRate = (state.creatorRateNew || 0) / 100;
  const cost = totalCost || 0;
  const rate = state.rateNew || 1;
  const targetMargin = state.targetMarginNew || 0;
  const anchor = state.anchorNew || 0.40;
  const denominator = anchor * (1 - platformFeeRate - creatorRate);
  if (anchor === 0 || denominator <= 0) return 0;
  return Math.max(0, ((cost * targetMargin * rate) + (customerShippingJpy * platformFeeRate)) / denominator);
}

function calcSalePrice({ state, totalCost }) {
  const salePrice = state.salePrice || 0;
  const cost = totalCost || 0;
  const rate = state.rateNew || 1;
  const creatorRate = (state.creatorRateNew || 0) / 100;
  if (salePrice <= 0) return null;
  const cnyGross = salePrice / rate;
  const creatorCommission = cnyGross * creatorRate;
  const cnyNet = cnyGross - creatorCommission;
  const profit = cnyNet - cost;
  const margin = cost > 0 ? cnyNet / cost : NaN;
  return { cnyNet, creatorCommission, profit, margin };
}

function calcSalePriceV3({ state, totalCost, customerShippingJpy = DEFAULT_CUSTOMER_SHIPPING_JPY }) {
  const salePrice = state.salePrice || 0;
  const cost = totalCost || 0;
  const rate = state.rateNew || 1;
  const platformFeeRate = (state.feeNew || 0) / 100;
  const creatorRate = (state.creatorRateNew || 0) / 100;
  if (salePrice <= 0) return null;
  const cnyGross = salePrice / rate;
  const platformFee = ((salePrice + customerShippingJpy) * platformFeeRate) / rate;
  const creatorCommission = (salePrice * creatorRate) / rate;
  const cnyNet = cnyGross - platformFee - creatorCommission;
  const profit = cnyNet - cost;
  const margin = cost > 0 ? cnyNet / cost : NaN;
  return { cnyNet, platformFee, creatorCommission, profit, margin };
}

function calcSalePriceV3Transfer({ state, totalCost, transferShippingJpy = DEFAULT_CUSTOMER_SHIPPING_JPY }) {
  const salePrice = state.salePrice || 0;
  const cost = totalCost || 0;
  const rate = state.rateNew || 1;
  const platformFeeRate = (state.feeNew || 0) / 100;
  const creatorRate = (state.creatorRateNew || 0) / 100;
  if (salePrice <= 0) return null;
  const effectiveSalePrice = Math.max(0, salePrice - Math.max(0, transferShippingJpy || 0));
  const cnyGross = effectiveSalePrice / rate;
  const platformFee = (salePrice * platformFeeRate) / rate;
  const creatorCommission = (salePrice * creatorRate) / rate;
  const cnyNet = cnyGross - platformFee - creatorCommission;
  const profit = cnyNet - cost;
  const margin = cost > 0 ? cnyNet / cost : NaN;
  return { cnyNet, platformFee, creatorCommission, profit, margin, effectiveSalePrice };
}

export {
  PRICING_VIEWS,
  calcLegacyRow,
  calcPricingRow,
  calcPricingV3TransferRow,
  calcPricingV3Row,
  calcSalePrice,
  calcSalePriceV3Transfer,
  calcSalePriceV3,
  derivePricingV3TransferOrigPrice,
  deriveLegacyOrigPrice,
  derivePricingOrigPrice,
  derivePricingV3OrigPrice
};
