/* ============================================================
 * 订单跟踪器：商品资料读取桥接
 * ============================================================ */
const OrderTrackerProducts = (function () {
  function create({ state, helpers = {}, ui = {} } = {}) {
    const productState = {
      firestoreConfigText: '',
      firestoreProjectId: '',
      user: ''
    };
    let productProvider = null;
    let productLoadPromise = null;

    const nowIso = helpers.nowIso || (() => new Date().toISOString());
    const normalizeAccountName = helpers.normalizeAccountName || (value => String(value || '').trim());
    const getConfig = helpers.getConfig || (() => window.TKFirestoreConnection?.getConfig?.() || null);
    const notifyRulesUpdateNeeded = helpers.notifyRulesUpdateNeeded || (message => (
      window.TKFirestoreConnection?.notifyRulesUpdateNeeded?.(message)
    ));
    const toast = ui.toast || (() => {});

    function getProductProvider() {
      if (productProvider) return productProvider;
      if (typeof ProductLibraryProviderFirestore === 'undefined') return null;
      productProvider = ProductLibraryProviderFirestore.create({
        state: productState,
        helpers: {
          nowIso
        }
      });
      return productProvider;
    }

    function formatProductAccessError(error, fallback = '商品资料加载失败') {
      const message = String(error?.message || '').trim();
      if (String(error?.code || '').includes('permission-denied') || /Missing or insufficient permissions/i.test(message)) {
        const next = '当前 Firebase 项目的 Firestore 规则还没放行 products 集合。请重新复制并发布最新规则。';
        notifyRulesUpdateNeeded(next);
        return next;
      }
      return message || fallback;
    }

    function getProductsForAccount(accountName = '') {
      const normalized = normalizeAccountName(accountName);
      return (state.products || [])
        .filter(product => normalizeAccountName(product?.accountName) === normalized)
        .sort((left, right) => String(left?.tkId || '').localeCompare(String(right?.tkId || '')));
    }

    function getProductByTkId(tkId = '') {
      const normalized = String(tkId || '').trim();
      if (!normalized) return null;
      return (state.products || []).find(product => String(product?.tkId || '').trim() === normalized) || null;
    }

    async function loadProductsForModal({ silent = false, force = false } = {}) {
      const cfg = getConfig();
      const provider = getProductProvider();
      if (!cfg?.configText || !provider) {
        state.products = [];
        return [];
      }
      const configChanged = productState.firestoreProjectId !== (cfg.projectId || '');
      if (!force && !configChanged && Array.isArray(state.products) && state.products.length) {
        return state.products;
      }
      if (productLoadPromise) return productLoadPromise;
      productLoadPromise = (async () => {
        try {
          await provider.init({ configText: cfg.configText });
          const result = await provider.pullProducts();
          state.products = Array.isArray(result?.products) ? result.products : [];
          return state.products;
        } catch (error) {
          state.products = [];
          if (!silent) toast(formatProductAccessError(error), 'error');
          return [];
        } finally {
          productLoadPromise = null;
        }
      })();
      return productLoadPromise;
    }

    function resetProductCache() {
      state.products = [];
      productState.firestoreConfigText = '';
      productState.firestoreProjectId = '';
      productState.user = '';
      productLoadPromise = null;
    }

    return {
      formatProductAccessError,
      getProductByTkId,
      getProductsForAccount,
      loadProductsForModal,
      resetProductCache
    };
  }

  return {
    create
  };
})();
