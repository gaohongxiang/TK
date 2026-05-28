import ReactEChartsCoreModule from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { FunnelChart, PieChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { HelpCircle, RefreshCw, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { HelpItem, HelpStack } from '@/components/ui/help-stack';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, TableViewport } from '@/components/ui/table-tools';
import { ModuleListState } from '@/components/ui/module-list-state';
import { AccountDeleteDialog, AccountEditDialog } from '@/components/ui/account-manage-dialogs';
import { AccountTabsBar } from '@/components/ui/account-tabs-bar';
import { AddAccountDialog } from '@/components/ui/add-account-dialog';
import {
  ModuleAccountTabs,
  ModuleHeader,
  ModuleStatusBar,
  ModuleToolbar,
  ModuleWorkspace
} from '@/components/ui/module-workspace';
import { refreshButtonClass, statusStripClass, statusStripLeftClass, storageHelpButtonClass, syncStatusClass } from '@/components/ui/status-strip';
import type { AnalyticsAnalysis, AnalyticsAnalyzer, AnalyticsFunnelStage, AnalyticsParser, AnalyticsPeriodComparison, AnalyticsRecord, AnalyticsXlsx } from '../../../analytics/types';
import { AnalyticsProviderFirestore, type AnalyticsProviderSnapshotSummary } from '../../../analytics/provider-firestore.ts';
import { aggregateAnalyses } from '../../../analytics/aggregate.ts';
import { buildActionPlan } from '../../../analytics/action-plan.ts';
import { TKFirestoreConnection } from '../../../firestore-connection.ts';
import { buildFirestoreSyncStatus } from '../../../firestore-sync-status.ts';
import { normalizeAccountName, uniqueAccounts } from '../../../products/accounts.ts';
import {
  formatFirestoreRulesUpdateMessage,
  isPermissionDenied
} from '../../../firestore-rules-compatibility.ts';
import { buildFunnelStages, buildOpportunityScatterOption, buildOverviewOption, DIAGNOSIS_COLORS } from './chartOptions';
import { formatInteger, formatPercent, formatYen, shortenText } from './format';
import { cn } from '@/lib/utils';

echarts.use([CanvasRenderer, FunnelChart, GridComponent, LegendComponent, PieChart, ScatterChart, TitleComponent, TooltipComponent]);

type ReactEChartsCoreProps = {
  echarts: typeof echarts;
  className?: string;
  option: EChartsCoreOption;
  onChartReady?: (chart: EChartsType) => void;
  style?: CSSProperties;
};

const ReactEChartsCoreModuleValue = ReactEChartsCoreModule as unknown as { default?: ComponentType<ReactEChartsCoreProps> } & ComponentType<ReactEChartsCoreProps>;
const ReactEChartsCore = ReactEChartsCoreModuleValue.default ?? ReactEChartsCoreModuleValue;

function ReactECharts(props: { className?: string; optionKey?: string; option: EChartsCoreOption }) {
  const chartRef = useRef<EChartsType | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { className, option, optionKey } = props;
  const resizeChart = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    window.requestAnimationFrame(() => chart.resize());
  }, []);
  useEffect(() => {
    resizeChart();
    const tick = window.setTimeout(resizeChart, 80);
    return () => window.clearTimeout(tick);
  }, [optionKey, option, resizeChart]);
  useEffect(() => {
    const node = containerRef.current;
    const onResize = () => resizeChart();
    const observer = typeof ResizeObserver === 'undefined' || !node ? null : new ResizeObserver(onResize);
    if (node) observer?.observe(node);
    window.addEventListener('resize', onResize);
    window.addEventListener('hashchange', onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('hashchange', onResize);
    };
  }, [resizeChart]);
  return (
    <div ref={containerRef} className={className}>
      <ReactEChartsCore
        echarts={echarts}
        className="h-full w-full"
        option={option}
        onChartReady={chart => {
          chartRef.current = chart;
          window.setTimeout(resizeChart, 0);
        }}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}

type AnalyticsCssVars = CSSProperties & Record<`--${string}`, string | number>;

type AnalyticsAppProps = {
  parser: AnalyticsParser;
  analyzer: AnalyticsAnalyzer;
  getXlsx?: () => AnalyticsXlsx | undefined;
  onToast?: (message: string, type?: 'ok' | 'error') => void;
};

