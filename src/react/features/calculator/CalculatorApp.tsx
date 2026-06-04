import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ChevronDown, ExternalLink, HelpCircle } from 'lucide-react';
import {
  calcLegacyRow,
  calcPricingRow,
  calcPricingV3TransferRow,
  calcPricingV3Row,
  calcSalePriceV3Transfer,
  calcSalePriceV3,
  deriveLegacyOrigPrice,
  derivePricingOrigPrice,
  derivePricingV3TransferOrigPrice,
  derivePricingV3OrigPrice
} from '../../../calc/formulas.ts';
import { ensureGlobalSettingsStore } from '../../../global-settings.ts';
import { DEFAULT_CONSTANTS, SHIPPING_RULES, computeCalculatedShippingCost, computeShippingQuote } from '../../../shipping-core.ts';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormRow } from '@/components/ui/form';
import { HelpItem, HelpStack } from '@/components/ui/help-stack';
import { InlineToken } from '@/components/ui/inline-token';
import { Input } from '@/components/ui/input';
import { DecimalInput, DecimalListInput, normalizeDecimalListInput, normalizeDecimalText } from '@/components/ui/number-input';
import { PageHero } from '@/components/ui/page-hero';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const LS_KEY = 'tk.calculator.v1';
const ENABLE_FREE_SHIPPING_CALC = false;
const COMMISSION_GUIDE_URL = 'https://seller.tiktokglobalshop.com/university/essay?btm_pre_unit_params=%7B%22outreach_task_id%22%3A%2257362904920580%22%2C%22outreach_channel_type%22%3A11%2C%22outreach_message_category_type%22%3A9010000%2C%22outreach_message_mapping_id%22%3A%22674874e4-806e-424e-ab72-9bcea4d6c7dc%22%7D&from=feature_guide&identity=1&knowledge_id=6852631579641601&role=1&shop_region=jp';
const SHIPPING_RATE_CARD_URL = 'https://seller.tiktokglobalshop.com/university/essay?knowledge_id=6411933700818705&role=1&course_type=1&from=search%7BcontentIdParams%7D&identity=1';
const REVIEW_SALE_PRICING_MODE_BUYER_PAID = 'buyer_paid_shipping';
const REVIEW_SALE_PRICING_MODE_TRANSFER = 'free_shipping_transfer';

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
  isFreeShippingNew: false,
  feeNew: 10,
  creatorRateNew: 0,
  rateNew: 23.5,
  discountsNew: [0.35, 0.38, 0.40, 0.42, 0.45, 0.48, 0.50],
  targetMarginNew: 1.4,
  anchorNew: 0.40,
  shippingTransferAnchorNew: 0.40,
  origPriceNew: null as number | null,
  reviewSalePricingMode: REVIEW_SALE_PRICING_MODE_BUYER_PAID,
  shipCargoTypeNew: 'general',
  shipActualWeightNew: 100,
  shipLengthNew: 10,
  shipWidthNew: 10,
  shipHeightNew: 10,
  salePrice: 0,
  calcTab: 'pricingV3',
  pricingV3DefaultMigrated: true,
  shipCargoType: 'general',
  shipActualWeight: 500,
  shipLength: 20,
  shipWidth: 15,
  shipHeight: 10
};

type CalcState = typeof DEFAULTS;
type CalcTab = CalcState['calcTab'];
type CargoType = 'general' | 'special';

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

function formatMoneyBare(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return formatMoney(value, digits);
}

function formatCny(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value < 0 ? '-¥' : '¥'}${formatMoney(Math.abs(value), digits)}`;
}

function formatCnyBare(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value < 0 ? '-' : ''}${formatMoney(Math.abs(value), digits)}`;
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
  const parsed = parseDiscountTokens(value);
  return parsed.length ? parsed : DEFAULTS.discountsNew;
}

function parseDiscountTokens(value: string) {
  return normalizeDecimalListInput(value)
    .split(/[,，\s]+/)
    .filter(Boolean)
    .map(item => {
      const normalized = normalizeDecimalText(item.trim());
      if (normalized.endsWith('%')) return Number.parseFloat(normalized) / 100;
      const number = Number.parseFloat(normalized);
      return number > 1 ? number / 100 : number;
    })
    .filter(item => Number.isFinite(item) && item > 0 && item <= 1);
}

function formatDiscountInput(discounts: number[]) {
  return discounts.map(discount => Number(discount.toFixed(4)).toString()).join(',');
}

