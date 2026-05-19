import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { calcLegacyRow, calcPricingRow, calcSalePrice, deriveLegacyOrigPrice, derivePricingOrigPrice } from '../../../calc/formulas.ts';
import { ensureGlobalSettingsStore } from '../../../global-settings.ts';
import { DEFAULT_CONSTANTS, SHIPPING_RULES, computeCalculatedShippingCost, computeShippingQuote } from '../../../shipping-core.ts';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormRow } from '@/components/ui/form';
import { HelpItem, HelpStack } from '@/components/ui/help-stack';
import { InlineToken } from '@/components/ui/inline-token';
import { Input } from '@/components/ui/input';
import { PageHero } from '@/components/ui/page-hero';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const LS_KEY = 'tk.calculator.v1';

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
  } as Parameters<typeof computeCalculatedShippingCost>[0]);
}

function syncCalculatedShipping(state: CalcState, { force = false }: { force?: boolean } = {}): CalcState {
  const finalCost = finalShippingCost(state);
  if (finalCost === null || state.overseasShippingNew === finalCost) return state;
  if (!force && state.shippingSourceNew === 'manual' && state.overseasShippingNew > 0) return state;
  return {
    ...state,
    overseasShippingNew: finalCost,
    shippingSourceNew: 'calculator'
  };
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
  labelClassName,
  inputClassName,
  readOnly = false
}: {
  id: string;
  label: string;
  value: string | number;
  onChange?: (value: string) => void;
  hint?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  readOnly?: boolean;
}) {
  return (
    <FormField htmlFor={id} label={label} hint={hint} className={className} labelClassName={labelClassName}>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        tone={inputToneForField(className, readOnly)}
        className={inputClassName}
        value={value}
        readOnly={readOnly}
        onChange={event => onChange?.(event.target.value)}
      />
    </FormField>
  );
}

