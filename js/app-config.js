/* ============================================================
 * 项目级配置：产品方向、模块元信息、数据边界
 * ============================================================ */
const TKAppConfig = Object.freeze({
  docsUrl: 'https://tk-evu-docs.pages.dev/',
  officialDataSource: 'firestore',
  storesUserBusinessData: false,
  dataPolicy: Object.freeze({
    orders: 'user-owned-firestore',
    products: 'user-owned-firestore',
    analytics: 'browser-memory-only',
    localSettings: 'browser-localStorage'
  }),
  modules: Object.freeze([
    Object.freeze({ key: 'calc', label: '利润计算器' }),
    Object.freeze({ key: 'products', label: '商品管理' }),
    Object.freeze({ key: 'orders', label: '订单管理' }),
    Object.freeze({ key: 'analytics', label: '数据分析' })
  ])
});
