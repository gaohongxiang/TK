type AnalyticsChannelKey = 'mall' | 'video' | 'productCard' | 'live';

type AnalyticsDiagnosisTone = 'hero' | 'scale' | 'creative' | 'detail' | 'watch' | 'normal';

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

type AnalyticsChannelColumnMap = {
  key: AnalyticsChannelKey;
  label: string;
  gmv: string;
  units: string;
  exposure: string;
  pageViews: string;
  customers: string;
  ctr: string;
  conversion: string;
};

type AnalyticsDiagnosis = {
  tone: AnalyticsDiagnosisTone;
  label: string;
  action: string;
};

type AnalyticsParsedRecord = {
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
  diagnosis?: AnalyticsDiagnosis;
  periodCount?: number;
  latestPeriod?: string;
  gmvTrend?: number;
  gmvTrendRate?: number;
};

type AnalyticsRecord = AnalyticsParsedRecord & {
  diagnosis: AnalyticsDiagnosis;
};

type AnalyticsKpis = {
  totalGmv: number;
  totalOrders: number;
  totalUnits: number;
  totalExposure: number;
  soldProducts: number;
  productCount: number;
  aov: number;
  unitPrice: number;
};

type AnalyticsPeriodComparison = {
  period: string;
  updatedAt: string;
  snapshotCount: number;
  productCount: number;
  activeCount: number;
  soldProducts: number;
  totalGmv: number;
  totalOrders: number;
  totalUnits: number;
  totalExposure: number;
  totalPageViews: number;
  totalCustomers: number;
  aov: number;
  unitPrice: number;
  ctr: number;
  conversion: number;
  gmvDelta: number;
  gmvDeltaRate: number;
  ordersDelta: number;
  ordersDeltaRate: number;
  unitsDelta: number;
  unitsDeltaRate: number;
  exposureDelta: number;
  exposureDeltaRate: number;
  conversionDelta: number;
};

type AnalyticsAnalysis = {
  period: string;
  records: AnalyticsRecord[];
  activeCount: number;
  channelTotals: AnalyticsChannel[];
  kpis: AnalyticsKpis;
  periodComparisons?: AnalyticsPeriodComparison[];
};

type AnalyticsFunnelStage = {
  key: 'exposure' | 'pageViews' | 'customers' | 'units';
  label: string;
  value: number;
  color: string;
  caption: string;
  rateFromPrevious: number;
  rateFromExposure: number;
};

type AnalyticsParseResult = {
  period: string;
  records: AnalyticsParsedRecord[];
};

type AnalyticsParser = {
  parseRows(rows: unknown[][]): AnalyticsParseResult;
};

type AnalyticsAnalyzer = {
  analyze(records: AnalyticsParsedRecord[], period: string): AnalyticsAnalysis;
};

type AnalyticsRawRecord = Record<string, unknown>;

type AnalyticsDiagnosisThresholds = {
  heroGmv: number;
  heroOrders: number;
  highExposure: number;
  mediumExposure: number;
  lowExposure: number;
  highPageViews: number;
  lowCtr: number;
};

type AnalyticsWorkbook = {
  SheetNames?: string[];
  Sheets: Record<string, unknown>;
};

type AnalyticsXlsx = {
  read: (data: ArrayBuffer, options: { type: 'array' }) => AnalyticsWorkbook;
  utils: {
    sheet_to_json: (
      sheet: unknown,
      options: { header: 1; raw: false; defval: string }
    ) => unknown[][];
  };
};

export type {
  AnalyticsAnalysis,
  AnalyticsAnalyzer,
  AnalyticsChannel,
  AnalyticsChannelColumnMap,
  AnalyticsChannelKey,
  AnalyticsDiagnosis,
  AnalyticsDiagnosisThresholds,
  AnalyticsDiagnosisTone,
  AnalyticsFunnelStage,
  AnalyticsKpis,
  AnalyticsPeriodComparison,
  AnalyticsParsedRecord,
  AnalyticsParser,
  AnalyticsParseResult,
  AnalyticsRawRecord,
  AnalyticsRecord,
  AnalyticsWorkbook,
  AnalyticsXlsx
};
