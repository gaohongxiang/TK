const CHANNEL_COLORS = {
  mall: '#3b82f6',
  video: '#13c2a3',
  productCard: '#f59e0b',
  live: '#ef476f'
};

function clamp(value, min, max) {
  const number = Number(value) || 0;
  return Math.min(max, Math.max(min, number));
}

function formatDefaultPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function polarToCartesian(cx, cy, radius, angle) {
  const radians = (angle - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const safeEndAngle = endAngle - startAngle >= 359.99 ? startAngle + 359.99 : endAngle;
  const start = polarToCartesian(cx, cy, radius, safeEndAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = safeEndAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', start.x.toFixed(3), start.y.toFixed(3),
    'A', radius, radius, 0, largeArcFlag, 0, end.x.toFixed(3), end.y.toFixed(3)
  ].join(' ');
}

function buildShareSlices(channels, metric) {
  const rows = (channels || [])
    .map(channel => ({
      key: channel.key,
      label: channel.label,
      value: Math.max(0, Number(channel[metric]) || 0),
      color: CHANNEL_COLORS[channel.key] || '#8b93c2'
    }))
    .filter(row => row.value > 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!total) return [];

  let cursor = 0;
  return rows.map(row => {
    const startAngle = cursor;
    const angle = row.value / total * 360;
    cursor += angle;
    return {
      ...row,
      total,
      share: row.value / total,
      startAngle,
      endAngle: cursor
    };
  });
}

function buildDonutMarkup({ id, title, totalLabel, totalValue, slices, formatValue, formatPercent, escapeHtml }) {
  const safeEscape = escapeHtml || (value => String(value ?? ''));
  const valueFormatter = formatValue || (value => String(value ?? ''));
  const percentFormatter = formatPercent || (value => `${Math.round((Number(value) || 0) * 100)}%`);
  const radius = 54;
  const strokeWidth = 18;
  const svgSize = 140;
  const pathMarkup = slices.length
    ? slices.map(slice => `
        <path class="analytics-donut-segment"
          d="${describeArc(svgSize / 2, svgSize / 2, radius, slice.startAngle, slice.endAngle)}"
          stroke="${safeEscape(slice.color)}"
          stroke-width="${strokeWidth}"
          pathLength="100">
          <title>${safeEscape(`${slice.label} ${valueFormatter(slice.value)} · ${percentFormatter(slice.share)}`)}</title>
        </path>
      `).join('')
    : `<circle class="analytics-donut-empty-ring" cx="${svgSize / 2}" cy="${svgSize / 2}" r="${radius}" stroke-width="${strokeWidth}"></circle>`;

  const legendMarkup = slices.length
    ? slices.map(slice => `
        <div class="analytics-donut-legend-row">
          <span class="analytics-donut-swatch" style="background:${safeEscape(slice.color)}"></span>
          <span>${safeEscape(slice.label)}</span>
          <strong>${safeEscape(percentFormatter(slice.share))}</strong>
        </div>
      `).join('')
    : '<div class="analytics-empty-chart-copy">暂无可拆分的渠道数据</div>';

  return `
    <div class="analytics-donut-card" id="${safeEscape(id)}">
      <div class="analytics-donut-visual">
        <svg class="analytics-donut-svg" viewBox="0 0 ${svgSize} ${svgSize}" role="img" aria-label="${safeEscape(title)}">
          <circle class="analytics-donut-track" cx="${svgSize / 2}" cy="${svgSize / 2}" r="${radius}" stroke-width="${strokeWidth}"></circle>
          ${pathMarkup}
        </svg>
        <div class="analytics-donut-center">
          <span>${safeEscape(totalLabel)}</span>
          <strong>${safeEscape(totalValue)}</strong>
        </div>
      </div>
      <div class="analytics-donut-legend">${legendMarkup}</div>
    </div>
  `;
}

function separateBubblePoints(points, bounds) {
  const next = points.map(point => ({ ...point }));
  for (let iteration = 0; iteration < 42; iteration += 1) {
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i];
        const b = next[j];
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const minDistance = a.r + b.r + 3;
        if (distance >= minDistance) continue;
        const push = (minDistance - distance) / 2;
        const nx = dx / distance;
        const ny = dy / distance;
        a.cx -= nx * push;
        a.cy -= ny * push;
        b.cx += nx * push;
        b.cy += ny * push;
      }
    }
    next.forEach(point => {
      point.cx = clamp(point.cx, bounds.left + point.r, bounds.right - point.r);
      point.cy = clamp(point.cy, bounds.top + point.r, bounds.bottom - point.r);
    });
  }
  return next;
}

