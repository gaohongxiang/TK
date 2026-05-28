import { aggregateAnalyses, type AnalyticsSnapshotForAggregation } from './aggregate.ts';
import { buildActionPlan } from './action-plan.ts';
import type { AnalyticsAnalysis } from './types.ts';

const ANALYTICS_ALL_ACCOUNTS_KEY = '__all__';

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatPercent(value: number, digits = 2) {
  return `${((Number(value) || 0) * 100).toFixed(digits)}%`;
}

function getAnalysisActions(analysis: AnalyticsAnalysis) {
  return analysis.actionPlan?.length ? analysis.actionPlan : buildActionPlan(analysis);
}

function buildAnalyticsExportCsv(analysis: AnalyticsAnalysis, { includeBom = true } = {}) {
  const actionsByProduct = new Map(
    getAnalysisActions(analysis).map(item => [item.productId || item.productName, item])
  );
  const headers = [
    '周期',
    '商品ID',
    '商品名称',
    '状态',
    'GMV',
    '订单',
    '件数',
    '总曝光',
    '总浏览',
    '成交客户',
    '点击率',
    '转化率',
    '覆盖周期数',
    '最近周期',
    'GMV趋势',
    '诊断',
    '动作优先级',
    '动作类型',
    '动作建议'
  ];
  const rows = analysis.records.map(record => {
    const action = actionsByProduct.get(record.id || record.name);
    return [
      analysis.period,
      record.id,
      record.name,
      record.status,
      record.gmv,
      record.orders,
      record.units,
      record.exposureTotal,
      record.pageViewsTotal,
      record.customersTotal,
      formatPercent(record.overallCtr),
      formatPercent(record.overallConversion),
      record.periodCount || 1,
      record.latestPeriod || analysis.period,
      record.gmvTrend ?? '',
      record.diagnosis.label,
      action?.priority || '',
      action?.title || '',
      action?.action || ''
    ];
  });
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
  return includeBom ? `\uFEFF${csv}` : csv;
}

function buildAnalyticsExportFilename(analysis: AnalyticsAnalysis, activeAccount: string) {
  const account = activeAccount === ANALYTICS_ALL_ACCOUNTS_KEY ? '全部账号' : activeAccount;
  const period = String(analysis.period || '数据分析').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '');
  return `数据分析_${account}_${period}.csv`;
}

function aggregateAnalyticsSnapshots(snapshots: AnalyticsSnapshotForAggregation[]) {
  return aggregateAnalyses(snapshots);
}

export {
  ANALYTICS_ALL_ACCOUNTS_KEY,
  aggregateAnalyticsSnapshots,
  buildAnalyticsExportCsv,
  buildAnalyticsExportFilename,
  csvEscape,
  formatPercent,
  getAnalysisActions
};
