/* ============================================================
 * 数据分析：商品流量汇总与诊断
 * ============================================================ */
const TKAnalyticsAnalyzer = (function () {
  const CHANNELS = typeof TKAnalyticsParser !== 'undefined' ? TKAnalyticsParser.CHANNELS : [];

  function sum(records, resolver) {
    return records.reduce((total, record) => total + (Number(resolver(record)) || 0), 0);
  }

  function buildChannelTotals(records) {
    return CHANNELS.map(channel => {
      const total = records.reduce((acc, record) => {
        const row = record.channels[channel.key];
        return {
          gmv: acc.gmv + row.gmv,
          units: acc.units + row.units,
          exposure: acc.exposure + row.exposure,
          pageViews: acc.pageViews + row.pageViews,
          customers: acc.customers + row.customers
        };
      }, { gmv: 0, units: 0, exposure: 0, pageViews: 0, customers: 0 });
      return {
        ...channel,
        ...total,
        ctr: total.exposure ? total.pageViews / total.exposure : 0,
        conversion: total.customers ? total.units / total.customers : 0
      };
    });
  }

  function diagnoseProduct(record, thresholds) {
    if (record.gmv >= thresholds.heroGmv || record.orders >= thresholds.heroOrders) {
      return { tone: 'hero', label: '爆品放大', action: '继续加视频素材、补库存，配合新客券和秒杀价放大成交。' };
    }
    if (record.orders > 0 && record.exposureTotal < thresholds.mediumExposure) {
      return { tone: 'scale', label: '加流量', action: '已有成交但曝光不足，优先补短视频和商品卡曝光。' };
    }
    if (record.exposureTotal >= thresholds.highExposure && record.overallCtr < thresholds.lowCtr) {
      return { tone: 'creative', label: '换素材', action: '曝光不低但点击弱，优先换主图、标题关键词和视频前三秒。' };
    }
    if (record.pageViewsTotal >= thresholds.highPageViews && record.orders === 0) {
      return { tone: 'detail', label: '承接差', action: '有浏览无成交，检查价格、评价、详情页卖点和优惠券。' };
    }
    if (record.exposureTotal <= thresholds.lowExposure && record.orders === 0) {
      return { tone: 'watch', label: '观察下架', action: '低曝光且无成交，短期补素材测试，仍无起量则下架或换品。' };
    }
    return { tone: 'normal', label: '常规观察', action: '保持监控，优先把资源给高转化或高 GMV 商品。' };
  }

  function analyze(records, period) {
    const activeRecords = records.filter(record => record.status !== 'Inactive');
    const channelTotals = buildChannelTotals(records);
    const totalGmv = sum(records, record => record.gmv);
    const totalOrders = sum(records, record => record.orders);
    const totalUnits = sum(records, record => record.units);
    const totalExposure = sum(records, record => record.exposureTotal);
    const soldProducts = records.filter(record => record.orders > 0).length;
    const thresholds = {
      heroGmv: Math.max(5000, totalGmv * 0.12),
      heroOrders: 8,
      highExposure: Math.max(2500, totalExposure / Math.max(records.length, 1) * 2.2),
      mediumExposure: Math.max(1200, totalExposure / Math.max(records.length, 1)),
      lowExposure: Math.max(80, totalExposure / Math.max(records.length, 1) * 0.12),
      highPageViews: 80,
      lowCtr: 0.018
    };
    const enriched = records.map(record => ({
      ...record,
      diagnosis: diagnoseProduct(record, thresholds)
    }));
    return {
      period,
      records: enriched,
      activeCount: activeRecords.length,
      channelTotals,
      kpis: {
        totalGmv,
        totalOrders,
        totalUnits,
        totalExposure,
        soldProducts,
        productCount: records.length,
        aov: totalOrders ? totalGmv / totalOrders : 0,
        unitPrice: totalUnits ? totalGmv / totalUnits : 0
      }
    };
  }

  return {
    buildChannelTotals,
    diagnoseProduct,
    analyze
  };
})();
