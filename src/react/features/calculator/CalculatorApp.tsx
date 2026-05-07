import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { calcLegacyRow, calcPricingRow, calcSalePrice, deriveLegacyOrigPrice, derivePricingOrigPrice } from '../../../calc/formulas.mjs';
import { ensureGlobalSettingsStore } from '../../../global-settings.mjs';
import { DEFAULT_CONSTANTS, SHIPPING_RULES, computeCalculatedShippingCost, computeShippingQuote } from '../../../shipping-core.mjs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const LS_KEY = 'tk.profit.v1';

const DEFAULTS = {
  fee: 7,
  rate: 23.5,
  shipping: 17,
  discounts: [0.35, 0.38, 0.40, 0.42, 0.45, 0.48, 0.50],
  creatorRate: 0,
  cost: 30,
  targetMargin: 1.4,
  anchor: 0.40,
  origPrice: null as number | null,
  costNew: 10,
  labelFeeNew: 1.2,
  overseasShippingNew: 0,
  shippingMultiplierNew: 1.1,
  shippingSourceNew: 'manual',
  feeNew: 10,
  creatorRateNew: 0,
  rateNew: 23.5,
  discountsNew: [0.35, 0.38, 0.40, 0.42, 0.45, 0.48, 0.50],
  targetMarginNew: 1.4,
  anchorNew: 0.40,
  origPriceNew: null as number | null,
  shipCargoTypeNew: 'general',
  shipActualWeightNew: 100,
  shipLengthNew: 10,
  shipWidthNew: 10,
  shipHeightNew: 10,
  salePrice: 0,
  calcTab: 'pricingNew',
  shipCargoType: 'general',
  shipActualWeight: 500,
  shipLength: 20,
  shipWidth: 15,
  shipHeight: 10
};

type CalcState = typeof DEFAULTS;
type CargoType = 'general' | 'special';

function normalizeDecimalText(value: unknown) {
  return String(value ?? '')
    .replace(/[。．｡，]/g, '.')
    .replace(/[﹣－–—]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/\s+/g, '');
}

