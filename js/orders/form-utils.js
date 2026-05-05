/* ============================================================
 * 订单跟踪器：弹窗纯函数
 * ============================================================ */
const OrderTrackerFormUtils = (function () {
  function formatProductSize(product = {}) {
    const values = [product?.lengthCm, product?.widthCm, product?.heightCm]
      .map(value => String(value ?? '').trim())
      .filter(Boolean);
    return values.length === 3 ? values.join('×') : '';
  }

  function buildProductLabel(product = {}) {
    const tkId = String(product?.tkId || '').trim();
    const name = String(product?.name || '').trim();
    if (tkId && name) return `${tkId} - ${name}`;
    return tkId || name || '';
  }

  function getProductSkus(product = {}) {
    return Array.isArray(product?.skus)
      ? product.skus.filter(sku => String(sku?.skuId || '').trim())
      : [];
  }

  function buildSkuLabel(sku = {}) {
    const skuId = String(sku?.skuId || '').trim();
    const skuName = String(sku?.skuName || '').trim();
    if (skuId && skuName) return `${skuName} - ${skuId}`;
    return skuName || skuId || '未命名SKU';
  }

  function skuUsesProductDefaults(sku = {}) {
    if (sku?.useProductDefaults === true) return true;
    if (sku?.useProductDefaults === false) return false;
    const hasOwnSpec = !!String(sku?.weightG || '').trim()
      || !!String(sku?.sizeText || '').trim()
      || !!String(sku?.lengthCm || '').trim()
      || !!String(sku?.widthCm || '').trim()
      || !!String(sku?.heightCm || '').trim()
      || !!String(sku?.estimatedShippingFee || '').trim()
      || !!String(sku?.chargeWeightKg || '').trim()
      || !!String(sku?.shippingNote || '').trim();
    return !hasOwnSpec;
  }

  function getProductDefaults(product = {}) {
    return product?.defaults && typeof product.defaults === 'object'
      ? product.defaults
      : product;
  }

  function resolveProductSnapshotSource(product = null, sku = null) {
    const defaults = getProductDefaults(product || {});
    if (!sku) return defaults || null;
    if (!skuUsesProductDefaults(sku)) return sku;
    return {
      ...product,
      ...defaults,
      ...sku,
      weightG: sku?.weightG || defaults?.weightG || '',
      lengthCm: sku?.lengthCm || defaults?.lengthCm || '',
      widthCm: sku?.widthCm || defaults?.widthCm || '',
      heightCm: sku?.heightCm || defaults?.heightCm || '',
      estimatedShippingFee: sku?.estimatedShippingFee || defaults?.estimatedShippingFee || '',
      chargeWeightKg: sku?.chargeWeightKg || defaults?.chargeWeightKg || '',
      shippingNote: sku?.shippingNote || defaults?.shippingNote || '',
      sizeText: sku?.sizeText || defaults?.sizeText || ''
    };
  }

  function createOrderItemDraft(seed = {}, { uid = null } = {}) {
    const nextUid = typeof uid === 'function'
      ? uid
      : () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const quantityRaw = Number.parseInt(String(seed.quantity ?? seed['数量'] ?? '').trim(), 10);
    const rawUseOrderCourier = seed.useOrderCourier ?? seed['跟随订单默认快递'];
    const hasUseOrderCourier = rawUseOrderCourier !== undefined
      && rawUseOrderCourier !== null
      && String(rawUseOrderCourier).trim() !== '';
    return {
      lineId: String(seed.lineId || nextUid()),
      productTkId: String(seed.productTkId || seed['商品TK ID'] || '').trim(),
      productSkuId: String(seed.productSkuId || seed['商品SKU ID'] || '').trim(),
      productSkuName: String(seed.productSkuName || seed['商品SKU名称'] || '').trim(),
      productName: String(seed.productName || seed['产品名称'] || '').trim(),
      quantity: Number.isFinite(quantityRaw) && quantityRaw > 0 ? String(quantityRaw) : '1',
      unitSalePrice: String(seed.unitSalePrice ?? seed['单件售价'] ?? seed['售价'] ?? '').trim(),
      unitPurchasePrice: String(seed.unitPurchasePrice ?? seed['单件采购价'] ?? seed['采购价格'] ?? '').trim(),
      unitWeightG: String(seed.unitWeightG ?? seed['单件重量'] ?? seed['重量'] ?? '').trim(),
      unitSizeText: String(seed.unitSizeText ?? seed['单件尺寸'] ?? seed['尺寸'] ?? '').trim(),
      useOrderCourier: hasUseOrderCourier
        ? !['0', 'false', 'no', 'n'].includes(String(rawUseOrderCourier).trim().toLowerCase())
        : null,
      courierCompany: String(seed.courierCompany ?? seed['快递公司'] ?? '').trim(),
      trackingNo: String(seed.trackingNo ?? seed['快递单号'] ?? '').trim()
    };
  }

  function buildLegacyOrderItems(order = {}, options = {}) {
    const hasLegacyValues = [
      order?.['商品TK ID'],
      order?.['商品SKU ID'],
      order?.['产品名称'],
      order?.['数量'],
      order?.['售价'],
      order?.['采购价格'],
      order?.['重量'],
      order?.['尺寸']
    ].some(value => String(value || '').trim());
    if (!hasLegacyValues) return [createOrderItemDraft({}, options)];
    return [createOrderItemDraft(order, options)];
  }

  function getOrderItemsFromOrder(order = {}, options = {}) {
    if (Array.isArray(order?.items) && order.items.length) {
      return order.items.map(item => {
        const draft = createOrderItemDraft(item, options);
        if (draft.useOrderCourier !== false) {
          if (!draft.courierCompany) draft.courierCompany = String(order?.['快递公司'] || '').trim();
          if (!draft.trackingNo) draft.trackingNo = String(order?.['快递单号'] || '').trim();
        }
        draft.useOrderCourier = null;
        return draft;
      });
    }
    return buildLegacyOrderItems(order, options);
  }

  function buildOrderItemLabel(item = {}) {
    const productName = String(item?.productName || '').trim();
    const skuName = String(item?.productSkuName || '').trim();
    if (productName && skuName) return `${productName} - ${skuName}`;
    return productName || skuName || '';
  }

  function buildOrderItemsSummary(items = []) {
    const lines = (Array.isArray(items) ? items : []).filter(item => buildOrderItemLabel(item));
    return lines.map(buildOrderItemLabel).join(' / ');
  }

  function formatMoneyValue(value) {
    if (!Number.isFinite(value)) return '';
    return value.toFixed(2).replace(/\.?0+$/, '');
  }

  function parseMoneyValue(value) {
    const raw = String(value ?? '').replace(/,/g, '').trim();
    if (!raw) return null;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatNumericValue(value) {
    if (!Number.isFinite(value)) return '';
    return value.toFixed(2).replace(/\.?0+$/, '');
  }

  function parseSizeText(value) {
    const matched = String(value || '')
      .trim()
      .replace(/[Xx＊*]/g, '×')
      .match(/\d+(?:\.\d+)?/g);
    if (!matched || matched.length < 3) {
      return {
        lengthCm: '',
        widthCm: '',
        heightCm: ''
      };
    }
    const [lengthCm, widthCm, heightCm] = matched.slice(0, 3).map(part => Number.parseFloat(part));
    return {
      lengthCm: Number.isFinite(lengthCm) ? lengthCm : '',
      widthCm: Number.isFinite(widthCm) ? widthCm : '',
      heightCm: Number.isFinite(heightCm) ? heightCm : ''
    };
  }

  return {
    buildLegacyOrderItems,
    buildOrderItemLabel,
    buildOrderItemsSummary,
    buildProductLabel,
    buildSkuLabel,
    createOrderItemDraft,
    formatMoneyValue,
    formatNumericValue,
    formatProductSize,
    getOrderItemsFromOrder,
    getProductDefaults,
    getProductSkus,
    parseMoneyValue,
    parseSizeText,
    resolveProductSnapshotSource,
    skuUsesProductDefaults
  };
})();