function loadState(): CalcState {
  try {
    const saved = typeof localStorage !== 'undefined'
      ? JSON.parse(localStorage.getItem(LS_KEY) || 'null')
      : null;
    const savedObject = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    const merged = { ...DEFAULTS, ...(saved || {}) };
    if (!Array.isArray(merged.discounts)) merged.discounts = DEFAULTS.discounts;
    if (!Array.isArray(merged.discountsNew)) merged.discountsNew = DEFAULTS.discountsNew;
    if (!Number.isFinite(merged.shippingTransferAnchorNew) || merged.shippingTransferAnchorNew <= 0) {
      merged.shippingTransferAnchorNew = DEFAULTS.shippingTransferAnchorNew;
    }
    if (![REVIEW_SALE_PRICING_MODE_BUYER_PAID, REVIEW_SALE_PRICING_MODE_TRANSFER].includes(merged.reviewSalePricingMode)) {
      merged.reviewSalePricingMode = DEFAULTS.reviewSalePricingMode;
    }
    if (!Object.prototype.hasOwnProperty.call(savedObject, 'pricingV3DefaultMigrated') && savedObject.calcTab === 'pricingNew') {
      merged.calcTab = 'pricingV3';
      merged.pricingV3DefaultMigrated = true;
    }
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

function v3CustomerShippingJpy(state: CalcState) {
  if (!ENABLE_FREE_SHIPPING_CALC) return DEFAULT_CONSTANTS.CUSTOMER_SHIPPING_JPY;
  return state.isFreeShippingNew ? 0 : DEFAULT_CONSTANTS.CUSTOMER_SHIPPING_JPY;
}

function activeCustomerShippingJpy(state: CalcState) {
  return state.calcTab === 'pricingV3' || state.calcTab === 'review'
    ? v3CustomerShippingJpy(state)
    : DEFAULT_CONSTANTS.CUSTOMER_SHIPPING_JPY;
}

function shippingConstantsForCustomerShipping(customerShippingJpy: number) {
  return {
    ...DEFAULT_CONSTANTS,
    CUSTOMER_SHIPPING_JPY: customerShippingJpy
  };
}

function quoteForPricingMode(state: CalcState, customerShippingJpy = activeCustomerShippingJpy(state)) {
  return computeShippingQuote({
    cargoType: state.shipCargoTypeNew,
    actualWeight: state.shipActualWeightNew,
    length: state.shipLengthNew,
    width: state.shipWidthNew,
    height: state.shipHeightNew,
    rate: state.rateNew,
    rules: SHIPPING_RULES,
    constants: shippingConstantsForCustomerShipping(customerShippingJpy)
  });
}

function finalShippingCost(
  state: CalcState,
  quote: ReturnType<typeof computeShippingQuote> | null = null,
  customerShippingJpy = activeCustomerShippingJpy(state)
) {
  const resolvedQuote = quote || quoteForPricingMode(state, customerShippingJpy);
  return computeCalculatedShippingCost({
    quote: resolvedQuote,
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
      <DecimalInput
        id={id}
        tone={inputToneForField(className, readOnly)}
        className={inputClassName}
        value={value}
        readOnly={readOnly}
        onChange={nextValue => onChange?.(nextValue)}
      />
    </FormField>
  );
}

const calcPanelClass = 'calc-panel active block';
const calcLayoutClass = 'calc-layout-grid grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-[18px] [&>*]:min-w-0 max-[860px]:grid-cols-1';
const calcFormSectionClass = 'calc-form-section mt-[18px]';
const calcDetailsClass = 'calc-details group mt-4';
const calcDetailsGridClass = 'calc-details-grid mt-2.5';
const calcToolbarClass = 'calc-toolbar mb-3 flex min-w-0 flex-wrap items-center justify-start gap-3';
const calcSubnavClass = 'calc-subnav flex w-auto min-w-0 items-center justify-start px-0 py-0';
const calcTabbarClass = 'calc-tabbar flex w-auto min-w-0 items-center justify-start gap-2';
const calcTabsClass = 'calc-tabs flex w-auto flex-none flex-wrap items-center gap-1.5 max-[768px]:min-w-0';
const calcHelpButtonClass = 'calc-help-icon h-7 w-7 shrink-0 rounded-full border border-[var(--border)] bg-[var(--panel)] p-0 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.5] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]';
const calcModeNoteClass = 'calc-mode-note min-w-[320px] flex-1 text-left text-[11.5px] leading-[1.45] text-[var(--muted)] max-[768px]:w-full max-[768px]:min-w-0';
const calcModeNoteStrongClass = 'font-semibold text-[var(--text)]';
const calcModeTabs: Array<[CalcTab, string]> = [
  ['pricing', '定价V1'],
  ['pricingNew', '定价V2'],
  ['pricingV3', '定价V3'],
  ['review', '利润复盘']
];
const knownSaleItemClass = 'known-sale-item flex flex-col justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel2)] px-3.5 py-3';
const knownSaleLabelClass = 'label text-[11px] uppercase tracking-[1px] text-[var(--muted)]';
const knownSaleValueClass = 'value text-xl font-bold leading-[1.2] text-[var(--text)] tabular-nums max-[768px]:text-lg';
const reviewFormulaClass = 'review-formula mt-3.5 grid gap-[3px] text-[11px] leading-[1.35] text-[var(--muted)] tabular-nums [overflow-wrap:anywhere]';
const reviewFeeRowClass = 'mt-[18px] !grid-cols-[74px_minmax(148px,1.14fr)_repeat(3,minmax(0,1fr))] gap-[14px] max-[980px]:!grid-cols-3 max-[768px]:!grid-cols-1 max-[768px]:mt-3';
const reviewTransferLabelClass = 'flex min-h-[18px] items-center gap-1.5 leading-[1.3] text-[12.5px] font-normal text-[var(--muted)]';
const reviewFeeLabelClass = 'whitespace-nowrap';
const reviewTransferSwitchClass = 'relative inline-flex h-[48px] w-[74px] max-w-full cursor-pointer items-center overflow-hidden rounded-xl border transition-[background,border-color,color] focus-within:shadow-[0_0_0_3px_rgba(110,168,255,.22)]';
const reviewTransferInputClass = 'absolute inset-0 opacity-0';
const reviewTransferSwitchKnobClass = 'absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(20,31,65,.18)] transition-[left]';
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
const shippingSummaryFieldsWithToggleClass = 'pricing-ship-inline-summary-fields grid min-w-0 grid-cols-[1fr_.76fr_.76fr_.9fr] gap-2.5 [&>*]:min-w-0 max-[860px]:grid-cols-2 max-[640px]:grid-cols-1';
const shippingItemClass = 'pricing-ship-inline-item flex flex-col items-stretch justify-start gap-1.5 rounded-[10px] border border-[rgba(110,168,255,.18)] bg-[var(--panel2)] px-3 py-2.5';
const shippingHeadClass = 'pricing-ship-inline-head flex min-w-0 items-center justify-between gap-2.5';
const shippingMetricLabelClass = 'k text-[11px] font-semibold tracking-[.5px] text-[var(--muted)]';
const shippingMetricValueClass = 'v text-right text-base font-bold text-[var(--text)] tabular-nums';
const shippingMetricRuleClass = 'pricing-ship-inline-rule whitespace-normal text-[10px] leading-[1.25] text-[var(--muted)] tabular-nums';
const shippingPriceButtonClass = 'pricing-ship-inline-price pricing-ship-inline-price-clickable expense flex w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-[10px] border-0 bg-transparent px-1 py-0.5 transition-[background,box-shadow,opacity] hover:bg-[rgba(240,138,134,.08)] disabled:cursor-not-allowed disabled:opacity-50';
const shippingPriceValueClass = 'v text-center text-xl font-bold text-[var(--expense)] tabular-nums';
const shippingFormulaClass = 'pricing-ship-inline-formula mt-2.5 whitespace-normal text-center text-[9px] leading-[1.35] text-[var(--muted)] tabular-nums [overflow-wrap:anywhere]';
const shippingFreeFieldClass = 'pricing-ship-free flex flex-col gap-1.5';
const shippingFreeSwitchClass = 'relative inline-grid min-h-[42px] w-full grid-cols-2 items-center overflow-hidden rounded-[10px] border px-3 text-left text-[12px] font-semibold leading-none transition-[background,border-color,color] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(110,168,255,.22)]';
const shippingFreeSwitchKnobClass = 'absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(20,31,65,.18)] transition-[left]';
const shippingFreeSwitchSideClass = 'relative z-[1] min-w-max whitespace-nowrap text-[12.5px] font-bold leading-none text-[var(--text)] tabular-nums';
const shippingFreeSwitchLeftClass = `${shippingFreeSwitchSideClass} justify-self-start`;
const shippingFreeSwitchRightClass = `${shippingFreeSwitchSideClass} justify-self-end`;
const calcFormulaBlockClass = 'calc-formula-block mt-3 text-[var(--muted)]';
const calcFormulaTitleClass = 'calc-formula-title mb-1 text-[9.5px] uppercase tracking-[.6px] opacity-70';
const calcFormulaListClass = 'calc-formula-list flex flex-col gap-[3px] font-mono text-[10.5px] leading-[1.32] [overflow-wrap:anywhere]';
const calcResultTableClass = 'calc-result-table mt-2 w-full border-collapse border-0 text-[13px] tabular-nums [&_td]:border-x-0 [&_td]:border-t-0 [&_th]:border-x-0 [&_th]:border-t-0 [&_tbody_tr:last-child_td]:border-b-0 max-[640px]:text-[12px]';
const calcResultHeadClass = 'whitespace-nowrap px-[7px] py-[10px] text-[10.5px] max-[640px]:px-1 max-[640px]:py-2 max-[640px]:text-[10px]';
const calcResultCellClass = 'whitespace-nowrap px-[7px] py-[10px] max-[640px]:px-1 max-[640px]:py-2';
const calcResultHeaderClass = 'mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3';
const calcResultTitleBlockClass = 'min-w-[240px] flex-1';
const calcResultTitleRowClass = 'mb-1 flex min-w-0 flex-wrap items-center gap-2';
const calcResultTitleClass = 'm-0 flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[.3px] text-[var(--muted)] max-[768px]:text-[13px]';
const calcResultNoteClass = 'text-[10.5px] leading-[1.45] text-[var(--muted)]';
const calcResultInfoButtonClass = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] p-0 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]';
const shippingTransferControlClass = 'inline-flex max-w-full items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_4%,var(--panel))] px-2.5 py-1.5 text-[10.5px] leading-none text-[var(--muted)] shadow-[inset_0_0_0_1px_rgba(255,255,255,.35)] max-[640px]:w-full max-[640px]:justify-start';
const shippingTransferControlHeadClass = 'inline-flex shrink-0 items-center gap-1.5 font-semibold';
const shippingTransferSelectWrapClass = 'relative inline-flex h-7 min-w-[52px] cursor-pointer items-center pl-1.5 pr-5 text-[var(--text)] transition-colors hover:text-[var(--accent)] focus-within:text-[var(--accent)]';
const shippingTransferSelectClass = 'absolute inset-0 h-full w-full cursor-pointer appearance-none border-0 bg-transparent px-0 py-0 text-center text-[12px] font-bold text-transparent caret-transparent outline-none shadow-none focus:shadow-none';
const shippingTransferSelectTextClass = 'pointer-events-none text-[12px] font-bold text-[var(--text)]';
const shippingTransferSelectIconClass = 'pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]';
const shippingTransferHintClass = 'whitespace-nowrap text-[10.5px] text-[var(--muted)]';
const shippingTransferSepClass = 'h-3.5 w-px bg-[var(--border)]';
const calcDualValueClass = 'inline-flex items-baseline justify-center gap-0.5 whitespace-nowrap text-[13px] leading-none max-[640px]:text-[11.5px]';
const calcDualPrimaryClass = 'font-semibold text-[var(--text)]';
const calcDualSlashClass = 'text-[var(--muted)]';
const calcDualSecondaryClass = 'font-semibold text-[var(--accent)]';
const calcDualSecondaryPositiveClass = 'font-semibold text-[var(--ok)]';
const calcTransferExactClass = 'font-bold text-[var(--danger)]';
const transferHelpTextClass = 'grid gap-2.5 text-[13px] leading-[1.65] text-[var(--muted)]';
const transferHelpFormulaClass = 'rounded-[10px] border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 font-mono text-[12px] leading-[1.7] text-[var(--text)]';
const calcResultAnchorCellClass = 'bg-[linear-gradient(90deg,rgba(110,168,255,.14),transparent)] font-semibold';
const calcResultOrigCellClass = 'bg-[linear-gradient(180deg,rgba(138,255,207,.16),rgba(138,255,207,.08))] font-semibold';
const calcResultOrigStrongCellClass = cn(calcResultOrigCellClass, 'font-bold text-[var(--accent2)]');
const calcDetailsSummaryClass = 'cursor-pointer py-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--text)] group-open:mb-2.5';
const profitPositiveClass = 'profit-pos font-semibold text-[var(--ok)]';
const profitNegativeClass = 'profit-neg font-semibold text-[var(--danger)]';
const referenceCardClass = 'ship-calc mt-[18px]';
const commissionCardClass = 'commission-ref mt-[18px]';
const referenceHeaderClass = 'mb-3 flex flex-wrap items-center justify-start gap-2.5';
const referenceMetaClass = 'ship-meta mb-3.5 flex flex-wrap gap-2.5 rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel2)] px-3.5 py-3 text-[12.5px] text-[var(--muted)]';
const referenceMetaStrongClass = 'font-semibold text-[var(--text)]';
const referenceMetaSepClass = 'sep opacity-40';
const referenceLinkClass = 'inline-flex min-h-8 items-center gap-1.5 rounded-[10px] border border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--panel))] px-3 text-[12.5px] font-semibold text-[var(--accent)] hover:border-[color-mix(in_srgb,var(--accent)_52%,var(--border))] hover:bg-[color-mix(in_srgb,var(--accent)_14%,var(--panel))]';
const algorithmExampleClass = 'rounded-xl border border-[var(--border)] bg-[var(--panel2)] px-3.5 py-3';
const algorithmExampleTitleClass = 'text-[12px] font-semibold text-[var(--text)]';
const algorithmExampleLineClass = 'text-[12px] leading-[1.7] text-[var(--muted)]';
const algorithmExampleEmphasisClass = 'text-[12.5px] font-bold leading-[1.7] text-[var(--text)]';
const commissionFormulaCardClass = cn(algorithmExampleClass, 'grid items-start grid-cols-[minmax(0,1fr)_minmax(320px,.68fr)] gap-5 max-[900px]:grid-cols-1');
const commissionFormulaTextClass = 'flex h-full flex-col gap-2.5';
const commissionFormulaLinesClass = 'grid gap-1.5';
const commissionCalcGridClass = 'grid grid-cols-2 items-stretch gap-3 max-[560px]:grid-cols-1';
const commissionCalcBoxClass = 'flex min-h-[148px] flex-col rounded-[8px] border border-[color-mix(in_srgb,var(--accent)_18%,var(--border))] bg-[rgba(255,255,255,.72)] px-3 py-2.5';
const commissionCalcTitleClass = 'mb-2 text-[11.5px] font-semibold text-[var(--text)]';
const commissionCalcRowsClass = 'grid gap-1.5';
const commissionCalcRowClass = 'grid grid-cols-[62px_minmax(0,1fr)] gap-2 text-[11px] leading-[1.38]';
const commissionCalcLabelClass = 'text-[var(--muted)]';
const commissionCalcFormulaClass = 'min-w-0 text-[var(--text)] tabular-nums';
const commissionCalcSubClass = 'text-[10.5px] leading-[1.35] text-[var(--muted)]';
const commissionCalcValueClass = 'mt-auto pt-2 text-[17px] font-bold text-[var(--accent)] tabular-nums';
const commissionCalcValueSubClass = 'ml-1 text-[11px] font-semibold text-[var(--ok)]';
const commissionCalcDiscountClass = 'text-[10.5px] font-semibold text-[var(--ok)] tabular-nums';
const commissionFormulaSectionClass = 'mt-4 grid gap-3';
const tkExampleShellClass = 'grid grid-cols-[minmax(0,1.42fr)_minmax(320px,.58fr)] gap-4 max-[1040px]:grid-cols-1';
const tkExamplePanelClass = 'rounded-[4px] border border-[color-mix(in_srgb,var(--border)_78%,#d9d9d9)] bg-white px-5 py-4 text-[#20242a] shadow-[0_1px_0_rgba(15,23,42,.04)]';
const tkExampleMutedClass = 'text-[12px] leading-[1.5] text-[#6b6f76]';
const tkExampleTitleClass = 'mb-4 text-[17px] font-bold text-[#111]';
const tkOrderInfoGridClass = 'grid grid-cols-3 gap-x-12 gap-y-5 border-b border-[#e5e7eb] pb-6 max-[860px]:grid-cols-2 max-[520px]:grid-cols-1';
const tkOrderInfoValueClass = 'mt-1 text-[15px] font-semibold text-[#111]';
const tkPackageTitleClass = 'mt-6 text-[18px] font-bold text-[#111]';
const tkProductCardClass = 'mt-4 overflow-hidden rounded-[4px] bg-[#f6f7f8]';
const tkProductHeaderClass = 'border-b border-[#d8dadd] px-4 py-3 text-[13px] text-[#111]';
const tkProductRowClass = 'grid grid-cols-[64px_minmax(0,1fr)_80px] items-center gap-3 px-4 py-3 max-[560px]:grid-cols-[52px_minmax(0,1fr)]';
const tkProductImageClass = 'h-12 w-12 rounded-[4px] border border-[#d8dadd] bg-[linear-gradient(135deg,#25384a,#f5d7b8_48%,#102433)]';
const tkProductNameClass = 'truncate text-[13px] text-[#111]';
const tkProductMetaClass = 'mt-1 text-[12px] text-[#6b6f76]';
const tkSidebarTitleClass = 'mb-5 text-[17px] font-bold text-[#111]';
const tkPaymentRowClass = 'flex items-center justify-between gap-5 py-1.5 text-[13px] text-[#6b6f76]';
const tkPaymentValueClass = 'shrink-0 text-right text-[#30343a] tabular-nums';
const tkPaymentStrongClass = 'font-bold text-[#111]';
const tkPaymentDividerClass = 'my-3 border-t border-[#d8dadd]';
const tkFormulaStripClass = 'mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel2)] px-3.5 py-2.5 text-[12px] text-[var(--muted)]';
const tkFormulaStripTitleClass = 'whitespace-nowrap font-semibold text-[var(--text)]';
const tkFormulaInlineClass = 'inline-flex flex-wrap items-center gap-x-1.5 gap-y-1';
const tkFormulaItemClass = 'inline-flex items-center gap-1.5 whitespace-nowrap';
const tkFormulaItemTitleClass = 'text-[11px] font-semibold text-[var(--muted)]';
const tkFormulaItemTextClass = 'text-[11.5px] font-semibold text-[var(--text)]';
const tkFormulaSepClass = 'opacity-35';
const tkSettlementPanelClass = 'rounded-[4px] border border-[color-mix(in_srgb,var(--border)_78%,#d9d9d9)] bg-white px-5 py-4 text-[#20242a]';
const tkSettlementHeaderGridClass = 'grid grid-cols-3 gap-x-12 gap-y-5 border-b border-[#d8dadd] pb-7 max-[860px]:grid-cols-2 max-[520px]:grid-cols-1';
const tkSettlementSectionClass = 'mt-5 bg-[#eefafa] px-4 py-2.5';
const tkSettlementSectionHeadClass = 'grid grid-cols-[minmax(0,1fr)_minmax(110px,180px)] items-center gap-5 text-[17px] font-bold text-[#111]';
const tkSettlementItemClass = 'grid grid-cols-[minmax(0,1fr)_minmax(110px,180px)] items-start gap-5 py-2.5 pl-8 pr-4 text-[14px] text-[#111] max-[640px]:pl-3';
const tkSettlementSubItemClass = 'grid grid-cols-[minmax(0,1fr)_minmax(110px,180px)] items-start gap-5 py-1.5 pl-14 pr-4 text-[13px] text-[#50545b] max-[640px]:pl-6';
const tkSettlementNestedItemClass = 'grid grid-cols-[minmax(0,1fr)_minmax(110px,180px)] items-start gap-5 py-1.5 pl-[74px] pr-4 text-[12.5px] text-[#50545b] max-[640px]:pl-10';
const tkSettlementNoteClass = 'mt-1 block text-[11px] leading-[1.45] text-[#6b7280]';
const tkSettlementValueClass = 'justify-self-end text-right tabular-nums';
const tkSettlementTotalClass = 'mt-5 grid grid-cols-[minmax(0,1fr)_minmax(110px,180px)] items-center gap-5 bg-[#eefafa] px-4 py-2 text-[24px] font-bold text-[#111] tabular-nums max-[640px]:text-xl';
const shipRateWrapClass = 'ship-rate-wrap mt-4 min-w-0 max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch] max-[640px]:-mx-4 max-[640px]:mt-[18px] max-[640px]:px-4';
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
  onToggleFreeShipping,
  prefix = 'New'
}: {
  state: CalcState;
  onNumber: (key: keyof CalcState, value: string) => void;
  onCargo: (value: CargoType) => void;
  onImport: () => void;
  onToggleFreeShipping?: () => void;
  prefix?: 'New' | 'Review';
}) {
  const customerShippingJpy = activeCustomerShippingJpy(state);
  const quote = quoteForPricingMode(state, customerShippingJpy);
  const finalCost = finalShippingCost(state, quote, customerShippingJpy);
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
        <div className={onToggleFreeShipping ? shippingSummaryFieldsWithToggleClass : shippingSummaryFieldsClass}>
          <FormField htmlFor={`shipBand${suffix}`} label="命中价卡区间" labelClassName={shippingSummaryFieldLabelClass}>
            <Input className={shippingSummaryInputClass} id={`shipBand${suffix}`} value={quote.band?.range || '-'} readOnly />
          </FormField>
          <Field id={`shippingMultiplier${suffix}`} label="运费倍率" labelClassName={shippingSummaryFieldLabelClass} inputClassName={shippingSummaryInputClass} value={state.shippingMultiplierNew} onChange={value => onNumber('shippingMultiplierNew', value)} />
          <Field id={`labelFee${suffix}`} label="贴单费 ¥" labelClassName={shippingSummaryFieldLabelClass} inputClassName={shippingSummaryInputClass} value={state.labelFeeNew} onChange={value => onNumber('labelFeeNew', value)} />
          {onToggleFreeShipping ? (
            <div className={shippingFreeFieldClass}>
              <div className={shippingSummaryFieldLabelClass}>买家支付运费</div>
              <button
                type="button"
                className={cn(
                  shippingFreeSwitchClass,
                  state.isFreeShippingNew
                    ? 'border-[rgba(199,81,98,.38)] bg-[rgba(199,81,98,.10)] text-[var(--danger)]'
                    : 'border-[rgba(110,168,255,.20)] bg-[var(--panel2)] text-[var(--text)]'
                )}
                role="switch"
                aria-checked={state.isFreeShippingNew}
                onClick={onToggleFreeShipping}
              >
                <span className={cn(shippingFreeSwitchKnobClass, state.isFreeShippingNew ? 'left-[calc(100%-30px)]' : 'left-1.5')} aria-hidden="true" />
                <span className={shippingFreeSwitchLeftClass}>{state.isFreeShippingNew ? '0円' : ''}</span>
                <span className={shippingFreeSwitchRightClass}>{state.isFreeShippingNew ? '' : `${customerShippingJpy}円`}</span>
              </button>
            </div>
          ) : null}
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
          ? `海外运费 =（基础费 ${quote.band.parcel} + 每千克重量费 ${quote.band.perKg} × 计费重 ${formatNumberValue(quote.chargeWeightKg, 3)} - 买家支付运费 ${customerShippingJpy}）× 运费倍率 ${formatMoney(state.shippingMultiplierNew, 2)} / 汇率 ${formatNumberValue(state.rateNew, 2)} + 贴单费 ${formatNumberValue(state.labelFeeNew, 2)}`
          : '海外运费 =（基础费 + 每千克重量费 × 计费重 - 买家支付运费）× 运费倍率 / 汇率 + 贴单费'}
      </div>
    </div>
  );
}