const calcPanelClass = 'calc-panel active block';
const calcLayoutClass = 'calc-layout-grid grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-[18px] [&>*]:min-w-0 max-[860px]:grid-cols-1';
const calcFormSectionClass = 'calc-form-section mt-[18px]';
const calcDetailsClass = 'calc-details group mt-4';
const calcDetailsGridClass = 'calc-details-grid mt-2.5';
const calcToolbarClass = 'calc-toolbar mb-2.5 flex flex-wrap items-center justify-start gap-0 max-[768px]:items-stretch';
const calcSubnavClass = 'calc-subnav flex w-full min-w-0 items-center justify-start rounded-2xl border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel2)_74%,transparent),color-mix(in_srgb,var(--panel)_92%,transparent))] px-3 py-1.5 shadow-[0_8px_20px_rgba(14,20,44,.07)] max-[768px]:px-[11px] max-[768px]:py-2.5';
const calcTabbarClass = 'calc-tabbar flex w-auto min-w-0 items-center justify-start gap-2';
const calcTabsClass = 'calc-tabs flex w-auto flex-none flex-wrap items-center gap-1.5 max-[768px]:min-w-0';
const calcHelpButtonClass = 'calc-help-icon h-7 w-7 shrink-0 rounded-full border border-[var(--border)] bg-[var(--panel)] p-0 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.5] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]';
const knownSaleItemClass = 'known-sale-item flex flex-col justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel2)] px-3.5 py-3';
const knownSaleLabelClass = 'label text-[11px] uppercase tracking-[1px] text-[var(--muted)]';
const knownSaleValueClass = 'value text-xl font-bold leading-[1.2] text-[var(--text)] tabular-nums max-[768px]:text-lg';
const reviewFormulaClass = 'review-formula mt-3.5 grid gap-[3px] text-[11px] leading-[1.35] text-[var(--muted)] tabular-nums [overflow-wrap:anywhere]';
const shippingFieldLabelClass = 'min-h-0 text-xs';
const shippingControlClass = 'min-h-10 rounded-[9px] px-2.5 py-2.5 text-[13.5px]';
const shippingSummaryFieldLabelClass = 'text-[11px]';
const shippingSummaryInputClass = 'px-2.5 py-[7px] text-[13px]';
const shippingInlineClass = 'pricing-ship-inline mt-[18px] rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(110,168,255,.07),rgba(138,255,207,.04))] p-3';
const shippingTitleRowClass = 'pricing-ship-inline-title-row mb-2.5 flex flex-wrap items-center justify-start gap-3';
const shippingTitleClass = 'pricing-ship-inline-title text-xs font-semibold tracking-[.5px] text-[var(--muted)]';
const shippingTipClass = 'pricing-ship-inline-tip text-[10px] leading-[1.35] text-[var(--accent)]';
const shippingAlertClass = 'pricing-ship-inline-alert min-w-0 flex-[0_1_auto] whitespace-normal text-left text-[10px] leading-[1.35] text-[var(--danger)] tabular-nums';
const shippingInputsClass = 'pricing-ship-inline-inputs grid grid-cols-[1.05fr_.95fr_.8fr_.8fr_.8fr] items-end gap-2.5 [&>*]:min-w-0 max-[860px]:grid-cols-3 max-[640px]:grid-cols-2';
const shippingMetricsClass = 'pricing-ship-inline-metrics mt-2.5 grid grid-cols-[.92fr_.92fr_1.16fr] gap-2.5 [&>*]:min-w-0 max-[640px]:grid-cols-1';
const shippingSummaryClass = 'pricing-ship-inline-summary mt-2.5 grid grid-cols-[1.84fr_1.16fr] items-stretch gap-2.5 [&>*]:min-w-0 max-[640px]:grid-cols-1';
const shippingSummaryFieldsClass = 'pricing-ship-inline-summary-fields grid min-w-0 grid-cols-3 gap-2.5 [&>*]:min-w-0 max-[640px]:grid-cols-1';
const shippingItemClass = 'pricing-ship-inline-item flex flex-col items-stretch justify-start gap-1.5 rounded-[10px] border border-[rgba(110,168,255,.18)] bg-[var(--panel2)] px-3 py-2.5';
const shippingHeadClass = 'pricing-ship-inline-head flex min-w-0 items-center justify-between gap-2.5';
const shippingMetricLabelClass = 'k text-[11px] font-semibold tracking-[.5px] text-[var(--muted)]';
const shippingMetricValueClass = 'v text-right text-base font-bold text-[var(--text)] tabular-nums';
const shippingMetricRuleClass = 'pricing-ship-inline-rule whitespace-normal text-[10px] leading-[1.25] text-[var(--muted)] tabular-nums';
const shippingPriceButtonClass = 'pricing-ship-inline-price pricing-ship-inline-price-clickable expense flex w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-[10px] border-0 bg-transparent px-1 py-0.5 transition-[background,box-shadow,opacity] hover:bg-[rgba(240,138,134,.08)] disabled:cursor-not-allowed disabled:opacity-50';
const shippingPriceValueClass = 'v text-center text-xl font-bold text-[var(--expense)] tabular-nums';
const shippingFormulaClass = 'pricing-ship-inline-formula mt-2.5 whitespace-normal text-center text-[9px] leading-[1.35] text-[var(--muted)] tabular-nums [overflow-wrap:anywhere]';
const calcFormulaBlockClass = 'calc-formula-block mt-3 text-[var(--muted)]';
const calcFormulaTitleClass = 'calc-formula-title mb-1 text-[9.5px] uppercase tracking-[.6px] opacity-70';
const calcFormulaListClass = 'calc-formula-list flex flex-col gap-[3px] font-mono text-[10.5px] leading-[1.32] [overflow-wrap:anywhere]';
const calcResultTableClass = 'calc-result-table mt-2 w-full border-collapse border-0 text-[14.5px] tabular-nums [&_td]:border-x-0 [&_td]:border-t-0 [&_th]:border-x-0 [&_th]:border-t-0 [&_tbody_tr:last-child_td]:border-b-0 max-[640px]:text-[13px]';
const calcResultHeadClass = 'px-[11px] py-[11.5px] text-[11.5px] max-[640px]:px-1.5 max-[640px]:py-2.5 max-[640px]:text-[10.5px]';
const calcResultCellClass = 'px-[11px] py-[11.5px] max-[640px]:px-1.5 max-[640px]:py-2.5';
const calcResultAnchorCellClass = 'bg-[linear-gradient(90deg,rgba(110,168,255,.14),transparent)] font-semibold';
const calcResultOrigCellClass = 'bg-[linear-gradient(180deg,rgba(138,255,207,.16),rgba(138,255,207,.08))] font-semibold';
const calcResultOrigStrongCellClass = cn(calcResultOrigCellClass, 'font-bold text-[var(--accent2)]');
const calcDetailsSummaryClass = 'cursor-pointer py-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--text)] group-open:mb-2.5';
const profitPositiveClass = 'profit-pos font-semibold text-[var(--ok)]';
const profitNegativeClass = 'profit-neg font-semibold text-[var(--danger)]';
const referenceCardClass = 'ship-calc mt-[18px]';
const commissionCardClass = 'commission-ref mt-[18px]';
const referenceMetaClass = 'ship-meta mb-3.5 flex flex-wrap gap-2.5 rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel2)] px-3.5 py-3 text-[12.5px] text-[var(--muted)]';
const referenceMetaStrongClass = 'font-semibold text-[var(--text)]';
const referenceMetaSepClass = 'sep opacity-40';
const shipRateWrapClass = 'ship-rate-wrap mt-4 min-w-0 max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch] max-[640px]:-mx-4 max-[640px]:mt-[18px] max-[640px]:px-4';
const shipRateTitleClass = 'ship-rate-title mb-2.5 text-[11px] uppercase tracking-[1px] text-[var(--muted)]';
const shipRateTableClass = 'ship-rate mt-1.5 w-full border-collapse text-[13.5px] tabular-nums max-[640px]:min-w-[640px] max-[640px]:text-[13px]';
const shipRateHeadClass = 'border-b border-[var(--border)] bg-[var(--panel2)] px-2 py-[11px] text-[11.5px] font-semibold uppercase tracking-[.4px] text-[var(--muted)] max-[640px]:px-1.5 max-[640px]:py-[9px] max-[640px]:text-[10.5px]';
const shipRateCellClass = 'whitespace-nowrap px-2 py-[11px] max-[640px]:px-1.5 max-[640px]:py-[9px]';
const shipRateWeightCellClass = cn(shipRateCellClass, 'w font-bold text-[var(--warn)]');
const shipRateEvenCellClass = 'bg-[rgba(110,168,255,.04)]';
const commissionGridClass = 'commission-grid grid grid-cols-2 gap-3 max-[768px]:grid-cols-1';
const commissionGroupClass = 'commission-group grid grid-cols-[68px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-[var(--border)] bg-[rgba(110,168,255,.05)] px-3.5 py-3 max-[768px]:grid-cols-[56px_minmax(0,1fr)] max-[768px]:gap-2.5 max-[768px]:px-3 max-[768px]:py-[11px]';
const commissionRateBadgeClass = 'commission-rate-badge inline-flex min-h-[34px] items-center justify-center rounded-full bg-[var(--panel2)] px-2.5 text-[15px] font-bold text-[var(--accent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--line)_86%,white_14%)] tabular-nums max-[768px]:min-h-[30px] max-[768px]:text-[13.5px]';
const commissionTagsClass = 'commission-tags flex flex-wrap gap-2 max-[768px]:gap-1.5';
const commissionTagClass = 'inline-flex min-h-[30px] items-center whitespace-nowrap rounded-full bg-[rgba(255,255,255,.78)] px-2.5 text-[12.5px] leading-[1.2] text-[var(--text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--border)_86%,white_14%)] max-[768px]:min-h-7 max-[768px]:px-[9px] max-[768px]:text-xs';

