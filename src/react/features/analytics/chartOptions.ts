import type { EChartsCoreOption } from 'echarts/core';
import type { AnalyticsAnalysis, AnalyticsChannel, AnalyticsFunnelStage, AnalyticsRecord } from '../../../analytics/types';
import { formatInteger, formatPercent, formatYen, shortenText } from './format';

const CHANNEL_COLORS: Record<string, string> = {
  mall: '#3b82f6',
  video: '#13c2a3',
  productCard: '#f59e0b',
  live: '#ef476f'
};

const DIAGNOSIS_COLORS: Record<string, string> = {
  hero: '#13c2a3',
  scale: '#3b82f6',
  creative: '#f59e0b',
  detail: '#ef476f',
  watch: '#8b93c2',
  normal: '#6ea8ff'
};

const FUNNEL_COLORS: Record<AnalyticsFunnelStage['key'], string> = {
  exposure: '#3b82f6',
  pageViews: '#13c2a3',
  customers: '#f59e0b',
  units: '#ef476f'
};

function sharedTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e7ecff';
}

function sharedMutedColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#8b93c2';
}

function buildDonutOption({
  title,
  channels,
  metric,
  formatter
}: {
  title: string;
  channels: AnalyticsChannel[];
  metric: 'gmv' | 'units';
  formatter: (value: number) => string;
}): EChartsCoreOption {
  const data = channels.map(channel => ({
    name: channel.label,
    value: channel[metric],
    itemStyle: { color: CHANNEL_COLORS[channel.key] || '#8b93c2' }
  }));
  return {
    color: channels.map(channel => CHANNEL_COLORS[channel.key] || '#8b93c2'),
    title: {
      text: title,
      left: 'center',
      top: 2,
      textStyle: { color: sharedTextColor(), fontSize: 13, fontWeight: 700 }
    },
    tooltip: {
      trigger: 'item',
      formatter: params => {
        const item = Array.isArray(params) ? params[0] : params;
        return `${item.name}<br/>${formatter(Number(item.value) || 0)} · ${item.percent}%`;
      }
    },
    legend: {
      show: false
    },
    series: [
      {
        type: 'pie',
        radius: ['48%', '70%'],
        center: ['50%', '48%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        data
      }
    ]
  };
}

function buildFunnelStages(analysis: AnalyticsAnalysis): AnalyticsFunnelStage[] {
  const exposure = analysis.kpis.totalExposure;
  const pageViews = analysis.records.reduce((total, record) => total + record.pageViewsTotal, 0);
  const customers = analysis.records.reduce((total, record) => total + record.customersTotal, 0);
  const units = analysis.kpis.totalUnits;
  const rows = [
    { key: 'exposure', label: '曝光', value: exposure, caption: '进入商品流量池' },
    { key: 'pageViews', label: '浏览', value: pageViews, caption: '点击进入详情页' },
    { key: 'customers', label: '成交客户', value: customers, caption: '产生购买意向' },
    { key: 'units', label: '成交件数', value: units, caption: '最终成交结果' }
  ] as const;
  return rows.map((row, index) => {
    const previous = index === 0 ? row.value : rows[index - 1].value;
    return {
      ...row,
      color: FUNNEL_COLORS[row.key],
      rateFromPrevious: previous ? row.value / previous : 0,
      rateFromExposure: exposure ? row.value / exposure : 0
    };
  });
}

function buildOverviewOption(analysis: AnalyticsAnalysis): EChartsCoreOption {
  const funnelStages = buildFunnelStages(analysis);
  const channelData = analysis.channelTotals
    .filter(channel => channel.gmv > 0 || channel.units > 0 || channel.exposure > 0)
    .map(channel => ({
      name: channel.label,
      value: channel.gmv,
      itemStyle: { color: CHANNEL_COLORS[channel.key] || '#8b93c2' },
      channel
    }));
  const diagnosisTotals = Object.entries(analysis.records.reduce<Record<string, { label: string; tone: string; count: number; gmv: number }>>((acc, record) => {
    const key = record.diagnosis.tone;
    if (!acc[key]) acc[key] = { label: record.diagnosis.label, tone: key, count: 0, gmv: 0 };
    acc[key].count += 1;
    acc[key].gmv += record.gmv;
    return acc;
  }, {})).map(([key, row]) => ({
    name: row.label,
    value: row.gmv || row.count,
    itemStyle: { color: DIAGNOSIS_COLORS[key] || DIAGNOSIS_COLORS.normal },
    diagnosis: row
  }));
  const leftTitle = channelData.length ? 'GMV 渠道' : '诊断分布';
  const leftData = channelData.length ? channelData : diagnosisTotals;
  const funnelData = funnelStages.map(stage => ({
    name: stage.label,
    value: stage.value,
    itemStyle: { color: stage.color },
    stage
  }));
  return {
    color: [...(channelData.length ? analysis.channelTotals.map(channel => CHANNEL_COLORS[channel.key] || '#8b93c2') : diagnosisTotals.map(item => item.itemStyle.color)), ...funnelStages.map(stage => stage.color)],
    title: [
      {
        text: leftTitle,
        left: '21%',
        top: 4,
        textAlign: 'center',
        textStyle: { color: sharedTextColor(), fontSize: 13, fontWeight: 800 }
      },
      {
        text: '流量漏斗',
        left: '70%',
        top: 4,
        textAlign: 'center',
        textStyle: { color: sharedTextColor(), fontSize: 13, fontWeight: 800 }
      }
    ],
    tooltip: {
      trigger: 'item',
      formatter: params => {
        const data = params.data as { channel?: AnalyticsChannel; diagnosis?: { label: string; count: number; gmv: number }; stage?: AnalyticsFunnelStage };
        if (data.channel) {
          return [
            `<strong>${data.channel.label}</strong>`,
            `GMV：${formatYen(data.channel.gmv)}`,
            `成交件数：${formatInteger(data.channel.units)} 件`,
            `点击率：${formatPercent(data.channel.ctr)}`,
            `转化率：${formatPercent(data.channel.conversion)}`
          ].join('<br/>');
        }
        if (data.diagnosis) {
          return [
            `<strong>${data.diagnosis.label}</strong>`,
            `商品数：${formatInteger(data.diagnosis.count)}`,
            `GMV：${formatYen(data.diagnosis.gmv)}`
          ].join('<br/>');
        }
        if (data.stage) {
          return [
            `<strong>${data.stage.label}</strong>`,
            `数量：${formatInteger(data.stage.value)}`,
            `较上一层：${data.stage.key === 'exposure' ? '100.00%' : formatPercent(data.stage.rateFromPrevious)}`,
            `占曝光：${formatPercent(data.stage.rateFromExposure)}`
          ].join('<br/>');
        }
        return '';
      }
    },
    legend: {
      show: false
    },
    series: [
      {
        type: 'pie',
        name: leftTitle,
        radius: ['38%', '58%'],
        center: ['22%', '51%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        data: leftData
      },
      {
        type: 'funnel',
        name: '流量漏斗',
        left: '50%',
        top: 34,
        width: '44%',
        height: '68%',
        minSize: '26%',
        maxSize: '100%',
        sort: 'none',
        gap: 5,
        label: {
          show: true,
          position: 'inside',
          color: '#ffffff',
          fontSize: 12,
          fontWeight: 800,
          formatter: params => `${params.name}\n${formatInteger(Number(params.value) || 0)}`
        },
        labelLine: { show: false },
        itemStyle: {
          borderColor: 'rgba(255,255,255,.18)',
          borderWidth: 1
        },
        data: funnelData
      }
    ]
  };
}

function buildOpportunityScatterOption(analysis: AnalyticsAnalysis): EChartsCoreOption {
  const records = [...analysis.records]
    .filter(record => record.exposureTotal > 0 || record.gmv > 0)
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 40);
  const useRankAxis = records.every(record => record.exposureTotal <= 0);
  const maxGmv = Math.max(...records.map(record => record.gmv), 1);
  const data = records.map((record, index) => ({
    name: record.name,
    value: [useRankAxis ? index + 1 : record.exposureTotal, record.overallConversion, record.gmv, record.orders, record.diagnosis.label],
    itemStyle: { color: DIAGNOSIS_COLORS[record.diagnosis.tone] || DIAGNOSIS_COLORS.normal },
    record
  }));
  return {
    grid: { left: 58, right: 58, top: 42, bottom: 56, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: params => {
        const record = (params.data as { record?: AnalyticsRecord }).record;
        if (!record) return '';
        return [
          `<strong>${shortenText(record.name, 36)}</strong>`,
          `GMV：${formatYen(record.gmv)}`,
          `订单：${formatInteger(record.orders)}`,
          `曝光：${formatInteger(record.exposureTotal)}`,
          `转化：${formatPercent(record.overallConversion)}`,
          `诊断：${record.diagnosis.label}`
        ].join('<br/>');
      }
    },
    xAxis: {
      type: useRankAxis ? 'value' : 'log',
      name: useRankAxis ? 'GMV 排名' : '曝光',
      nameGap: 18,
      nameTextStyle: { color: sharedMutedColor(), fontSize: 11, padding: [8, 0, 0, 0] },
      axisLabel: { color: sharedMutedColor(), fontSize: 10, margin: 10 },
      axisLine: { lineStyle: { color: 'rgba(139,147,194,.35)' } },
      splitLine: { lineStyle: { color: 'rgba(139,147,194,.14)', type: 'dashed' } }
    },
    yAxis: {
      type: 'value',
      name: '转化率',
      nameGap: 18,
      nameTextStyle: { color: sharedMutedColor(), fontSize: 11, padding: [0, 0, 8, 0] },
      axisLabel: { color: sharedMutedColor(), fontSize: 10, margin: 10, formatter: value => `${Number(value) * 100}%` },
      axisLine: { lineStyle: { color: 'rgba(139,147,194,.35)' } },
      splitLine: { lineStyle: { color: 'rgba(139,147,194,.14)', type: 'dashed' } }
    },
    series: [
      {
        type: 'scatter',
        data,
        symbolSize: value => 8 + Math.sqrt((Number(value[2]) || 0) / maxGmv) * 26,
        emphasis: {
          focus: 'self',
          scale: 1.15,
          label: {
            show: true,
            formatter: params => shortenText(params.name || '', 14),
            color: sharedTextColor(),
            position: 'top',
            fontSize: 11,
            fontWeight: 700
          }
        }
      }
    ]
  };
}

export {
  CHANNEL_COLORS,
  DIAGNOSIS_COLORS,
  FUNNEL_COLORS,
  buildDonutOption,
  buildFunnelStages,
  buildOverviewOption,
  buildOpportunityScatterOption
};