function PricingNewPanel({
  state,
  setState,
  version = 'v2'
}: {
  state: CalcState;
  setState: Dispatch<SetStateAction<CalcState>>;
  version?: 'v2' | 'v3';
}) {
  const isV3 = version === 'v3';
  const [transferHelpOpen, setTransferHelpOpen] = useState(false);
  const canToggleFreeShipping = isV3 && ENABLE_FREE_SHIPPING_CALC;
  const customerShippingJpy = isV3 ? v3CustomerShippingJpy(state) : DEFAULT_CONSTANTS.CUSTOMER_SHIPPING_JPY;
  const totalCost = state.costNew + state.overseasShippingNew;
  const discounts = state.discountsNew.length ? state.discountsNew : DEFAULTS.discountsNew;
  const anchor = nearestDiscount(discounts, state.anchorNew);
  const shippingTransferAnchor = nearestDiscount(discounts, state.shippingTransferAnchorNew);
  const pricingState = { ...state, anchorNew: anchor, shippingTransferAnchorNew: shippingTransferAnchor };
  const origPrice = isV3
    ? derivePricingV3OrigPrice({ state: pricingState, totalCost, customerShippingJpy })
    : derivePricingOrigPrice({ state: pricingState, totalCost });
  const transferOrigPrice = isV3
    ? derivePricingV3TransferOrigPrice({
        baseOrigPrice: origPrice,
        transferDiscount: shippingTransferAnchor,
        transferShippingJpy: DEFAULT_CONSTANTS.CUSTOMER_SHIPPING_JPY
      })
    : origPrice;
  const rows = discounts.slice().sort((a, b) => a - b).map(discount => calcPricingRow({
    state: pricingState,
    totalCost,
    origPrice,
    discount
  }));
  const v3Rows = discounts.slice().sort((a, b) => a - b).map(discount => calcPricingV3Row({
    state: pricingState,
    totalCost,
    origPrice,
    discount,
    customerShippingJpy
  }));
  const v3TransferRows = discounts.slice().sort((a, b) => a - b).map(discount => calcPricingV3TransferRow({
    state: pricingState,
    totalCost,
    baseOrigPrice: origPrice,
    transferDiscount: shippingTransferAnchor,
    discount,
    transferShippingJpy: DEFAULT_CONSTANTS.CUSTOMER_SHIPPING_JPY
  }));
  const v3TransferRowsByDiscount = new Map(v3TransferRows.map(row => [row.discount, row]));
  const visibleRows = isV3 ? v3Rows : rows;
  const origRow = isV3
    ? calcPricingV3Row({
        state: pricingState,
        totalCost,
        origPrice,
        discount: 1,
        customerShippingJpy
      })
    : calcPricingRow({ state: pricingState, totalCost, origPrice, discount: 1 });
  const transferOrigRow = isV3
    ? calcPricingV3TransferRow({
        state: pricingState,
        totalCost,
        baseOrigPrice: origPrice,
        transferDiscount: shippingTransferAnchor,
        discount: 1,
        transferShippingJpy: DEFAULT_CONSTANTS.CUSTOMER_SHIPPING_JPY
      })
    : null;
  const updateNumber = (key: keyof CalcState, value: string) => setState(prev => ({
    ...prev,
    [key]: toNumber(value),
    ...(key === 'overseasShippingNew' ? { shippingSourceNew: 'manual' } : {})
  }));
  const updateCargo = (value: CargoType) => setState(prev => ({ ...prev, shipCargoTypeNew: value }));
  const importShipping = () => {
    const finalCost = finalShippingCost(state, null, customerShippingJpy);
    if (finalCost === null) return;
    setState(prev => ({ ...prev, overseasShippingNew: finalCost, shippingSourceNew: 'calculator' }));
  };
  const toggleFreeShipping = () => setState(prev => {
    const next = { ...prev, isFreeShippingNew: !prev.isFreeShippingNew };
    const finalCost = finalShippingCost(next, null, v3CustomerShippingJpy(next));
    return {
      ...next,
      ...(finalCost !== null ? { overseasShippingNew: finalCost, shippingSourceNew: 'calculator' } : {})
    };
  });
  const updateDiscounts = (parsed: number[]) => {
    if (!parsed.length) return;
    setState(prev => ({
      ...prev,
      discountsNew: parsed,
      anchorNew: nearestDiscount(parsed, prev.anchorNew),
      shippingTransferAnchorNew: nearestDiscount(parsed, prev.shippingTransferAnchorNew)
    }));
  };

  return (
    <div className={calcPanelClass} id={isV3 ? 'calc-panel-pricing-v3' : 'calc-panel-pricing-new'}>
      <div className={calcLayoutClass}>
        <Card>
          <CardTitle>{isV3 ? '定价V3输入' : '定价V2输入'}</CardTitle>
          <FormRow columns={3} className="triple">
            <Field id="costNew" label="采购价 ¥" className="expense-field" value={state.costNew} onChange={value => updateNumber('costNew', value)} />
            <Field id="overseasShippingNew" label="海外运费 ¥" className="expense-field" value={state.overseasShippingNew} onChange={value => updateNumber('overseasShippingNew', value)} />
            <FormField htmlFor="totalCostNew" label={<>总费用 ¥<InlineToken variant="var">采购价+海外运费</InlineToken></>} className="expense-field">
              <Input id="totalCostNew" tone="expense" type="number" step="0.01" min="0" value={totalCost.toFixed(2)} readOnly />
            </FormField>
          </FormRow>
          <ShippingInline state={state} onNumber={updateNumber} onCargo={updateCargo} onImport={importShipping} onToggleFreeShipping={canToggleFreeShipping ? toggleFreeShipping : undefined} />
          <div className={calcFormSectionClass}>
            <FormRow columns={3} className="triple">
              <Field id="feeNew" label="TK 平台手续费率（%）" value={state.feeNew} onChange={value => updateNumber('feeNew', value)} />
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
                <DecimalListInput
                  id="discountsNew"
                  defaultValue={formatDiscountInput(discounts)}
                  fallbackValue={formatDiscountInput(DEFAULTS.discountsNew)}
                  formatValues={formatDiscountInput}
                  parseValues={parseDiscountTokens}
                  onValuesChange={updateDiscounts}
                />
              </FormField>
            </FormRow>
          </div>
          <div hidden aria-hidden="true">
            <Input id={isV3 ? 'origPriceV3' : 'origPriceNew'} inputMode="decimal" autoComplete="off" value={Math.round(origPrice)} readOnly />
          </div>
        </Card>
        <Card>
          {isV3 ? (
            <div className={calcResultHeaderClass}>
              <div className={calcResultTitleBlockClass}>
                <div className={calcResultTitleRowClass}>
                  <h2 className={calcResultTitleClass}>各折扣档位定价与利润一览</h2>
                  <Button
                    id="pricing-v3-transfer-help-btn"
                    variant="plain"
                    className={calcResultInfoButtonClass}
                    aria-controls="pricing-v3-transfer-help-modal"
                    aria-haspopup="dialog"
                    aria-label="包邮转嫁说明"
                    title="包邮转嫁说明"
                    onClick={() => setTransferHelpOpen(true)}
                  >
                    <HelpCircle size={14} strokeWidth={2} aria-hidden="true" />
                  </Button>
                </div>
                <div className={calcResultNoteClass}>斜杠左侧是不包邮，右侧是包邮转嫁。</div>
              </div>
              <div className={shippingTransferControlClass}>
                <label className={shippingTransferControlHeadClass} htmlFor="shippingTransferAnchorNew">
                  <span>包邮转嫁折扣</span>
                  <span className={shippingTransferSelectWrapClass}>
                    <span className={shippingTransferSelectTextClass}>{formatDiscount(shippingTransferAnchor)}</span>
                    <ChevronDown className={shippingTransferSelectIconClass} strokeWidth={2} aria-hidden="true" />
                    <Select
                      id="shippingTransferAnchorNew"
                      className={shippingTransferSelectClass}
                      value={shippingTransferAnchor}
                      aria-label="选择包邮转嫁折扣"
                      title="点击切换包邮转嫁折扣"
                      onChange={event => updateNumber('shippingTransferAnchorNew', event.target.value)}
                    >
                      {discounts.map(discount => <option value={discount} key={discount}>{formatDiscount(discount)}</option>)}
                    </Select>
                  </span>
                </label>
                <span className={shippingTransferSepClass} aria-hidden="true" />
                <span className={shippingTransferHintClass}>该档包邮转嫁 350円</span>
              </div>
            </div>
          ) : (
            <CardTitle>各折扣档位定价与利润一览</CardTitle>
          )}
          <Table className={calcResultTableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className={calcResultHeadClass}>折扣</TableHead>
                <TableHead className={calcResultHeadClass}>{isV3 ? '商品售价(円)' : '日元售价'}</TableHead>
                {isV3 ? <TableHead className={calcResultHeadClass}>包邮转嫁额(円)</TableHead> : null}
                <TableHead className={calcResultHeadClass}>{isV3 ? '人民币到手(¥)' : '人民币到手'}</TableHead>
                <TableHead className={calcResultHeadClass}>{isV3 ? '利润(¥)' : '利润'}</TableHead>
                <TableHead className={calcResultHeadClass}>利润率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody id={isV3 ? 'tbodyV3' : 'tbodyNew'}>
              <TableRow className="orig-row">
                <TableCell className={calcResultOrigStrongCellClass}>原价</TableCell>
                <TableCell className={cn(calcResultOrigStrongCellClass, 'orig-price-cell')}>
                  {isV3 ? (
                    <div className={calcDualValueClass}>
                      <span className={calcDualPrimaryClass}>{formatMoneyBare(origPrice, 0)}</span>
                      <span className={calcDualSlashClass}>/</span>
                      <span className={calcDualSecondaryClass}>{formatMoneyBare(transferOrigPrice, 0)}</span>
                    </div>
                  ) : (
                    <>{formatMoney(origPrice, 0)} 円</>
                  )}
                </TableCell>
                {isV3 ? <TableCell className={calcResultOrigCellClass}>{formatMoneyBare(transferOrigPrice - origPrice, 0)}</TableCell> : null}
                <TableCell className={calcResultOrigCellClass}>
                  {isV3 && transferOrigRow ? (
                    <div className={calcDualValueClass}>
                      <span>{formatCnyBare(origRow.cnyNet, 2)}</span>
                      <span className={calcDualSlashClass}>/</span>
                      <span className={calcDualSecondaryClass}>{formatCnyBare(transferOrigRow.cnyNet, 2)}</span>
                    </div>
                  ) : (
                    <>{formatCny(origRow.cnyNet, 2)}</>
                  )}
                </TableCell>
                <TableCell className={cn(calcResultOrigCellClass, calcProfitClass(origRow.profit))}>
                  {isV3 && transferOrigRow ? (
                    <div className={calcDualValueClass}>
                      <span>{formatCnyBare(origRow.profit, 2)}</span>
                      <span className={calcDualSlashClass}>/</span>
                      <span className={cn(calcDualSecondaryPositiveClass, calcProfitClass(transferOrigRow.profit))}>{formatCnyBare(transferOrigRow.profit, 2)}</span>
                    </div>
                  ) : (
                    <>{formatCny(origRow.profit, 2)}</>
                  )}
                </TableCell>
                <TableCell className={calcResultOrigCellClass}>
                  {isV3 && transferOrigRow ? (
                    <div className={calcDualValueClass}>
                      <span>{formatMargin(origRow.margin)}</span>
                      <span className={calcDualSlashClass}>/</span>
                      <span className={calcDualSecondaryClass}>{formatMargin(transferOrigRow.margin)}</span>
                    </div>
                  ) : (
                    <>{formatMargin(origRow.margin)}</>
                  )}
                </TableCell>
              </TableRow>
              {visibleRows.map(row => {
                const isAnchor = Math.abs(row.discount - anchor) < 1e-9;
                const transferRow = isV3 ? v3TransferRowsByDiscount.get(row.discount) : null;
                const isExactTransfer = transferRow ? Math.abs(transferRow.transferredJpy - DEFAULT_CONSTANTS.CUSTOMER_SHIPPING_JPY) < 0.5 : false;
                return (
                  <TableRow className={isAnchor ? 'anchor' : ''} key={row.discount}>
                    <TableCell className={calcRowCellClass(isAnchor)}>{formatDiscount(row.discount)}{isAnchor ? ' ★' : ''}</TableCell>
                    <TableCell className={calcRowCellClass(isAnchor)}>
                      {isV3 && transferRow ? (
                        <div className={calcDualValueClass}>
                          <span className={calcDualPrimaryClass}>{formatMoneyBare(row.jpyPrice, 0)}</span>
                          <span className={calcDualSlashClass}>/</span>
                          <span className={calcDualSecondaryClass}>{formatMoneyBare(transferRow.jpyPrice, 0)}</span>
                        </div>
                      ) : (
                        <>{formatMoney(row.jpyPrice, 0)} 円</>
                      )}
                    </TableCell>
                    {isV3 ? (
                      <TableCell className={calcRowCellClass(isAnchor)}>
                        {transferRow ? (
                          <span className={isExactTransfer ? calcTransferExactClass : ''}>{formatMoneyBare(transferRow.transferredJpy, 0)}</span>
                        ) : '-'}
                      </TableCell>
                    ) : null}
                    <TableCell className={calcRowCellClass(isAnchor)}>
                      {isV3 && transferRow ? (
                        <div className={calcDualValueClass}>
                          <span>{formatCnyBare(row.cnyNet, 2)}</span>
                          <span className={calcDualSlashClass}>/</span>
                          <span className={calcDualSecondaryClass}>{formatCnyBare(transferRow.cnyNet, 2)}</span>
                        </div>
                      ) : (
                        <>{formatCny(row.cnyNet, 2)}</>
                      )}
                    </TableCell>
                    <TableCell className={calcRowCellClass(isAnchor, calcProfitClass(row.profit))}>
                      {isV3 && transferRow ? (
                        <div className={calcDualValueClass}>
                          <span>{formatCnyBare(row.profit, 2)}</span>
                          <span className={calcDualSlashClass}>/</span>
                          <span className={cn(calcDualSecondaryPositiveClass, calcProfitClass(transferRow.profit))}>{formatCnyBare(transferRow.profit, 2)}</span>
                        </div>
                      ) : (
                        <>{formatCny(row.profit, 2)}</>
                      )}
                    </TableCell>
                    <TableCell className={calcRowCellClass(isAnchor)}>
                      {isV3 && transferRow ? (
                        <div className={calcDualValueClass}>
                          <span>{formatMargin(row.margin)}</span>
                          <span className={calcDualSlashClass}>/</span>
                          <span className={calcDualSecondaryClass}>{formatMargin(transferRow.margin)}</span>
                        </div>
                      ) : (
                        <>{formatMargin(row.margin)}</>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className={calcFormulaBlockClass}>
            <div className={calcFormulaTitleClass}>{isV3 ? '◇ 不包邮公式' : '◇ 公式'}</div>
            <div className={calcFormulaListClass}>
              {isV3 ? (
                <>
                  <div>海外运费 =（基础费 + 每千克重量费 × 计费重 − 买家支付运费）× 运费倍率 ÷ 汇率 + 贴单费</div>
                  <div>总费用 = 采购价 + 海外运费</div>
                  <div>商品售价 = 原价 × 折扣</div>
                  <div>平台手续费 =（商品售价 + 买家支付运费）× 平台手续费率 ÷ 汇率</div>
                  <div>达人佣金 = 商品售价 × 达人佣金率 ÷ 汇率</div>
                  <div>人民币到手 = 商品售价 ÷ 汇率 − 平台手续费 − 达人佣金</div>
                  <div>利润 = 人民币到手 − 总费用</div>
                  <div>利润率 = 人民币到手 ÷ 总费用</div>
                  <div>原价反推 = [总费用 × 目标利润率 × 汇率 + 买家支付运费 × 平台手续费率] ÷ [基准折扣 × (1 − 平台手续费率 − 达人佣金率)]</div>
                  {ENABLE_FREE_SHIPPING_CALC ? <div>包邮打开时，买家支付运费按 0 计入公式；为了维持利润率，反推原价会把原本的运费体现在商品售价里。</div> : null}
                </>
              ) : (
                <>
                  <div>海外运费 =（基础费 + 每千克重量费 × 计费重 − 买家支付运费）× 运费倍率 ÷ 汇率 + 贴单费</div>
                  <div>总费用 = 采购价 + 海外运费</div>
                  <div>日元售价 = 原价 × 折扣 ×（1 − 平台手续费率）</div>
                  <div>达人佣金 = 日元售价 ÷ 汇率 × 达人佣金率</div>
                  <div>人民币到手 = 日元售价 ÷ 汇率 − 达人佣金</div>
                  <div>利润 = 人民币到手 − 总费用</div>
                  <div>利润率 = 人民币到手 ÷ 总费用</div>
                  <div>原价反推 = 总费用 × 目标利润率 × 汇率 ÷ [基准折扣 × (1 − 平台手续费率) × (1 − 达人佣金率)]</div>
                </>
              )}
            </div>
          </div>
          {isV3 ? (
            <Dialog
              id="pricing-v3-transfer-help-modal"
              open={transferHelpOpen}
              titleId="pricing-v3-transfer-help-title"
              onOpenChange={setTransferHelpOpen}
            >
              <DialogContent className="max-w-[560px]">
                <DialogTitle id="pricing-v3-transfer-help-title">包邮转嫁说明</DialogTitle>
                <div className={transferHelpTextClass}>
                  <p>不包邮仍按 V3 原公式测算，底部只展示不包邮公式。</p>
                  <p>包邮转嫁的口径是：买家原本单独支付的 350円 运费，改为放进商品售价里。页面显示包邮，但买家总支付接近不包邮。</p>
                  <p>所以这里不是把 350円 当成商家新增成本，而是测算“运费从明面运费转到商品售价后”，各折扣档位的售价、到手和利润变化。</p>
                  <div className={transferHelpFormulaClass}>
                    <div>包邮原价 = 不包邮原价 + 350 ÷ 包邮转嫁折扣</div>
                    <div>不包邮商品售价 = 不包邮原价 × 当前折扣</div>
                    <div>包邮商品售价 = 包邮原价 × 当前折扣</div>
                    <div>实际包邮转嫁 = 包邮商品售价 - 不包邮商品售价</div>
                    <div>包邮有效收入 =（包邮商品售价 - 350）÷ 汇率</div>
                    <div>包邮平台手续费 = 包邮商品售价 × 平台费率 ÷ 汇率</div>
                    <div>包邮达人佣金 = 包邮商品售价 × 达人佣金率 ÷ 汇率</div>
                    <div>包邮人民币到手 = 包邮有效收入 - 包邮平台手续费 - 包邮达人佣金</div>
                    <div>包邮利润 = 包邮人民币到手 - 不包邮总费用</div>
                    <div>包邮利润率 = 包邮人民币到手 ÷ 不包邮总费用</div>
                  </div>
                  <p>表格斜杠左侧是不包邮，右侧是包邮转嫁。当实际包邮转嫁正好是 350 时，平台费能和不包邮对齐；如果有达人佣金，包邮侧会因为实际商品售价更高而多扣一段佣金，约等于 350 × 达人佣金率 ÷ 汇率。</p>
                  <p>包邮转嫁折扣用来决定哪个折扣档位完整包邮转嫁 350。选 4折时，4折行刚好完整包邮转嫁；如果新品主推 3.5折，就改成 3.5折，让 3.5折行完整包邮转嫁。</p>
                  <p>不能让每个折扣都刚好包邮转嫁 350，因为 TK 商品原价只能填一个。固定同一个包邮原价后，不同折扣乘出来的价差一定不同：低折扣包邮转嫁少，高折扣包邮转嫁多。</p>
                  <p>需要特别注意达人佣金：包邮转嫁后商品售价变高，达人佣金按更高的包邮商品售价计算，所以达人费用会比不包邮更多。</p>
                </div>
                <DialogActions>
                  <Button variant="primary" onClick={() => setTransferHelpOpen(false)}>知道了</Button>
                </DialogActions>
              </DialogContent>
            </Dialog>
          ) : null}
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
          <CardTitle>各折扣档位定价与利润一览</CardTitle>
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
  const [reviewHelpOpen, setReviewHelpOpen] = useState(false);
  const customerShippingJpy = v3CustomerShippingJpy(state);
  const totalCost = state.costNew + state.overseasShippingNew;
  const isTransferReview = state.reviewSalePricingMode === REVIEW_SALE_PRICING_MODE_TRANSFER;
  const result = isTransferReview
    ? calcSalePriceV3Transfer({
        state,
        totalCost,
        transferShippingJpy: DEFAULT_CONSTANTS.CUSTOMER_SHIPPING_JPY
      })
    : calcSalePriceV3({ state, totalCost, customerShippingJpy });
  const updateNumber = (key: keyof CalcState, value: string) => setState(prev => ({
    ...prev,
    [key]: toNumber(value),
    ...(key === 'overseasShippingNew' ? { shippingSourceNew: 'manual' } : {})
  }));
  const toggleTransferReview = () => setState(prev => ({
    ...prev,
    reviewSalePricingMode: prev.reviewSalePricingMode === REVIEW_SALE_PRICING_MODE_TRANSFER
      ? REVIEW_SALE_PRICING_MODE_BUYER_PAID
      : REVIEW_SALE_PRICING_MODE_TRANSFER
  }));
  const importShipping = () => {
    const finalCost = finalShippingCost(state, null, customerShippingJpy);
    if (finalCost === null) return;
    setState(prev => ({ ...prev, overseasShippingNew: finalCost, shippingSourceNew: 'calculator' }));
  };
  const profitClass = result && result.profit > 0 ? 'profit-pos' : result && result.profit < 0 ? 'profit-neg' : '';
  return (
    <div className={calcPanelClass} id="calc-panel-review">
      <div className={calcLayoutClass}>
        <Card>
          <CardTitle>
            <span>成交输入</span>
            <Button
              id="review-pricing-guide-btn"
              variant="plain"
              className={calcResultInfoButtonClass}
              aria-controls="review-pricing-guide-modal"
              aria-haspopup="dialog"
              aria-label="利润复盘口径说明"
              title="利润复盘口径说明"
              onClick={() => setReviewHelpOpen(true)}
            >
              <HelpCircle size={14} strokeWidth={2} aria-hidden="true" />
            </Button>
          </CardTitle>
          <FormRow>
            <Field id="salePrice" label="商品售价（円）" className="success" value={state.salePrice || ''} onChange={value => updateNumber('salePrice', value)} />
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
            <FormRow columns={5} className={reviewFeeRowClass}>
              <FormField>
                <div className={reviewTransferLabelClass}>
                  <span>包邮转嫁</span>
                </div>
                <label
                  id="reviewFreeShippingTransfer"
                  className={cn(
                    reviewTransferSwitchClass,
                    isTransferReview
                      ? 'border-[rgba(69,172,121,.34)] bg-[rgba(69,172,121,.11)] text-[var(--ok)]'
                      : 'border-[rgba(110,168,255,.20)] bg-[var(--panel2)] text-[var(--text)]'
                  )}
                >
                  <input
                    className={reviewTransferInputClass}
                    type="checkbox"
                    aria-label="包邮转嫁"
                    checked={isTransferReview}
                    onChange={toggleTransferReview}
                  />
                  <span className={cn(reviewTransferSwitchKnobClass, isTransferReview ? 'left-[calc(100%-40px)]' : 'left-1')} aria-hidden="true" />
                </label>
              </FormField>
              <Field id="feeReview" label="TK 平台手续费率（%）" labelClassName={reviewFeeLabelClass} inputClassName="min-h-[48px] text-[18px] max-[640px]:text-[18px]" value={state.feeNew} onChange={value => updateNumber('feeNew', value)} />
              <Field id="platformFeeReview" label="平台手续费 ¥" className="expense-field" value={result ? result.platformFee.toFixed(2) : ''} readOnly />
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
            {isTransferReview ? (
              <>
                <div>有效收入 =（实际商品售价 − 包邮转嫁运费 350円）÷ 日元汇率</div>
                <div>平台手续费 = 实际商品售价 × 平台手续费率 ÷ 日元汇率</div>
                <div>达人佣金 = 实际商品售价 × 达人佣金率 ÷ 日元汇率</div>
                <div>人民币到手 = 有效收入 − 平台手续费 − 达人佣金</div>
              </>
            ) : (
              <>
                <div>平台手续费 =（商品售价 + 买家支付运费 350円）× 平台手续费率 ÷ 日元汇率</div>
                <div>达人佣金 = 商品售价 × 达人佣金率 ÷ 日元汇率</div>
                <div>人民币到手 = 商品售价 ÷ 日元汇率 − 平台手续费 − 达人佣金</div>
              </>
            )}
            <div>利润 = 人民币到手 − 总费用</div>
            <div>利润率 = 人民币到手 ÷ 总费用</div>
          </div>
        </Card>
        <Dialog
          id="review-pricing-guide-modal"
          open={reviewHelpOpen}
          titleId="review-pricing-guide-title"
          onOpenChange={setReviewHelpOpen}
        >
          <DialogContent className="max-w-[560px]">
            <DialogTitle id="review-pricing-guide-title">利润复盘口径说明</DialogTitle>
            <div className={transferHelpTextClass}>
              <p>定价V3用于测算包邮转嫁后的售价；利润复盘只按已成交订单的实际售价复盘。</p>
              <p>商品售价按订单里的平台实际售价填写。</p>
              <p>包邮转嫁开关只标记这笔单的运费口径，不会自动加减 350円。</p>
              <p>不包邮时，平台费基数为商品售价 + 买家运费 350円；达人佣金按商品售价计算。</p>
              <p>包邮转嫁时，收入扣回 350円；平台费和达人佣金按当前填写的商品售价计算。</p>
            </div>
            <DialogActions>
              <Button onClick={() => setReviewHelpOpen(false)}>知道了</Button>
            </DialogActions>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function CommissionFormulaGuide() {
  return (
    <div className={commissionFormulaSectionClass}>
      <div className={commissionFormulaCardClass}>
        <div className={commissionFormulaTextClass}>
          <div className={algorithmExampleTitleClass}>佣金计算公式</div>
          <div className={commissionFormulaLinesClass}>
            <div className={algorithmExampleLineClass}>佣金费用 = 佣金费率 ×（用户支付金额 + 平台补贴 − 用户退款金额 − 平台补贴退款）</div>
            <div className={algorithmExampleLineClass}>用户退款金额和平台补贴退款只在退款场景里影响结算；日常定价预估按 0 处理</div>
            <div className={algorithmExampleLineClass}>平台补贴 = TikTok Shop 商品折扣 + TikTok Shop 运费折扣</div>
            <div className={algorithmExampleLineClass}><strong className={algorithmExampleEmphasisClass}>用户支付金额 + 平台补贴 = 商品售价 + 买家支付运费</strong></div>
            <div className={algorithmExampleLineClass}>商品售价 = 原价 * 折扣 = 商品实付价 + TikTok Shop 商品折扣</div>
            <div className={algorithmExampleLineClass}>该订单结算页有佣金优惠：优惠前按 7% 约 111円，优惠后实际扣 80円（约 5%）。</div>
          </div>
        </div>
        <div className={commissionCalcGridClass}>
          <div className={commissionCalcBoxClass}>
            <div className={commissionCalcTitleClass}>官方字段口径</div>
            <div className={commissionCalcRowsClass}>
              <div className={commissionCalcRowClass}>
                <span className={commissionCalcLabelClass}>用户支付</span>
                <span className={commissionCalcFormulaClass}>1,095円</span>
              </div>
              <div className={commissionCalcRowClass}>
                <span className={commissionCalcLabelClass}>平台补贴</span>
                <span className={commissionCalcFormulaClass}>497円 <span className={commissionCalcSubClass}>商品497 + 运费0</span></span>
              </div>
              <div className={commissionCalcRowClass}>
                <span className={commissionCalcLabelClass}>优惠前</span>
                <span className={commissionCalcFormulaClass}>1,592円 × 7%</span>
              </div>
              <div className={commissionCalcRowClass}>
                <span className={commissionCalcLabelClass}>实扣</span>
                <span className={commissionCalcDiscountClass}>约 80円（优惠后约 5%）</span>
              </div>
            </div>
            <div className={commissionCalcValueClass}>≈111円 <span className={commissionCalcValueSubClass}>实扣≈80円</span></div>
          </div>
          <div className={commissionCalcBoxClass}>
            <div className={commissionCalcTitleClass}>定价口径</div>
            <div className={commissionCalcRowsClass}>
              <div className={commissionCalcRowClass}>
                <span className={commissionCalcLabelClass}>商品售价</span>
                <span className={commissionCalcFormulaClass}>1,242円</span>
              </div>
              <div className={commissionCalcRowClass}>
                <span className={commissionCalcLabelClass}>用户运费</span>
                <span className={commissionCalcFormulaClass}>350円</span>
              </div>
              <div className={commissionCalcRowClass}>
                <span className={commissionCalcLabelClass}>优惠前</span>
                <span className={commissionCalcFormulaClass}>1,592円 × 7%</span>
              </div>
              <div className={commissionCalcRowClass}>
                <span className={commissionCalcLabelClass}>实扣</span>
                <span className={commissionCalcDiscountClass}>约 80円（优惠后约 5%）</span>
              </div>
            </div>
            <div className={commissionCalcValueClass}>≈111円 <span className={commissionCalcValueSubClass}>实扣≈80円</span></div>
          </div>
        </div>
      </div>
      <div>
        <div className={tkFormulaStripClass}>
          <div className={tkFormulaStripTitleClass}>真实订单示例</div>
          <div className={tkFormulaInlineClass}>
            <div className={tkFormulaItemClass}>
              <span className={tkFormulaItemTitleClass}>商品售价 = </span>
              <span className={tkFormulaItemTextClass}>商品实付价 + TikTok Shop 商品折扣</span>
            </div>
            <span className={tkFormulaSepClass}>/</span>
            <div className={tkFormulaItemClass}>
              <span className={tkFormulaItemTitleClass}>商品售价 = </span>
              <span className={tkFormulaItemTextClass}>商品原价 - 商家商品折扣</span>
            </div>
          </div>
        </div>
        <div className={tkExampleShellClass}>
          <div className={tkExamplePanelClass}>
            <div className={tkExampleTitleClass}>已送达</div>
            <div className={tkOrderInfoGridClass}>
              {[
                ['位置', 'JP'],
                ['创建时间', '2026/05/03 09:16:37'],
                ['物流选项', '全球标准运输服务'],
                ['仓库编号', '******'],
                ['仓库名称', '******'],
                ['物流方式', '平台发货'],
                ['发货期限', '2026/05/08 00:59:59']
              ].map(([label, value]) => (
                <div key={label}>
                  <div className={tkExampleMutedClass}>{label}</div>
                  <div className={tkOrderInfoValueClass}>{value}</div>
                </div>
              ))}
            </div>
            <div className={tkPackageTitleClass}><span className="text-[#009688]">1</span> 个包裹，包含 <span className="text-[#009688]">1</span> 件商品</div>
            <div className="mt-4 rounded-[4px] bg-[#e2e6ea] px-4 py-4">
              <div className="text-[14px] font-bold text-[#222]">发货说明</div>
              <div className="mt-2 text-[13px] leading-[1.45] text-[#444]">请准备好所有包裹并将其送至你选择的门店自寄点。</div>
              <div className="mt-3 text-[13px] font-semibold text-[#555]">Show more⌄</div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="text-[16px] font-semibold text-[#111]">包裹 1： 已送达</div>
              <div className="text-[13px] font-semibold text-[#009688]">物流信息</div>
            </div>
            <div className={tkProductCardClass}>
              <div className={tkProductHeaderClass}>SKU ID: 17**************</div>
              <div className={tkProductRowClass}>
                <div className={tkProductImageClass} aria-hidden="true" />
                <div className="min-w-0">
                  <div className={tkProductNameClass}>牛革製 ミニ財布 アコーディオンカードケース ボックスタイプ...</div>
                  <div className={tkProductMetaClass}>ダークブルー</div>
                  <div className="mt-2 inline-flex rounded bg-[#e7e7e7] px-2 py-1 text-[11px] text-[#555]">联盟达人</div>
                </div>
                <div className="text-right text-[13px] text-[#111] max-[560px]:col-span-2">745円 x 1</div>
              </div>
            </div>
          </div>
          <div className={tkExamplePanelClass}>
            <div className={tkSidebarTitleClass}>客户支付的金额</div>
            <div className={tkPaymentRowClass}><span>支付方式</span><span className={tkPaymentValueClass}>ConvenientStore</span></div>
            <div className={tkPaymentDividerClass} />
            <div className="mb-2 text-right text-[12px] text-[#6b6f76]">隐藏⌃</div>
            <div className={tkPaymentRowClass}><span className={tkPaymentStrongClass}>商品实付价</span><span className={tkPaymentValueClass}>745円</span></div>
            <div className={tkPaymentRowClass}><span>商品原价</span><span className={tkPaymentValueClass}>3,550円</span></div>
            <div className={tkPaymentRowClass}><span>商家商品折扣</span><span className={tkPaymentValueClass}>-2,308円</span></div>
            <div className={tkPaymentRowClass}><span>TikTok Shop 商品折扣</span><span className={tkPaymentValueClass}>-497円</span></div>
            <div className={tkPaymentRowClass}><span className={tkPaymentStrongClass}>运费实付价</span><span className={tkPaymentValueClass}>350円</span></div>
            <div className={tkPaymentRowClass}><span>运费原价</span><span className={tkPaymentValueClass}>350円</span></div>
            <div className={tkPaymentRowClass}><span>商家运费折扣</span><span className={tkPaymentValueClass}>-0円</span></div>
            <div className={tkPaymentRowClass}><span>TikTok Shop 运费折扣</span><span className={tkPaymentValueClass}>-0円</span></div>
            <div className={tkPaymentRowClass}><span className={tkPaymentStrongClass}>全部</span><span className={cn(tkPaymentValueClass, tkPaymentStrongClass)}>1,095円</span></div>
          </div>
        </div>
      </div>
      <div>
        <div className={tkFormulaStripClass}>
          <div className={tkFormulaStripTitleClass}>结算明细示例</div>
          <div className={tkFormulaInlineClass}>
            <div className={tkFormulaItemClass}>
              <span className={tkFormulaItemTitleClass}>利润 = </span>
              <span className={tkFormulaItemTextClass}>总收入 - 总费用</span>
            </div>
            <span className={tkFormulaSepClass}>/</span>
            <div className={tkFormulaItemClass}>
              <span className={tkFormulaItemTitleClass}>总费用 = </span>
              <span className={tkFormulaItemTextClass}>平台佣金 + 商家运费 + 联盟佣金</span>
            </div>
            <span className={tkFormulaSepClass}>/</span>
            <div className={tkFormulaItemClass}>
              <span className={tkFormulaItemTitleClass}>商家运费 = </span>
              <span className={tkFormulaItemTextClass}>海外运费 - 买家支付运费</span>
            </div>
          </div>
        </div>
        <div className={tkSettlementPanelClass}>
          <div className={tkExampleTitleClass}>结算明细</div>
          <div className={tkSettlementHeaderGridClass}>
            {[
              ['订单创建日期', '2026/05/03'],
              ['结算日期（付款开始日期）', '2026/05/26'],
              ['结算单 ID', '7643254946318026517'],
              ['订单送达日期', '2026/05/10']
            ].map(([label, value]) => (
              <div key={label}>
                <div className={tkExampleMutedClass}>{label}</div>
                <div className={tkOrderInfoValueClass}>{value}</div>
              </div>
            ))}
          </div>
          <div className={tkSettlementSectionClass}>
            <div className={tkSettlementSectionHeadClass}><span>⌃ 总收入</span><span className={tkSettlementValueClass}>1,242円</span></div>
          </div>
          <div className={tkSettlementItemClass}><span>⌃ 享受商家折扣后小计</span><span className={tkSettlementValueClass}>1,242円</span></div>
          <div className={tkSettlementSubItemClass}><span>• 享受折扣前小计</span><span className={tkSettlementValueClass}>3,550円</span></div>
          <div className={tkSettlementSubItemClass}><span>• 商家折扣</span><span className={tkSettlementValueClass}>-2,308円</span></div>
          <div className={tkSettlementSectionClass}>
            <div className={tkSettlementSectionHeadClass}><span>⌃ 总费用</span><span className={tkSettlementValueClass}>-458円</span></div>
          </div>
          <div className={tkSettlementItemClass}><span>⌃ TikTok Shop 佣金费 <span className="rounded-full bg-[#dff5e5] px-2 py-1 text-[12px] text-[#15803d]">佣金优惠</span></span><span className={tkSettlementValueClass}>-80円</span></div>
          <div className={tkSettlementSubItemClass}><span>• 优惠前的佣金费</span><span className={tkSettlementValueClass}>-111円</span></div>
          <div className={tkSettlementSubItemClass}><span>• 优惠金额（广告支出）</span><span className={tkSettlementValueClass}>0円</span></div>
          <div className={tkSettlementSubItemClass}><span>• 其他佣金优惠金额</span><span className={tkSettlementValueClass}>31円</span></div>
          <div className={tkSettlementItemClass}><span>⌃ 商家运费</span><span className={tkSettlementValueClass}>-237円</span></div>
          <div className={tkSettlementSubItemClass}><span>• 实际运费（计费包裹重量：124 克）</span><span className={tkSettlementValueClass}>-587円</span></div>
          <div className={tkSettlementSubItemClass}><span>⌃ • 买家支付运费（预估包裹重量：200 克）</span><span className={tkSettlementValueClass}>350円</span></div>
          <div className={tkSettlementNestedItemClass}><span>• 客户实付运费（折扣前）</span><span className={tkSettlementValueClass}>350円</span></div>
          <div className={tkSettlementNestedItemClass}><span>• 商家运费折扣</span><span className={tkSettlementValueClass}>0円</span></div>
          <div className={tkSettlementNestedItemClass}><span>• TikTok Shop 运费折扣</span><span className={tkSettlementValueClass}>0円</span></div>
          <div className={tkSettlementSubItemClass}><span>• 运费补贴</span><span className={tkSettlementValueClass}>0円</span></div>
          <div className={tkSettlementItemClass}>
            <span>联盟佣金<span className={tkSettlementNoteClass}>（商品价格（不含税费）- 商家折扣）* 佣金率。订单结算后发生退款，联盟服务商佣金不予退还。</span></span>
            <span className={tkSettlementValueClass}>-141円</span>
          </div>
          <div className={tkSettlementTotalClass}><span>结算总金额</span><span className={tkSettlementValueClass}>784円</span></div>
        </div>
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
        <div className={referenceHeaderClass}>
          <CardTitle className="mb-0">新版海外运费参考表</CardTitle>
          <a className={referenceLinkClass} href={SHIPPING_RATE_CARD_URL} target="_blank" rel="noreferrer">
            官方价卡 <ExternalLink size={13} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
        <div className={referenceMetaClass}>
          <span><b className={referenceMetaStrongClass}>使用新规</b> 2026/04/24 00:00（GMT+8）起生效</span>
          <span className={referenceMetaSepClass}>·</span>
          <span>50g 起重，按 g 计费</span>
          <span className={referenceMetaSepClass}>·</span>
          <span>当体积重 &gt; 1.5 × 实重时，按体积重计费</span>
          <span className={referenceMetaSepClass}>·</span>
          <span>价卡是平台仓库至买家的跨境直邮运费，计算自己的运费时减去买家支付运费。</span>
        </div>
        <div className={shipRateWrapClass}>
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
        <div className={referenceHeaderClass}>
          <CardTitle className="mb-0">TK 佣金费率参考表</CardTitle>
          <a className={referenceLinkClass} href={COMMISSION_GUIDE_URL} target="_blank" rel="noreferrer">
            官方佣金说明 <ExternalLink size={13} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
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
        <CommissionFormulaGuide />
      </Card>
    </>
  );
}

function CalculatorModeActions({
  activeTab,
  onTabChange,
  onHelp
}: {
  activeTab: CalcTab;
  onTabChange: (tab: CalcTab) => void;
  onHelp: () => void;
}) {
  return (
    <div className={calcToolbarClass}>
      <div className={calcSubnavClass}>
        <div className={calcTabbarClass}>
          <TabsList className={calcTabsClass} role="tablist" aria-label="利润计算模式">
            {calcModeTabs.map(([key, label]) => (
              <TabsTrigger
                active={activeTab === key}
                className="flex-none border-transparent bg-transparent px-3.5 py-1.5 text-[12.5px] font-semibold leading-[1.2] text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--border)_86%,transparent)] hover:bg-[color-mix(in_srgb,var(--panel2)_50%,transparent)] hover:text-[var(--text)] data-[state=active]:border-[color-mix(in_srgb,var(--border)_84%,transparent)] data-[state=active]:bg-[color-mix(in_srgb,var(--panel2)_72%,transparent)] data-[state=active]:text-[var(--text)]"
                data-calc-tab={key}
                key={key}
                onClick={() => onTabChange(key)}
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
            onClick={onHelp}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.5 4.5h8a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v-11a3 3 0 0 1 2-3Z" />
              <path d="M8.5 8.25h6.5M8.5 11.25h6.5M8.5 14.25h4.5" />
            </svg>
          </Button>
        </div>
      </div>
      <p className={calcModeNoteClass}>
        <strong className={calcModeNoteStrongClass}>V1/V2</strong> 为早期测算公式；<strong className={calcModeNoteStrongClass}>V3</strong> 根据已结算订单和 TK 客服口径整理。
      </p>
    </div>
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
          labelFeeNew: pricingContext.labelFee,
          feeNew: pricingContext.platformFeeRate
        }
      : next;
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const shippingInputSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const signature = [
      state.calcTab,
      ENABLE_FREE_SHIPPING_CALC ? state.isFreeShippingNew : false,
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
    state.calcTab,
    ENABLE_FREE_SHIPPING_CALC ? state.isFreeShippingNew : false,
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
        labelFee: state.labelFeeNew,
        platformFeeRate: state.feeNew
      });
    }
  }, [state]);

  const activePanel = useMemo(() => {
    if (state.calcTab === 'pricing') return <LegacyPanel state={state} setState={setState} />;
    if (state.calcTab === 'pricingNew') return <PricingNewPanel state={state} setState={setState} version="v2" />;
    if (state.calcTab === 'review') return <ReviewPanel state={state} setState={setState} />;
    return <PricingNewPanel state={state} setState={setState} version="v3" />;
  }, [state]);

  return (
    <div className="calculator-react-shell" data-react-calculator-ready="true">
      <PageHero
        variant="calc"
        title="利润计算器"
        description="根据各项参数统一测算售价、利润，以及确定售价复盘实际利润"
      />
      <CalculatorModeActions
        activeTab={state.calcTab}
        onTabChange={tab => setState(prev => ({ ...prev, calcTab: tab }))}
        onHelp={() => setHelpOpen(true)}
      />
      {activePanel}
      <ReferenceCards />
      <Dialog id="calc-help-modal" open={helpOpen} titleId="calc-help-title" onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogTitle id="calc-help-title">定价V1 / 定价V2 / 定价V3 / 利润复盘有什么区别？</DialogTitle>
          <HelpStack>
            <HelpItem label="定价V3">新版主口径。平台手续费按商品售价加买家支付运费计算，达人佣金按商品售价计算，订单和收支模块也使用这个口径。</HelpItem>
            <HelpItem label="定价V2">历史口径。平台费率先折进日元售价，再计算达人佣金，保留用于对比。</HelpItem>
            <HelpItem label="定价V1">旧口径。按旧参数快速反推原价、折扣售价和利润率，保留用于对比。</HelpItem>
            <HelpItem label="利润复盘">适合订单已经成交、商品售价已经确定时使用，按 V3 口径复盘人民币到手、利润和利润率。</HelpItem>
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
