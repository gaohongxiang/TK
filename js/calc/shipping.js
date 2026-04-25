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
    const shippingCore = typeof TKShippingCore !== 'undefined' ? TKShippingCore : null;

    function getShippingMultiplierNew() {
      return Math.max(1, state.shippingMultiplierNew || 1);
    }

    function getManualShippingCostNew() {
      return state.overseasShippingNew || 0;
    }

    function getShippingBand(type, weightKg) {
      if (shippingCore?.getShippingBand) return shippingCore.getShippingBand(type, weightKg, SHIPPING_RULES);
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
      if (shippingCore?.computeShippingQuote) {
        return shippingCore.computeShippingQuote({
          cargoType,
          actualWeight,
          length,
          width,
          height,
          rate,
          rules: SHIPPING_RULES,
          constants: {
            MIN_BILLABLE_WEIGHT_KG,
            MAX_WEIGHT_KG,
            VOLUME_DIVISOR,
            VOLUME_TRIGGER_MULTIPLIER,
            SIZE_LIMITS,
            CUSTOMER_SHIPPING_JPY
          }
        });
      }
      return null;
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
      if (shippingCore?.computeCalculatedShippingCost) {
        return shippingCore.computeCalculatedShippingCost({
          quote,
          multiplier: getShippingMultiplierNew(),
          labelFee: state.labelFeeNew || 0
        });
      }
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
