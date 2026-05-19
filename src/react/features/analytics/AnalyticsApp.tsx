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
import { PageHero } from '@/components/ui/page-hero';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, TableViewport } from '@/components/ui/table-tools';
import { ModuleListState } from '@/components/ui/module-list-state';
import { AccountTabsBar } from '@/components/ui/account-tabs-bar';
import { refreshButtonClass, statusStripClass, statusStripLeftClass, storageHelpButtonClass, syncStatusClass } from '@/components/ui/status-strip';
import type { AnalyticsAnalysis, AnalyticsAnalyzer, AnalyticsFunnelStage, AnalyticsParser, AnalyticsRecord, AnalyticsXlsx } from '../../../analytics/types';
import { AnalyticsProviderFirestore, type AnalyticsProviderSnapshotSummary } from '../../../analytics/provider-firestore.ts';
import { TKFirestoreConnection } from '../../../firestore-connection.ts';
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
  const { className, option, optionKey } = props;
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return undefined;
    const tick = window.setTimeout(() => chart.resize(), 0);
    return () => window.clearTimeout(tick);
  }, [optionKey, option]);
  return (
    <div className={className}>
      <ReactEChartsCore
        echarts={echarts}
        className="h-full w-full"
        option={option}
        onChartReady={chart => {
          chartRef.current = chart;
          window.setTimeout(() => chart.resize(), 0);
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
const analyticsUploadRowClass = 'analytics-upload-card analytics-react-upload-card grid grid-cols-[minmax(0,1fr)_minmax(240px,320px)] items-center gap-3.5 max-[860px]:grid-cols-1 max-[640px]:gap-3';
const uploadSummaryClass = 'analytics-upload-summary flex min-w-0 flex-wrap items-center gap-2.5';
const uploadCopyTitleClass = 'mb-0 mr-1 text-[13px] font-semibold uppercase tracking-[.3px] text-[var(--muted)]';
const uploadToolsClass = 'analytics-upload-tools ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 max-[860px]:ml-0 max-[860px]:justify-start max-[640px]:w-full';
const analyticsChipClass = 'analytics-chip inline-flex min-h-[26px] items-center whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--panel2)_80%,transparent)] px-2.5 text-xs font-semibold text-[var(--muted)]';
const privacyPrimaryChipClass = cn(analyticsChipClass, 'border-[color-mix(in_srgb,var(--accent2)_42%,var(--border))] bg-[color-mix(in_srgb,var(--accent2)_13%,var(--panel))] text-[color-mix(in_srgb,var(--accent2)_72%,var(--text))]');
const uploadActionClass = 'analytics-upload-action relative grid min-w-0 gap-1.5 max-[640px]:w-full';
const filePickerClass = 'analytics-file-picker inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-[9px] rounded-xl border border-[color-mix(in_srgb,var(--accent)_54%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_13%,var(--panel))] px-4 text-[13px] font-bold text-[color-mix(in_srgb,var(--accent)_76%,white)] transition-[transform,border-color,background-color] hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--accent)_72%,white)] hover:bg-[color-mix(in_srgb,var(--accent)_18%,var(--panel))]';
const fileIconClass = 'analytics-file-icon inline-flex h-[18px] w-[18px] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:fill-none [&_svg]:stroke-current';
const fileInputClass = 'pointer-events-none absolute h-px w-px overflow-hidden opacity-0';
const fileMetaClass = 'analytics-file-meta min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-center text-xs text-[var(--muted)]';
const snapshotSelectClass = 'analytics-snapshot-select h-8 min-h-8 w-[240px] max-w-full rounded-full bg-[rgba(255,255,255,.035)] py-1 pl-3 pr-8 text-xs max-[640px]:w-full';
const emptyCardClass = 'analytics-empty analytics-react-empty grid min-h-[180px] place-items-center border-dashed bg-[color-mix(in_srgb,var(--panel2)_38%,transparent)]';
const analyticsMainClass = 'analytics-main analytics-react-main grid gap-4';
const kpiGridClass = 'analytics-kpi-grid grid grid-cols-4 gap-3 max-[860px]:grid-cols-2 max-[640px]:grid-cols-1';
const kpiCardClass = 'analytics-kpi-card min-h-28 rounded-xl border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel)_94%,white),var(--panel))] px-4 pb-3.5 pt-4 shadow-[0_12px_26px_rgba(0,0,0,.10)]';
const kpiLabelClass = 'analytics-kpi-label text-[11.5px] font-bold uppercase tracking-[.08em] text-[var(--muted)]';
const kpiValueClass = 'analytics-kpi-value mt-[9px] text-[clamp(20px,2.1vw,25px)] font-bold leading-[1.12] text-[var(--text)]';
const kpiMetaClass = 'analytics-kpi-meta mt-2 text-xs text-[var(--muted)]';
const analyticsInsightLayoutClass = 'analytics-insight-layout analytics-react-insight-layout grid grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] gap-4 max-[860px]:grid-cols-1';
const analyticsLayoutClass = 'analytics-layout grid grid-cols-2 gap-4 max-[860px]:grid-cols-1';
const analyticsCardClass = 'analytics-chart-card min-w-0';
const analyticsTableCardClass = 'analytics-table-card min-w-0';
const sectionHeadClass = 'analytics-section-head mb-3.5 flex items-center justify-between gap-3 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-2';
const mutedChipClass = cn(analyticsChipClass, 'muted');
const chartSlotClass = 'analytics-react-chart min-w-0 [&_.echarts-for-react]:h-full [&_.echarts-for-react]:w-full';
const overviewChartWrapClass = 'analytics-react-overview-chart min-w-0';
const overviewChartClass = cn(chartSlotClass, 'analytics-react-overview h-[332px] rounded-xl border border-[color-mix(in_srgb,var(--border)_72%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel2)_32%,transparent),transparent),color-mix(in_srgb,var(--panel2)_18%,transparent)] px-1.5 pb-1 pt-2.5 max-[640px]:h-[250px]');
const funnelSummaryClass = 'analytics-react-funnel-summary mt-2.5 grid grid-cols-4 gap-2 max-[860px]:grid-cols-2 max-[640px]:grid-cols-1';
const funnelStepClass = 'analytics-react-funnel-step grid min-w-0 grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-[7px] rounded-[9px] border border-[color-mix(in_srgb,var(--border)_72%,transparent)] bg-[color-mix(in_srgb,var(--panel2)_30%,transparent)] px-2.5 py-[9px]';
const funnelDotClass = 'analytics-react-funnel-dot h-2 w-2 rounded-full bg-[var(--funnel-color)]';
const funnelTextWrapClass = 'grid min-w-0 gap-0.5';
const funnelLabelClass = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold not-italic text-[var(--text)]';
const funnelValueClass = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] font-bold text-[var(--muted)]';
const funnelRateClass = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-bold not-italic text-[color-mix(in_srgb,var(--accent2)_74%,var(--text))]';
const scatterWrapClass = 'analytics-react-scatter-wrap min-h-[324px] max-[640px]:min-h-[260px]';
const scatterChartClass = cn(chartSlotClass, 'analytics-react-scatter h-[324px] rounded-xl border border-[color-mix(in_srgb,var(--border)_72%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel2)_32%,transparent),transparent),color-mix(in_srgb,var(--panel2)_18%,transparent)] max-[640px]:h-[260px] max-[640px]:min-h-[220px]');
const scatterLegendClass = 'analytics-react-legend mt-2.5 flex flex-wrap gap-2';
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
const diagnosticsClass = 'analytics-diagnostics grid gap-3';
const diagnosisHeadClass = 'analytics-diagnosis-head flex items-center justify-between gap-3';
const diagnosisTitleClass = 'text-[13px] font-bold text-[var(--text)]';
const diagnosisCountClass = 'text-[13px] text-[var(--muted)]';
const diagnosisCopyClass = 'm-0 text-xs leading-[1.55] text-[var(--muted)]';
const diagnosisProductsClass = 'analytics-diagnosis-products flex flex-wrap gap-1.5';
const diagnosisProductPillClass = 'inline-flex min-h-6 max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-[7px] bg-[color-mix(in_srgb,var(--panel)_76%,transparent)] px-2 text-[11.5px] text-[color-mix(in_srgb,var(--text)_78%,var(--muted))]';
const tableWrapClass = 'analytics-table-wrap max-h-[620px] overflow-auto';
const detailTableClass = 'analytics-detail-table mt-1.5 w-full border-collapse text-sm max-[640px]:text-[13px]';
const detailHeadClass = 'px-2.5 py-[11px] text-[11.5px] max-[640px]:px-1.5 max-[640px]:py-[9px] max-[640px]:text-[10.5px]';
const detailFirstHeadClass = cn(detailHeadClass, 'min-w-[260px] text-left max-[640px]:min-w-[220px]');
const detailNumericHeadClass = cn(detailHeadClass, 'whitespace-nowrap text-right');
const detailCellClass = 'px-2.5 py-[11px] align-middle max-[640px]:px-1.5 max-[640px]:py-[9px]';
const detailFirstCellClass = cn(detailCellClass, 'min-w-[260px] text-left max-[640px]:min-w-[220px]');
const detailNumericCellClass = cn(detailCellClass, 'whitespace-nowrap text-right');
const productNameClass = 'analytics-product-name max-w-[520px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--text)]';
const productIdClass = 'analytics-product-id mt-[3px] text-[11.5px] text-[var(--muted)]';

function diagnosisCardClass(tone: string) {
  const toneClass = {
    hero: 'border-l-[#13c2a3]',
    scale: 'border-l-[#3b82f6]',
    creative: 'border-l-[#f59e0b]',
    detail: 'border-l-[#ef476f]',
    watch: 'border-l-[#8b93c2]',
    normal: 'border-l-[color-mix(in_srgb,var(--accent)_64%,var(--border))]'
  }[tone] || 'border-l-[color-mix(in_srgb,var(--accent)_64%,var(--border))]';
  return cn('analytics-diagnosis-card grid gap-[7px] rounded-[10px] border-l-[3px] bg-[color-mix(in_srgb,var(--panel2)_48%,transparent)] px-3 py-[11px]', `is-${tone}`, toneClass);
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

function formatSnapshotOption(snapshot: AnalyticsProviderSnapshotSummary) {
  const period = snapshot.period || '未知周期';
  const name = snapshot.filename || '已保存分析';
  return `${period} · ${name} · ${snapshot.recordCount} 个商品`;
}

function filterSnapshotsByAccount(snapshots: AnalyticsProviderSnapshotSummary[], activeAccount: string) {
  if (activeAccount === '__all__') return snapshots;
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

function DiagnosisCards({ records }: { records: AnalyticsRecord[] }) {
  const groups = records.reduce<Record<string, AnalyticsRecord[]>>((acc, record) => {
    const key = record.diagnosis.tone;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});
  const priority = ['hero', 'scale', 'creative', 'detail', 'watch', 'normal'];
  return (
    <div id="analytics-diagnostics" className={diagnosticsClass}>
      {priority.filter(key => groups[key]?.length).map(key => {
        const sample = groups[key].slice(0, 2);
        const first = sample[0];
        return (
          <div className={diagnosisCardClass(key)} key={key}>
            <div className={diagnosisHeadClass}>
              <span className={diagnosisTitleClass}>{first.diagnosis.label}</span>
              <strong className={diagnosisCountClass}>{groups[key].length}</strong>
            </div>
            <p className={diagnosisCopyClass}>{first.diagnosis.action}</p>
            <div className={diagnosisProductsClass}>
              {sample.map(record => <span className={diagnosisProductPillClass} key={record.id || record.name} title={record.name}>{shortenText(record.name, 24)}</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailTable({ records }: { records: AnalyticsRecord[] }) {
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
          <HelpItem label="导入">选择 TikTok Shop 导出的商品流量详情 Excel。原始 Excel 只在浏览器本地解析，不上传到本站服务器。</HelpItem>
          <HelpItem label="保存">解析后的分析快照和商品明细会保存到你自己的 Firestore。刷新页面后会自动恢复最近一次分析。</HelpItem>
          <HelpItem label="多周数据">每次导入都会生成一个新的分析快照。顶部下拉框可以切换以前导入过的周期。</HelpItem>
          <HelpItem label="权限">如果 Firestore 规则没有发布到最新版本，页面会弹出统一规则提示，可直接复制最新规则。</HelpItem>
        </HelpStack>
        <DialogActions>
          <Button variant="primary" onClick={() => onOpenChange(false)}>知道了</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

function AnalyticsDashboard({ analysis }: { analysis: AnalyticsAnalysis }) {
  const funnelStages = buildFunnelStages(analysis);
  const chartKey = `${analysis.period}|${analysis.records.length}|${analysis.kpis.totalGmv}|${analysis.kpis.totalExposure}`;
  return (
    <section className={analyticsMainClass} data-react-analytics-ready="true">
      <KpiGrid analysis={analysis} />
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
        <Card className={analyticsCardClass}>
          <div className={sectionHeadClass}>
            <CardTitle className="mb-0">Top 商品 GMV</CardTitle>
            <Badge className={mutedChipClass}>前 10</Badge>
          </div>
          <TopProducts records={analysis.records} />
        </Card>
        <Card className={analyticsCardClass}>
          <div className={sectionHeadClass}>
            <CardTitle className="mb-0">商品诊断</CardTitle>
            <Badge className={mutedChipClass}>运营动作</Badge>
          </div>
          <DiagnosisCards records={analysis.records} />
        </Card>
      </div>
      <Card className={analyticsTableCardClass}>
        <div className={sectionHeadClass}>
          <CardTitle className="mb-0">商品明细</CardTitle>
          <Badge className={mutedChipClass}>{analysis.records.length} 个商品 · 滚动查看全部</Badge>
        </div>
        <TableViewport className={tableWrapClass}>
          <DetailTable records={analysis.records} />
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
  const [activeAccount, setActiveAccount] = useState('__all__');
  const [savedSnapshots, setSavedSnapshots] = useState<AnalyticsProviderSnapshotSummary[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const providerRef = useRef(AnalyticsProviderFirestore.create({
    state: {},
    helpers: { nowIso: () => new Date().toISOString() }
  }));
  const scopedSnapshots = useMemo(() => filterSnapshotsByAccount(savedSnapshots, activeAccount), [activeAccount, savedSnapshots]);
  const accountTabItems = useMemo(() => accounts.map(account => ({
    key: account,
    label: account,
    count: savedSnapshots.filter(snapshot => normalizeAccountName(snapshot.accountName) === account).length,
    dataAttrs: { 'data-analytics-acc': account }
  })), [accounts, savedSnapshots]);
  const connected = !!projectId;
  const loading = syncTone === 'saving';

  const loadSnapshot = useCallback(async (snapshotId: string) => {
    const cfg = TKFirestoreConnection.getConfig();
    const id = String(snapshotId || '').trim();
    if (!cfg?.configText || !id) return false;
    setSyncText('正在恢复已保存的数据分析…');
    setSyncTone('saving');
    try {
      const next = await providerRef.current.init({ firestoreConfigText: cfg.configText });
      setProjectId(next.projectId);
      const snapshot = await providerRef.current.pullAnalysisBySnapshot(id);
      if (!snapshot) {
        setAnalysis(null);
        setSyncText('没有找到这个分析快照');
        setSyncTone('error');
        return false;
      }
      setAnalysis(snapshot.analysis);
      setPermissionBlocked(false);
      setMeta(`${snapshot.filename || '已保存分析'} · ${snapshot.analysis.period || '未知周期'} · ${snapshot.analysis.records.length} 个商品`);
      setSelectedSnapshotId(snapshot.snapshotId);
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
  }, []);

  const loadLatestAnalysis = useCallback(async () => {
    const cfg = TKFirestoreConnection.getConfig();
    if (!cfg?.configText) {
      setProjectId('');
      setSyncText('未连接');
      setSyncTone('local');
      setPermissionBlocked(false);
      setAccounts([]);
      setAnalysis(null);
      setSavedSnapshots([]);
      setSelectedSnapshotId('');
      return false;
    }
    setSyncText('正在读取最近一次数据分析…');
    setSyncTone('saving');
    try {
      const next = await providerRef.current.init({ firestoreConfigText: cfg.configText });
      setProjectId(next.projectId);
      const remoteAccounts = await providerRef.current.pullAccounts();
      let snapshotsPermissionBlocked = false;
      const snapshots = await providerRef.current.listSavedAnalyses().catch(error => {
        if (isPermissionDenied(error)) {
          snapshotsPermissionBlocked = true;
          return [] as AnalyticsProviderSnapshotSummary[];
        }
        throw error;
      });
      const snapshotAccounts = snapshots.map(snapshot => snapshot.accountName);
      const nextAccounts = uniqueAccounts([...remoteAccounts, ...snapshotAccounts]);
      setAccounts(nextAccounts);
      const resolvedActiveAccount = activeAccount === '__all__' || nextAccounts.includes(activeAccount) ? activeAccount : '__all__';
      if (resolvedActiveAccount !== activeAccount) setActiveAccount(resolvedActiveAccount);
      setSavedSnapshots(snapshots);
      if (snapshotsPermissionBlocked) {
        setAnalysis(null);
        setSelectedSnapshotId('');
        setPermissionBlocked(true);
        setSyncText('');
        setSyncTone('error');
        return false;
      }
      const visibleSnapshots = filterSnapshotsByAccount(snapshots, resolvedActiveAccount);
      if (!visibleSnapshots.length) {
        setAnalysis(null);
        setSelectedSnapshotId('');
        setPermissionBlocked(false);
        setSyncText('尚未保存分析');
        setSyncTone('saved');
        return true;
      }
      const latest = await providerRef.current.pullAnalysisBySnapshot(visibleSnapshots[0].snapshotId);
      if (!latest) {
        setAnalysis(null);
        setSyncText('没有找到最近一次分析快照');
        setSyncTone('error');
        return false;
      }
      setAnalysis(latest.analysis);
      setPermissionBlocked(false);
      setMeta(`${latest.filename || '已保存分析'} · ${latest.analysis.period || '未知周期'} · ${latest.analysis.records.length} 个商品`);
      setSelectedSnapshotId(latest.snapshotId);
      setSyncText(`已恢复最近分析 · ${latest.updatedAt.slice(0, 10)}`);
      setSyncTone('saved');
      return true;
    } catch (error) {
      handleAnalyticsSyncError(error);
      if (isPermissionDenied(error)) {
        setPermissionBlocked(true);
        setAnalysis(null);
        setSelectedSnapshotId('');
        setSyncText('');
      } else {
        setSyncText(formatAnalyticsError(error));
      }
      setSyncTone('error');
      return false;
    }
  }, [activeAccount]);

  useEffect(() => {
    void loadLatestAnalysis();
    const handler = () => void loadLatestAnalysis();
    window.addEventListener('tk-firestore-config-changed', handler);
    return () => window.removeEventListener('tk-firestore-config-changed', handler);
  }, [loadLatestAnalysis]);

  async function saveAnalysisToFirestore(next: AnalyticsAnalysis, filename: string) {
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
      const accountName = activeAccount !== '__all__' ? activeAccount : accounts[0] || '';
      const result = await providerRef.current.saveAnalysis(next, { accountName, filename });
      setSyncText(`已保存到 Firestore · ${result.recordCount} 个商品`);
      setSyncTone('saved');
      setPermissionBlocked(false);
      const snapshots = await providerRef.current.listSavedAnalyses();
      if (accountName) setAccounts(previous => uniqueAccounts([...previous, accountName]));
      setSavedSnapshots(snapshots);
      setSelectedSnapshotId(result.snapshotId);
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
    if (activeAccount === '__all__' || accounts.includes(activeAccount)) return;
    setActiveAccount('__all__');
  }, [accounts, activeAccount]);

  useEffect(() => {
    if (permissionBlocked) return;
    const nextSnapshot = scopedSnapshots[0];
    if (!nextSnapshot) {
      setAnalysis(null);
      setSelectedSnapshotId('');
      setSyncText(projectId ? '尚未保存分析' : '未连接');
      setSyncTone(projectId ? 'saved' : 'local');
      return;
    }
    if (nextSnapshot.snapshotId !== selectedSnapshotId) void loadSnapshot(nextSnapshot.snapshotId);
  }, [activeAccount, loadSnapshot, permissionBlocked, projectId, scopedSnapshots, selectedSnapshotId]);

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

  async function handleFile(file: File | null) {
    if (!file) return;
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
      const saved = await saveAnalysisToFirestore(next, file.name);
      onToast?.(saved ? '商品流量数据已生成并保存' : '商品流量数据已生成，尚未保存到数据库', saved ? 'ok' : 'error');
    } catch (error) {
      setMeta('解析失败');
      onToast?.(error instanceof Error ? error.message : 'Excel 解析失败', 'error');
    }
  }

  return (
    <div className={analyticsShellClass} id="analytics-react-root">
      <PageHero
        variant="analytics"
        title="数据分析"
        kicker="Excel 导入 / 流量诊断 / 商品动作"
        description="本地解析 TikTok Shop 商品流量导出表，生成渠道表现、商品排行和运营诊断；数据不上传到本站服务器。"
      />
      <Card className={analyticsControlCardClass}>
        <div className={statusStripClass}>
          <div className={statusStripLeftClass}>
            <Badge id="analytics-user" className="min-h-[30px] text-[var(--text)] font-semibold">{projectId ? `已连接 · ${projectId}` : '未连接 Firebase'}</Badge>
            {permissionBlocked ? null : <Badge id="analytics-sync-status" className={syncStatusClass(syncTone)} data-sync-state={syncTone}>{syncText}</Badge>}
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
        </div>
        {connected ? (
          <AccountTabsBar
            id="analytics-acc-tabs"
            activeKey={activeAccount}
            allCount={savedSnapshots.length}
            allDataAttrs={{ 'data-analytics-acc': '__all__' }}
            allTabsId="analytics-acc-tabs-all"
            scrollId="analytics-acc-tabs-scroll"
            actionsId="analytics-acc-actions"
            items={accountTabItems}
            emptyText="暂无账号"
            onChange={account => setActiveAccount(account)}
          />
        ) : null}
        {connected && !permissionBlocked ? (
          <div className={analyticsUploadRowClass}>
            <div className={uploadSummaryClass}>
              <CardTitle className={uploadCopyTitleClass}>导入商品流量表</CardTitle>
              <span className={privacyPrimaryChipClass}>本地解析</span>
              <span className={analyticsChipClass}>原始 Excel 不上传</span>
              <div className={uploadToolsClass}>
                <Select
                  id="analytics-snapshot-select"
                  className={snapshotSelectClass}
                  value={selectedSnapshotId}
                  disabled={!scopedSnapshots.length || syncTone === 'saving'}
                  title="选择已保存的数据分析"
                  onChange={event => void loadSnapshot(event.currentTarget.value)}
                >
                  {scopedSnapshots.length ? (
                    scopedSnapshots.map(snapshot => (
                      <option value={snapshot.snapshotId} key={snapshot.snapshotId}>{formatSnapshotOption(snapshot)}</option>
                    ))
                  ) : <option value="">暂无已保存分析</option>}
                </Select>
              </div>
            </div>
            <div className={uploadActionClass}>
              <label className={filePickerClass} htmlFor="analytics-file-input">
                <span className={fileIconClass} aria-hidden="true"><Upload size={18} strokeWidth={2} /></span>
                <span>选择 Excel 文件</span>
              </label>
              <input id="analytics-file-input" className={fileInputClass} type="file" accept=".xlsx,.xls" onChange={event => void handleFile(event.target.files?.[0] || null)} />
              <div id="analytics-file-meta" className={fileMetaClass}>{meta}</div>
            </div>
          </div>
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
      ) : <AnalyticsDashboard analysis={analysis} />}
    </div>
  );
}

export { AnalyticsApp };
