type AnalyticsChannelKey = 'mall' | 'video' | 'productCard' | 'live';

type AnalyticsChannel = {
  key: AnalyticsChannelKey;
  label: string;
  gmv: number;
  units: number;
  exposure: number;
  pageViews: number;
  customers: number;
  ctr: number;
  conversion: number;
};

type AnalyticsDiagnosis = {
  tone: 'hero' | 'scale' | 'creative' | 'detail' | 'watch' | 'normal';
  label: string;
  action: string;
};

type AnalyticsRecord = {
  id: string;
  name: string;
  status: string;
  gmv: number;
  units: number;
  orders: number;
  exposureTotal: number;
  pageViewsTotal: number;
  customersTotal: number;
  overallCtr: number;
  overallConversion: number;
  channels: Record<AnalyticsChannelKey, AnalyticsChannel>;
  diagnosis: AnalyticsDiagnosis;
};

type AnalyticsAnalysis = {
  period: string;
  records: AnalyticsRecord[];
  activeCount: number;
  channelTotals: AnalyticsChannel[];
  kpis: {
    totalGmv: number;
    totalOrders: number;
    totalUnits: number;
    totalExposure: number;
    soldProducts: number;
    productCount: number;
    aov: number;
    unitPrice: number;
  };
};

type AnalyticsParser = {
  parseRows(rows: unknown[][]): { period: string; records: AnalyticsRecord[] };
};

type AnalyticsAnalyzer = {
  analyze(records: AnalyticsRecord[], period: string): AnalyticsAnalysis;
};

export type {
  AnalyticsAnalysis,
  AnalyticsAnalyzer,
  AnalyticsChannel,
  AnalyticsChannelKey,
  AnalyticsDiagnosis,
  AnalyticsParser,
  AnalyticsRecord
};
