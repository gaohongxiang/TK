import { CHANNELS } from './parser.ts';
import { analyze } from './analyzer.ts';
import type { AnalyticsAnalysis, AnalyticsChannel, AnalyticsChannelKey, AnalyticsPeriodComparison, AnalyticsRecord } from './types.ts';

type AnalyticsSnapshotForAggregation = {
  analysis: AnalyticsAnalysis;
  snapshotId: string;
  period: string;
  updatedAt: string;
};

type ProductAccumulator = {
  id: string;
  name: string;
  status: string;
  gmv: number;
  units: number;
  orders: number;
  exposureTotal: number;
  pageViewsTotal: number;
  customersTotal: number;
  channels: Record<AnalyticsChannelKey, AnalyticsChannel>;
  periods: Set<string>;
  latestPeriod: string;
  latestUpdatedAt: string;
  firstGmv: number;
  latestGmv: number;
};

type PeriodAccumulator = {
  period: string;
  updatedAt: string;
  snapshotCount: number;
  productIds: Set<string>;
  activeProductIds: Set<string>;
  soldProductIds: Set<string>;
  totalGmv: number;
  totalOrders: number;
  totalUnits: number;
  totalExposure: number;
  totalPageViews: number;
  totalCustomers: number;
};

function emptyChannel(key: AnalyticsChannelKey): AnalyticsChannel {
  const channel = CHANNELS.find(item => item.key === key);
  return {
    key,
    label: channel?.label || key,
    gmv: 0,
    units: 0,
    exposure: 0,
    pageViews: 0,
    customers: 0,
    ctr: 0,
    conversion: 0
  };
}

function addChannel(target: AnalyticsChannel, source: AnalyticsChannel | undefined) {
  if (!source) return;
  target.gmv += Number(source.gmv || 0);
  target.units += Number(source.units || 0);
  target.exposure += Number(source.exposure || 0);
  target.pageViews += Number(source.pageViews || 0);
  target.customers += Number(source.customers || 0);
  target.ctr = target.exposure ? target.pageViews / target.exposure : 0;
  target.conversion = target.customers ? target.units / target.customers : 0;
}

function makeAccumulator(record: AnalyticsRecord, period: string, updatedAt: string): ProductAccumulator {
  const channels = Object.fromEntries(CHANNELS.map(channel => [channel.key, emptyChannel(channel.key)])) as Record<AnalyticsChannelKey, AnalyticsChannel>;
  CHANNELS.forEach(channel => addChannel(channels[channel.key], record.channels[channel.key]));
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    gmv: Number(record.gmv || 0),
    units: Number(record.units || 0),
    orders: Number(record.orders || 0),
    exposureTotal: Number(record.exposureTotal || 0),
    pageViewsTotal: Number(record.pageViewsTotal || 0),
    customersTotal: Number(record.customersTotal || 0),
    channels,
    periods: new Set(period ? [period] : []),
    latestPeriod: period,
    latestUpdatedAt: updatedAt,
    firstGmv: Number(record.gmv || 0),
    latestGmv: Number(record.gmv || 0)
  };
}

function addRecord(acc: ProductAccumulator, record: AnalyticsRecord, period: string, updatedAt: string) {
  acc.gmv += Number(record.gmv || 0);
  acc.units += Number(record.units || 0);
  acc.orders += Number(record.orders || 0);
  acc.exposureTotal += Number(record.exposureTotal || 0);
  acc.pageViewsTotal += Number(record.pageViewsTotal || 0);
  acc.customersTotal += Number(record.customersTotal || 0);
  if (period) acc.periods.add(period);
  CHANNELS.forEach(channel => addChannel(acc.channels[channel.key], record.channels[channel.key]));
  if (String(updatedAt || '').localeCompare(acc.latestUpdatedAt || '') >= 0) {
    acc.latestPeriod = period || acc.latestPeriod;
    acc.latestUpdatedAt = updatedAt;
    acc.latestGmv = Number(record.gmv || 0);
    acc.name = record.name || acc.name;
    acc.status = record.status || acc.status;
  }
}

function accumulatorToRecord(acc: ProductAccumulator): AnalyticsRecord {
  const gmvTrend = acc.latestGmv - acc.firstGmv;
  return {
    id: acc.id,
    name: acc.name,
    status: acc.status,
    gmv: acc.gmv,
    units: acc.units,
    orders: acc.orders,
    exposureTotal: acc.exposureTotal,
    pageViewsTotal: acc.pageViewsTotal,
    customersTotal: acc.customersTotal,
    overallCtr: acc.exposureTotal ? acc.pageViewsTotal / acc.exposureTotal : 0,
    overallConversion: acc.customersTotal ? acc.units / acc.customersTotal : 0,
    channels: acc.channels,
    periodCount: acc.periods.size,
    latestPeriod: acc.latestPeriod,
    gmvTrend,
    gmvTrendRate: acc.firstGmv ? gmvTrend / acc.firstGmv : 0,
    diagnosis: { tone: 'normal', label: '常规观察', action: '' }
  };
}

function combinePeriodLabel(snapshots: AnalyticsSnapshotForAggregation[]) {
  const periods = [...new Set(snapshots.map(snapshot => snapshot.period).filter(Boolean))];
  if (!periods.length) return '全部周期';
  if (periods.length === 1) return periods[0];
  return `全部周期 · ${periods.length} 期`;
}

