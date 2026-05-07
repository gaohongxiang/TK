import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { FunnelChart, PieChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState, TableViewport } from '@/components/ui/table-tools';
import type { AnalyticsAnalysis, AnalyticsAnalyzer, AnalyticsFunnelStage, AnalyticsParser, AnalyticsRecord } from './types';
import { buildFunnelStages, buildOpportunityScatterOption, buildOverviewOption, DIAGNOSIS_COLORS } from './chartOptions';
import { formatInteger, formatPercent, formatYen, shortenText } from './format';

echarts.use([CanvasRenderer, FunnelChart, GridComponent, LegendComponent, PieChart, ScatterChart, TitleComponent, TooltipComponent]);

function ReactECharts(props: { className?: string; option: any }) {
  return <ReactEChartsCore echarts={echarts} {...props} />;
}

type AnalyticsAppProps = {
  parser: AnalyticsParser;
  analyzer: AnalyticsAnalyzer;
  getXlsx?: () => any;
  onToast?: (message: string, type?: 'ok' | 'error') => void;
};

function getSheetRows(workbook: any, xlsx: any) {
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error('Excel 文件里没有工作表');
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ''
  }) as unknown[][];
}

function KpiGrid({ analysis }: { analysis: AnalyticsAnalysis }) {
  const kpis = [
    { label: 'GMV', value: formatYen(analysis.kpis.totalGmv), meta: analysis.period || '当前导入周期' },
    { label: '订单数', value: formatInteger(analysis.kpis.totalOrders), meta: `${formatInteger(analysis.kpis.totalUnits)} 件成交` },
    { label: '动销商品', value: `${analysis.kpis.soldProducts}/${analysis.kpis.productCount}`, meta: `${analysis.activeCount} 个 Active 商品` },
    { label: '客单价', value: `${formatYen(analysis.kpis.aov)}/单`, meta: `件均 ${formatYen(analysis.kpis.unitPrice)}/件` }
  ];
  return (
    <div id="analytics-kpi-grid" className="analytics-kpi-grid">
      {kpis.map(item => (
        <div className="analytics-kpi-card" key={item.label}>
          <div className="analytics-kpi-label">{item.label}</div>
          <div className="analytics-kpi-value">{item.value}</div>
          <div className="analytics-kpi-meta">{item.meta}</div>
        </div>
      ))}
    </div>
  );
}

