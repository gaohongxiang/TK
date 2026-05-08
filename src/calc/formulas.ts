function calcLegacyRow(state, origPrice, discount) {
  const feeRate = (state.fee || 0) / 100;
  const creatorRate = (state.creatorRate || 0) / 100;
  const cost = state.cost || 0;
  const rate = state.rate || 1;
  const shipping = state.shipping || 0;
  const jpyPrice = origPrice * discount * (1 - feeRate);
  const creatorCommission = (jpyPrice / rate) * creatorRate;
  const cnyNet = jpyPrice / rate - creatorCommission - shipping;
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

export {
  PRICING_VIEWS,
  calcLegacyRow,
  calcPricingRow,
  calcSalePrice,
  deriveLegacyOrigPrice,
  derivePricingOrigPrice
};
