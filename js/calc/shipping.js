/* ============================================================
 * 利润计算器：运费逻辑
 * ============================================================ */
const CalcShipping = (function () {
  function create({ state, els, helpers, constants }) {
    const {
      fmtCny,
      fmtMoney,
      fmtNumberValue,
      fmtWeight,
      fmtWeightValue,
      toNumber,
      setInputValue
    } = helpers;
    const {
      SHIPPING_RULES,
      MIN_BILLABLE_WEIGHT_KG,
      MAX_WEIGHT_KG,
      VOLUME_DIVISOR,
      VOLUME_TRIGGER_MULTIPLIER,
      SIZE_LIMITS,
      CUSTOMER_SHIPPING_JPY
    } = constants;

    function getShippingMultiplierNew() {
      return Math.max(1, state.shippingMultiplierNew || 1);
    }

    function getManualShippingCostNew() {
      return state.overseasShippingNew || 0;
    }

    function getShippingBand(type, weightKg) {
      const rule = SHIPPING_RULES[type] || SHIPPING_RULES.general;
      return rule.bands.find(band => weightKg <= band.max) || null;
    }

    function buildAlert(type, text) {
      return `<div class="ship-alert ${type}">${text}</div>`;
    }

    function buildReason(lines) {
      return lines.map(line => `<span class="ship-reason-line">${line}</span>`).join('');
    }

    function computeShippingQuote({ cargoType, actualWeight, length, width, height, rate }) {
      const type = SHIPPING_RULES[cargoType] ? cargoType : 'general';
      const actualWeightG = Math.max(0, toNumber(actualWeight));
      const dims = [
        Math.max(0, toNumber(length)),
        Math.max(0, toNumber(width)),
        Math.max(0, toNumber(height))
      ];
      const hasAllDims = dims.every(value => value > 0);
      const actualWeightKg = actualWeightG / 1000;
      const volumeWeightKg = hasAllDims ? (dims[0] * dims[1] * dims[2]) / VOLUME_DIVISOR : null;
      const useVolumeWeight = !!(
        hasAllDims
        && actualWeightKg > 0
        && volumeWeightKg > actualWeightKg * VOLUME_TRIGGER_MULTIPLIER
      );
      const floorApplied = actualWeightKg > 0 && actualWeightKg < MIN_BILLABLE_WEIGHT_KG;

      let chargeWeightKg = actualWeightKg > 0
        ? (useVolumeWeight ? volumeWeightKg : actualWeightKg)
        : null;
      if (chargeWeightKg !== null) chargeWeightKg = Math.max(chargeWeightKg, MIN_BILLABLE_WEIGHT_KG);

      const sortedDims = hasAllDims ? dims.slice().sort((a, b) => b - a) : [];
      const sizeExceeded = hasAllDims && sortedDims.some((edge, index) => edge > SIZE_LIMITS[index]);
      const actualWeightExceeded = actualWeightKg > MAX_WEIGHT_KG;
      const chargeWeightExceeded = chargeWeightKg !== null && chargeWeightKg > MAX_WEIGHT_KG;
      const hasError = actualWeightKg <= 0 || actualWeightExceeded || chargeWeightExceeded || sizeExceeded;
      const band = chargeWeightKg !== null && !chargeWeightExceeded ? getShippingBand(type, chargeWeightKg) : null;
      const grossJpyFee = !hasError && band ? band.parcel + band.perKg * chargeWeightKg : null;
      const jpyFee = grossJpyFee !== null ? grossJpyFee - CUSTOMER_SHIPPING_JPY : null;
      const cnyFee = jpyFee !== null && rate > 0 ? jpyFee / rate : null;

      const alerts = [];
      if (actualWeightKg <= 0) alerts.push({ type: 'error', text: '请输入实重后再计算运费。' });
      if (actualWeightKg > 0 && actualWeightKg < MIN_BILLABLE_WEIGHT_KG) {
        alerts.push({ type: 'warn', text: '实重低于 50g，系统已按 50g 起计。' });
      }
      if (!hasAllDims) {
        alerts.push({ type: 'warn', text: '尺寸未填写完整，当前仅按实重预估，未校验体积重。' });
      }
      if (sizeExceeded) {
        alerts.push({
          type: 'error',
          text: `尺寸限制为 60 × 50 × 40 cm。按边长排序后，你当前包裹为 ${sortedDims.map(n => n.toFixed(1).replace(/\.0$/, '')).join(' × ')} cm。`
        });
      }
      if (actualWeightExceeded) alerts.push({ type: 'error', text: `单包裹实重不能超过 ${MAX_WEIGHT_KG} kg。` });
      if (chargeWeightExceeded) alerts.push({ type: 'error', text: `计费重为 ${fmtWeight(chargeWeightKg)}，已超过 ${MAX_WEIGHT_KG} kg 上限。` });
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
          `${fmtWeightValue(volumeWeightKg)} > ${fmtWeightValue(actualWeightKg)} × 1.5`,
          '按体积重计费'
        ]);
      } else {
        chargeReason = buildReason([
          `${fmtWeightValue(volumeWeightKg)} <= ${fmtWeightValue(actualWeightKg)} × 1.5`,
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

    function computeShipping() {
      return computeShippingQuote({
        cargoType: state.shipCargoType,
        actualWeight: state.shipActualWeight,
        length: state.shipLength,
        width: state.shipWidth,
        height: state.shipHeight,
        rate: state.rate
      });
    }

    function computePricingNewShipping() {
      return computeShippingQuote({
        cargoType: state.shipCargoTypeNew,
        actualWeight: state.shipActualWeightNew,
        length: state.shipLengthNew,
        width: state.shipWidthNew,
        height: state.shipHeightNew,
        rate: state.rateNew
      });
    }

    function getCalculatedShippingCostNew(quote = computePricingNewShipping()) {
      if (!quote || quote.cnyFee === null) return null;
      const multiplier = getShippingMultiplierNew();
      const labelFee = state.labelFeeNew || 0;
      return Number((quote.cnyFee * multiplier + labelFee).toFixed(2));
    }

    function applyCalculatedShippingCostNew(quote = computePricingNewShipping(), { markSource = false } = {}) {
      const calculated = getCalculatedShippingCostNew(quote);
      if (calculated === null) return null;
      state.overseasShippingNew = calculated;
      if (markSource) state.shippingSourceNew = 'calculator';
      setInputValue(els.overseasShippingNew, calculated);
      setInputValue(els.shippingReview, calculated);
      return calculated;
    }

    function computeTotalCostNew() {
      return (state.costNew || 0) + getManualShippingCostNew();
    }

    function getPricingNewShippingTargets() {
      return [
        {
          actualKg: els.shipActualKgNew,
          actualRule: els.shipActualRuleNew,
          volWeight: els.shipVolWeightNew,
          volFormula: els.shipVolFormulaNew,
          chargeWeight: els.shipChargeWeightNew,
          chargeRule: els.shipChargeRuleNew,
          band: els.shipBandNew,
          feeCny: els.shipFeeCnyNew,
          feeFormula: els.shipFeeFormulaNew,
          alert: els.shipChargeReasonNew,
          importTrigger: els.importShippingNew
        },
        {
          actualKg: els.shipActualKgReview,
          actualRule: els.shipActualRuleReview,
          volWeight: els.shipVolWeightReview,
          volFormula: els.shipVolFormulaReview,
          chargeWeight: els.shipChargeWeightReview,
          chargeRule: els.shipChargeRuleReview,
          band: els.shipBandReview,
          feeCny: els.shipFeeCnyReview,
          feeFormula: els.shipFeeFormulaReview,
          alert: els.shipChargeReasonReview,
          importTrigger: els.importShippingReview
        }
      ];
    }

    function renderPricingNewShippingTarget(target, quote, finalCnyFee, multiplier, labelFee) {
      if (!target.actualKg) return;
      target.actualKg.textContent = quote.actualWeightKg > 0 ? fmtWeight(quote.actualWeightKg) : '-';
      target.actualRule.textContent = '按输入重量换算';
      target.volWeight.textContent = quote.volumeWeightKg !== null ? fmtWeight(quote.volumeWeightKg) : '-';
      target.volFormula.textContent = '长 × 宽 × 高 ÷ 8000';
      target.chargeWeight.textContent = quote.chargeWeightKg !== null ? fmtWeight(quote.chargeWeightKg) : '-';

      if (quote.actualWeightKg <= 0) {
        target.chargeRule.textContent = '输入实重和尺寸后显示计费依据';
      } else if (quote.volumeWeightKg === null) {
        target.chargeRule.textContent = '尺寸未填完整，暂按实重计费';
      } else {
        const useVolumeWeight = quote.volumeWeightKg > quote.actualWeightKg * VOLUME_TRIGGER_MULTIPLIER;
        const operator = useVolumeWeight ? '>' : '<=';
        const method = useVolumeWeight ? '按体积重计费' : '按实重计费';
        target.chargeRule.textContent = `${fmtWeightValue(quote.volumeWeightKg)} ${operator} ${fmtWeightValue(quote.actualWeightKg)} × 1.5，${method}`;
      }

      target.band.value = quote.band ? quote.band.range : '-';
      target.feeCny.textContent = finalCnyFee !== null ? fmtCny(finalCnyFee, 2) : '-';
      if (target.importTrigger) {
        target.importTrigger.classList.toggle('is-disabled', finalCnyFee === null);
      }
      target.feeFormula.textContent = (quote.band && quote.chargeWeightKg !== null)
        ? `海外运费 =（基础费 ${quote.band.parcel} + 每千克重量费 ${quote.band.perKg} × 计费重 ${fmtWeightValue(quote.chargeWeightKg)} - 用户承担 ${CUSTOMER_SHIPPING_JPY}）× 运费倍率 ${fmtMoney(multiplier, 2)} / 汇率 ${fmtNumberValue(state.rateNew || 0, 2)} + 贴单费 ${fmtNumberValue(labelFee, 2)}`
        : '海外运费 =（基础费 + 每千克重量费 × 计费重 - 用户承担）× 运费倍率 / 汇率 + 贴单费';

      target.alert.textContent = quote.alerts.length ? quote.alerts[0].text : '';
    }

    function renderPricingNewShipping(quote = computePricingNewShipping()) {
      const multiplier = getShippingMultiplierNew();
      const labelFee = state.labelFeeNew || 0;
      const finalCnyFee = getCalculatedShippingCostNew(quote);
      getPricingNewShippingTargets().forEach(target => {
        renderPricingNewShippingTarget(target, quote, finalCnyFee, multiplier, labelFee);
      });
      return quote;
    }

    function renderShippingCalc() {
      if (!els.shipActualKg || !els.shipVolWeight || !els.shipChargeWeight || !els.shipAlerts) return null;
      const quote = computeShipping();

      els.shipActualKg.textContent = quote.actualWeightKg > 0 ? fmtWeight(quote.actualWeightKg) : '-';
      els.shipVolWeight.textContent = quote.volumeWeightKg !== null ? fmtWeight(quote.volumeWeightKg) : '-';
      els.shipChargeWeight.textContent = quote.chargeWeightKg !== null ? fmtWeight(quote.chargeWeightKg) : '-';
      els.shipChargeReason.innerHTML = quote.chargeReason;
      els.shipBand.textContent = quote.band ? quote.band.range : '-';
      els.shipRateLine.textContent = quote.band ? `${quote.band.parcel} 円/票 + ${quote.band.perKg} 円/kg` : '-';
      els.shipFeeJpy.textContent = quote.jpyFee !== null ? fmtMoney(quote.jpyFee, 2) : '-';
      els.shipFeeCny.textContent = quote.cnyFee !== null ? fmtMoney(quote.cnyFee, 2) : '-';
      els.shipFormula.textContent = (quote.band && quote.chargeWeightKg !== null)
        ? `挂号费 ${quote.band.parcel} + ${quote.band.perKg} × ${fmtWeightValue(quote.chargeWeightKg)} - 用户承担 ${CUSTOMER_SHIPPING_JPY}`
        : '-';
      els.shipCnyFormula.textContent = quote.jpyFee !== null
        ? (state.rate > 0 ? `已按当前汇率 ${state.rate} 折算` : '汇率未填写，暂无法折算人民币')
        : '-';
      els.shipAlerts.innerHTML = quote.alerts.map(alert => buildAlert(alert.type, alert.text)).join('');
      return quote;
    }

    return {
      getShippingMultiplierNew,
      getManualShippingCostNew,
      getCalculatedShippingCostNew,
      applyCalculatedShippingCostNew,
      computeTotalCostNew,
      computeShippingQuote,
      computeShipping,
      computePricingNewShipping,
      renderPricingNewShipping,
      renderShippingCalc
    };
  }

  return {
    create
  };
})();
