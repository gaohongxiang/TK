/* ============================================================
 * 数据源注册表：只登记用户自有数据源，不托管业务数据
 * ============================================================ */
const TKDataSourceRegistry = (function () {
  const providers = {
    orders: new Map(),
    products: new Map(),
    analytics: new Map()
  };

  function normalizeDomain(domain) {
    const key = String(domain || '').trim();
    if (!providers[key]) throw new Error(`未知数据域：${key}`);
    return key;
  }

  function normalizeProvider(provider) {
    if (!provider || typeof provider !== 'object') throw new Error('数据源 provider 不能为空');
    const key = String(provider.key || '').trim();
    if (!key) throw new Error('数据源 provider 需要 key');
    return {
      ...provider,
      key,
      label: String(provider.label || key).trim(),
      ownership: provider.ownership || 'user-owned',
      storesUserData: provider.storesUserData === true,
      localFirst: provider.localFirst !== false
    };
  }

  function register(domain, provider) {
    const key = normalizeDomain(domain);
    const next = normalizeProvider(provider);
    providers[key].set(next.key, next);
    return next;
  }

  function get(domain, key) {
    const domainKey = normalizeDomain(domain);
    return providers[domainKey].get(String(key || '').trim()) || null;
  }

  function list(domain) {
    const domainKey = normalizeDomain(domain);
    return Array.from(providers[domainKey].values());
  }

  function clear(domain) {
    if (domain) {
      providers[normalizeDomain(domain)].clear();
      return;
    }
    Object.values(providers).forEach(map => map.clear());
  }

  function registerProvider(domain, provider) {
    return register(domain, provider);
  }

  function getProvider(domain, key) {
    return get(domain, key);
  }

  function listProviders(domain) {
    return list(domain);
  }

  return {
    register,
    get,
    list,
    clear,
    registerProvider,
    getProvider,
    listProviders
  };
})();