function toNumber(value: unknown) {
  const parsed = Number.parseFloat(normalizeDecimalText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return Number(value).toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function formatCny(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value < 0 ? '-¥' : '¥'}${formatMoney(Math.abs(value), digits)}`;
}

function formatDiscount(discount: number) {
  return `${+(discount * 10).toFixed(2)}折`;
}

function formatMargin(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toFixed(2);
}

function formatWeight(value: number | null | undefined, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value.toFixed(digits).replace(/\.?0+$/, '')} kg`;
}

function formatNumberValue(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toFixed(digits).replace(/\.?0+$/, '');
}

function parseDiscounts(value: string) {
  const parsed = value
    .split(/[,，\s]+/)
    .filter(Boolean)
    .map(item => {
      const normalized = item.trim();
      if (normalized.endsWith('%')) return Number.parseFloat(normalized) / 100;
      const number = Number.parseFloat(normalized);
      return number > 1 ? number / 100 : number;
    })
    .filter(item => Number.isFinite(item) && item > 0 && item <= 1);
  return parsed.length ? parsed : DEFAULTS.discountsNew;
}

function loadState(): CalcState {
  try {
    const saved = typeof localStorage !== 'undefined'
      ? JSON.parse(localStorage.getItem(LS_KEY) || 'null')
      : null;
    const merged = { ...DEFAULTS, ...(saved || {}) };
    if (!Array.isArray(merged.discounts)) merged.discounts = DEFAULTS.discounts;
    if (!Array.isArray(merged.discountsNew)) merged.discountsNew = DEFAULTS.discountsNew;
    return merged;
  } catch (error) {
    return { ...DEFAULTS };
  }
}

function saveState(state: CalcState) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function nearestDiscount(discounts: number[], want: number) {
  return discounts.reduce((a, b) => Math.abs(b - want) < Math.abs(a - want) ? b : a, discounts[0] || 0.4);
}

function quoteForPricing(state: CalcState) {
  return computeShippingQuote({
    cargoType: state.shipCargoTypeNew,
    actualWeight: state.shipActualWeightNew,
    length: state.shipLengthNew,
    width: state.shipWidthNew,
    height: state.shipHeightNew,
    rate: state.rateNew,
    rules: SHIPPING_RULES,
    constants: DEFAULT_CONSTANTS
  });
}

function finalShippingCost(state: CalcState, quote = quoteForPricing(state)) {
  return computeCalculatedShippingCost({
    quote,
    multiplier: Math.max(1, state.shippingMultiplierNew || 1),
    labelFee: state.labelFeeNew || 0
  });
}

function chargeRuleText(quote: ReturnType<typeof computeShippingQuote>) {
  if (quote.actualWeightKg <= 0) return '输入实重和尺寸后显示计费依据';
  if (quote.volumeWeightKg === null) return '尺寸未填完整，暂按实重计费';
  const useVolume = quote.volumeWeightKg > quote.actualWeightKg * DEFAULT_CONSTANTS.VOLUME_TRIGGER_MULTIPLIER;
  return `${formatNumberValue(quote.volumeWeightKg, 3)} ${useVolume ? '>' : '<='} ${formatNumberValue(quote.actualWeightKg, 3)} × 1.5，${useVolume ? '按体积重计费' : '按实重计费'}`;
}

function inputToneForField(className: string, readOnly: boolean) {
  if (className.includes('expense-field')) return 'expense';
  if (className.includes('primary')) return 'primary';
  if (className.includes('success')) return 'success';
  if (className.includes('readonly') || readOnly) return 'readonly';
  return 'default';
}

function Field({
  id,
  label,
  value,
  onChange,
  hint,
  className = '',
  readOnly = false
}: {
  id: string;
  label: string;
  value: string | number;
  onChange?: (value: string) => void;
  hint?: string;
  className?: string;
  readOnly?: boolean;
}) {
  return (
    <FormField htmlFor={id} label={label} hint={hint} className={className}>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        tone={inputToneForField(className, readOnly)}
        value={value}
        readOnly={readOnly}
        onChange={event => onChange?.(event.target.value)}
      />
    </FormField>
  );
}

function ShippingInline({
  state,
  onNumber,
  onCargo,
  onImport,
  prefix = 'New'
}: {
  state: CalcState;
  onNumber: (key: keyof CalcState, value: string) => void;
  onCargo: (value: CargoType) => void;
  onImport: () => void;
  prefix?: 'New' | 'Review';
}) {
  const quote = quoteForPricing(state);
  const finalCost = finalShippingCost(state, quote);
  const suffix = prefix === 'New' ? 'New' : 'Review';
  const weightId = prefix === 'New' ? 'shipActualWeightNew' : 'shipActualWeightReviewCalc';
  const lengthId = prefix === 'New' ? 'shipLengthNew' : 'shipLengthReviewCalc';
  const widthId = prefix === 'New' ? 'shipWidthNew' : 'shipWidthReviewCalc';
  const heightId = prefix === 'New' ? 'shipHeightNew' : 'shipHeightReviewCalc';
  const cargoId = prefix === 'New' ? 'shipCargoTypeNew' : 'shipCargoTypeReview';
  const importId = prefix === 'New' ? 'importShippingNew' : 'importShippingReview';

  return (
    <div className="pricing-ship-inline">
      <div className="pricing-ship-inline-title-row">
        <div className="pricing-ship-inline-title">海外运费计算器</div>
        <div className="pricing-ship-inline-tip">点击计算结果可回填到海外运费框</div>
        <div className="pricing-ship-inline-alert mono" id={`shipChargeReason${suffix}`}>{quote.alerts[0]?.text || ''}</div>
      </div>
      <div className="pricing-ship-inline-inputs">
        <FormField htmlFor={cargoId} label="货物类型">
          <Select id={cargoId} value={state.shipCargoTypeNew} onChange={event => onCargo(event.target.value as CargoType)}>
            <option value="general">普货</option>
            <option value="special">特货</option>
          </Select>
        </FormField>
        <Field id={weightId} label="实重（g）" value={state.shipActualWeightNew} onChange={value => onNumber('shipActualWeightNew', value)} />
        <Field id={lengthId} label="长（cm）" value={state.shipLengthNew} onChange={value => onNumber('shipLengthNew', value)} />
        <Field id={widthId} label="宽（cm）" value={state.shipWidthNew} onChange={value => onNumber('shipWidthNew', value)} />
        <Field id={heightId} label="高（cm）" value={state.shipHeightNew} onChange={value => onNumber('shipHeightNew', value)} />
      </div>
      <div className="pricing-ship-inline-metrics">
        <div className="pricing-ship-inline-item">
          <div className="pricing-ship-inline-head">
            <span className="k">实重</span>
            <span className="v mono" id={`shipActualKg${suffix}`}>{quote.actualWeightKg > 0 ? formatWeight(quote.actualWeightKg) : '-'}</span>
          </div>
          <span className="pricing-ship-inline-rule mono" id={`shipActualRule${suffix}`}>按输入重量换算</span>
        </div>
        <div className="pricing-ship-inline-item">
          <div className="pricing-ship-inline-head">
            <span className="k">体积重</span>
            <span className="v mono" id={`shipVolWeight${suffix}`}>{quote.volumeWeightKg !== null ? formatWeight(quote.volumeWeightKg) : '-'}</span>
          </div>
          <span className="pricing-ship-inline-rule mono" id={`shipVolFormula${suffix}`}>长 × 宽 × 高 ÷ 8000</span>
        </div>
        <div className="pricing-ship-inline-item">
          <div className="pricing-ship-inline-head">
            <span className="k">计费重</span>
            <span className="v mono" id={`shipChargeWeight${suffix}`}>{quote.chargeWeightKg !== null ? formatWeight(quote.chargeWeightKg) : '-'}</span>
          </div>
          <span className="pricing-ship-inline-rule mono" id={`shipChargeRule${suffix}`}>{chargeRuleText(quote)}</span>
        </div>
      </div>
      <div className="pricing-ship-inline-summary">
        <div className="pricing-ship-inline-summary-fields">
          <FormField htmlFor={`shipBand${suffix}`} label="命中价卡区间">
            <Input id={`shipBand${suffix}`} value={quote.band?.range || '-'} readOnly />
          </FormField>
          <Field id={`shippingMultiplier${suffix}`} label="运费倍率" value={state.shippingMultiplierNew} onChange={value => onNumber('shippingMultiplierNew', value)} />
          <Field id={`labelFee${suffix}`} label="贴单费 ¥" value={state.labelFeeNew} onChange={value => onNumber('labelFeeNew', value)} />
        </div>
        <button
          id={importId}
          type="button"
          className={`pricing-ship-inline-price pricing-ship-inline-price-clickable expense ${finalCost === null ? 'is-disabled' : ''}`.trim()}
          title="点击导入到上方海外运费"
          onClick={onImport}
          disabled={finalCost === null}
        >
          <span className="v mono" id={`shipFeeCny${suffix}`}>{finalCost !== null ? formatCny(finalCost, 2) : '-'}</span>
        </button>
      </div>
      <div className="pricing-ship-inline-formula mono" id={`shipFeeFormula${suffix}`}>
        {quote.band && quote.chargeWeightKg !== null
          ? `海外运费 =（基础费 ${quote.band.parcel} + 每千克重量费 ${quote.band.perKg} × 计费重 ${formatNumberValue(quote.chargeWeightKg, 3)} - 用户承担 ${DEFAULT_CONSTANTS.CUSTOMER_SHIPPING_JPY}）× 运费倍率 ${formatMoney(state.shippingMultiplierNew, 2)} / 汇率 ${formatNumberValue(state.rateNew, 2)} + 贴单费 ${formatNumberValue(state.labelFeeNew, 2)}`
          : '海外运费 =（基础费 + 每千克重量费 × 计费重 - 用户承担）× 运费倍率 / 汇率 + 贴单费'}
      </div>
    </div>
  );
}

function PricingNewPanel({
  state,
  setState
}: {
  state: CalcState;
  setState: Dispatch<SetStateAction<CalcState>>;
}) {
  const totalCost = state.costNew + state.overseasShippingNew;
  const discounts = state.discountsNew.length ? state.discountsNew : DEFAULTS.discountsNew;
  const anchor = nearestDiscount(discounts, state.anchorNew);
  const origPrice = derivePricingOrigPrice({ state: { ...state, anchorNew: anchor }, totalCost });
  const rows = discounts.slice().sort((a, b) => a - b).map(discount => calcPricingRow({
    state: { ...state, anchorNew: anchor },
    totalCost,
    origPrice,
    discount
  }));
  const origRow = calcPricingRow({ state: { ...state, anchorNew: anchor }, totalCost, origPrice, discount: 1 });
  const updateNumber = (key: keyof CalcState, value: string) => setState(prev => ({ ...prev, [key]: toNumber(value) }));
  const updateCargo = (value: CargoType) => setState(prev => ({ ...prev, shipCargoTypeNew: value }));
  const importShipping = () => {
    const finalCost = finalShippingCost(state);
    if (finalCost === null) return;
    setState(prev => ({ ...prev, overseasShippingNew: finalCost, shippingSourceNew: 'calculator' }));
  };

  return (
    <div className="calc-panel active" id="calc-panel-pricing-new">
      <div className="grid">
        <Card>
          <h2>定价输入</h2>
          <div className="row triple">
            <Field id="costNew" label="采购价 ¥" className="expense-field" value={state.costNew} onChange={value => updateNumber('costNew', value)} />
            <Field id="overseasShippingNew" label="海外运费 ¥" className="expense-field" value={state.overseasShippingNew} onChange={value => updateNumber('overseasShippingNew', value)} />
            <FormField htmlFor="totalCostNew" label={<>总费用 ¥<span className="var">采购价+海外运费</span></>} className="expense-field">
              <Input id="totalCostNew" type="number" step="0.01" min="0" value={totalCost.toFixed(2)} readOnly />
            </FormField>
          </div>
          <ShippingInline state={state} onNumber={updateNumber} onCargo={updateCargo} onImport={importShipping} />
          <div style={{ marginTop: 18 }}>
            <div className="row triple">
              <Field id="feeNew" label="TK 平台手续费（%）" value={state.feeNew} onChange={value => updateNumber('feeNew', value)} />
              <Field id="creatorRateNew" label="达人佣金率（%）" value={state.creatorRateNew} onChange={value => updateNumber('creatorRateNew', value)} />
              <Field id="rateNew" label="日元汇率" value={state.rateNew} onChange={value => updateNumber('rateNew', value)} />
            </div>
            <div className="row pricing-anchor-row" style={{ marginTop: 18 }}>
              <FormField htmlFor="anchorNew" label="基准折扣档位" hint="用于按该折扣反推原价">
                <Select id="anchorNew" value={anchor} onChange={event => updateNumber('anchorNew', event.target.value)}>
                  {discounts.map(discount => <option value={discount} key={discount}>{formatDiscount(discount)}</option>)}
                </Select>
              </FormField>
              <Field id="targetMarginNew" label="目标利润率（倍）" value={state.targetMarginNew} hint="总费用倍数" onChange={value => updateNumber('targetMarginNew', value)} />
              <FormField htmlFor="discountsNew" label="折扣档位（逗号分隔）" hint="支持 0.38 或 38%；档位可增删">
                <Input
                  id="discountsNew"
                  value={state.discountsNew.join(',')}
                  onChange={event => setState(prev => ({ ...prev, discountsNew: parseDiscounts(event.target.value) }))}
                />
              </FormField>
            </div>
          </div>
          <div hidden aria-hidden="true">
            <Input id="origPriceNew" inputMode="decimal" autoComplete="off" value={Math.round(origPrice)} readOnly />
          </div>
        </Card>
        <Card>
          <h2>各折扣档位定价 / 利润一览</h2>
          <table className="mono calc-result-table">
            <thead>
              <tr>
                <th>折扣</th>
                <th>日元售价</th>
                <th>人民币到手</th>
                <th>利润</th>
                <th>利润率</th>
              </tr>
            </thead>
            <tbody id="tbodyNew">
              <tr className="orig-row">
                <td>原价</td>
                <td className="orig-price-cell">{formatMoney(origPrice, 0)} 円</td>
                <td>{formatCny(origRow.cnyNet, 2)}</td>
                <td className={origRow.profit > 0 ? 'profit-pos' : origRow.profit < 0 ? 'profit-neg' : ''}>{formatCny(origRow.profit, 2)}</td>
                <td>{formatMargin(origRow.margin)}</td>
              </tr>
              {rows.map(row => {
                const isAnchor = Math.abs(row.discount - anchor) < 1e-9;
                const profitClass = row.profit > 0 ? 'profit-pos' : row.profit < 0 ? 'profit-neg' : '';
                return (
                  <tr className={isAnchor ? 'anchor' : ''} key={row.discount}>
                    <td>{formatDiscount(row.discount)}{isAnchor ? ' ★' : ''}</td>
                    <td>{formatMoney(row.jpyPrice, 0)} 円</td>
                    <td>{formatCny(row.cnyNet, 2)}</td>
                    <td className={profitClass}>{formatCny(row.profit, 2)}</td>
                    <td>{formatMargin(row.margin)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="calc-formula-block">
            <div className="calc-formula-title">◇ 公式</div>
            <div className="calc-formula-list">
              <div>海外运费 =（基础费 + 每千克重量费 × 计费重 − 用户承担）× 运费倍率 ÷ 汇率 + 贴单费</div>
              <div>总费用 = 采购价 + 海外运费</div>
              <div>日元售价 = 原价 × 折扣 ×（1 − 平台手续费率）</div>
              <div>达人佣金 = 日元售价 × 达人佣金率</div>
              <div>人民币到手 =（日元售价 − 达人佣金）÷ 汇率</div>
              <div>利润 = 人民币到手 − 总费用</div>
              <div>利润率 = 人民币到手 ÷ 总费用</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function LegacyPanel({ state, setState }: { state: CalcState; setState: Dispatch<SetStateAction<CalcState>> }) {
  const discounts = state.discounts.length ? state.discounts : DEFAULTS.discounts;
  const anchor = nearestDiscount(discounts, state.anchor);
  const origPrice = deriveLegacyOrigPrice({ ...state, anchor });
  const rows = discounts.slice().sort((a, b) => a - b).map(discount => calcLegacyRow(state, origPrice, discount));
  const updateNumber = (key: keyof CalcState, value: string) => setState(prev => ({ ...prev, [key]: toNumber(value) }));
  return (
    <div className="calc-panel active" id="calc-panel-pricing">
      <div className="grid">
        <Card>
          <h2>核心输入</h2>
          <div className="row">
            <Field id="cost" label="采购价（人民币 ¥）" className="primary" value={state.cost} onChange={value => updateNumber('cost', value)} />
            <Field id="targetMargin" label="目标利润率（倍）" value={state.targetMargin} hint="人民币到手价 ÷ 采购价，例如 1.4 表示到手价 = 1.4 × 采购价" onChange={value => updateNumber('targetMargin', value)} />
          </div>
          <div className="row">
            <FormField htmlFor="anchor" label="基准折扣档位" hint="以该档位为目标利润率的基准来反推原价">
              <Select id="anchor" value={anchor} onChange={event => updateNumber('anchor', event.target.value)}>
                {discounts.map(discount => <option value={discount} key={discount}>{formatDiscount(discount)}</option>)}
              </Select>
            </FormField>
            <Field id="origPrice" label="商品原价（円）" className="readonly" value={Math.round(origPrice)} readOnly />
          </div>
          <details open style={{ marginTop: 16 }}>
            <summary>全局参数（平台手续费 / 汇率 / 运费 / 折扣档位）</summary>
            <div className="row quad" style={{ marginTop: 10 }}>
              <Field id="fee" label="TK 平台手续费（%）" value={state.fee} onChange={value => updateNumber('fee', value)} />
              <Field id="rate" label="日元汇率（1元 = ? 円）" value={state.rate} onChange={value => updateNumber('rate', value)} />
              <Field id="shipping" label="100g 运费+贴单费（¥）" value={state.shipping} onChange={value => updateNumber('shipping', value)} />
              <Field id="creatorRate" label="达人佣金率（%）" value={state.creatorRate} onChange={value => updateNumber('creatorRate', value)} />
            </div>
          </details>
        </Card>
        <Card>
          <h2>各折扣档位定价 / 利润一览</h2>
          <table className="mono calc-result-table">
            <thead>
              <tr>
                <th>折扣</th>
                <th>日元售价</th>
                <th>人民币到手</th>
                <th>利润率</th>
              </tr>
            </thead>
            <tbody id="tbody">
              {rows.map(row => (
                <tr className={Math.abs(row.discount - anchor) < 1e-9 ? 'anchor' : ''} key={row.discount}>
                  <td>{formatDiscount(row.discount)}</td>
                  <td>{formatMoney(row.jpyPrice, 0)} 円</td>
                  <td>{formatCny(row.cnyNet, 2)}</td>
                  <td>{formatMargin(row.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function ReviewPanel({ state, setState }: { state: CalcState; setState: Dispatch<SetStateAction<CalcState>> }) {
  const totalCost = state.costNew + state.overseasShippingNew;
  const result = calcSalePrice({ state, totalCost });
  const updateNumber = (key: keyof CalcState, value: string) => setState(prev => ({ ...prev, [key]: toNumber(value) }));
  const importShipping = () => {
    const finalCost = finalShippingCost(state);
    if (finalCost === null) return;
    setState(prev => ({ ...prev, overseasShippingNew: finalCost, shippingSourceNew: 'calculator' }));
  };
  const profitClass = result && result.profit > 0 ? 'profit-pos' : result && result.profit < 0 ? 'profit-neg' : '';
  return (
    <div className="calc-panel active" id="calc-panel-review">
      <div className="grid">
        <Card>
          <h2>成交输入</h2>
          <div className="row">
            <Field id="salePrice" label="实际售价（円）" className="success" value={state.salePrice || ''} onChange={value => updateNumber('salePrice', value)} />
            <FormField htmlFor="totalCostReview" label={<>总费用 ¥<span className="var">采购价+海外运费</span></>} className="expense-field">
              <Input id="totalCostReview" type="number" step="0.01" min="0" value={totalCost.toFixed(2)} readOnly />
            </FormField>
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="row">
              <Field id="costReview" label="采购价 ¥" className="expense-field" value={state.costNew} onChange={value => updateNumber('costNew', value)} />
              <Field id="shippingReview" label="海外运费 ¥" className="expense-field" value={state.overseasShippingNew} onChange={value => updateNumber('overseasShippingNew', value)} />
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="row">
              <Field id="creatorRateReview" label="达人佣金率（%）" value={state.creatorRateNew} onChange={value => updateNumber('creatorRateNew', value)} />
              <Field id="saleCommissionReview" label="达人佣金 ¥" className="expense-field" value={result ? result.creatorCommission.toFixed(2) : ''} readOnly />
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <ShippingInline state={state} onNumber={updateNumber} onCargo={value => setState(prev => ({ ...prev, shipCargoTypeNew: value }))} onImport={importShipping} prefix="Review" />
          </div>
        </Card>
        <Card>
          <h2>利润复盘</h2>
          <div className="known-sale-grid review-metrics">
            <div className="known-sale-item">
              <div className="label">人民币到手</div>
              <div className="value mono" id="saleNet">{result ? formatCny(result.cnyNet, 2) : '-'}</div>
            </div>
            <div className="known-sale-item">
              <div className="label">利润</div>
              <div className={`value mono ${profitClass}`.trim()} id="saleProfit">{result ? formatCny(result.profit, 2) : '-'}</div>
            </div>
            <div className="known-sale-item">
              <div className="label">利润率</div>
              <div className={`value mono ${profitClass}`.trim()} id="saleMargin">{result ? formatMargin(result.margin) : '-'}</div>
            </div>
          </div>
          <div className="review-formula mono">
            <div>总费用 = 采购价 + 海外运费</div>
            <div>达人佣金 = 实际售价 × 达人佣金率</div>
            <div>人民币到手 =（实际售价 − 达人佣金）÷ 日元汇率</div>
            <div>利润 = 人民币到手 − 总费用</div>
            <div>利润率 = 人民币到手 ÷ 总费用</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReferenceCards() {
  const general = SHIPPING_RULES.general.bands;
  const special = SHIPPING_RULES.special.bands;
  return (
    <>
      <Card className="ship-calc">
        <h2>新版海外运费参考表</h2>
        <div className="ship-meta">
          <span><b>使用新规</b> 2026/04/24 00:00（GMT+8）起生效</span>
          <span className="sep">·</span>
          <span>50g 起重，按 g 计费</span>
          <span className="sep">·</span>
          <span>当体积重 &gt; 1.5 × 实重时，按体积重计费</span>
        </div>
        <div className="ship-rate-wrap">
          <div className="ship-rate-title">2026/04/24 起新版价卡</div>
          <table className="ship ship-rate mono">
            <thead>
              <tr>
                <th>重量区间</th>
                <th>普货基础费</th>
                <th>普货重量费</th>
                <th>特货基础费</th>
                <th>特货重量费</th>
              </tr>
            </thead>
            <tbody>
              {general.map((band, index) => (
                <tr key={band.range}>
                  <td className="w">{band.range}</td>
                  <td>{band.parcel} 円</td>
                  <td>{band.perKg} 円/kg</td>
                  <td>{special[index].parcel} 円</td>
                  <td>{special[index].perKg} 円/kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="commission-ref">
        <h2>TK 佣金费率参考表</h2>
        <div className="ship-meta">
          <span><b>类目佣金率参考</b> 用于达人佣金率和类目判断</span>
          <span className="sep">·</span>
          <span>最终请以店铺后台实时显示为准</span>
        </div>
        <div className="commission-grid">
          {[
            ['7%', ['汽车与摩托车', '电脑办公', '食品饮料', '家电', '手机与数码', '家具', '家装建材']],
            ['9%', ['图书&杂志&音频', '收藏品', '居家日用*', '厨房用品', '家纺布艺', '五金工具']],
            ['10%', ['母婴用品*', '美妆个护*', '保健', '珠宝与衍生品', '鞋靴', '运动与户外', '玩具和爱好']],
            ['12%', ['时尚配件', '儿童时尚', '箱包', '男装与男士内衣', '穆斯林服饰', '宠物用品*', '女装与女士内衣']]
          ].map(([rate, tags]) => (
            <div className="commission-group" key={rate as string}>
              <div className="commission-rate-badge mono">{rate}</div>
              <div className="commission-tags">{(tags as string[]).map(tag => <span key={tag}>{tag}</span>)}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function CalculatorApp() {
  const [state, setState] = useState<CalcState>(() => {
    const next = loadState();
    const store = typeof window !== 'undefined' ? ensureGlobalSettingsStore(window) : null;
    const globalRate = store?.getExchangeRate?.();
    return globalRate ? { ...next, rateNew: globalRate } : next;
  });
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    saveState(state);
    if (typeof window !== 'undefined') {
      ensureGlobalSettingsStore(window).setExchangeRate(state.rateNew || null);
    }
  }, [state]);

  const activePanel = useMemo(() => {
    if (state.calcTab === 'pricing') return <LegacyPanel state={state} setState={setState} />;
    if (state.calcTab === 'review') return <ReviewPanel state={state} setState={setState} />;
    return <PricingNewPanel state={state} setState={setState} />;
  }, [state]);

  return (
    <div className="calculator-react-shell" data-react-calculator-ready="true">
      <div className="module-hero page-hero page-hero-calc">
        <div className="module-hero-copy">
          <div className="module-hero-title-row">
            <h2>利润计算器</h2>
            <div className="module-kicker">定价 / 汇率 / 海外运费</div>
          </div>
          <p>根据各项参数统一测算售价、利润，以及确定售价复盘实际利润</p>
        </div>
      </div>
      <div className="calc-toolbar">
        <div className="calc-subnav">
          <div className="calc-tabbar">
            <TabsList className="calc-tabs" role="tablist" aria-label="利润计算模式">
              {[
                ['pricing', '定价旧'],
                ['pricingNew', '定价新'],
                ['review', '利润复盘']
              ].map(([key, label]) => (
                <TabsTrigger
                  active={state.calcTab === key}
                  className={`calc-tab ${state.calcTab === key ? 'active' : ''}`.trim()}
                  data-calc-tab={key}
                  key={key}
                  onClick={() => setState(prev => ({ ...prev, calcTab: key }))}
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              id="calc-help-btn"
              variant="plain"
              className="calc-help-icon"
              aria-controls="calc-help-modal"
              aria-haspopup="dialog"
              aria-label="模式说明"
              title="模式说明"
              onClick={() => setHelpOpen(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.5 4.5h8a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v-11a3 3 0 0 1 2-3Z" />
                <path d="M8.5 8.25h6.5M8.5 11.25h6.5M8.5 14.25h4.5" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
      {activePanel}
      <ReferenceCards />
      <Dialog id="calc-help-modal" open={helpOpen} titleId="calc-help-title" onOpenChange={setHelpOpen}>
        <DialogContent style={{ maxWidth: 560 }}>
          <DialogTitle id="calc-help-title">定价旧 / 定价新 / 利润复盘有什么区别？</DialogTitle>
          <Alert variant="info" className="calc-help-copy">
            <AlertDescription>
            <div className="calc-help-item"><div className="k">定价旧</div><div className="v">按旧口径快速反推原价、各折扣售价和利润率，适合粗算、对比和保留原来的计算习惯。</div></div>
            <div className="calc-help-item"><div className="k">定价新</div><div className="v">以目标利润率为核心，根据采购价、海外运费、平台手续费、达人佣金率、汇率和折扣档位反推原价。</div></div>
            <div className="calc-help-item"><div className="k">利润复盘</div><div className="v">适合订单已经成交、商品售价已经确定时使用，直接复盘人民币到手、利润和利润率。</div></div>
            </AlertDescription>
          </Alert>
          <div className="actions">
            <Button id="calc-help-close" variant="primary" onClick={() => setHelpOpen(false)}>知道了</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CalculatorApp };