const analyticsShellClass = 'analytics-react-shell grid gap-3.5';
const analyticsControlCardClass = 'analytics-control-card mb-2 grid gap-3 border-[color-mix(in_srgb,var(--accent2)_24%,var(--border))] p-4';
const analyticsUploadRowClass = 'analytics-upload-card analytics-react-upload-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 max-[760px]:grid-cols-1';
const periodControlClass = 'analytics-period-control flex min-w-0 flex-1 flex-wrap items-center gap-2.5 max-[760px]:grid max-[760px]:grid-cols-1';
const analyticsChipClass = 'analytics-chip inline-flex min-h-[26px] items-center whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--panel2)_80%,transparent)] px-2.5 text-xs font-semibold text-[var(--muted)]';
const uploadActionClass = 'analytics-upload-action relative flex min-w-[220px] justify-end max-[980px]:justify-start max-[640px]:min-w-0';
const filePickerClass = 'analytics-file-picker inline-flex min-h-11 w-full max-w-[300px] cursor-pointer items-center justify-center gap-[9px] rounded-xl border border-[color-mix(in_srgb,var(--accent)_54%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_13%,var(--panel))] px-4 text-[13px] font-bold text-[color-mix(in_srgb,var(--accent)_76%,white)] transition-[transform,border-color,background-color] hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--accent)_72%,white)] hover:bg-[color-mix(in_srgb,var(--accent)_18%,var(--panel))] max-[760px]:max-w-none';
const filePickerDisabledClass = 'pointer-events-none cursor-not-allowed opacity-55 saturate-50 hover:translate-y-0';
const fileIconClass = 'analytics-file-icon inline-flex h-[18px] w-[18px] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:fill-none [&_svg]:stroke-current';
const fileInputClass = 'pointer-events-none absolute h-px w-px overflow-hidden opacity-0';
const fileMetaClass = 'analytics-file-meta min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[var(--muted)]';
const snapshotSelectClass = 'analytics-snapshot-select h-10 min-h-10 w-[280px] max-w-full rounded-xl bg-[rgba(255,255,255,.035)] py-2 pl-3 pr-8 text-sm max-[760px]:w-full';
const emptyCardClass = 'analytics-empty analytics-react-empty grid min-h-[180px] place-items-center border-dashed bg-[color-mix(in_srgb,var(--panel2)_38%,transparent)]';
const analyticsMainClass = 'analytics-main analytics-react-main grid gap-4';
const kpiGridClass = 'analytics-kpi-grid grid grid-cols-4 gap-3 max-[860px]:grid-cols-2 max-[640px]:grid-cols-1';
const kpiCardClass = 'analytics-kpi-card min-h-28 rounded-xl border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel)_94%,white),var(--panel))] px-4 pb-3.5 pt-4 shadow-[0_12px_26px_rgba(0,0,0,.10)]';
const kpiLabelClass = 'analytics-kpi-label text-[11.5px] font-bold uppercase tracking-[.08em] text-[var(--muted)]';
const kpiValueClass = 'analytics-kpi-value mt-[9px] text-[clamp(20px,2.1vw,25px)] font-bold leading-[1.12] text-[var(--text)]';
const kpiMetaClass = 'analytics-kpi-meta mt-2 text-xs text-[var(--muted)]';
const analyticsTwoColumnClass = 'grid grid-cols-2 items-stretch gap-4 max-[980px]:grid-cols-1';
const analyticsInsightLayoutClass = cn('analytics-insight-layout analytics-react-insight-layout', analyticsTwoColumnClass);
const analyticsLayoutClass = cn('analytics-layout analytics-summary-layout', analyticsTwoColumnClass);
const analyticsCardClass = 'analytics-chart-card min-w-0';
const analyticsTableCardClass = 'analytics-table-card min-w-0';
const sectionHeadClass = 'analytics-section-head mb-3.5 flex items-center justify-between gap-3 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-2';
const mutedChipClass = cn(analyticsChipClass, 'muted');
const chartSlotClass = 'analytics-react-chart min-w-0 [&_.echarts-for-react]:h-full [&_.echarts-for-react]:w-full';
const overviewChartWrapClass = 'analytics-react-overview-chart min-w-0';
const overviewChartClass = cn(chartSlotClass, 'analytics-react-overview h-[300px] rounded-xl border border-[color-mix(in_srgb,var(--border)_72%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel2)_32%,transparent),transparent),color-mix(in_srgb,var(--panel2)_18%,transparent)] px-1.5 pb-1 pt-2.5 max-[640px]:h-[250px]');
const funnelSummaryClass = 'analytics-react-funnel-summary mt-2.5 grid grid-cols-4 gap-2 max-[860px]:grid-cols-2 max-[640px]:grid-cols-1';
const funnelStepClass = 'analytics-react-funnel-step grid min-w-0 grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-[7px] rounded-[9px] border border-[color-mix(in_srgb,var(--border)_72%,transparent)] bg-[color-mix(in_srgb,var(--panel2)_30%,transparent)] px-2.5 py-[9px]';
const funnelDotClass = 'analytics-react-funnel-dot h-2 w-2 rounded-full bg-[var(--funnel-color)]';
const funnelTextWrapClass = 'grid min-w-0 gap-0.5';
const funnelLabelClass = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold not-italic text-[var(--text)]';
const funnelValueClass = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] font-bold text-[var(--muted)]';
const funnelRateClass = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-bold not-italic text-[color-mix(in_srgb,var(--accent2)_74%,var(--text))]';
const scatterWrapClass = 'analytics-react-scatter-wrap grid min-w-0';
const scatterChartClass = cn(chartSlotClass, 'analytics-react-scatter h-[300px] rounded-xl border border-[color-mix(in_srgb,var(--border)_72%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel2)_32%,transparent),transparent),color-mix(in_srgb,var(--panel2)_18%,transparent)] px-1.5 pb-1 pt-2.5 max-[640px]:h-[250px]');
const scatterLegendClass = 'analytics-react-legend mt-4 flex flex-wrap gap-2';
const scatterLegendItemClass = 'inline-flex min-h-6 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--border)_76%,transparent)] bg-[color-mix(in_srgb,var(--panel2)_28%,transparent)] px-[9px] text-[11.5px] font-bold text-[var(--muted)]';
const scatterLegendDotClass = 'h-2 w-2 rounded-full bg-[var(--legend-color)]';
const readableSummaryClass = 'analytics-react-readable-summary sr-only';
const rankingClass = 'analytics-ranking grid gap-3';
const rankRowClass = 'analytics-rank-row grid grid-cols-[30px_minmax(0,1fr)_96px] items-center gap-2.5 max-[640px]:grid-cols-[28px_minmax(0,1fr)] max-[640px]:items-start';
const rankIndexClass = 'analytics-rank-index grid h-[26px] w-[26px] place-items-center rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,var(--panel2))] text-xs font-bold text-[color-mix(in_srgb,var(--accent)_72%,white)]';
const rankMainClass = 'analytics-rank-main min-w-0';
const rankNameClass = 'analytics-rank-name overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold leading-[1.35] text-[var(--text)]';
const rankTrackClass = 'analytics-rank-track mt-[7px] h-[7px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--panel2)_72%,black)]';
const rankTrackBarClass = 'block h-full rounded-[inherit] bg-[linear-gradient(90deg,#13c2a3,#ffd166)]';
const rankValueClass = 'analytics-rank-value grid justify-items-end gap-0.5 text-xs text-[var(--muted)] max-[640px]:col-start-2 max-[640px]:flex max-[640px]:items-center max-[640px]:gap-2 max-[640px]:justify-items-start';
const rankValueStrongClass = 'text-[12.5px] text-[var(--text)]';
const summaryCardClass = cn(analyticsCardClass, 'analytics-summary-card h-full');
const portfolioSummaryClass = 'analytics-portfolio-summary grid h-full content-between gap-2.5';
const portfolioMetricClass = 'analytics-portfolio-metric flex items-start justify-between gap-3 border-b border-[color-mix(in_srgb,var(--border)_58%,transparent)] py-2.5 last:border-b-0';
const portfolioMetricLabelClass = 'text-xs font-bold text-[var(--muted)]';
const portfolioMetricValueClass = 'whitespace-nowrap text-[15px] font-bold text-[var(--text)]';
const portfolioMetricMetaClass = 'mt-1 text-[11.5px] text-[var(--muted)]';
const portfolioSignalsClass = 'mt-1.5 flex flex-wrap gap-1.5';
const portfolioSignalClass = 'inline-flex min-h-6 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--border)_76%,transparent)] bg-[color-mix(in_srgb,var(--panel2)_30%,transparent)] px-2 text-[11.5px] font-bold text-[var(--muted)]';
const portfolioNextClass = 'analytics-portfolio-next mt-1 grid content-start gap-2';
const portfolioNextItemClass = 'rounded-[9px] border border-[color-mix(in_srgb,var(--accent2)_26%,var(--border))] bg-[color-mix(in_srgb,var(--panel2)_38%,transparent)] px-3 py-2';
const portfolioNextLabelClass = 'mb-1 text-[11.5px] font-bold text-[color-mix(in_srgb,var(--accent2)_72%,var(--text))]';
const portfolioNextCopyClass = 'm-0 text-xs leading-[1.55] text-[var(--text)]';
const actionPlanClass = 'analytics-action-plan grid grid-cols-2 gap-2.5 max-[980px]:grid-cols-1';
const actionItemClass = 'analytics-action-item grid gap-2 rounded-[10px] border-l-[3px] bg-[color-mix(in_srgb,var(--panel2)_48%,transparent)] px-3 py-[11px]';
const actionHeadClass = 'analytics-action-head flex items-center justify-between gap-2';
const actionTitleClass = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-[var(--text)]';
const actionProductClass = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold text-[var(--muted)]';
const actionCopyClass = 'm-0 text-xs leading-[1.55] text-[var(--muted)]';
const actionStrongCopyClass = 'm-0 text-xs font-semibold leading-[1.55] text-[var(--text)]';
const actionMetricClass = 'flex flex-wrap gap-1.5';
const tableWrapClass = 'analytics-table-wrap max-h-[620px] overflow-auto';
const comparisonTableWrapClass = 'analytics-period-table-wrap !max-h-[256px] !overflow-y-auto overflow-x-auto';
const detailTableClass = 'analytics-detail-table mt-1.5 w-full border-collapse text-sm max-[640px]:text-[13px]';
const detailHeadClass = 'px-2.5 py-[11px] text-[11.5px] max-[640px]:px-1.5 max-[640px]:py-[9px] max-[640px]:text-[10.5px]';
const detailFirstHeadClass = cn(detailHeadClass, 'min-w-[260px] text-left max-[640px]:min-w-[220px]');
const detailNumericHeadClass = cn(detailHeadClass, 'whitespace-nowrap text-right');
const comparisonNumericHeadClass = cn(detailHeadClass, 'whitespace-nowrap text-center');
const comparisonStickyHeadClass = 'sticky top-0 z-10 bg-[var(--panel)] shadow-[0_1px_0_var(--border)]';
const detailCellClass = 'px-2.5 py-[11px] align-middle max-[640px]:px-1.5 max-[640px]:py-[9px]';
const detailFirstCellClass = cn(detailCellClass, 'min-w-[260px] text-left max-[640px]:min-w-[220px]');
const detailNumericCellClass = cn(detailCellClass, 'whitespace-nowrap text-right');
const comparisonNumericCellClass = cn(detailCellClass, 'whitespace-nowrap text-center');
const comparisonPeriodHeadClass = cn(detailHeadClass, 'min-w-[172px] text-center max-[640px]:min-w-[150px]');
const comparisonPeriodCellClass = cn(detailCellClass, 'min-w-[172px] text-center font-semibold text-[var(--text)] max-[640px]:min-w-[150px]');
const deltaTextClass = 'mt-1 block text-[11px] font-semibold';
const deltaPositiveClass = 'text-[color-mix(in_srgb,var(--accent2)_76%,var(--text))]';
const deltaNegativeClass = 'text-[color-mix(in_srgb,var(--danger)_76%,var(--text))]';
const deltaNeutralClass = 'text-[var(--muted)]';
const productNameClass = 'analytics-product-name max-w-[520px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--text)]';
const productIdClass = 'analytics-product-id mt-[3px] text-[11.5px] text-[var(--muted)]';
const ALL_ACCOUNTS_KEY = '__all__';
const ACCOUNT_UPDATED_EVENT = 'tk-accounts-changed';
const ALL_PERIODS_KEY = '__all_periods__';

function actionToneForKind(kind: string) {
  return {
    scale: 'hero',
    traffic: 'scale',
    creative: 'creative',
    conversion: 'detail',
    pause: 'watch',
    watch: 'normal'
  }[kind] || 'normal';
}

function actionCardClass(kind: string) {
  const tone = actionToneForKind(kind);
  const toneClass = {
    hero: 'border-l-[#13c2a3]',
    scale: 'border-l-[#3b82f6]',
    creative: 'border-l-[#f59e0b]',
    detail: 'border-l-[#ef476f]',
    watch: 'border-l-[#8b93c2]',
    normal: 'border-l-[color-mix(in_srgb,var(--accent)_64%,var(--border))]'
  }[tone] || 'border-l-[color-mix(in_srgb,var(--accent)_64%,var(--border))]';
  return cn(actionItemClass, `is-${tone}`, `is-${kind}`, toneClass);
}

function analyticsTagClass(tone: string) {
  const toneClass = {
    hero: 'border-[color-mix(in_srgb,#13c2a3_46%,var(--border))] bg-[color-mix(in_srgb,#13c2a3_14%,transparent)] text-[#13c2a3]',
    scale: 'border-[color-mix(in_srgb,#3b82f6_46%,var(--border))] bg-[color-mix(in_srgb,#3b82f6_14%,transparent)] text-[#7dd3fc]',
    creative: 'border-[color-mix(in_srgb,#f59e0b_46%,var(--border))] bg-[color-mix(in_srgb,#f59e0b_14%,transparent)] text-[#ffd166]',
    detail: 'border-[color-mix(in_srgb,#ef476f_46%,var(--border))] bg-[color-mix(in_srgb,#ef476f_14%,transparent)] text-[#ff9aa8]',
    watch: 'text-[var(--muted)]',
    normal: 'text-[var(--muted)]'
  }[tone] || 'text-[var(--muted)]';
  return cn('analytics-tag min-h-[26px] px-2.5 font-semibold', `is-${tone}`, toneClass);
}

