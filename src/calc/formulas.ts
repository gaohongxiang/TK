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

export {
  PRICING_VIEWS,
  calcLegacyRow,
  calcPricingRow,
  calcPricingV3Row,
  calcSalePrice,
  calcSalePriceV3,
  deriveLegacyOrigPrice,
  derivePricingOrigPrice,
  derivePricingV3OrigPrice
};
