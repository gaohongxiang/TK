import type { AnalyticsActionItem, AnalyticsActionKind, AnalyticsAnalysis, AnalyticsRecord } from './types.ts';

const ACTION_LABELS: Record<AnalyticsActionKind, string> = {
  scale: '优先放大',
  traffic: '补流量测试',
  creative: '换素材',
  conversion: '改详情/价格',
  pause: '暂停观察',
  watch: '继续观察'
};

function percentile(values: number[], ratio: number) {
  const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

function baseMetrics(record: AnalyticsRecord) {
  return {
    gmv: Number(record.gmv || 0),
    orders: Number(record.orders || 0),
    exposure: Number(record.exposureTotal || 0),
    pageViews: Number(record.pageViewsTotal || 0),
    ctr: Number(record.overallCtr || 0),
    conversion: Number(record.overallConversion || 0),
    gmvTrend: Number(record.gmvTrend || 0),
    periodCount: Number(record.periodCount || 1)
  };
}

function priorityFor(score: number, kind: AnalyticsActionKind): AnalyticsActionItem['priority'] {
  if (kind === 'scale' || score >= 90) return 'P0';
  if (score >= 62) return 'P1';
  return 'P2';
}

function buildActionForRecord(record: AnalyticsRecord, analysis: AnalyticsAnalysis, thresholds: {
  highGmv: number;
  highExposure: number;
  lowExposure: number;
  highViews: number;
  lowCtr: number;
  goodConversion: number;
}): AnalyticsActionItem {
  const metrics = baseMetrics(record);
  const name = record.name || record.id || '未命名商品';
  const trendBoost = metrics.gmvTrend > 0 ? Math.min(metrics.gmvTrend / Math.max(metrics.gmv, 1), 0.35) : 0;
  const impact = metrics.gmv + metrics.orders * Math.max(analysis.kpis.aov || 0, 1);
  const common = {
    productId: record.id,
    productName: name,
    metrics
  };

  let kind: AnalyticsActionKind = 'watch';
  let score = 20 + Math.min(metrics.exposure / Math.max(thresholds.highExposure, 1), 1) * 16;
  let reason = '数据还没有形成明确方向。';
  let action = '继续观察 1 个周期，把资源优先留给高转化或高 GMV 商品。';

  if ((metrics.gmv >= thresholds.highGmv || metrics.orders >= 8 || metrics.gmvTrend > 0) && metrics.orders > 0) {
    kind = 'scale';
    score = 88 + Math.min(impact / Math.max(analysis.kpis.totalGmv || 1, 1), 0.2) * 60 + trendBoost * 20;
    reason = `已成交 ${metrics.orders} 单，GMV ${Math.round(metrics.gmv).toLocaleString('ja-JP')} 円，具备继续放大的信号。`;
    action = '优先补库存和素材，追加 2-3 条短视频/商品卡素材，配合小额券或限时价放大成交。';
  } else if (metrics.orders > 0 && metrics.exposure <= thresholds.lowExposure) {
    kind = 'traffic';
    score = 74 + Math.min(metrics.orders / 8, 1) * 12;
    reason = `已有 ${metrics.orders} 单，但曝光只有 ${Math.round(metrics.exposure).toLocaleString('ja-JP')}，不是承接问题。`;
    action = '补 2 条短视频和 1 组商品卡素材，先拉曝光测试，不急着改价格。';
  } else if (metrics.exposure >= thresholds.highExposure && metrics.ctr < thresholds.lowCtr) {
    kind = 'creative';
    score = 70 + Math.min(metrics.exposure / Math.max(thresholds.highExposure * 2, 1), 1) * 18;
    reason = `曝光足够但点击率只有 ${(metrics.ctr * 100).toFixed(2)}%，首图/标题/视频前三秒吸引力不足。`;
    action = '先换主图和标题关键词，再测视频前三秒卖点；不要先加预算。';
  } else if (metrics.pageViews >= thresholds.highViews || (metrics.ctr >= thresholds.lowCtr && metrics.orders === 0 && metrics.exposure > thresholds.lowExposure)) {
    kind = 'conversion';
    score = 66 + Math.min((metrics.pageViews || 0) / Math.max(thresholds.highViews * 2, 1), 1) * 18;
    reason = `有点击/浏览但没有形成订单，转化率 ${(metrics.conversion * 100).toFixed(2)}%。`;
    action = '检查价格、评价、详情页首屏、规格和优惠券；优先做承接优化。';
  } else if (metrics.orders === 0 && metrics.exposure <= thresholds.lowExposure && metrics.periodCount >= 2) {
    kind = 'pause';
    score = 58 + Math.min(metrics.periodCount / 4, 1) * 18;
    reason = `连续 ${metrics.periodCount} 个周期没有订单，且曝光弱。`;
    action = '最多再补一次素材测试；仍不起量就暂停上新资源或下架替换。';
  } else if (metrics.orders === 0 && metrics.gmvTrend < 0) {
    kind = 'pause';
    score = 55;
    reason = '多周期趋势转弱且没有订单贡献。';
    action = '减少资源占用，除非有明确季节性或供应链优势，否则进入替换候选。';
  } else if (metrics.conversion >= thresholds.goodConversion && metrics.exposure < thresholds.highExposure) {
    kind = 'traffic';
    score = 64 + Math.min(metrics.conversion / Math.max(thresholds.goodConversion * 2, 0.01), 1) * 12;
    reason = `转化率 ${(metrics.conversion * 100).toFixed(2)}%，但曝光还没打满。`;
    action = '小步加曝光，观察 GMV 是否同步放大。';
  }

  return {
    ...common,
    kind,
    priority: priorityFor(score, kind),
    title: ACTION_LABELS[kind],
    reason,
    action,
    score
  };
}

function buildActionPlan(analysis: AnalyticsAnalysis, limit = 6): AnalyticsActionItem[] {
  const activeRecords = analysis.records.filter(record => record.status !== 'Inactive');
  const gmvValues = activeRecords.map(record => Number(record.gmv || 0));
  const exposureValues = activeRecords.map(record => Number(record.exposureTotal || 0));
  const viewValues = activeRecords.map(record => Number(record.pageViewsTotal || 0));
  const conversionValues = activeRecords.map(record => Number(record.overallConversion || 0)).filter(value => value > 0);
  const thresholds = {
    highGmv: Math.max(5000, percentile(gmvValues, 0.82), analysis.kpis.totalGmv * 0.08),
    highExposure: Math.max(1500, percentile(exposureValues, 0.75)),
    lowExposure: Math.max(120, percentile(exposureValues, 0.25)),
    highViews: Math.max(80, percentile(viewValues, 0.75)),
    lowCtr: Math.max(0.012, Math.min(0.025, analysis.kpis.totalExposure ? activeRecords.reduce((total, record) => total + record.pageViewsTotal, 0) / analysis.kpis.totalExposure * 0.72 : 0.018)),
    goodConversion: Math.max(0.05, percentile(conversionValues, 0.6))
  };
  return activeRecords
    .map(record => buildActionForRecord(record, analysis, thresholds))
    .sort((left, right) => right.score - left.score || right.metrics.gmv - left.metrics.gmv || right.metrics.orders - left.metrics.orders)
    .slice(0, limit);
}

export {
  buildActionPlan
};