function getSheetRows(workbook: ReturnType<AnalyticsXlsx['read']>, xlsx: AnalyticsXlsx): unknown[][] {
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error('Excel 文件里没有工作表');
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ''
  }) as unknown[][];
}

function formatAnalyticsError(error: unknown, fallback = '数据分析同步失败') {
  const message = error instanceof Error ? error.message : String(error || '');
  if (isPermissionDenied(error)) {
    return formatFirestoreRulesUpdateMessage('analytics', [
      'analytics_snapshots.read',
      'analytics_snapshots.write',
      'analytics_records.read',
      'analytics_records.write'
    ]);
  }
  return message || fallback;
}

function handleAnalyticsSyncError(error: unknown, fallback = '数据分析同步失败') {
  const message = formatAnalyticsError(error, fallback);
  if (isPermissionDenied(error)) TKFirestoreConnection.notifyRulesUpdateNeeded(message);
  return message;
}

function formatPeriodOption(snapshot: AnalyticsProviderSnapshotSummary, showAccount = false) {
  const accountPrefix = showAccount && snapshot.accountName ? `${snapshot.accountName} · ` : '';
  const period = snapshot.period || '未知周期';
  return `${accountPrefix}${period} · ${snapshot.recordCount} 个商品`;
}

function periodStartKey(period: string) {
  const match = String(period || '').match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
  if (!match) return '';
  const [year, month, day] = match[0].replace(/\//g, '-').split('-');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function compareSnapshotsByPeriodDesc(left: AnalyticsProviderSnapshotSummary, right: AnalyticsProviderSnapshotSummary) {
  return periodStartKey(right.period).localeCompare(periodStartKey(left.period))
    || String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
}

function comparePeriodRowsDesc(left: AnalyticsPeriodComparison, right: AnalyticsPeriodComparison) {
  return periodStartKey(right.period).localeCompare(periodStartKey(left.period))
    || String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
}

function getAnalysisActions(analysis: AnalyticsAnalysis) {
  return analysis.actionPlan?.length ? analysis.actionPlan : buildActionPlan(analysis);
}

function filterSnapshotsByAccount(snapshots: AnalyticsProviderSnapshotSummary[], activeAccount: string) {
  if (activeAccount === ALL_ACCOUNTS_KEY) return snapshots;
  return snapshots.filter(snapshot => normalizeAccountName(snapshot.accountName) === activeAccount);
}

function KpiGrid({ analysis }: { analysis: AnalyticsAnalysis }) {
  const kpis = [
    { label: 'GMV', value: formatYen(analysis.kpis.totalGmv), meta: analysis.period || '当前导入周期' },
    { label: '订单数', value: formatInteger(analysis.kpis.totalOrders), meta: `${formatInteger(analysis.kpis.totalUnits)} 件成交` },
    { label: '动销商品', value: `${analysis.kpis.soldProducts}/${analysis.kpis.productCount}`, meta: `${analysis.activeCount} 个 Active 商品` },
    { label: '客单价', value: `${formatYen(analysis.kpis.aov)}/单`, meta: `件均 ${formatYen(analysis.kpis.unitPrice)}/件` }
  ];
  return (
    <div id="analytics-kpi-grid" className={kpiGridClass}>
      {kpis.map(item => (
        <div className={kpiCardClass} key={item.label}>
          <div className={kpiLabelClass}>{item.label}</div>
          <div className={kpiValueClass}>{item.value}</div>
          <div className={kpiMetaClass}>{item.meta}</div>
        </div>
      ))}
    </div>
  );
}

function deltaClass(value: number) {
  if (value > 0) return cn(deltaTextClass, deltaPositiveClass);
  if (value < 0) return cn(deltaTextClass, deltaNegativeClass);
  return cn(deltaTextClass, deltaNeutralClass);
}

function formatSignedYen(value: number) {
  const numeric = Number(value) || 0;
  return `${numeric > 0 ? '+' : ''}${formatYen(numeric)}`;
}

function formatSignedInteger(value: number) {
  const numeric = Number(value) || 0;
  return `${numeric > 0 ? '+' : ''}${formatInteger(numeric)}`;
}

function formatSignedPercent(value: number, digits = 2) {
  const numeric = Number(value) || 0;
  return `${numeric > 0 ? '+' : ''}${formatPercent(numeric, digits)}`;
}

function MetricWithDelta({
  value,
  delta,
  deltaRate,
  formatter
}: {
  value: string;
  delta: number;
  deltaRate?: number;
  formatter: (value: number) => string;
}) {
  const hasDelta = delta !== 0 || !!deltaRate;
  return (
    <>
      <span>{value}</span>
      {hasDelta ? (
        <span className={deltaClass(delta)}>
          {formatter(delta)}
          {typeof deltaRate === 'number' ? ` (${formatSignedPercent(deltaRate)})` : ''}
        </span>
      ) : <span className={deltaClass(0)}>持平</span>}
    </>
  );
}

function PeriodComparisonTable({ rows }: { rows: AnalyticsPeriodComparison[] }) {
  const sorted = useMemo(() => [...rows].sort(comparePeriodRowsDesc), [rows]);
  if (!sorted.length) return null;
  return (
    <Card className={analyticsTableCardClass}>
      <div className={sectionHeadClass}>
        <CardTitle className="mb-0">周期对比</CardTitle>
        <Badge className={mutedChipClass}>{rows.length} 个周期 · 环比按上一周期计算</Badge>
      </div>
      <TableViewport className={comparisonTableWrapClass}>
        <Table className={detailTableClass}>
          <TableHeader>
            <TableRow>
              <TableHead className={cn(comparisonPeriodHeadClass, comparisonStickyHeadClass)}>周期</TableHead>
              <TableHead className={cn(comparisonNumericHeadClass, comparisonStickyHeadClass)}>GMV</TableHead>
              <TableHead className={cn(comparisonNumericHeadClass, comparisonStickyHeadClass)}>订单</TableHead>
              <TableHead className={cn(comparisonNumericHeadClass, comparisonStickyHeadClass)}>件数</TableHead>
              <TableHead className={cn(comparisonNumericHeadClass, comparisonStickyHeadClass)}>曝光</TableHead>
              <TableHead className={cn(comparisonNumericHeadClass, comparisonStickyHeadClass)}>浏览</TableHead>
              <TableHead className={cn(comparisonNumericHeadClass, comparisonStickyHeadClass)}>成交客户</TableHead>
              <TableHead className={cn(comparisonNumericHeadClass, comparisonStickyHeadClass)}>点击率</TableHead>
              <TableHead className={cn(comparisonNumericHeadClass, comparisonStickyHeadClass)}>转化率</TableHead>
              <TableHead className={cn(comparisonNumericHeadClass, comparisonStickyHeadClass)}>客单价</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(row => (
              <TableRow key={`${row.period}-${row.updatedAt}`}>
                <TableCell className={comparisonPeriodCellClass}>
                  {row.period}
                  <span className="mt-1 block text-[11px] font-normal text-[var(--muted)]">{formatInteger(row.snapshotCount)} 张表 · {formatInteger(row.productCount)} 个商品 · {formatInteger(row.soldProducts)} 个动销</span>
                </TableCell>
                <TableCell className={comparisonNumericCellClass}>
                  <MetricWithDelta value={formatYen(row.totalGmv)} delta={row.gmvDelta} deltaRate={row.gmvDeltaRate} formatter={formatSignedYen} />
                </TableCell>
                <TableCell className={comparisonNumericCellClass}>
                  <MetricWithDelta value={formatInteger(row.totalOrders)} delta={row.ordersDelta} deltaRate={row.ordersDeltaRate} formatter={formatSignedInteger} />
                </TableCell>
                <TableCell className={comparisonNumericCellClass}>
                  <MetricWithDelta value={formatInteger(row.totalUnits)} delta={row.unitsDelta} deltaRate={row.unitsDeltaRate} formatter={formatSignedInteger} />
                </TableCell>
                <TableCell className={comparisonNumericCellClass}>
                  <MetricWithDelta value={formatInteger(row.totalExposure)} delta={row.exposureDelta} deltaRate={row.exposureDeltaRate} formatter={formatSignedInteger} />
                </TableCell>
                <TableCell className={comparisonNumericCellClass}>{formatInteger(row.totalPageViews)}</TableCell>
                <TableCell className={comparisonNumericCellClass}>{formatInteger(row.totalCustomers)}</TableCell>
                <TableCell className={comparisonNumericCellClass}>{formatPercent(row.ctr)}</TableCell>
                <TableCell className={comparisonNumericCellClass}>
                  <span>{formatPercent(row.conversion)}</span>
                  {row.conversionDelta ? <span className={deltaClass(row.conversionDelta)}>{formatSignedPercent(row.conversionDelta)}</span> : <span className={deltaClass(0)}>持平</span>}
                </TableCell>
                <TableCell className={comparisonNumericCellClass}>{formatYen(row.aov)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableViewport>
    </Card>
  );
}

function TopProducts({ records }: { records: AnalyticsRecord[] }) {
  const rows = useMemo(() => [...records].sort((a, b) => b.gmv - a.gmv).slice(0, 10), [records]);
  const max = Math.max(...rows.map(record => record.gmv), 1);
  return (
    <div className={rankingClass}>
      {rows.map((record, index) => (
        <div className={rankRowClass} key={record.id || record.name}>
          <div className={rankIndexClass}>{index + 1}</div>
          <div className={rankMainClass}>
            <div className={rankNameClass} title={record.name}>{shortenText(record.name, 54)}</div>
            <div className={rankTrackClass}>
              <span
                className={rankTrackBarClass}
                style={{ width: `${Math.max(2, record.gmv / max * 100).toFixed(2)}%` }}
              />
            </div>
          </div>
          <div className={rankValueClass}>
            <strong className={rankValueStrongClass}>{formatYen(record.gmv)}</strong>
            <span>{formatInteger(record.orders)} 单</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PortfolioSummary({ analysis }: { analysis: AnalyticsAnalysis }) {
  const actions = useMemo(() => getAnalysisActions(analysis), [analysis]);
  const topRows = useMemo(() => [...analysis.records].sort((a, b) => b.gmv - a.gmv).slice(0, 3), [analysis.records]);
  const topGmv = topRows.reduce((total, record) => total + record.gmv, 0);
  const topShare = analysis.kpis.totalGmv ? topGmv / analysis.kpis.totalGmv : 0;
  const activeCount = analysis.activeCount || analysis.records.filter(record => record.status !== 'Inactive').length;
  const activeSellThrough = activeCount ? analysis.kpis.soldProducts / activeCount : 0;
  const actionCounts = actions.reduce<Record<string, number>>((acc, item) => {
    acc[item.title] = (acc[item.title] || 0) + 1;
    return acc;
  }, {});
  const topAction = Object.entries(actionCounts).sort((left, right) => right[1] - left[1])[0];
  const ctr = analysis.kpis.totalExposure
    ? analysis.records.reduce((total, record) => total + record.pageViewsTotal, 0) / analysis.kpis.totalExposure
    : 0;
  const conversion = analysis.records.reduce((total, record) => total + record.customersTotal, 0)
    ? analysis.kpis.totalUnits / analysis.records.reduce((total, record) => total + record.customersTotal, 0)
    : 0;
  const nextSteps = [
    {
      label: '库存 / 素材',
      copy: topShare >= 0.5 ? '头部商品占比高，先保证 Top3 库存和素材迭代。' : '头部不过度集中，按动作优先级分配素材资源。'
    },
    {
      label: '补流量候选',
      copy: activeSellThrough < 0.12 ? '动销面偏窄，优先从 P1/P2 里挑 2-3 个商品补曝光。' : '动销面可用，补流量前先确认利润和库存。'
    },
    {
      label: '承接检查',
      copy: conversion < 0.35 ? '转化偏弱，检查价格、评价、规格和详情首屏。' : '转化表现可继续放大，重点观察点击率是否拖后腿。'
    }
  ];
  return (
    <div id="analytics-portfolio-summary" className={portfolioSummaryClass}>
      <div className={portfolioMetricClass}>
        <div>
          <div className={portfolioMetricLabelClass}>Top3 GMV 占比</div>
          <div className={portfolioMetricMetaClass}>{formatYen(topGmv)} / {formatYen(analysis.kpis.totalGmv)}</div>
        </div>
        <strong className={portfolioMetricValueClass}>{formatPercent(topShare, 1)}</strong>
      </div>
      <div className={portfolioMetricClass}>
        <div>
          <div className={portfolioMetricLabelClass}>动销率</div>
          <div className={portfolioMetricMetaClass}>{formatInteger(analysis.kpis.soldProducts)} 个动销 / {formatInteger(activeCount)} 个 Active</div>
        </div>
        <strong className={portfolioMetricValueClass}>{formatPercent(activeSellThrough, 1)}</strong>
      </div>
      <div className={portfolioMetricClass}>
        <div>
          <div className={portfolioMetricLabelClass}>流量承接</div>
          <div className={portfolioMetricMetaClass}>点击率 {formatPercent(ctr)} · 转化率 {formatPercent(conversion)}</div>
        </div>
        <strong className={portfolioMetricValueClass}>{topAction ? topAction[0] : '观察'}</strong>
      </div>
      <div className={portfolioSignalsClass}>
        {Object.entries(actionCounts).map(([label, count]) => (
          <span className={portfolioSignalClass} key={label}>{label} {formatInteger(count)}</span>
        ))}
      </div>
      <div className={portfolioNextClass}>
        {nextSteps.map(step => (
          <div className={portfolioNextItemClass} key={step.label}>
            <div className={portfolioNextLabelClass}>{step.label}</div>
            <p className={portfolioNextCopyClass}>{step.copy}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionPlan({ analysis }: { analysis: AnalyticsAnalysis }) {
  const items = useMemo(() => getAnalysisActions(analysis), [analysis]);
  if (!items.length) {
    return (
      <div id="analytics-action-plan" className={actionPlanClass}>
        <p className={actionCopyClass}>当前数据不足，先补齐商品流量表后再判断动作优先级。</p>
      </div>
    );
  }
  return (
    <div id="analytics-action-plan" className={actionPlanClass}>
      {items.map(item => (
        <div className={actionCardClass(item.kind)} data-action-kind={item.kind} key={`${item.kind}-${item.productId || item.productName}`}>
          <div className={actionHeadClass}>
            <span className={actionTitleClass}>{item.title}</span>
            <Badge className={analyticsTagClass(actionToneForKind(item.kind))}>{item.priority}</Badge>
          </div>
          <div className={actionProductClass} title={item.productName}>{shortenText(item.productName, 42)}</div>
          <p className={actionCopyClass}>{item.reason}</p>
          <p className={actionStrongCopyClass}>{item.action}</p>
          <div className={actionMetricClass}>
            <Badge className={mutedChipClass}>GMV {formatYen(item.metrics.gmv)}</Badge>
            <Badge className={mutedChipClass}>{formatInteger(item.metrics.orders)} 单</Badge>
            <Badge className={mutedChipClass}>点击率 {formatPercent(item.metrics.ctr)}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailTable({ records, showPeriodColumns = false }: { records: AnalyticsRecord[]; showPeriodColumns?: boolean }) {
  const rows = useMemo(() => [...records].sort((a, b) => b.gmv - a.gmv || b.exposureTotal - a.exposureTotal), [records]);
  return (
    <Table className={detailTableClass}>
      <TableHeader>
        <TableRow>
          <TableHead className={detailFirstHeadClass}>商品</TableHead>
          <TableHead className={detailNumericHeadClass}>GMV</TableHead>
          <TableHead className={detailNumericHeadClass}>订单</TableHead>
          <TableHead className={detailNumericHeadClass}>总曝光</TableHead>
          <TableHead className={detailNumericHeadClass}>总浏览</TableHead>
          <TableHead className={detailNumericHeadClass}>点击率</TableHead>
          {showPeriodColumns ? <TableHead className={detailNumericHeadClass}>覆盖周期</TableHead> : null}
          {showPeriodColumns ? <TableHead className={detailNumericHeadClass}>最近周期</TableHead> : null}
          {showPeriodColumns ? <TableHead className={detailNumericHeadClass}>GMV趋势</TableHead> : null}
          <TableHead className={detailNumericHeadClass}>诊断</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(record => (
          <TableRow key={record.id || record.name}>
            <TableCell className={detailFirstCellClass} title={record.name}>
              <div className={productNameClass}>{shortenText(record.name, 64)}</div>
              <div className={productIdClass}>{record.id}</div>
            </TableCell>
            <TableCell className={detailNumericCellClass}>{formatYen(record.gmv)}</TableCell>
            <TableCell className={detailNumericCellClass}>{formatInteger(record.orders)}</TableCell>
            <TableCell className={detailNumericCellClass}>{formatInteger(record.exposureTotal)}</TableCell>
            <TableCell className={detailNumericCellClass}>{formatInteger(record.pageViewsTotal)}</TableCell>
            <TableCell className={detailNumericCellClass}>{formatPercent(record.overallCtr)}</TableCell>
            {showPeriodColumns ? <TableCell className={detailNumericCellClass}>{formatInteger(record.periodCount || 1)}</TableCell> : null}
            {showPeriodColumns ? <TableCell className={detailNumericCellClass}>{record.latestPeriod || '-'}</TableCell> : null}
            {showPeriodColumns ? (
              <TableCell className={detailNumericCellClass}>
                {(record.gmvTrend || 0) >= 0 ? '+' : ''}{formatYen(record.gmvTrend || 0)}
              </TableCell>
            ) : null}
            <TableCell className={detailNumericCellClass}><Badge className={analyticsTagClass(record.diagnosis.tone)}>{record.diagnosis.label}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ScatterLegend() {
  const items = [
    ['hero', '爆品'],
    ['scale', '加流量'],
    ['creative', '换素材'],
    ['detail', '承接差']
  ];
  return (
    <div className={scatterLegendClass}>
      {items.map(([key, label]) => (
        <span className={scatterLegendItemClass} key={key}>
          <i className={scatterLegendDotClass} style={{ '--legend-color': DIAGNOSIS_COLORS[key] } as AnalyticsCssVars} />
          {label}
        </span>
      ))}
    </div>
  );
}

function ChannelSummary({ analysis }: { analysis: AnalyticsAnalysis }) {
  const funnelStages = buildFunnelStages(analysis);
  return (
    <div className={readableSummaryClass} aria-label="运营总览摘要">
      {analysis.channelTotals.map(channel => `${channel.label} ${formatYen(channel.gmv)} ${formatInteger(channel.units)} 件`).join(' · ')}
      {' · '}
      {funnelStages.map(stage => `${stage.label} ${formatInteger(stage.value)}`).join(' · ')}
    </div>
  );
}

function FunnelSummary({ stages }: { stages: AnalyticsFunnelStage[] }) {
  return (
    <div id="analytics-funnel" className={funnelSummaryClass}>
      {stages.map(stage => (
        <div className={funnelStepClass} key={stage.key}>
          <span className={funnelDotClass} style={{ '--funnel-color': stage.color } as AnalyticsCssVars} />
          <div className={funnelTextWrapClass}>
            <strong className={funnelLabelClass}>{stage.label}</strong>
            <span className={funnelValueClass}>{formatInteger(stage.value)}</span>
          </div>
          <em className={funnelRateClass}>{stage.key === 'exposure' ? '100.00%' : formatPercent(stage.rateFromPrevious)}</em>
        </div>
      ))}
    </div>
  );
}

function AnalyticsHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog id="analytics-help-modal" open={open} titleId="analytics-help-title" onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogTitle id="analytics-help-title">数据分析说明</DialogTitle>
        <HelpStack>
          <HelpItem label="Excel 来源">在 TikTok Shop 商家中心进入“数据分析 / 商品数据分析”，打开商品列表的“详细信息”并导出 Excel。</HelpItem>
          <HelpItem label="指标配置">后台自定义指标最多选择 10 个。建议选择 GMV，以及商城页、视频、商品卡各自的曝光次数、点击率、转化率。</HelpItem>
          <HelpItem label="导入">原始 Excel 只在浏览器本地解析，不上传到本站服务器。</HelpItem>
          <HelpItem label="保存">解析后的分析快照和商品明细会按所选账号保存到你自己的 Firestore。上传时会先选择账号，不能落在“全部”。</HelpItem>
          <HelpItem label="多周数据">每次导入都会生成一个新的分析快照。周期选择默认“全部周期”并聚合同账号下多张表，也可以切回单个周期。</HelpItem>
          <HelpItem label="权限">如果 Firestore 规则没有发布到最新版本，页面会弹出统一规则提示，可直接复制最新规则。</HelpItem>
        </HelpStack>
        <DialogActions>
          <Button variant="primary" onClick={() => onOpenChange(false)}>知道了</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

function AnalyticsDashboard({ analysis, periodMode = 'single' }: { analysis: AnalyticsAnalysis; periodMode?: 'all' | 'single' }) {
  const funnelStages = buildFunnelStages(analysis);
  const chartKey = `${analysis.period}|${analysis.records.length}|${analysis.kpis.totalGmv}|${analysis.kpis.totalExposure}`;
  const isAllPeriods = periodMode === 'all';
  const comparisonRows = isAllPeriods ? analysis.periodComparisons || [] : [];
  return (
    <section className={analyticsMainClass} data-react-analytics-ready="true">
      <KpiGrid analysis={analysis} />
      {comparisonRows.length > 1 ? <PeriodComparisonTable rows={comparisonRows} /> : null}
      <div className={analyticsInsightLayoutClass}>
        <Card className={cn(analyticsCardClass, 'analytics-overview-card')}>
          <div className={sectionHeadClass}>
            <CardTitle className="mb-0">运营总览</CardTitle>
            <Badge className={mutedChipClass}>渠道 GMV / 流量漏斗</Badge>
          </div>
          <div id="analytics-channel-share" className={overviewChartWrapClass}>
            <ChannelSummary analysis={analysis} />
            <ReactECharts className={overviewChartClass} option={buildOverviewOption(analysis)} optionKey={`overview-${chartKey}`} />
          </div>
          <FunnelSummary stages={funnelStages} />
        </Card>
        <Card className={cn(analyticsCardClass, 'analytics-bubble-card')}>
          <div className={sectionHeadClass}>
            <CardTitle className="mb-0">商品机会散点图</CardTitle>
            <Badge className={mutedChipClass}>曝光 × 转化 × GMV</Badge>
          </div>
          <div id="analytics-bubble-chart" className={scatterWrapClass}>
            <ReactECharts className={scatterChartClass} option={buildOpportunityScatterOption(analysis)} optionKey={`scatter-${chartKey}`} />
          </div>
          <ScatterLegend />
        </Card>
      </div>
      <div className={analyticsLayoutClass}>
        <Card className={summaryCardClass}>
          <div className={sectionHeadClass}>
            <CardTitle className="mb-0">Top 商品 GMV</CardTitle>
            <Badge className={mutedChipClass}>前 10</Badge>
          </div>
          <TopProducts records={analysis.records} />
        </Card>
        <Card className={summaryCardClass}>
          <div className={sectionHeadClass}>
            <CardTitle className="mb-0">运营摘要</CardTitle>
            <Badge className={mutedChipClass}>集中度 / 动销 / 承接</Badge>
          </div>
          <PortfolioSummary analysis={analysis} />
        </Card>
      </div>
      <Card className={analyticsCardClass}>
        <div className={sectionHeadClass}>
          <CardTitle className="mb-0">动作优先级</CardTitle>
          <Badge className={mutedChipClass}>先做前 6 项</Badge>
        </div>
        <ActionPlan analysis={analysis} />
      </Card>
      <Card className={analyticsTableCardClass}>
        <div className={sectionHeadClass}>
          <CardTitle className="mb-0">商品明细</CardTitle>
          <Badge className={mutedChipClass}>{analysis.records.length} 个商品 · {isAllPeriods ? '多周期聚合' : '单周期'} · 滚动查看全部</Badge>
        </div>
        <TableViewport className={tableWrapClass}>
          <DetailTable records={analysis.records} showPeriodColumns={isAllPeriods} />
        </TableViewport>
      </Card>
    </section>
  );
}

function AnalyticsApp({ parser, analyzer, getXlsx, onToast }: AnalyticsAppProps) {
  const [analysis, setAnalysis] = useState<AnalyticsAnalysis | null>(null);
  const [meta, setMeta] = useState('尚未导入数据');
  const [projectId, setProjectId] = useState('');
  const [syncText, setSyncText] = useState('未连接');
  const [syncTone, setSyncTone] = useState<'local' | 'saving' | 'saved' | 'error'>('local');
  const [helpOpen, setHelpOpen] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [copyingRules, setCopyingRules] = useState(false);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [activeAccount, setActiveAccount] = useState(ALL_ACCOUNTS_KEY);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [editingAccountName, setEditingAccountName] = useState('');
  const [editingAccountValue, setEditingAccountValue] = useState('');
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
  const [deletingAccountName, setDeletingAccountName] = useState('');
  const [savedSnapshots, setSavedSnapshots] = useState<AnalyticsProviderSnapshotSummary[]>([]);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState(ALL_PERIODS_KEY);
  const [uploadAccountOpen, setUploadAccountOpen] = useState(false);
  const [uploadAccountDraft, setUploadAccountDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const providerRef = useRef(AnalyticsProviderFirestore.create({
    state: {},
    helpers: { nowIso: () => new Date().toISOString() }
  }));
  const unsubscribeSnapshotRef = useRef<(() => void) | null>(null);
  const allAccounts = accounts;
  const scopedSnapshots = useMemo(() => filterSnapshotsByAccount(savedSnapshots, activeAccount).sort(compareSnapshotsByPeriodDesc), [activeAccount, savedSnapshots]);
  const accountTabItems = useMemo(() => allAccounts.map(account => ({
    key: account,
    label: account,
    count: savedSnapshots.filter(snapshot => normalizeAccountName(snapshot.accountName) === account).length,
    dataAttrs: { 'data-analytics-acc': account }
  })), [allAccounts, savedSnapshots]);
  const connected = !!projectId;
  const loading = syncTone === 'saving';
  const defaultUploadAccountName = activeAccount !== ALL_ACCOUNTS_KEY ? activeAccount : allAccounts[0] || '';
  const canUploadAnalysis = connected && !permissionBlocked && !!allAccounts.length;

  const notifyAccountsChanged = useCallback((detail: Record<string, unknown> = {}) => {
    window.dispatchEvent(new CustomEvent(ACCOUNT_UPDATED_EVENT, {
      detail: {
        source: 'analytics',
        projectId,
        ...detail
      }
    }));
  }, [projectId]);

  const stopSnapshot = useCallback(() => {
    if (!unsubscribeSnapshotRef.current) return;
    unsubscribeSnapshotRef.current();
    unsubscribeSnapshotRef.current = null;
  }, []);

  const loadPeriodAnalysis = useCallback(async (periodKey: string, snapshotsSource: AnalyticsProviderSnapshotSummary[] = scopedSnapshots) => {
    const cfg = TKFirestoreConnection.getConfig();
    const key = String(periodKey || ALL_PERIODS_KEY).trim() || ALL_PERIODS_KEY;
    if (!cfg?.configText) return false;
    const visibleSnapshots = filterSnapshotsByAccount(snapshotsSource, activeAccount);
    if (!visibleSnapshots.length) {
      setAnalysis(null);
      setSelectedPeriodKey(ALL_PERIODS_KEY);
      setMeta('暂无已保存分析');
      setSyncText('尚未保存分析');
      setSyncTone('saved');
      return true;
    }
    setSyncText(key === ALL_PERIODS_KEY ? '正在聚合全部周期…' : '正在恢复所选周期…');
    setSyncTone('saving');
    try {
      const next = await providerRef.current.init({ firestoreConfigText: cfg.configText });
      setProjectId(next.projectId);
      if (key === ALL_PERIODS_KEY) {
        const snapshots = await providerRef.current.pullAnalysesBySnapshots(visibleSnapshots.map(snapshot => snapshot.snapshotId));
        if (!snapshots.length) {
          setAnalysis(null);
          setSelectedPeriodKey(ALL_PERIODS_KEY);
          setSyncText('没有找到已保存的分析快照');
          setSyncTone('error');
          return false;
        }
        const combined = aggregateAnalyses(snapshots.map(snapshot => ({
          analysis: snapshot.analysis,
          snapshotId: snapshot.snapshotId,
          period: snapshot.analysis.period || snapshot.filename,
          updatedAt: snapshot.updatedAt
        })));
        setAnalysis(combined);
        setPermissionBlocked(false);
        setMeta(`全部周期 · ${visibleSnapshots.length} 张流量表 · ${combined.records.length} 个商品`);
        setSelectedPeriodKey(ALL_PERIODS_KEY);
        setSyncText(`已聚合全部周期 · ${visibleSnapshots.length} 张表`);
        setSyncTone('saved');
        return true;
      }
      const snapshot = await providerRef.current.pullAnalysisBySnapshot(key);
      if (!snapshot) {
        setAnalysis(null);
        setSyncText('没有找到这个分析快照');
        setSyncTone('error');
        return false;
      }
      setAnalysis(snapshot.analysis);
      setPermissionBlocked(false);
      setMeta(`${snapshot.filename || '已保存分析'} · ${snapshot.analysis.period || '未知周期'} · ${snapshot.analysis.records.length} 个商品`);
      setSelectedPeriodKey(snapshot.snapshotId);
      setSyncText(`已恢复分析 · ${snapshot.updatedAt.slice(0, 10)}`);
      setSyncTone('saved');
      return true;
    } catch (error) {
      handleAnalyticsSyncError(error);
      if (isPermissionDenied(error)) {
        setPermissionBlocked(true);
        setAnalysis(null);
        setSyncText('');
      } else {
        setSyncText(formatAnalyticsError(error));
      }
      setSyncTone('error');
      return false;
    }
  }, [activeAccount, scopedSnapshots]);

  const loadLatestAnalysis = useCallback(async () => {
    const cfg = TKFirestoreConnection.getConfig();
    if (!cfg?.configText) {
      stopSnapshot();
      setProjectId('');
      const status = buildFirestoreSyncStatus('unconnected');
      setSyncText(status.text);
      setSyncTone('local');
      setPermissionBlocked(false);
      setAccounts([]);
      setAnalysis(null);
      setSavedSnapshots([]);
      setSelectedPeriodKey(ALL_PERIODS_KEY);
      return false;
    }
    const refreshingStatus = buildFirestoreSyncStatus('refreshing');
    setSyncText('正在读取数据分析列表…');
    setSyncTone(refreshingStatus.className as 'saving');
    try {
      const next = await providerRef.current.init({ firestoreConfigText: cfg.configText });
      setProjectId(next.projectId);
      stopSnapshot();
      unsubscribeSnapshotRef.current = providerRef.current.subscribeSnapshot(snapshot => {
        const nextAccounts = uniqueAccounts(snapshot.accounts || []);
        const snapshots = snapshot.snapshots || [];
        setAccounts(nextAccounts);
        setActiveAccount(current => (
          current === ALL_ACCOUNTS_KEY || nextAccounts.includes(current) ? current : ALL_ACCOUNTS_KEY
        ));
        setSavedSnapshots(snapshots);
        setPermissionBlocked(false);
        const status = buildFirestoreSyncStatus(snapshot.hasPendingWrites ? 'queueing' : 'confirmed', {
          action: '数据分析更改',
          count: snapshots.length,
          unit: '个分析'
        });
        setSyncText(snapshots.length ? status.text : '尚未保存分析');
        setSyncTone(snapshot.hasPendingWrites ? 'saving' : 'saved');
      }, error => {
        handleAnalyticsSyncError(error);
        if (isPermissionDenied(error)) {
          setPermissionBlocked(true);
          setAnalysis(null);
          setSelectedPeriodKey(ALL_PERIODS_KEY);
          setSyncText('');
        } else {
          setSyncText(formatAnalyticsError(error));
        }
        setSyncTone('error');
      });
      return true;
    } catch (error) {
      handleAnalyticsSyncError(error);
      if (isPermissionDenied(error)) {
        setPermissionBlocked(true);
        setAnalysis(null);
        setSelectedPeriodKey(ALL_PERIODS_KEY);
        setSyncText('');
      } else {
        setSyncText(formatAnalyticsError(error));
      }
      setSyncTone('error');
      return false;
    }
  }, [stopSnapshot]);

  useEffect(() => {
    void loadLatestAnalysis();
    const handleConnectionChange = () => void loadLatestAnalysis();
    const handleAccountsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string; action?: string; oldAccount?: string; account?: string; accounts?: string[] }>).detail || {};
      if (detail.source === 'analytics' || !TKFirestoreConnection.getConfig()?.configText) return;
      if (Array.isArray(detail.accounts)) {
        const nextAccounts = uniqueAccounts(detail.accounts);
        setAccounts(nextAccounts);
        setActiveAccount(current => current === ALL_ACCOUNTS_KEY || nextAccounts.includes(current) ? current : ALL_ACCOUNTS_KEY);
      }
      if (detail.action === 'rename' && detail.oldAccount && detail.account) {
        const oldName = normalizeAccountName(detail.oldAccount);
        const newName = normalizeAccountName(detail.account);
        setSavedSnapshots(previous => previous.map(snapshot => (
          normalizeAccountName(snapshot.accountName) === oldName ? { ...snapshot, accountName: newName } : snapshot
        )));
      }
      if (detail.action === 'reorder' || detail.action === 'upsert' || detail.action === 'rename' || detail.action === 'delete') return;
      void loadLatestAnalysis();
    };
    window.addEventListener('tk-firestore-config-changed', handleConnectionChange);
    window.addEventListener(ACCOUNT_UPDATED_EVENT, handleAccountsChanged);
    return () => {
      stopSnapshot();
      window.removeEventListener('tk-firestore-config-changed', handleConnectionChange);
      window.removeEventListener(ACCOUNT_UPDATED_EVENT, handleAccountsChanged);
    };
  }, [loadLatestAnalysis, stopSnapshot]);

  async function saveAnalysisToFirestore(next: AnalyticsAnalysis, filename: string, accountName: string) {
    const normalizedAccountName = normalizeAccountName(accountName);
    if (!normalizedAccountName) {
      setSyncText('请先选择具体账号，再导入商品流量表');
      setSyncTone('error');
      onToast?.('请先选择具体账号，再导入商品流量表', 'error');
      return false;
    }
    const cfg = TKFirestoreConnection.getConfig();
    if (!cfg?.configText) {
      setSyncText('未连接数据库，本次分析未保存');
      setSyncTone('local');
      setProjectId('');
      setPermissionBlocked(false);
      return false;
    }
    setSyncText('正在保存数据分析到 Firestore…');
    setSyncTone('saving');
    try {
      const firestoreConfig = await providerRef.current.init({ firestoreConfigText: cfg.configText });
      setProjectId(firestoreConfig.projectId);
      const result = await providerRef.current.saveAnalysis(next, { accountName: normalizedAccountName, filename });
      setSyncText(`已保存到 Firestore · ${result.recordCount} 个商品`);
      setSyncTone('saved');
      setPermissionBlocked(false);
      const snapshots = await providerRef.current.listSavedAnalyses();
      setAccounts(previous => uniqueAccounts([...previous, normalizedAccountName]));
      setSavedSnapshots(snapshots);
      setSelectedPeriodKey(ALL_PERIODS_KEY);
      return true;
    } catch (error) {
      handleAnalyticsSyncError(error, '数据分析保存失败');
      if (isPermissionDenied(error)) {
        setPermissionBlocked(true);
        setAnalysis(null);
        setSyncText('');
      } else {
        setSyncText(formatAnalyticsError(error, '数据分析保存失败'));
      }
      setSyncTone('error');
      if (!isPermissionDenied(error)) onToast?.(error instanceof Error ? error.message : '数据分析保存失败', 'error');
      return false;
    }
  }

  useEffect(() => {
    if (activeAccount === ALL_ACCOUNTS_KEY || accounts.includes(activeAccount)) return;
    setActiveAccount(ALL_ACCOUNTS_KEY);
  }, [accounts, activeAccount]);

	  useEffect(() => {
	    if (permissionBlocked) return;
	    if (!scopedSnapshots.length) {
	      setAnalysis(null);
	      setSelectedPeriodKey(ALL_PERIODS_KEY);
	      setSyncText(projectId ? '尚未保存分析' : '未连接');
	      setSyncTone(projectId ? 'saved' : 'local');
	      return;
	    }
	    const key = selectedPeriodKey === ALL_PERIODS_KEY || scopedSnapshots.some(snapshot => snapshot.snapshotId === selectedPeriodKey)
	      ? selectedPeriodKey
	      : ALL_PERIODS_KEY;
	    if (key !== selectedPeriodKey) setSelectedPeriodKey(key);
	    void loadPeriodAnalysis(key, scopedSnapshots);
	  }, [activeAccount, loadPeriodAnalysis, permissionBlocked, projectId, scopedSnapshots, selectedPeriodKey]);

  async function copyFirestoreRules() {
    setCopyingRules(true);
    try {
      await TKFirestoreConnection.copyRules();
      onToast?.('Firestore 规则已复制', 'ok');
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : '规则复制失败', 'error');
    } finally {
      setCopyingRules(false);
    }
  }

  async function addAccount() {
    const name = newAccountName.trim();
    if (!name) return;
    if (allAccounts.includes(name)) {
      onToast?.('该账号已存在', 'error');
      return;
    }
    const nextAccounts = uniqueAccounts([...allAccounts, name]);
    setAccounts(nextAccounts);
    setActiveAccount(name);
    setNewAccountName('');
    setAccountModalOpen(false);
    setPermissionBlocked(false);
    setSyncText('账号已保存到 Firestore 本地队列…');
    setSyncTone('saving');
    notifyAccountsChanged({ action: 'upsert', account: name, accounts: nextAccounts });
    try {
      const result = await providerRef.current.upsertAccount(name, { sortIndex: nextAccounts.indexOf(name), waitForCommit: false });
      if (typeof result === 'object' && result?.commitPromise) result.commitPromise.then(() => {
        setSyncText(`已同步 · ${savedSnapshots.length} 个分析`);
        setSyncTone('saved');
        notifyAccountsChanged({ action: 'commit', account: name, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) setPermissionBlocked(true);
        setSyncText(formatAnalyticsError(error, '账号保存失败'));
        setSyncTone('error');
        if (!isPermissionDenied(error)) onToast?.(formatAnalyticsError(error, '账号保存失败'), 'error');
      });
      onToast?.('账号已添加', 'ok');
    } catch (error) {
      if (isPermissionDenied(error)) {
        handleAnalyticsSyncError(error, '账号保存失败');
        setPermissionBlocked(true);
      } else {
        onToast?.(formatAnalyticsError(error, '账号保存失败'), 'error');
      }
      setSyncText(formatAnalyticsError(error, '账号保存失败'));
      setSyncTone('error');
    }
  }

  async function reorderAccounts(nextOrder: string[]) {
    const nextAccounts = uniqueAccounts(nextOrder);
    if (!nextAccounts.length) return;
    setAccounts(nextAccounts);
    notifyAccountsChanged({ action: 'reorder', accounts: nextAccounts });
    try {
      const result = await providerRef.current.saveAccountOrder(nextAccounts, { waitForCommit: false });
      if (typeof result === 'object' && result?.commitPromise) result.commitPromise.catch(error => {
        if (isPermissionDenied(error)) setPermissionBlocked(true);
        setSyncText(formatAnalyticsError(error, '账号排序保存失败'));
        setSyncTone('error');
        if (!isPermissionDenied(error)) onToast?.(formatAnalyticsError(error, '账号排序保存失败'), 'error');
      });
    } catch (error) {
      if (isPermissionDenied(error)) {
        handleAnalyticsSyncError(error, '账号排序保存失败');
        setPermissionBlocked(true);
      } else {
        onToast?.(formatAnalyticsError(error, '账号排序保存失败'), 'error');
      }
      setSyncText(formatAnalyticsError(error, '账号排序保存失败'));
      setSyncTone('error');
    }
  }

  function openEditAccount(account: string) {
    setEditingAccountName(account);
    setEditingAccountValue(account);
    setAccountEditOpen(true);
  }

  function openDeleteAccount(account: string) {
    setDeletingAccountName(account);
    setAccountDeleteOpen(true);
  }

  async function renameAccount() {
    const oldName = editingAccountName.trim();
    const newName = editingAccountValue.trim();
    if (!oldName || !newName) return;
    if (oldName === newName) {
      setAccountEditOpen(false);
      return;
    }
    if (allAccounts.some(account => account !== oldName && account === newName)) {
      onToast?.('该账号已存在', 'error');
      return;
    }
    const nextAccounts = allAccounts.map(account => account === oldName ? newName : account);
    const nextSnapshots = savedSnapshots.map(snapshot => (
      normalizeAccountName(snapshot.accountName) === oldName ? { ...snapshot, accountName: newName } : snapshot
    ));
    setAccounts(nextAccounts);
    setSavedSnapshots(nextSnapshots);
    if (activeAccount === oldName) setActiveAccount(newName);
    setAccountEditOpen(false);
    setEditingAccountName('');
    setEditingAccountValue('');
    setPermissionBlocked(false);
    setSyncText('账号名已保存到 Firestore 本地队列…');
    setSyncTone('saving');
    notifyAccountsChanged({ action: 'rename', oldAccount: oldName, account: newName, accounts: nextAccounts });
    try {
      const result = await providerRef.current.renameAccount(oldName, newName, { accountOrder: allAccounts, waitForCommit: false });
      if (result?.commitPromise) result.commitPromise.then(() => {
        setSyncText(`已同步 · ${nextSnapshots.length} 个分析`);
        setSyncTone('saved');
        notifyAccountsChanged({ action: 'commit', account: newName, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) setPermissionBlocked(true);
        setSyncText(formatAnalyticsError(error, '账号名保存失败'));
        setSyncTone('error');
        if (!isPermissionDenied(error)) onToast?.(formatAnalyticsError(error, '账号名保存失败'), 'error');
      });
      onToast?.('账号名已更新', 'ok');
    } catch (error) {
      if (isPermissionDenied(error)) {
        handleAnalyticsSyncError(error, '账号名保存失败');
        setPermissionBlocked(true);
      } else {
        onToast?.(formatAnalyticsError(error, '账号名保存失败'), 'error');
      }
      setSyncText(formatAnalyticsError(error, '账号名保存失败'));
      setSyncTone('error');
    }
  }

  async function deleteAccount() {
    const name = deletingAccountName.trim();
    if (!name) return;
    const nextAccounts = allAccounts.filter(account => account !== name);
    setAccounts(nextAccounts);
    setActiveAccount(current => current === name ? ALL_ACCOUNTS_KEY : current);
    setAccountDeleteOpen(false);
    setDeletingAccountName('');
    setPermissionBlocked(false);
    setSyncText('账号名已删除，数据保留在全部…');
    setSyncTone('saving');
    notifyAccountsChanged({ action: 'delete', account: name, accounts: nextAccounts });
    try {
      const result = await providerRef.current.deleteAccount(name, { accountOrder: allAccounts, waitForCommit: false });
      if (result?.commitPromise) result.commitPromise.then(() => {
        setSyncText(`已同步 · ${savedSnapshots.length} 个分析`);
        setSyncTone('saved');
        notifyAccountsChanged({ action: 'commit-delete', account: name, accounts: nextAccounts });
      }).catch(error => {
        if (isPermissionDenied(error)) setPermissionBlocked(true);
        setSyncText(formatAnalyticsError(error, '账号名删除失败'));
        setSyncTone('error');
        if (!isPermissionDenied(error)) onToast?.(formatAnalyticsError(error, '账号名删除失败'), 'error');
      });
      onToast?.('账号名已删除，数据仍在全部里', 'ok');
    } catch (error) {
      if (isPermissionDenied(error)) {
        handleAnalyticsSyncError(error, '账号名删除失败');
        setPermissionBlocked(true);
      } else {
        onToast?.(formatAnalyticsError(error, '账号名删除失败'), 'error');
      }
      setSyncText(formatAnalyticsError(error, '账号名删除失败'));
      setSyncTone('error');
    }
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    const accountName = normalizeAccountName(uploadAccountDraft);
    if (!accountName) {
      onToast?.('请先选择具体账号，再导入商品流量表', 'error');
      setSyncText('请先选择具体账号，再导入商品流量表');
      setSyncTone('error');
      return;
    }
    const xlsx = getXlsx?.();
    if (!xlsx) {
      onToast?.('Excel 解析库还没有加载完成，请稍后再试。', 'error');
      return;
    }
    setMeta(`正在解析：${file.name}`);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: 'array' });
      const parsed = parser.parseRows(getSheetRows(workbook, xlsx));
      const next = analyzer.analyze(parsed.records, parsed.period);
      setAnalysis(next);
      setMeta(`${file.name} · ${next.period || '未知周期'} · ${next.records.length} 个商品`);
      const saved = await saveAnalysisToFirestore(next, file.name, accountName);
      onToast?.(saved ? '商品流量数据已生成并保存' : '商品流量数据已生成，尚未保存到数据库', saved ? 'ok' : 'error');
    } catch (error) {
      setMeta('解析失败');
      onToast?.(error instanceof Error ? error.message : 'Excel 解析失败', 'error');
    }
  }

  function openUploadAccountDialog() {
    if (!canUploadAnalysis) {
      onToast?.(allAccounts.length ? '当前不可上传商品流量表' : '请先添加账号，再导入商品流量表', 'error');
      return;
    }
    setUploadAccountDraft(defaultUploadAccountName);
    setUploadAccountOpen(true);
  }

  function confirmUploadAccount() {
    const accountName = normalizeAccountName(uploadAccountDraft);
    if (!accountName) {
      onToast?.('请选择账号', 'error');
      return;
    }
    setUploadAccountOpen(false);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  }

  return (
    <ModuleWorkspace className={analyticsShellClass} id="analytics-react-root">
        <ModuleHeader
          title="数据分析"
          description="导入 TikTok Shop 商品数据表，本地生成流量、转化、商品排行和运营诊断，分析结果保存到你的 Firestore。"
        />
        <Card className={analyticsControlCardClass}>
          <ModuleStatusBar className={statusStripClass}>
          <div className={statusStripLeftClass}>
            {connected && !permissionBlocked ? <Badge id="analytics-sync-status" className={syncStatusClass(syncTone)} data-sync-state={syncTone}>{syncText}</Badge> : null}
            <Button
              id="analytics-refresh"
              variant="plain"
              className={refreshButtonClass(loading)}
              disabled={loading}
              aria-label="刷新数据分析"
              title="刷新数据分析"
              aria-busy={loading ? 'true' : 'false'}
              onClick={() => void loadLatestAnalysis()}
            >
              <RefreshCw size={15} strokeWidth={2} aria-hidden="true" className={loading ? 'is-spinning' : ''} />
            </Button>
            <Button
              id="analytics-help"
              variant="plain"
              className={storageHelpButtonClass}
              aria-controls="analytics-help-modal"
              aria-haspopup="dialog"
              aria-label="数据分析说明"
              title="数据分析说明"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle size={14} strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>
          </ModuleStatusBar>
          {connected ? (
            <ModuleAccountTabs>
              <AccountTabsBar
            id="analytics-acc-tabs"
            activeKey={activeAccount}
            allCount={savedSnapshots.length}
            allDataAttrs={{ 'data-analytics-acc': ALL_ACCOUNTS_KEY }}
            allTabsId="analytics-acc-tabs-all"
            scrollId="analytics-acc-tabs-scroll"
            actionsId="analytics-acc-actions"
            items={accountTabItems}
            emptyText="暂无账号，点击 + 添加账号"
            addAccountButton={{ id: 'analytics-tab-add', title: '添加账号', onClick: () => setAccountModalOpen(true) }}
            onEditAccount={openEditAccount}
            onDeleteAccount={openDeleteAccount}
            onReorder={reorderAccounts}
            onChange={account => setActiveAccount(account)}
              />
            </ModuleAccountTabs>
          ) : null}
          {connected && !permissionBlocked ? (
            <ModuleToolbar className={analyticsUploadRowClass}>
            <div className={periodControlClass}>
              <Select
                id="analytics-snapshot-select"
                className={snapshotSelectClass}
                value={selectedPeriodKey}
                disabled={!scopedSnapshots.length || syncTone === 'saving'}
                title="选择周期"
                aria-label="选择数据分析周期"
                onChange={event => {
                  const key = event.currentTarget.value || ALL_PERIODS_KEY;
                  setSelectedPeriodKey(key);
                  void loadPeriodAnalysis(key, scopedSnapshots);
                }}
              >
                {scopedSnapshots.length ? (
                  <>
                    <option value={ALL_PERIODS_KEY}>全部周期 · {scopedSnapshots.length} 张表</option>
                    {scopedSnapshots.map(snapshot => (
                      <option value={snapshot.snapshotId} key={snapshot.snapshotId}>{formatPeriodOption(snapshot, activeAccount === ALL_ACCOUNTS_KEY)}</option>
                    ))}
                  </>
                ) : <option value="">暂无已保存分析</option>}
              </Select>
              <div id="analytics-file-meta" className={fileMetaClass}>{canUploadAnalysis ? meta : '先添加账号，再导入商品流量表'}</div>
            </div>
            <div className={uploadActionClass}>
              <button type="button" className={cn(filePickerClass, !canUploadAnalysis && filePickerDisabledClass)} disabled={!canUploadAnalysis} aria-disabled={!canUploadAnalysis ? 'true' : undefined} onClick={openUploadAccountDialog}>
                <span className={fileIconClass} aria-hidden="true"><Upload size={18} strokeWidth={2} /></span>
                <span>导入商品流量表</span>
              </button>
              <input ref={fileInputRef} id="analytics-file-input" className={fileInputClass} type="file" accept=".xlsx,.xls" disabled={!canUploadAnalysis} onChange={event => void handleFile(event.currentTarget.files?.[0] || null)} />
            </div>
            </ModuleToolbar>
          ) : null}
        </Card>
      <AnalyticsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      {!connected ? (
        <Card id="analytics-connect-state" className={emptyCardClass}>
          <ModuleListState
            tone="connect"
            className="py-0"
            title="连接数据库"
            description="连接你的 Firebase Firestore 后，才能导入并保存数据分析快照。"
            actions={[{ id: 'analytics-open-connection', label: '连接 Firebase', variant: 'primary', onClick: () => TKFirestoreConnection.open() }]}
          />
        </Card>
      ) : permissionBlocked ? (
        <Card id="analytics-permission-state" className={emptyCardClass}>
          <ModuleListState
            tone="permission"
            className="py-0"
            title="数据库权限不足"
            description="当前数据库权限不足，数据分析保存不可用。复制最新 Firestore 规则发布后刷新页面。"
            actions={[
              { label: '打开 Firebase Console', onClick: () => TKFirestoreConnection.openConsole() },
              { label: copyingRules ? '复制中…' : '复制 Firestore 规则', variant: 'primary', disabled: copyingRules, onClick: () => void copyFirestoreRules() }
            ]}
          />
        </Card>
      ) : !analysis ? (
        <Card id="analytics-empty" className={emptyCardClass}>
          <EmptyState
            className="py-0"
            title="等待导入商品流量 Excel"
            description="导入后会自动生成 ECharts 渠道图、商品机会散点图、Top 商品和诊断标签。"
          />
        </Card>
      ) : <AnalyticsDashboard analysis={analysis} periodMode={selectedPeriodKey === ALL_PERIODS_KEY ? 'all' : 'single'} />}
      <Dialog id="analytics-upload-account-modal" open={uploadAccountOpen} titleId="analytics-upload-account-title" onOpenChange={setUploadAccountOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogTitle id="analytics-upload-account-title">选择流量表账号</DialogTitle>
          <p className="mb-4 text-[13px] leading-[1.7] text-[var(--muted)]">
            这张商品流量表会保存到所选账号下；周期筛选会先按账号过滤，再显示该账号的全部周期或单个周期。
          </p>
          <Select id="analytics-upload-account-select" value={uploadAccountDraft} onChange={event => setUploadAccountDraft(event.currentTarget.value)}>
            {allAccounts.map(account => <option value={account} key={account}>{account}</option>)}
          </Select>
          <DialogActions>
            <Button onClick={() => setUploadAccountOpen(false)}>取消</Button>
            <Button variant="primary" onClick={confirmUploadAccount}>选择 Excel 文件</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <AddAccountDialog
        modalId="analytics-add-acc-modal"
        formId="analytics-add-acc-form"
        inputId="analytics-new-acc-input"
        open={accountModalOpen}
        value={newAccountName}
        onValueChange={setNewAccountName}
        onOpenChange={setAccountModalOpen}
        onConfirm={addAccount}
      />
      <AccountEditDialog
        modalId="analytics-edit-acc-modal"
        formId="analytics-edit-acc-form"
        inputId="analytics-edit-acc-input"
        open={accountEditOpen}
        accountName={editingAccountName}
        value={editingAccountValue}
        onValueChange={setEditingAccountValue}
        onOpenChange={setAccountEditOpen}
        onConfirm={renameAccount}
      />
      <AccountDeleteDialog
        modalId="analytics-delete-acc-modal"
        open={accountDeleteOpen}
        accountName={deletingAccountName}
        onOpenChange={setAccountDeleteOpen}
        onConfirm={deleteAccount}
      />
    </ModuleWorkspace>
  );
}

export { AnalyticsApp };
