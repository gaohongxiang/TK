import type { EChartsOption } from 'echarts';
import type { AnalyticsAnalysis, AnalyticsChannel, AnalyticsFunnelStage, AnalyticsRecord } from './types';
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

function buildOverviewOption(analysis: AnalyticsAnalysis): EChartsOption {
  const funnelStages = buildFunnelStages(analysis);
  const channelData = analysis.channelTotals.map(channel => ({
    name: channel.label,
    value: channel.gmv,
    itemStyle: { color: CHANNEL_COLORS[channel.key] || '#8b93c2' },
    channel
  }));
  const funnelData = funnelStages.map(stage => ({
    name: stage.label,
    value: stage.value,
    itemStyle: { color: stage.color },
    stage
  }));
  return {
    color: [...analysis.channelTotals.map(channel => CHANNEL_COLORS[channel.key] || '#8b93c2'), ...funnelStages.map(stage => stage.color)],
    title: [
      {
        text: 'GMV 渠道',
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
        const data = params.data as { channel?: AnalyticsChannel; stage?: AnalyticsFunnelStage };
        if (data.channel) {
          return [
            `<strong>${data.channel.label}</strong>`,
            `GMV：${formatYen(data.channel.gmv)}`,
            `成交件数：${formatInteger(data.channel.units)} 件`,
            `点击率：${formatPercent(data.channel.ctr)}`,
            `转化率：${formatPercent(data.channel.conversion)}`
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
      bottom: 0,
      left: 'center',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: sharedMutedColor(), fontSize: 11 }
    },
    series: [
      {
        type: 'pie',
        name: 'GMV 渠道',
        radius: ['38%', '58%'],
        center: ['22%', '51%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        data: channelData
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

export {
  CHANNEL_COLORS,
  DIAGNOSIS_COLORS,
  FUNNEL_COLORS,
  buildDonutOption,
  buildFunnelStages,
  buildOverviewOption,
  buildOpportunityScatterOption
};