function rateDelta(current: number, previous: number) {
  if (!previous) return current ? 1 : 0;
  return (current - previous) / previous;
}

function makePeriodAccumulator(snapshot: AnalyticsSnapshotForAggregation): PeriodAccumulator {
  return {
    period: snapshot.period || snapshot.analysis.period || '未知周期',
    updatedAt: snapshot.updatedAt,
    snapshotCount: 0,
    productIds: new Set(),
    activeProductIds: new Set(),
    soldProductIds: new Set(),
    totalGmv: 0,
    totalOrders: 0,
    totalUnits: 0,
    totalExposure: 0,
    totalPageViews: 0,
    totalCustomers: 0
  };
}

function addSnapshotToPeriod(acc: PeriodAccumulator, snapshot: AnalyticsSnapshotForAggregation) {
  acc.snapshotCount += 1;
  if (String(snapshot.updatedAt || '').localeCompare(acc.updatedAt || '') >= 0) acc.updatedAt = snapshot.updatedAt;
  snapshot.analysis.records.forEach(record => {
    const productId = String(record.id || record.name || '').trim();
    if (productId) {
      acc.productIds.add(productId);
      if (record.status !== 'Inactive') acc.activeProductIds.add(productId);
      if (Number(record.orders || 0) > 0) acc.soldProductIds.add(productId);
    }
    acc.totalGmv += Number(record.gmv || 0);
    acc.totalOrders += Number(record.orders || 0);
    acc.totalUnits += Number(record.units || 0);
    acc.totalExposure += Number(record.exposureTotal || 0);
    acc.totalPageViews += Number(record.pageViewsTotal || 0);
    acc.totalCustomers += Number(record.customersTotal || 0);
  });
}

function makePeriodComparison(acc: PeriodAccumulator, previous?: AnalyticsPeriodComparison): AnalyticsPeriodComparison {
  const current = {
    period: acc.period,
    updatedAt: acc.updatedAt,
    snapshotCount: acc.snapshotCount,
    productCount: acc.productIds.size,
    activeCount: acc.activeProductIds.size,
    soldProducts: acc.soldProductIds.size,
    totalGmv: acc.totalGmv,
    totalOrders: acc.totalOrders,
    totalUnits: acc.totalUnits,
    totalExposure: acc.totalExposure,
    totalPageViews: acc.totalPageViews,
    totalCustomers: acc.totalCustomers,
    aov: acc.totalOrders ? acc.totalGmv / acc.totalOrders : 0,
    unitPrice: acc.totalUnits ? acc.totalGmv / acc.totalUnits : 0,
    ctr: acc.totalExposure ? acc.totalPageViews / acc.totalExposure : 0,
    conversion: acc.totalCustomers ? acc.totalUnits / acc.totalCustomers : 0
  };
  return {
    ...current,
    gmvDelta: previous ? current.totalGmv - previous.totalGmv : 0,
    gmvDeltaRate: previous ? rateDelta(current.totalGmv, previous.totalGmv) : 0,
    ordersDelta: previous ? current.totalOrders - previous.totalOrders : 0,
    ordersDeltaRate: previous ? rateDelta(current.totalOrders, previous.totalOrders) : 0,
    unitsDelta: previous ? current.totalUnits - previous.totalUnits : 0,
    unitsDeltaRate: previous ? rateDelta(current.totalUnits, previous.totalUnits) : 0,
    exposureDelta: previous ? current.totalExposure - previous.totalExposure : 0,
    exposureDeltaRate: previous ? rateDelta(current.totalExposure, previous.totalExposure) : 0,
    conversionDelta: previous ? current.conversion - previous.conversion : 0
  };
}

function buildPeriodComparisons(snapshots: AnalyticsSnapshotForAggregation[]): AnalyticsPeriodComparison[] {
  const byPeriod = new Map<string, PeriodAccumulator>();
  snapshots.forEach(snapshot => {
    const period = snapshot.period || snapshot.analysis.period || '未知周期';
    const existing = byPeriod.get(period) || makePeriodAccumulator(snapshot);
    addSnapshotToPeriod(existing, snapshot);
    byPeriod.set(period, existing);
  });
  return [...byPeriod.values()]
    .sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')))
    .reduce<AnalyticsPeriodComparison[]>((rows, acc) => {
      const previous = rows[rows.length - 1];
      rows.push(makePeriodComparison(acc, previous));
      return rows;
    }, []);
}

function aggregateAnalyses(snapshots: AnalyticsSnapshotForAggregation[]): AnalyticsAnalysis {
  const ordered = [...snapshots].sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')));
  const byProduct = new Map<string, ProductAccumulator>();

  ordered.forEach(snapshot => {
    snapshot.analysis.records.forEach(record => {
      const key = String(record.id || record.name || '').trim();
      if (!key) return;
      const existing = byProduct.get(key);
      if (existing) {
        addRecord(existing, record, snapshot.period || snapshot.analysis.period, snapshot.updatedAt);
      } else {
        byProduct.set(key, makeAccumulator(record, snapshot.period || snapshot.analysis.period, snapshot.updatedAt));
      }
    });
  });

  const combinedRecords = [...byProduct.values()].map(accumulatorToRecord);
  const combined = analyze(combinedRecords, combinePeriodLabel(ordered));
  return {
    ...combined,
    periodComparisons: buildPeriodComparisons(ordered)
  };
}

export {
  aggregateAnalyses,
  buildPeriodComparisons
};
export type {
  AnalyticsSnapshotForAggregation
};
