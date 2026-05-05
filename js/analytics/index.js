/* ============================================================
 * 数据分析：TK 商品流量 Excel 本地看板
 * ============================================================ */
const TKAnalytics = (function () {
  let initialized = false;
  let currentAnalysis = null;

  function $(selector) {
    return document.querySelector(selector);
  }

  const escapeHtml = value => TKHtml.escape(value);
  const formatInteger = value => TKFormat.integer(value);
  const formatYen = value => TKFormat.yen(value);
  const formatPercent = (value, digits = 2) => TKFormat.percent(value, digits);
  const shortenText = (value, max = 46) => TKHtml.shorten(value, max);

  function showToast(message, type = 'ok') {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function getSheetRows(workbook) {
    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) throw new Error('Excel 文件里没有工作表');
    const sheet = workbook.Sheets[sheetName];
    return window.XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: ''
    });
  }

  function renderKpis(analysis) {
    const kpis = [
      { label: 'GMV', value: formatYen(analysis.kpis.totalGmv), meta: analysis.period || '当前导入周期' },
      { label: '订单数', value: formatInteger(analysis.kpis.totalOrders), meta: `${formatInteger(analysis.kpis.totalUnits)} 件成交` },
      { label: '动销商品', value: `${analysis.kpis.soldProducts}/${analysis.kpis.productCount}`, meta: `${analysis.activeCount} 个 Active 商品` },
      { label: '客单价', value: formatYen(analysis.kpis.aov), meta: `件均 ${formatYen(analysis.kpis.unitPrice)}` }
    ];
    const container = $('#analytics-kpi-grid');
    if (!container) return;
    container.innerHTML = kpis.map(item => `
      <div class="analytics-kpi-card">
        <div class="analytics-kpi-label">${escapeHtml(item.label)}</div>
        <div class="analytics-kpi-value">${escapeHtml(item.value)}</div>
        <div class="analytics-kpi-meta">${escapeHtml(item.meta)}</div>
      </div>
    `).join('');
  }

  function renderChannelGmv(analysis) {
    const container = $('#analytics-channel-gmv');
    if (!container) return;
    const maxGmv = Math.max(...analysis.channelTotals.map(channel => channel.gmv), 1);
    container.innerHTML = analysis.channelTotals.map(channel => `
      <div class="analytics-bar-row">
        <div class="analytics-bar-label">${escapeHtml(channel.label)}</div>
        <div class="analytics-bar-track">
          <div class="analytics-bar-fill analytics-bar-${escapeHtml(channel.key)}" style="width:${Math.max(2, channel.gmv / maxGmv * 100).toFixed(2)}%"></div>
        </div>
        <div class="analytics-bar-value">${escapeHtml(formatYen(channel.gmv))}</div>
      </div>
    `).join('');
  }

  function renderFunnel(analysis) {
    const container = $('#analytics-funnel');
    if (!container) return;
    const rows = analysis.channelTotals.map(channel => {
      const max = Math.max(channel.exposure, 1);
      return {
        ...channel,
        pageViewRate: channel.exposure ? channel.pageViews / channel.exposure : 0,
        customerRate: channel.pageViews ? channel.customers / channel.pageViews : 0,
        unitRate: channel.customers ? channel.units / channel.customers : 0,
        exposureWidth: 100,
        pageViewWidth: Math.max(4, channel.pageViews / max * 100),
        customerWidth: Math.max(4, channel.customers / max * 100),
        unitWidth: Math.max(4, channel.units / max * 100)
      };
    });
    container.innerHTML = rows.map(row => `
      <div class="analytics-funnel-row">
        <div class="analytics-funnel-head">
          <strong>${escapeHtml(row.label)}</strong>
          <span>${escapeHtml(formatPercent(row.ctr))} 点击 · ${escapeHtml(formatPercent(row.conversion))} 转化</span>
        </div>
        <div class="analytics-funnel-bars">
          <span style="width:${row.exposureWidth}%">曝 ${formatInteger(row.exposure)}</span>
          <span style="width:${row.pageViewWidth}%">览 ${formatInteger(row.pageViews)}</span>
          <span style="width:${row.customerWidth}%">客 ${formatInteger(row.customers)}</span>
          <span style="width:${row.unitWidth}%">成 ${formatInteger(row.units)}</span>
        </div>
      </div>
    `).join('');
  }

  function renderTopProducts(analysis) {
    const container = $('#analytics-top-products');
    if (!container) return;
    const top = [...analysis.records].sort((a, b) => b.gmv - a.gmv).slice(0, 10);
    const max = Math.max(...top.map(record => record.gmv), 1);
    container.innerHTML = top.map((record, index) => `
      <div class="analytics-rank-row">
        <div class="analytics-rank-index">${index + 1}</div>
        <div class="analytics-rank-main">
          <div class="analytics-rank-name" title="${escapeHtml(record.name)}">${escapeHtml(shortenText(record.name, 54))}</div>
          <div class="analytics-rank-track"><span style="width:${Math.max(2, record.gmv / max * 100).toFixed(2)}%"></span></div>
        </div>
        <div class="analytics-rank-value">
          <strong>${escapeHtml(formatYen(record.gmv))}</strong>
          <span>${escapeHtml(formatInteger(record.orders))} 单</span>
        </div>
      </div>
    `).join('');
  }

  function renderDiagnostics(analysis) {
    const container = $('#analytics-diagnostics');
    if (!container) return;
    const groups = analysis.records.reduce((acc, record) => {
      const key = record.diagnosis.tone;
      if (!acc[key]) acc[key] = [];
      acc[key].push(record);
      return acc;
    }, {});
    const priority = ['hero', 'scale', 'creative', 'detail', 'watch', 'normal'];
    container.innerHTML = priority
      .filter(key => groups[key]?.length)
      .map(key => {
        const sample = groups[key].slice(0, 2);
        const first = sample[0];
        return `
          <div class="analytics-diagnosis-card is-${escapeHtml(key)}">
            <div class="analytics-diagnosis-head">
              <span>${escapeHtml(first.diagnosis.label)}</span>
              <strong>${groups[key].length}</strong>
            </div>
            <p>${escapeHtml(first.diagnosis.action)}</p>
            <div class="analytics-diagnosis-products">
              ${sample.map(record => `<span title="${escapeHtml(record.name)}">${escapeHtml(shortenText(record.name, 24))}</span>`).join('')}
            </div>
          </div>`;
      }).join('');
  }

  function renderTable(analysis) {
    const container = $('#analytics-table');
    if (!container) return;
    const rows = [...analysis.records]
      .sort((a, b) => b.gmv - a.gmv || b.exposureTotal - a.exposureTotal)
      .slice(0, 50);
    container.innerHTML = `
      <table class="ot-table analytics-detail-table">
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
          ${rows.map(record => `
            <tr>
              <td title="${escapeHtml(record.name)}">
                <div class="analytics-product-name">${escapeHtml(shortenText(record.name, 64))}</div>
                <div class="analytics-product-id">${escapeHtml(record.id)}</div>
              </td>
              <td>${escapeHtml(formatYen(record.gmv))}</td>
              <td>${escapeHtml(formatInteger(record.orders))}</td>
              <td>${escapeHtml(formatInteger(record.exposureTotal))}</td>
              <td>${escapeHtml(formatInteger(record.pageViewsTotal))}</td>
              <td>${escapeHtml(formatPercent(record.overallCtr))}</td>
              <td><span class="analytics-tag is-${escapeHtml(record.diagnosis.tone)}">${escapeHtml(record.diagnosis.label)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  function renderAnalysis(analysis) {
    currentAnalysis = analysis;
    $('#analytics-empty').style.display = 'none';
    $('#analytics-main').style.display = '';
    const periodChip = $('#analytics-period-chip');
    if (periodChip) periodChip.textContent = analysis.period || '当前导入周期';
    const rowCount = $('#analytics-row-count');
    if (rowCount) rowCount.textContent = `${analysis.records.length} 个商品 · 仅展示前 50`;
    renderKpis(analysis);
    renderChannelGmv(analysis);
    renderFunnel(analysis);
    renderTopProducts(analysis);
    renderDiagnostics(analysis);
    renderTable(analysis);
  }

  async function handleFile(file) {
    if (!file) return;
    if (typeof window.XLSX === 'undefined') {
      showToast('Excel 解析库还没有加载完成，请稍后再试。', 'error');
      return;
    }
    const meta = $('#analytics-file-meta');
    if (meta) meta.textContent = `正在解析：${file.name}`;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: 'array' });
      const parsed = TKAnalyticsParser.parseRows(getSheetRows(workbook));
      const analysis = TKAnalyticsAnalyzer.analyze(parsed.records, parsed.period);
      if (meta) meta.textContent = `${file.name} · ${analysis.period || '未知周期'} · ${analysis.records.length} 个商品`;
      renderAnalysis(analysis);
      showToast('商品流量数据已生成看板', 'ok');
    } catch (error) {
      if (meta) meta.textContent = '解析失败';
      showToast(error.message || 'Excel 解析失败', 'error');
    }
  }

  function bindEvents() {
    if (initialized) return;
    initialized = true;
    const input = $('#analytics-file-input');
    if (input) {
      input.addEventListener('change', event => {
        const file = event.target.files?.[0] || null;
        void handleFile(file);
      });
    }
  }

  function onEnter() {
    bindEvents();
    if (currentAnalysis) renderAnalysis(currentAnalysis);
  }

  return {
    onEnter,
    parseRows: TKAnalyticsParser.parseRows,
    analyze: TKAnalyticsAnalyzer.analyze
  };
})();

if (typeof TKDataSourceRegistry !== 'undefined') {
  TKDataSourceRegistry.registerProvider('analytics', {
    key: 'browser-excel',
    label: '浏览器本地 Excel',
    module: TKAnalytics,
    ownership: 'user-owned',
    storesUserData: false,
    localFirst: true,
    offline: 'memory-only'
  });
}