function TopProducts({ records }: { records: AnalyticsRecord[] }) {
  const rows = useMemo(() => [...records].sort((a, b) => b.gmv - a.gmv).slice(0, 10), [records]);
  const max = Math.max(...rows.map(record => record.gmv), 1);
  return (
    <div className="analytics-ranking">
      {rows.map((record, index) => (
        <div className="analytics-rank-row" key={record.id || record.name}>
          <div className="analytics-rank-index">{index + 1}</div>
          <div className="analytics-rank-main">
            <div className="analytics-rank-name" title={record.name}>{shortenText(record.name, 54)}</div>
            <div className="analytics-rank-track"><span style={{ width: `${Math.max(2, record.gmv / max * 100).toFixed(2)}%` }} /></div>
          </div>
          <div className="analytics-rank-value">
            <strong>{formatYen(record.gmv)}</strong>
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
    <div id="analytics-diagnostics" className="analytics-diagnostics">
      {priority.filter(key => groups[key]?.length).map(key => {
        const sample = groups[key].slice(0, 2);
        const first = sample[0];
        return (
          <div className={`analytics-diagnosis-card is-${key}`} key={key}>
            <div className="analytics-diagnosis-head">
              <span>{first.diagnosis.label}</span>
              <strong>{groups[key].length}</strong>
            </div>
            <p>{first.diagnosis.action}</p>
            <div className="analytics-diagnosis-products">
              {sample.map(record => <span key={record.id || record.name} title={record.name}>{shortenText(record.name, 24)}</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailTable({ records }: { records: AnalyticsRecord[] }) {
  const rows = useMemo(() => [...records].sort((a, b) => b.gmv - a.gmv || b.exposureTotal - a.exposureTotal).slice(0, 50), [records]);
  return (
    <table className="ot-table analytics-detail-table">
      <thead>
        <tr>
          <th>商品</th>
          <th>GMV</th>
          <th>订单</th>
          <th>总曝光</th>
          <th>总浏览</th>
          <th>点击率</th>
          <th>诊断</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(record => (
          <tr key={record.id || record.name}>
            <td title={record.name}>
              <div className="analytics-product-name">{shortenText(record.name, 64)}</div>
              <div className="analytics-product-id">{record.id}</div>
            </td>
            <td>{formatYen(record.gmv)}</td>
            <td>{formatInteger(record.orders)}</td>
            <td>{formatInteger(record.exposureTotal)}</td>
            <td>{formatInteger(record.pageViewsTotal)}</td>
            <td>{formatPercent(record.overallCtr)}</td>
            <td><Badge className={`analytics-tag is-${record.diagnosis.tone}`}>{record.diagnosis.label}</Badge></td>
          </tr>
        ))}
      </tbody>
    </table>
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
    <div className="analytics-react-legend">
      {items.map(([key, label]) => (
        <span key={key}>
          <i style={{ background: DIAGNOSIS_COLORS[key] }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function ChannelSummary({ analysis }: { analysis: AnalyticsAnalysis }) {
  const funnelStages = buildFunnelStages(analysis);
  return (
    <div className="analytics-react-readable-summary" aria-label="运营总览摘要">
      {analysis.channelTotals.map(channel => `${channel.label} ${formatYen(channel.gmv)} ${formatInteger(channel.units)} 件`).join(' · ')}
      {' · '}
      {funnelStages.map(stage => `${stage.label} ${formatInteger(stage.value)}`).join(' · ')}
    </div>
  );
}

function FunnelSummary({ stages }: { stages: AnalyticsFunnelStage[] }) {
  return (
    <div id="analytics-funnel" className="analytics-react-funnel-summary">
      {stages.map(stage => (
        <div className="analytics-react-funnel-step" key={stage.key}>
          <span className="analytics-react-funnel-dot" style={{ background: stage.color }} />
          <div>
            <strong>{stage.label}</strong>
            <span>{formatInteger(stage.value)}</span>
          </div>
          <em>{stage.key === 'exposure' ? '100.00%' : formatPercent(stage.rateFromPrevious)}</em>
        </div>
      ))}
    </div>
  );
}

function AnalyticsDashboard({ analysis }: { analysis: AnalyticsAnalysis }) {
  const funnelStages = buildFunnelStages(analysis);
  return (
    <section className="analytics-main analytics-react-main" data-react-analytics-ready="true">
      <KpiGrid analysis={analysis} />
      <div className="analytics-insight-layout analytics-react-insight-layout">
        <Card className="analytics-chart-card analytics-overview-card">
          <div className="analytics-section-head">
            <h2>运营总览</h2>
            <Badge className="analytics-chip muted">渠道 GMV / 流量漏斗</Badge>
          </div>
          <div id="analytics-channel-share" className="analytics-react-overview-chart">
            <ChannelSummary analysis={analysis} />
            <ReactECharts className="analytics-react-chart analytics-react-overview" option={buildOverviewOption(analysis)} />
          </div>
          <FunnelSummary stages={funnelStages} />
        </Card>
        <Card className="analytics-chart-card analytics-bubble-card">
          <div className="analytics-section-head">
            <h2>商品机会散点图</h2>
            <Badge className="analytics-chip muted">曝光 × 转化 × GMV</Badge>
          </div>
          <div id="analytics-bubble-chart" className="analytics-react-scatter-wrap">
            <ReactECharts className="analytics-react-chart analytics-react-scatter" option={buildOpportunityScatterOption(analysis)} />
          </div>
          <ScatterLegend />
        </Card>
      </div>
      <div className="analytics-layout">
        <Card className="analytics-chart-card">
          <div className="analytics-section-head">
            <h2>Top 商品 GMV</h2>
            <Badge className="analytics-chip muted">前 10</Badge>
          </div>
          <TopProducts records={analysis.records} />
        </Card>
        <Card className="analytics-chart-card">
          <div className="analytics-section-head">
            <h2>商品诊断</h2>
            <Badge className="analytics-chip muted">运营动作</Badge>
          </div>
          <DiagnosisCards records={analysis.records} />
        </Card>
      </div>
      <Card className="analytics-table-card">
        <div className="analytics-section-head">
          <h2>商品明细</h2>
          <Badge className="analytics-chip muted">{analysis.records.length} 个商品 · 仅展示前 50</Badge>
        </div>
        <TableViewport className="analytics-table-wrap">
          <DetailTable records={analysis.records} />
        </TableViewport>
      </Card>
    </section>
  );
}

function AnalyticsApp({ parser, analyzer, getXlsx, onToast }: AnalyticsAppProps) {
  const [analysis, setAnalysis] = useState<AnalyticsAnalysis | null>(null);
  const [meta, setMeta] = useState('尚未导入数据');

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
      onToast?.('商品流量数据已生成 React 看板', 'ok');
    } catch (error: any) {
      setMeta('解析失败');
      onToast?.(error?.message || 'Excel 解析失败', 'error');
    }
  }

  return (
    <div className="analytics-react-shell" id="analytics-react-root">
      <div className="module-hero page-hero page-hero-analytics">
        <div className="module-hero-copy">
          <div className="module-hero-title-row">
            <h2>数据分析</h2>
            <div className="module-kicker">Excel 导入 / 流量诊断 / 商品动作</div>
          </div>
          <p>本地解析 TikTok Shop 商品流量导出表，生成渠道表现、商品排行和运营诊断；数据不上传到本站服务器。</p>
        </div>
      </div>
      <Card className="analytics-upload-card analytics-react-upload-card">
        <div className="analytics-upload-grid">
          <div className="analytics-upload-copy">
            <h2>导入商品流量表</h2>
            <p>支持 TikTok Shop 导出的商品流量详情 Excel。React 看板只在当前浏览器内解析，不上传、不保存到本站数据库。</p>
            <Alert variant="info" className="analytics-privacy-strip">
              <AlertDescription className="contents">
                <span>本地解析</span>
                <span>ECharts 图表</span>
                <span>不保存用户数据</span>
              </AlertDescription>
            </Alert>
          </div>
          <div className="analytics-upload-action">
            <label className="analytics-file-picker" htmlFor="analytics-file-input">
              <span className="analytics-file-icon" aria-hidden="true"><Upload size={18} strokeWidth={2} /></span>
              <span>选择 Excel 文件</span>
            </label>
            <input id="analytics-file-input" type="file" accept=".xlsx,.xls" onChange={event => void handleFile(event.target.files?.[0] || null)} />
            <div id="analytics-file-meta" className="analytics-file-meta">{meta}</div>
          </div>
        </div>
      </Card>
      {!analysis ? (
        <Card id="analytics-empty" className="analytics-empty analytics-react-empty">
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
