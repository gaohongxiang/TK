import ReactECharts from 'echarts-for-react';
import { Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AnalyticsAnalysis, AnalyticsAnalyzer, AnalyticsFunnelStage, AnalyticsParser, AnalyticsRecord } from './types';
import { buildFunnelStages, buildOpportunityScatterOption, buildOverviewOption, DIAGNOSIS_COLORS } from './chartOptions';
import { formatInteger, formatPercent, formatYen, shortenText } from './format';

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
    { label: '客单价', value: formatYen(analysis.kpis.aov), meta: `件均 ${formatYen(analysis.kpis.unitPrice)}` }
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
            <td><span className={`analytics-tag is-${record.diagnosis.tone}`}>{record.diagnosis.label}</span></td>
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
        <section className="card analytics-chart-card analytics-overview-card">
          <div className="analytics-section-head">
            <h2>运营总览</h2>
            <span className="analytics-chip muted">渠道 GMV / 流量漏斗</span>
          </div>
          <div id="analytics-channel-share" className="analytics-react-overview-chart">
            <ChannelSummary analysis={analysis} />
            <ReactECharts className="analytics-react-chart analytics-react-overview" option={buildOverviewOption(analysis)} />
          </div>
          <FunnelSummary stages={funnelStages} />
        </section>
        <section className="card analytics-chart-card analytics-bubble-card">
          <div className="analytics-section-head">
            <h2>商品机会散点图</h2>
            <span className="analytics-chip muted">曝光 × 转化 × GMV</span>
          </div>
          <div id="analytics-bubble-chart" className="analytics-react-scatter-wrap">
            <ReactECharts className="analytics-react-chart analytics-react-scatter" option={buildOpportunityScatterOption(analysis)} />
          </div>
          <ScatterLegend />
        </section>
      </div>
      <div className="analytics-layout">
        <section className="card analytics-chart-card">
          <div className="analytics-section-head">
            <h2>Top 商品 GMV</h2>
            <span className="analytics-chip muted">前 10</span>
          </div>
          <TopProducts records={analysis.records} />
        </section>
        <section className="card analytics-chart-card">
          <div className="analytics-section-head">
            <h2>商品诊断</h2>
            <span className="analytics-chip muted">运营动作</span>
          </div>
          <DiagnosisCards records={analysis.records} />
        </section>
      </div>
      <section className="card analytics-table-card">
        <div className="analytics-section-head">
          <h2>商品明细</h2>
          <span className="analytics-chip muted">{analysis.records.length} 个商品 · 仅展示前 50</span>
        </div>
        <div className="ot-table-wrap analytics-table-wrap">
          <DetailTable records={analysis.records} />
        </div>
      </section>
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
    <div className="analytics-react-shell">
      <section className="card analytics-upload-card analytics-react-upload-card">
        <div className="analytics-upload-grid">
          <div className="analytics-upload-copy">
            <h2>导入商品流量表</h2>
            <p>支持 TikTok Shop 导出的商品流量详情 Excel。React 看板只在当前浏览器内解析，不上传、不保存到本站数据库。</p>
            <div className="analytics-privacy-strip">
              <span>本地解析</span>
              <span>ECharts 图表</span>
              <span>不保存用户数据</span>
            </div>
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
      </section>
      {!analysis ? (
        <section id="analytics-empty" className="card analytics-empty analytics-react-empty">
          <div className="ot-empty">
            <div style={{ fontSize: 15, marginBottom: 6 }}>等待导入商品流量 Excel</div>
            <div style={{ fontSize: 12.5 }}>导入后会自动生成 ECharts 渠道图、商品机会散点图、Top 商品和诊断标签。</div>
          </div>
        </section>
      ) : <AnalyticsDashboard analysis={analysis} />}
    </div>
  );
}

export { AnalyticsApp };
