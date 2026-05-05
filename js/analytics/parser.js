/* ============================================================
 * 数据分析：商品流量 Excel 解析
 * ============================================================ */
const TKAnalyticsParser = (function () {
  const CHANNELS = [
    {
      key: 'mall',
      label: '商城',
      gmv: '商城页 GMV',
      units: '商城商品成交件数',
      exposure: '商城页发品曝光次数',
      pageViews: '商城页面浏览次数',
      customers: '商城页去重商品客户数',
      ctr: '商城点击率',
      conversion: '商城转化率'
    },
    {
      key: 'video',
      label: '视频',
      gmv: '视频归因 GMV',
      units: '视频归因成交件数',
      exposure: '视频曝光次数',
      pageViews: '来自视频的页面浏览次数',
      customers: '视频去重商品客户数',
      ctr: '视频点击率',
      conversion: '视频转化率'
    },
    {
      key: 'productCard',
      label: '商品卡',
      gmv: '商品卡归因 GMV',
      units: '商品卡归因成交件数',
      exposure: '商品卡曝光次数',
      pageViews: '商品卡的页面浏览次数',
      customers: '商品卡去重客户数',
      ctr: '商品卡点击率',
      conversion: '商品卡转化率'
    },
    {
      key: 'live',
      label: '直播',
      gmv: '直播归因 GMV',
      units: '直播归因成交件数',
      exposure: '直播曝光次数',
      pageViews: '直播的页面浏览次数',
      customers: '直播去重商品客户数',
      ctr: '直播点击率',
      conversion: '直播转化率'
    }
  ];

  function normalizeNumber(value) {
    const raw = String(value ?? '')
      .replace(/[,\s]/g, '')
      .replace(/[円¥￥]/g, '')
      .replace(/%/g, '')
      .trim();
    if (!raw || raw === '-') return 0;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizePercent(value) {
    return normalizeNumber(value) / 100;
  }

  function normalizeRecord(record) {
    const channels = Object.fromEntries(CHANNELS.map(channel => [channel.key, {
      label: channel.label,
      gmv: normalizeNumber(record[channel.gmv]),
      units: normalizeNumber(record[channel.units]),
      exposure: normalizeNumber(record[channel.exposure]),
      pageViews: normalizeNumber(record[channel.pageViews]),
      customers: normalizeNumber(record[channel.customers]),
      ctr: normalizePercent(record[channel.ctr]),
      conversion: normalizePercent(record[channel.conversion])
    }]));
    const exposureTotal = CHANNELS.reduce((sum, channel) => sum + channels[channel.key].exposure, 0);
    const pageViewsTotal = CHANNELS.reduce((sum, channel) => sum + channels[channel.key].pageViews, 0);
    const customersTotal = CHANNELS.reduce((sum, channel) => sum + channels[channel.key].customers, 0);
    return {
      id: String(record.ID || '').trim(),
      name: String(record['商品'] || '').trim(),
      status: String(record['状态'] || '').trim(),
      gmv: normalizeNumber(record.GMV),
      units: normalizeNumber(record['成交件数']),
      orders: normalizeNumber(record['订单数']),
      exposureTotal,
      pageViewsTotal,
      customersTotal,
      overallCtr: exposureTotal ? pageViewsTotal / exposureTotal : 0,
      overallConversion: customersTotal ? normalizeNumber(record['成交件数']) / customersTotal : 0,
      channels
    };
  }

  function parseRows(rows) {
    const nonEmptyRows = (rows || []).filter(row => Array.isArray(row) && row.some(cell => String(cell || '').trim()));
    if (nonEmptyRows.length < 2) throw new Error('Excel 内容为空或格式不完整');
    const period = String(nonEmptyRows[0]?.[0] || '').trim();
    const headerIndex = nonEmptyRows.findIndex(row => String(row?.[0] || '').trim() === 'ID' && String(row?.[1] || '').trim() === '商品');
    if (headerIndex < 0) throw new Error('没有找到商品流量表头，请确认是 TK 商品流量详情导出表');
    const headers = nonEmptyRows[headerIndex].map(value => String(value || '').trim());
    const records = nonEmptyRows.slice(headerIndex + 1)
      .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
      .filter(record => String(record.ID || '').trim());
    if (!records.length) throw new Error('没有读取到商品数据');
    return {
      period,
      records: records.map(normalizeRecord)
    };
  }

  return {
    CHANNELS,
    normalizeNumber,
    normalizePercent,
    normalizeRecord,
    parseRows
  };
})();
