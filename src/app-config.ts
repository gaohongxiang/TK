const TKAppConfig = Object.freeze({
  docsUrl: 'https://tk-evu-docs.pages.dev/',
  officialDataSource: 'firestore',
  storesUserBusinessData: false,
  dataPolicy: Object.freeze({
    orders: 'user-owned-firestore',
    products: 'user-owned-firestore',
    finance: 'user-owned-firestore',
    collection: 'user-owned-firestore',
    analytics: 'user-owned-firestore',
    localSettings: 'browser-localStorage'
  }),
  modules: Object.freeze([
    Object.freeze({ key: 'calc', label: '利润计算器' }),
    Object.freeze({ key: 'products', label: '商品管理' }),
    Object.freeze({ key: 'orders', label: '订单管理' }),
    Object.freeze({ key: 'finance', label: '收支管理' }),
    Object.freeze({ key: 'collection', label: '商品采编' }),
    Object.freeze({ key: 'analytics', label: '数据分析' })
  ])
});

export { TKAppConfig };
