import type { EChartsOption } from 'echarts';
import type { AnalyticsAnalysis, AnalyticsChannel, AnalyticsRecord } from './types';
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
}): EChartsOption {
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
      bottom: 0,
      left: 'center',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: sharedMutedColor(), fontSize: 11 }
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

function buildOpportunityScatterOption(analysis: AnalyticsAnalysis): EChartsOption {
  const records = [...analysis.records]
    .filter(record => record.exposureTotal > 0 || record.gmv > 0)
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 40);
  const maxGmv = Math.max(...records.map(record => record.gmv), 1);
  const data = records.map(record => ({
    name: record.name,
    value: [record.exposureTotal, record.overallConversion, record.gmv, record.orders, record.diagnosis.label],
    itemStyle: { color: DIAGNOSIS_COLORS[record.diagnosis.tone] || DIAGNOSIS_COLORS.normal },
    record
  }));
  return {
    grid: { left: 46, right: 20, top: 24, bottom: 42 },
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
      type: 'log',
      name: '曝光',
      nameTextStyle: { color: sharedMutedColor(), fontSize: 11 },
      axisLabel: { color: sharedMutedColor(), fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(139,147,194,.35)' } },
      splitLine: { lineStyle: { color: 'rgba(139,147,194,.14)', type: 'dashed' } }
    },
    yAxis: {
      type: 'value',
      name: '转化率',
      nameTextStyle: { color: sharedMutedColor(), fontSize: 11 },
      axisLabel: { color: sharedMutedColor(), fontSize: 10, formatter: value => `${Number(value) * 100}%` },
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

export { CHANNEL_COLORS, DIAGNOSIS_COLORS, buildDonutOption, buildOpportunityScatterOption };