function buildBubblePoints(records, limit = 16) {
  const rows = [...(records || [])]
    .filter(record => (Number(record.exposureTotal) || 0) > 0 || (Number(record.gmv) || 0) > 0)
    .sort((a, b) => (Number(b.gmv) || 0) - (Number(a.gmv) || 0))
    .slice(0, limit);
  if (!rows.length) return [];

  const maxExposure = Math.max(...rows.map(record => Number(record.exposureTotal) || 0), 1);
  const maxConversion = Math.max(...rows.map(record => Number(record.overallConversion) || 0), 0.01);
  const maxGmv = Math.max(...rows.map(record => Number(record.gmv) || 0), 1);
  const bounds = { left: 34, right: 270, top: 38, bottom: 188 };
  const points = rows.map(record => {
    const exposure = Number(record.exposureTotal) || 0;
    const conversion = Number(record.overallConversion) || 0;
    const gmv = Number(record.gmv) || 0;
    return {
      id: record.id,
      name: record.name,
      gmv,
      exposure,
      conversion,
      diagnosis: record.diagnosis,
      cx: bounds.left + (maxExposure ? Math.log1p(exposure) / Math.log1p(maxExposure) : 0) * (bounds.right - bounds.left),
      cy: bounds.bottom - (maxConversion ? Math.sqrt(conversion / maxConversion) : 0) * (bounds.bottom - bounds.top),
      r: 5 + Math.sqrt(gmv / maxGmv) * 10
    };
  });
  return separateBubblePoints(points, bounds);
}

function buildBubbleChartMarkup({ records, formatValue, formatInteger, formatPercent, shortenText, escapeHtml }) {
  const safeEscape = escapeHtml || (value => String(value ?? ''));
  const valueFormatter = formatValue || (value => String(value ?? ''));
  const integerFormatter = formatInteger || (value => String(value ?? ''));
  const percentFormatter = formatPercent || formatDefaultPercent;
  const shortener = shortenText || (value => String(value ?? ''));
  const points = buildBubblePoints(records);
  if (!points.length) {
    return '<div class="analytics-empty-chart-copy">暂无足够数据绘制商品气泡图</div>';
  }

  const highlightPoints = [...points].sort((a, b) => b.gmv - a.gmv).slice(0, 5);
  return `
    <div class="analytics-bubble-chart">
      <svg class="analytics-bubble-svg" viewBox="0 0 300 220" role="img" aria-label="商品曝光转化 GMV 气泡图">
        <line class="analytics-bubble-axis" x1="30" y1="192" x2="276" y2="192"></line>
        <line class="analytics-bubble-axis" x1="30" y1="42" x2="30" y2="192"></line>
        <line class="analytics-bubble-grid-line" x1="30" y1="122" x2="276" y2="122"></line>
        <line class="analytics-bubble-grid-line" x1="150" y1="42" x2="150" y2="192"></line>
        ${points.map(point => `
          <circle class="analytics-bubble-point is-${safeEscape(point.diagnosis?.tone || 'normal')}"
            cx="${point.cx.toFixed(2)}"
            cy="${point.cy.toFixed(2)}"
            r="${point.r.toFixed(2)}">
            <title>${safeEscape(`${point.name} · ${valueFormatter(point.gmv)} · 曝光 ${integerFormatter(point.exposure)} · 转化 ${percentFormatter(point.conversion)}`)}</title>
          </circle>
        `).join('')}
        <text class="analytics-bubble-axis-label" x="276" y="212">曝光</text>
        <text class="analytics-bubble-axis-label" x="10" y="40">转化</text>
      </svg>
      <div class="analytics-bubble-note">圆越大 GMV 越高，越靠右曝光越高，越靠上转化越强；商品名放在下方，避免遮挡数据点。</div>
      <div class="analytics-bubble-highlights">
        ${highlightPoints.map(point => `
          <div class="analytics-bubble-highlight">
            <span class="analytics-bubble-dot is-${safeEscape(point.diagnosis?.tone || 'normal')}"></span>
            <span title="${safeEscape(point.name)}">${safeEscape(shortener(point.name, 18))}</span>
            <strong>${safeEscape(valueFormatter(point.gmv))}</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function buildChannelDonutMarkup({ analysis, metric, id, title, totalLabel, totalValue, formatValue, formatPercent, escapeHtml }) {
  return buildDonutMarkup({
    id,
    title,
    totalLabel,
    totalValue,
    slices: buildShareSlices(analysis?.channelTotals || [], metric),
    formatValue,
    formatPercent,
    escapeHtml
  });
}

const TKAnalyticsCharts = {
  CHANNEL_COLORS,
  buildShareSlices,
  buildChannelDonutMarkup,
  buildBubblePoints,
  separateBubblePoints,
  buildBubbleChartMarkup
};

export {
  TKAnalyticsCharts,
  CHANNEL_COLORS,
  buildShareSlices,
  buildChannelDonutMarkup,
  buildBubblePoints,
  separateBubblePoints,
  buildBubbleChartMarkup
};
