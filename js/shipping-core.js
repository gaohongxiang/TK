/* ============================================================
 * 共享运费计算核心
 * ============================================================ */
const TKShippingCore = (function () {
  const SHIPPING_RULES = {
    general: {
      label: '普货',
      bands: [
        { max: 0.5, range: '0 - 0.5 kg', parcel: 545, perKg: 340 },
        { max: 1, range: '0.5 - 1 kg', parcel: 560, perKg: 340 },
        { max: 2, range: '1 - 2 kg', parcel: 590, perKg: 340 },
        { max: 5, range: '2 - 5 kg', parcel: 590, perKg: 405 },
        { max: 10, range: '5 - 10 kg', parcel: 590, perKg: 415 },
        { max: 20, range: '10 - 20 kg', parcel: 590, perKg: 425 },
        { max: 30, range: '20 - 30 kg', parcel: 590, perKg: 435 }
      ]
    },
    special: {
      label: '特货',
      bands: [
        { max: 0.5, range: '0 - 0.5 kg', parcel: 555, perKg: 400 },
        { max: 1, range: '0.5 - 1 kg', parcel: 580, perKg: 420 },
        { max: 2, range: '1 - 2 kg', parcel: 610, perKg: 420 },
        { max: 5, range: '2 - 5 kg', parcel: 610, perKg: 510 },
        { max: 10, range: '5 - 10 kg', parcel: 610, perKg: 525 },
        { max: 20, range: '10 - 20 kg', parcel: 610, perKg: 535 },
        { max: 30, range: '20 - 30 kg', parcel: 610, perKg: 545 }
      ]
    }
  };

  const DEFAULT_CONSTANTS = {
    MIN_BILLABLE_WEIGHT_KG: 0.05,
    MAX_WEIGHT_KG: 30,
    VOLUME_DIVISOR: 8000,
    VOLUME_TRIGGER_MULTIPLIER: 1.5,
    SIZE_LIMITS: [60, 50, 40],
    CUSTOMER_SHIPPING_JPY: 350
  };

  function toNumber(value) {
    const normalized = String(value ?? '').trim();
    if (!normalized) return 0;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundMoney(value) {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }

  function formatWeightValue(value) {
    return Number.isFinite(value) ? Number(value.toFixed(3)).toString().replace(/\.?0+$/, '') : '-';
  }

  function getShippingBand(type, weightKg, rules = SHIPPING_RULES) {
    const rule = rules[type] || rules.general;
    return rule?.bands?.find(band => weightKg <= band.max) || null;
  }

  function buildReason(lines) {
    return lines.map(line => `<span class="ship-reason-line">${line}</span>`).join('');
  }

  function computeShippingQuote({
    cargoType,
    actualWeight,
    length,
    width,
    height,
    rate,
    rules = SHIPPING_RULES,
    constants = DEFAULT_CONSTANTS
  }) {
    const type = rules[cargoType] ? cargoType : 'general';
    const actualWeightG = Math.max(0, toNumber(actualWeight));
    const dims = [
      Math.max(0, toNumber(length)),
      Math.max(0, toNumber(width)),
      Math.max(0, toNumber(height))
    ];
    const hasAllDims = dims.every(value => value > 0);
    const actualWeightKg = actualWeightG / 1000;
    const volumeWeightKg = hasAllDims ? (dims[0] * dims[1] * dims[2]) / constants.VOLUME_DIVISOR : null;
    const useVolumeWeight = !!(
      hasAllDims
      && actualWeightKg > 0
      && volumeWeightKg > actualWeightKg * constants.VOLUME_TRIGGER_MULTIPLIER
    );
    const floorApplied = actualWeightKg > 0 && actualWeightKg < constants.MIN_BILLABLE_WEIGHT_KG;

    let chargeWeightKg = actualWeightKg > 0
      ? (useVolumeWeight ? volumeWeightKg : actualWeightKg)
      : null;
    if (chargeWeightKg !== null) chargeWeightKg = Math.max(chargeWeightKg, constants.MIN_BILLABLE_WEIGHT_KG);

    const sortedDims = hasAllDims ? dims.slice().sort((a, b) => b - a) : [];
    const sizeExceeded = hasAllDims && sortedDims.some((edge, index) => edge > constants.SIZE_LIMITS[index]);
    const actualWeightExceeded = actualWeightKg > constants.MAX_WEIGHT_KG;
    const chargeWeightExceeded = chargeWeightKg !== null && chargeWeightKg > constants.MAX_WEIGHT_KG;
    const hasError = actualWeightKg <= 0 || actualWeightExceeded || chargeWeightExceeded || sizeExceeded;
    const band = chargeWeightKg !== null && !chargeWeightExceeded ? getShippingBand(type, chargeWeightKg, rules) : null;
    const grossJpyFee = !hasError && band ? band.parcel + band.perKg * chargeWeightKg : null;
    const jpyFee = grossJpyFee !== null ? grossJpyFee - constants.CUSTOMER_SHIPPING_JPY : null;
    const cnyFee = jpyFee !== null && rate > 0 ? jpyFee / rate : null;

    const alerts = [];
    if (actualWeightKg <= 0) alerts.push({ type: 'error', text: '请输入实重后再计算运费。' });
    if (actualWeightKg > 0 && actualWeightKg < constants.MIN_BILLABLE_WEIGHT_KG) {
      alerts.push({ type: 'warn', text: '实重低于 50g，系统已按 50g 起计。' });
    }
    if (!hasAllDims) {
      alerts.push({ type: 'warn', text: '尺寸未填写完整，当前仅按实重预估，未校验体积重。' });
    }
    if (sizeExceeded) {
      alerts.push({
        type: 'error',
        text: `尺寸限制为 ${constants.SIZE_LIMITS.join(' × ')} cm。按边长排序后，你当前包裹为 ${sortedDims.map(n => n.toFixed(1).replace(/\.0$/, '')).join(' × ')} cm。`
      });
    }
    if (actualWeightExceeded) alerts.push({ type: 'error', text: `单包裹实重不能超过 ${constants.MAX_WEIGHT_KG} kg。` });
    if (chargeWeightExceeded) alerts.push({ type: 'error', text: `计费重为 ${formatWeightValue(chargeWeightKg)}，已超过 ${constants.MAX_WEIGHT_KG} kg 上限。` });
    if (jpyFee !== null && cnyFee === null) alerts.push({ type: 'warn', text: '汇率未填写或为 0，暂时无法折算人民币。' });

    let chargeReason = '最低按 0.05 kg';
    if (actualWeightKg <= 0) {
      chargeReason = '输入实重和尺寸后显示计费依据';
    } else if (!hasAllDims) {
      chargeReason = floorApplied
        ? '尺寸未填完整，暂按实重计费，且已按 0.05 kg 起计'
        : '尺寸未填完整，暂按实重计费';
    } else if (useVolumeWeight) {
      chargeReason = buildReason([
        `${formatWeightValue(volumeWeightKg)} > ${formatWeightValue(actualWeightKg)} × 1.5`,
        '按体积重计费'
      ]);
    } else {
      chargeReason = buildReason([
        `${formatWeightValue(volumeWeightKg)} <= ${formatWeightValue(actualWeightKg)} × 1.5`,
        '按实重计算'
      ]);
    }

    return {
      type,
      actualWeightKg,
      volumeWeightKg,
      chargeWeightKg,
      grossJpyFee,
      chargeReason,
      band,
      jpyFee,
      cnyFee,
      alerts,
      hasError
    };
  }

  function computeCalculatedShippingCost({ quote, multiplier = 1, labelFee = 0 } = {}) {
    if (!quote || quote.cnyFee === null) return null;
    const safeMultiplier = Math.max(1, toNumber(multiplier) || 1);
    const safeLabelFee = toNumber(labelFee) || 0;
    return roundMoney(quote.cnyFee * safeMultiplier + safeLabelFee);
  }

  return {
    SHIPPING_RULES,
    DEFAULT_CONSTANTS,
    getShippingBand,
    computeShippingQuote,
    computeCalculatedShippingCost
  };
})();