function calcProfitClass(value: number) {
  if (value > 0) return profitPositiveClass;
  if (value < 0) return profitNegativeClass;
  return '';
}

function calcRowCellClass(isAnchor: boolean, className = '') {
  return cn(calcResultCellClass, isAnchor ? calcResultAnchorCellClass : '', className);
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
    <div className={shippingInlineClass}>
      <div className={shippingTitleRowClass}>
        <div className={shippingTitleClass}>海外运费计算器</div>
        <div className={shippingTipClass}>计算结果自动回填到海外运费框</div>
        <div className={shippingAlertClass} id={`shipChargeReason${suffix}`}>{quote.alerts[0]?.text || ''}</div>
      </div>
      <div className={shippingInputsClass}>
        <FormField htmlFor={cargoId} label="货物类型" className="gap-1.5" labelClassName={shippingFieldLabelClass}>
          <Select className={shippingControlClass} id={cargoId} value={state.shipCargoTypeNew} onChange={event => onCargo(event.target.value as CargoType)}>
            <option value="general">普货</option>
            <option value="special">特货</option>
          </Select>
        </FormField>
        <Field id={weightId} label="实重（g）" className="gap-1.5" labelClassName={shippingFieldLabelClass} inputClassName={shippingControlClass} value={state.shipActualWeightNew} onChange={value => onNumber('shipActualWeightNew', value)} />
        <Field id={lengthId} label="长（cm）" className="gap-1.5" labelClassName={shippingFieldLabelClass} inputClassName={shippingControlClass} value={state.shipLengthNew} onChange={value => onNumber('shipLengthNew', value)} />
        <Field id={widthId} label="宽（cm）" className="gap-1.5" labelClassName={shippingFieldLabelClass} inputClassName={shippingControlClass} value={state.shipWidthNew} onChange={value => onNumber('shipWidthNew', value)} />
        <Field id={heightId} label="高（cm）" className="gap-1.5" labelClassName={shippingFieldLabelClass} inputClassName={shippingControlClass} value={state.shipHeightNew} onChange={value => onNumber('shipHeightNew', value)} />
      </div>
      <div className={shippingMetricsClass}>
        <div className={shippingItemClass}>
          <div className={shippingHeadClass}>
            <span className={shippingMetricLabelClass}>实重</span>
            <span className={shippingMetricValueClass} id={`shipActualKg${suffix}`}>{quote.actualWeightKg > 0 ? formatWeight(quote.actualWeightKg) : '-'}</span>
          </div>
          <span className={shippingMetricRuleClass} id={`shipActualRule${suffix}`}>按输入重量换算</span>
        </div>
        <div className={shippingItemClass}>
          <div className={shippingHeadClass}>
            <span className={shippingMetricLabelClass}>体积重</span>
            <span className={shippingMetricValueClass} id={`shipVolWeight${suffix}`}>{quote.volumeWeightKg !== null ? formatWeight(quote.volumeWeightKg) : '-'}</span>
          </div>
          <span className={shippingMetricRuleClass} id={`shipVolFormula${suffix}`}>长 × 宽 × 高 ÷ 8000</span>
        </div>
        <div className={shippingItemClass}>
          <div className={shippingHeadClass}>
            <span className={shippingMetricLabelClass}>计费重</span>
            <span className={shippingMetricValueClass} id={`shipChargeWeight${suffix}`}>{quote.chargeWeightKg !== null ? formatWeight(quote.chargeWeightKg) : '-'}</span>
          </div>
          <span className={shippingMetricRuleClass} id={`shipChargeRule${suffix}`}>{chargeRuleText(quote)}</span>
        </div>
      </div>
      <div className={shippingSummaryClass}>
        <div className={shippingSummaryFieldsClass}>
          <FormField htmlFor={`shipBand${suffix}`} label="命中价卡区间" labelClassName={shippingSummaryFieldLabelClass}>
            <Input className={shippingSummaryInputClass} id={`shipBand${suffix}`} value={quote.band?.range || '-'} readOnly />
          </FormField>
          <Field id={`shippingMultiplier${suffix}`} label="运费倍率" labelClassName={shippingSummaryFieldLabelClass} inputClassName={shippingSummaryInputClass} value={state.shippingMultiplierNew} onChange={value => onNumber('shippingMultiplierNew', value)} />
          <Field id={`labelFee${suffix}`} label="贴单费 ¥" labelClassName={shippingSummaryFieldLabelClass} inputClassName={shippingSummaryInputClass} value={state.labelFeeNew} onChange={value => onNumber('labelFeeNew', value)} />
        </div>
        <button
          id={importId}
          type="button"
          className={cn(shippingPriceButtonClass, finalCost === null ? 'is-disabled' : '')}
          title="点击导入到上方海外运费"
          onClick={onImport}
          disabled={finalCost === null}
        >
          <span className={shippingPriceValueClass} id={`shipFeeCny${suffix}`}>{finalCost !== null ? formatCny(finalCost, 2) : '-'}</span>
        </button>
      </div>
      <div className={shippingFormulaClass} id={`shipFeeFormula${suffix}`}>
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
  const updateNumber = (key: keyof CalcState, value: string) => setState(prev => ({
    ...prev,
    [key]: toNumber(value),
    ...(key === 'overseasShippingNew' ? { shippingSourceNew: 'manual' } : {})
  }));
  const updateCargo = (value: CargoType) => setState(prev => ({ ...prev, shipCargoTypeNew: value }));
  const importShipping = () => {
    const finalCost = finalShippingCost(state);
    if (finalCost === null) return;
    setState(prev => ({ ...prev, overseasShippingNew: finalCost, shippingSourceNew: 'calculator' }));
  };

  return (
    <div className={calcPanelClass} id="calc-panel-pricing-new">
      <div className={calcLayoutClass}>
        <Card>
          <CardTitle>定价输入</CardTitle>
          <FormRow columns={3} className="triple">
            <Field id="costNew" label="采购价 ¥" className="expense-field" value={state.costNew} onChange={value => updateNumber('costNew', value)} />
            <Field id="overseasShippingNew" label="海外运费 ¥" className="expense-field" value={state.overseasShippingNew} onChange={value => updateNumber('overseasShippingNew', value)} />
            <FormField htmlFor="totalCostNew" label={<>总费用 ¥<InlineToken variant="var">采购价+海外运费</InlineToken></>} className="expense-field">
              <Input id="totalCostNew" tone="expense" type="number" step="0.01" min="0" value={totalCost.toFixed(2)} readOnly />
            </FormField>
          </FormRow>
          <ShippingInline state={state} onNumber={updateNumber} onCargo={updateCargo} onImport={importShipping} />
          <div className={calcFormSectionClass}>
            <FormRow columns={3} className="triple">
              <Field id="feeNew" label="TK 平台手续费（%）" value={state.feeNew} onChange={value => updateNumber('feeNew', value)} />
              <Field id="creatorRateNew" label="达人佣金率（%）" value={state.creatorRateNew} onChange={value => updateNumber('creatorRateNew', value)} />
              <Field id="rateNew" label="日元汇率" value={state.rateNew} onChange={value => updateNumber('rateNew', value)} />
            </FormRow>
            <FormRow columns={3} className="pricing-anchor-row mt-[18px] gap-[14px] max-[900px]:grid-cols-1">
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
            </FormRow>
          </div>
          <div hidden aria-hidden="true">
            <Input id="origPriceNew" inputMode="decimal" autoComplete="off" value={Math.round(origPrice)} readOnly />
          </div>
        </Card>
        <Card>
          <CardTitle>各折扣档位定价 / 利润一览</CardTitle>
          <Table className={calcResultTableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className={calcResultHeadClass}>折扣</TableHead>
                <TableHead className={calcResultHeadClass}>日元售价</TableHead>
                <TableHead className={calcResultHeadClass}>人民币到手</TableHead>
                <TableHead className={calcResultHeadClass}>利润</TableHead>
                <TableHead className={calcResultHeadClass}>利润率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody id="tbodyNew">
              <TableRow className="orig-row">
                <TableCell className={calcResultOrigStrongCellClass}>原价</TableCell>
                <TableCell className={cn(calcResultOrigStrongCellClass, 'orig-price-cell')}>{formatMoney(origPrice, 0)} 円</TableCell>
                <TableCell className={calcResultOrigCellClass}>{formatCny(origRow.cnyNet, 2)}</TableCell>
                <TableCell className={cn(calcResultOrigCellClass, calcProfitClass(origRow.profit))}>{formatCny(origRow.profit, 2)}</TableCell>
                <TableCell className={calcResultOrigCellClass}>{formatMargin(origRow.margin)}</TableCell>
              </TableRow>
              {rows.map(row => {
                const isAnchor = Math.abs(row.discount - anchor) < 1e-9;
                return (
                  <TableRow className={isAnchor ? 'anchor' : ''} key={row.discount}>
                    <TableCell className={calcRowCellClass(isAnchor)}>{formatDiscount(row.discount)}{isAnchor ? ' ★' : ''}</TableCell>
                    <TableCell className={calcRowCellClass(isAnchor)}>{formatMoney(row.jpyPrice, 0)} 円</TableCell>
                    <TableCell className={calcRowCellClass(isAnchor)}>{formatCny(row.cnyNet, 2)}</TableCell>
                    <TableCell className={calcRowCellClass(isAnchor, calcProfitClass(row.profit))}>{formatCny(row.profit, 2)}</TableCell>
                    <TableCell className={calcRowCellClass(isAnchor)}>{formatMargin(row.margin)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className={calcFormulaBlockClass}>
            <div className={calcFormulaTitleClass}>◇ 公式</div>
            <div className={calcFormulaListClass}>
              <div>海外运费 =（基础费 + 每千克重量费 × 计费重 − 用户承担）× 运费倍率 ÷ 汇率 + 贴单费</div>
              <div>总费用 = 采购价 + 海外运费</div>
              <div>日元售价 = 原价 × 折扣 ×（1 − 平台手续费率）</div>
              <div>达人佣金 = 日元售价 ÷ 汇率 × 达人佣金率</div>
              <div>人民币到手 = 日元售价 ÷ 汇率 − 达人佣金</div>
              <div>利润 = 人民币到手 − 总费用</div>
              <div>利润率 = 人民币到手 ÷ 总费用</div>
              <div>原价反推 = 总费用 × 目标利润率 × 汇率 ÷ [基准折扣 × (1 − 平台手续费率) × (1 − 达人佣金率)]</div>
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
  const updateNumber = (key: keyof CalcState, value: string) => setState(prev => ({
    ...prev,
    [key]: toNumber(value),
    ...(key === 'overseasShippingNew' ? { shippingSourceNew: 'manual' } : {})
  }));
  return (
    <div className={calcPanelClass} id="calc-panel-pricing">
      <div className={calcLayoutClass}>
        <Card>
          <CardTitle>核心输入</CardTitle>
          <FormRow>
            <Field id="cost" label="采购价（人民币 ¥）" className="primary" value={state.cost} onChange={value => updateNumber('cost', value)} />
            <Field id="targetMargin" label="目标利润率（倍）" value={state.targetMargin} hint="人民币到手价 ÷ 采购价，例如 1.4 表示到手价 = 1.4 × 采购价" onChange={value => updateNumber('targetMargin', value)} />
          </FormRow>
          <FormRow className="mt-[18px] max-[768px]:mt-3">
            <FormField htmlFor="anchor" label="基准折扣档位" hint="以该档位为目标利润率的基准来反推原价">
              <Select id="anchor" value={anchor} onChange={event => updateNumber('anchor', event.target.value)}>
                {discounts.map(discount => <option value={discount} key={discount}>{formatDiscount(discount)}</option>)}
              </Select>
            </FormField>
            <Field id="origPrice" label="商品原价（円）" className="readonly" value={Math.round(origPrice)} readOnly />
          </FormRow>
          <details open className={calcDetailsClass}>
            <summary className={calcDetailsSummaryClass}>全局参数（平台手续费 / 汇率 / 运费 / 折扣档位）</summary>
            <FormRow columns={4} className={calcDetailsGridClass}>
              <Field id="fee" label="TK 平台手续费（%）" value={state.fee} onChange={value => updateNumber('fee', value)} />
              <Field id="rate" label="日元汇率（1元 = ? 円）" value={state.rate} onChange={value => updateNumber('rate', value)} />
              <Field id="shipping" label="100g 运费+贴单费（¥）" value={state.shipping} onChange={value => updateNumber('shipping', value)} />
              <Field id="creatorRate" label="达人佣金率（%）" value={state.creatorRate} onChange={value => updateNumber('creatorRate', value)} />
            </FormRow>
          </details>
        </Card>
        <Card>
          <CardTitle>各折扣档位定价 / 利润一览</CardTitle>
          <Table className={calcResultTableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className={calcResultHeadClass}>折扣</TableHead>
                <TableHead className={calcResultHeadClass}>日元售价</TableHead>
                <TableHead className={calcResultHeadClass}>人民币到手</TableHead>
                <TableHead className={calcResultHeadClass}>利润率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody id="tbody">
              {rows.map(row => {
                const isAnchor = Math.abs(row.discount - anchor) < 1e-9;
                return (
                  <TableRow className={isAnchor ? 'anchor' : ''} key={row.discount}>
                    <TableCell className={calcRowCellClass(isAnchor)}>{formatDiscount(row.discount)}</TableCell>
                    <TableCell className={calcRowCellClass(isAnchor)}>{formatMoney(row.jpyPrice, 0)} 円</TableCell>
                    <TableCell className={calcRowCellClass(isAnchor)}>{formatCny(row.cnyNet, 2)}</TableCell>
                    <TableCell className={calcRowCellClass(isAnchor)}>{formatMargin(row.margin)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function ReviewPanel({ state, setState }: { state: CalcState; setState: Dispatch<SetStateAction<CalcState>> }) {
  const totalCost = state.costNew + state.overseasShippingNew;
  const result = calcSalePrice({ state, totalCost });
  const updateNumber = (key: keyof CalcState, value: string) => setState(prev => ({
    ...prev,
    [key]: toNumber(value),
    ...(key === 'overseasShippingNew' ? { shippingSourceNew: 'manual' } : {})
  }));
  const importShipping = () => {
    const finalCost = finalShippingCost(state);
    if (finalCost === null) return;
    setState(prev => ({ ...prev, overseasShippingNew: finalCost, shippingSourceNew: 'calculator' }));
  };
  const profitClass = result && result.profit > 0 ? 'profit-pos' : result && result.profit < 0 ? 'profit-neg' : '';
  return (
    <div className={calcPanelClass} id="calc-panel-review">
      <div className={calcLayoutClass}>
        <Card>
          <CardTitle>成交输入</CardTitle>
          <FormRow>
            <Field id="salePrice" label="实际售价（円）" className="success" value={state.salePrice || ''} onChange={value => updateNumber('salePrice', value)} />
            <FormField htmlFor="totalCostReview" label={<>总费用 ¥<InlineToken variant="var">采购价+海外运费</InlineToken></>} className="expense-field">
              <Input id="totalCostReview" tone="expense" type="number" step="0.01" min="0" value={totalCost.toFixed(2)} readOnly />
            </FormField>
          </FormRow>
          <div className={calcFormSectionClass}>
            <FormRow>
              <Field id="costReview" label="采购价 ¥" className="expense-field" value={state.costNew} onChange={value => updateNumber('costNew', value)} />
              <Field id="shippingReview" label="海外运费 ¥" className="expense-field" value={state.overseasShippingNew} onChange={value => updateNumber('overseasShippingNew', value)} />
            </FormRow>
          </div>
          <div className={calcFormSectionClass}>
            <FormRow>
              <Field id="creatorRateReview" label="达人佣金率（%）" inputClassName="min-h-[48px] text-[18px] max-[640px]:text-[18px]" value={state.creatorRateNew} onChange={value => updateNumber('creatorRateNew', value)} />
              <Field id="saleCommissionReview" label="达人佣金 ¥" className="expense-field" value={result ? result.creatorCommission.toFixed(2) : ''} readOnly />
            </FormRow>
          </div>
          <div className={calcFormSectionClass}>
            <ShippingInline state={state} onNumber={updateNumber} onCargo={value => setState(prev => ({ ...prev, shipCargoTypeNew: value }))} onImport={importShipping} prefix="Review" />
          </div>
        </Card>
        <Card>
          <CardTitle>利润复盘</CardTitle>
          <div className="known-sale-grid review-metrics grid grid-cols-3 items-stretch gap-3 [&>*]:min-w-0 max-[860px]:grid-cols-2 max-[768px]:grid-cols-1">
            <div className={knownSaleItemClass}>
              <div className={knownSaleLabelClass}>人民币到手</div>
              <div className={knownSaleValueClass} id="saleNet">{result ? formatCny(result.cnyNet, 2) : '-'}</div>
            </div>
            <div className={knownSaleItemClass}>
              <div className={knownSaleLabelClass}>利润</div>
              <div className={cn(knownSaleValueClass, profitClass === 'profit-pos' ? 'text-[var(--ok)]' : '', profitClass === 'profit-neg' ? 'text-[var(--danger)]' : '')} id="saleProfit">{result ? formatCny(result.profit, 2) : '-'}</div>
            </div>
            <div className={knownSaleItemClass}>
              <div className={knownSaleLabelClass}>利润率</div>
              <div className={cn(knownSaleValueClass, profitClass === 'profit-pos' ? 'text-[var(--ok)]' : '', profitClass === 'profit-neg' ? 'text-[var(--danger)]' : '')} id="saleMargin">{result ? formatMargin(result.margin) : '-'}</div>
            </div>
          </div>
          <div className={reviewFormulaClass}>
            <div>总费用 = 采购价 + 海外运费</div>
            <div>达人佣金 = 实际售价 ÷ 日元汇率 × 达人佣金率</div>
            <div>人民币到手 = 实际售价 ÷ 日元汇率 − 达人佣金</div>
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
      <Card className={referenceCardClass}>
        <CardTitle>新版海外运费参考表</CardTitle>
        <div className={referenceMetaClass}>
          <span><b className={referenceMetaStrongClass}>使用新规</b> 2026/04/24 00:00（GMT+8）起生效</span>
          <span className={referenceMetaSepClass}>·</span>
          <span>50g 起重，按 g 计费</span>
          <span className={referenceMetaSepClass}>·</span>
          <span>当体积重 &gt; 1.5 × 实重时，按体积重计费</span>
        </div>
        <div className={shipRateWrapClass}>
          <div className={shipRateTitleClass}>2026/04/24 起新版价卡</div>
          <Table className={shipRateTableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className={shipRateHeadClass}>重量区间</TableHead>
                <TableHead className={shipRateHeadClass}>普货基础费</TableHead>
                <TableHead className={shipRateHeadClass}>普货重量费</TableHead>
                <TableHead className={shipRateHeadClass}>特货基础费</TableHead>
                <TableHead className={shipRateHeadClass}>特货重量费</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {general.map((band, index) => (
                <TableRow key={band.range}>
                  <TableCell className={cn(shipRateWeightCellClass, index % 2 ? shipRateEvenCellClass : '')}>{band.range}</TableCell>
                  <TableCell className={cn(shipRateCellClass, index % 2 ? shipRateEvenCellClass : '')}>{band.parcel} 円</TableCell>
                  <TableCell className={cn(shipRateCellClass, index % 2 ? shipRateEvenCellClass : '')}>{band.perKg} 円/kg</TableCell>
                  <TableCell className={cn(shipRateCellClass, index % 2 ? shipRateEvenCellClass : '')}>{special[index].parcel} 円</TableCell>
                  <TableCell className={cn(shipRateCellClass, index % 2 ? shipRateEvenCellClass : '')}>{special[index].perKg} 円/kg</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <Card className={commissionCardClass}>
        <CardTitle>TK 佣金费率参考表</CardTitle>
        <div className={referenceMetaClass}>
          <span><b className={referenceMetaStrongClass}>类目佣金率参考</b> 用于达人佣金率和类目判断</span>
          <span className={referenceMetaSepClass}>·</span>
          <span>最终请以店铺后台实时显示为准</span>
        </div>
        <div className={commissionGridClass}>
          {[
            ['7%', ['汽车与摩托车', '电脑办公', '食品饮料', '家电', '手机与数码', '家具', '家装建材']],
            ['9%', ['图书&杂志&音频', '收藏品', '居家日用*', '厨房用品', '家纺布艺', '五金工具']],
            ['10%', ['母婴用品*', '美妆个护*', '保健', '珠宝与衍生品', '鞋靴', '运动与户外', '玩具和爱好']],
            ['12%', ['时尚配件', '儿童时尚', '箱包', '男装与男士内衣', '穆斯林服饰', '宠物用品*', '女装与女士内衣']]
          ].map(([rate, tags]) => (
            <div className={commissionGroupClass} key={rate as string}>
              <div className={commissionRateBadgeClass}>{rate}</div>
              <div className={commissionTagsClass}>{(tags as string[]).map(tag => <span className={commissionTagClass} key={tag}>{tag}</span>)}</div>
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
    const store = typeof window !== 'undefined' ? ensureGlobalSettingsStore() : null;
    const pricingContext = store?.getPricingContext?.();
    return pricingContext
      ? {
          ...next,
          rateNew: pricingContext.rate || next.rateNew,
          shippingMultiplierNew: pricingContext.shippingMultiplier,
          labelFeeNew: pricingContext.labelFee
        }
      : next;
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const shippingInputSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const signature = [
      state.shipCargoTypeNew,
      state.shipActualWeightNew,
      state.shipLengthNew,
      state.shipWidthNew,
      state.shipHeightNew,
      state.rateNew,
      state.shippingMultiplierNew,
      state.labelFeeNew
    ].join('|');
    const force = shippingInputSignatureRef.current !== null && shippingInputSignatureRef.current !== signature;
    setState(previous => syncCalculatedShipping(previous, { force }));
    shippingInputSignatureRef.current = signature;
  }, [
    state.shipCargoTypeNew,
    state.shipActualWeightNew,
    state.shipLengthNew,
    state.shipWidthNew,
    state.shipHeightNew,
    state.rateNew,
    state.shippingMultiplierNew,
    state.labelFeeNew
  ]);

  useEffect(() => {
    saveState(state);
    if (typeof window !== 'undefined') {
      ensureGlobalSettingsStore().setPricingContext({
        exchangeRate: state.rateNew || null,
        shippingMultiplier: state.shippingMultiplierNew,
        labelFee: state.labelFeeNew
      });
    }
  }, [state]);

  const activePanel = useMemo(() => {
    if (state.calcTab === 'pricing') return <LegacyPanel state={state} setState={setState} />;
    if (state.calcTab === 'review') return <ReviewPanel state={state} setState={setState} />;
    return <PricingNewPanel state={state} setState={setState} />;
  }, [state]);

  return (
    <div className="calculator-react-shell" data-react-calculator-ready="true">
      <PageHero
        variant="calc"
        title="利润计算器"
        kicker="定价 / 汇率 / 海外运费"
        description="根据各项参数统一测算售价、利润，以及确定售价复盘实际利润"
      />
      <div className={calcToolbarClass}>
        <div className={calcSubnavClass}>
          <div className={calcTabbarClass}>
            <TabsList className={calcTabsClass} role="tablist" aria-label="利润计算模式">
              {[
                ['pricing', '定价旧'],
                ['pricingNew', '定价新'],
                ['review', '利润复盘']
              ].map(([key, label]) => (
                <TabsTrigger
                  active={state.calcTab === key}
                  className="flex-none border-transparent bg-transparent px-3.5 py-1.5 text-[12.5px] font-semibold leading-[1.2] text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--border)_86%,transparent)] hover:bg-[color-mix(in_srgb,var(--panel2)_50%,transparent)] hover:text-[var(--text)] data-[state=active]:border-[color-mix(in_srgb,var(--border)_84%,transparent)] data-[state=active]:bg-[color-mix(in_srgb,var(--panel2)_72%,transparent)] data-[state=active]:text-[var(--text)]"
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
              className={calcHelpButtonClass}
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
        <DialogContent className="max-w-[560px]">
          <DialogTitle id="calc-help-title">定价旧 / 定价新 / 利润复盘有什么区别？</DialogTitle>
          <HelpStack>
            <HelpItem label="定价旧">按旧口径快速反推原价、各折扣售价和利润率，适合粗算、对比和保留原来的计算习惯。</HelpItem>
            <HelpItem label="定价新">以目标利润率为核心，根据采购价、海外运费、平台手续费、达人佣金率、汇率和折扣档位反推原价。</HelpItem>
            <HelpItem label="利润复盘">适合订单已经成交、商品售价已经确定时使用，直接复盘人民币到手、利润和利润率。</HelpItem>
          </HelpStack>
          <DialogActions>
            <Button id="calc-help-close" variant="primary" onClick={() => setHelpOpen(false)}>知道了</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CalculatorApp };
