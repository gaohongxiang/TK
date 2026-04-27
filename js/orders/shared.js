/* ============================================================
 * 订单跟踪器：共享 helper 与领域规则
 * ============================================================ */
const OrderTrackerShared = (function () {
  function create({ state, constants }) {
    const {
      UNASSIGNED_ACCOUNT_SLOT,
      ACCOUNT_FILE_PREFIX,
      ACCOUNT_FILE_SUFFIX,
      COURIER_AUTO_DETECTORS
    } = constants;

    const $ = selector => document.querySelector(selector);

    function uid() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function nowIso() {
      return new Date().toISOString();
    }

    function parseLegacyUidTimestamp(id) {
      const raw = String(id || '').trim().toLowerCase();
      if (!/^[0-9a-z]{7,}$/.test(raw)) return '';
      const prefix = raw.slice(0, -6);
      if (!prefix) return '';
      const parsed = parseInt(prefix, 36);
      if (!Number.isFinite(parsed)) return '';
      if (parsed < Date.parse('2020-01-01T00:00:00.000Z')) return '';
      if (parsed > Date.parse('2100-01-01T00:00:00.000Z')) return '';
      return new Date(parsed).toISOString();
    }

    function getOrderCreatedAt(order) {
      const direct = String(order?.createdAt || order?.created_at || '').trim();
      if (direct) return direct;
      const fromId = parseLegacyUidTimestamp(order?.id);
      if (fromId) return fromId;
      return String(order?.updatedAt || order?.updated_at || '').trim();
    }

    function showDatePicker(input) {
      if (!input || input.readOnly || input.disabled || typeof input.showPicker !== 'function') return;
      try {
        input.showPicker();
      } catch (error) {}
    }

    function roundMoney(value) {
      return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
    }

    function parseOrderMoneyValue(value) {
      const raw = String(value ?? '').replace(/,/g, '').trim();
      if (!raw) return null;
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function formatOrderSummaryNumber(value) {
      if (!Number.isFinite(value)) return '';
      return Number(value.toFixed(2)).toString();
    }

    function parseExchangeRateValue(value) {
      const parsed = parseOrderMoneyValue(value);
      return parsed && parsed > 0 ? parsed : null;
    }

    function isOrderRefunded(order) {
      const raw = String(
        order?.['是否退款']
        ?? order?.isRefunded
        ?? order?.refunded
        ?? ''
      ).trim().toLowerCase();
      return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
    }

    function getPricingExchangeRate() {
      const globalStore = typeof window !== 'undefined' ? window.__tkGlobalSettingsStore : null;
      return typeof globalStore?.getExchangeRate === 'function'
        ? parseExchangeRateValue(globalStore.getExchangeRate())
        : null;
    }

    function computeOrderSaleCny(order, exchangeRate = getPricingExchangeRate()) {
      const saleJpy = parseOrderMoneyValue(order?.['售价'] ?? order?.salePrice);
      const rate = parseExchangeRateValue(exchangeRate);
      if (rate === null) return null;
      if (isOrderRefunded(order)) return 0;
      if (saleJpy === null || saleJpy <= 0) return null;
      return roundMoney(saleJpy / rate);
    }

    function computeOrderEstimatedProfit(order, exchangeRate = getPricingExchangeRate()) {
      const saleCny = computeOrderSaleCny(order, exchangeRate);
      const purchase = parseOrderMoneyValue(order?.['采购价格'] ?? order?.purchasePrice);
      const shipping = parseOrderMoneyValue(order?.['预估运费'] ?? order?.estimatedShippingFee);
      if (saleCny === null || purchase === null || shipping === null) return null;
      return roundMoney(saleCny - purchase - shipping);
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
      ));
    }

    function normalizeStatusValue(value) {
      return String(value || '').trim();
    }

    function normalizeOrderSeq(value) {
      const parsed = Number.parseInt(String(value ?? '').trim(), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function normalizeOrderItem(item = {}) {
      const quantity = Number.parseInt(String(item?.quantity ?? item?.['数量'] ?? '').trim(), 10);
      return {
        lineId: String(item?.lineId || '').trim() || uid(),
        productTkId: String(item?.productTkId || item?.['商品TK ID'] || '').trim(),
        productSkuId: String(item?.productSkuId || item?.['商品SKU ID'] || '').trim(),
        productSkuName: String(item?.productSkuName || item?.['商品SKU名称'] || '').trim(),
        productName: String(item?.productName || item?.['产品名称'] || '').trim(),
        quantity: Number.isFinite(quantity) && quantity > 0 ? String(quantity) : '1',
        unitPurchasePrice: String(item?.unitPurchasePrice ?? item?.['单件采购价'] ?? item?.['采购价格'] ?? '').trim(),
        unitSalePrice: String(item?.unitSalePrice ?? item?.['单件售价'] ?? item?.['售价'] ?? '').trim(),
        unitWeightG: String(item?.unitWeightG ?? item?.['单件重量'] ?? item?.['重量'] ?? '').trim(),
        unitSizeText: String(item?.unitSizeText ?? item?.['单件尺寸'] ?? item?.['尺寸'] ?? '').trim()
      };
    }

    function normalizeOrderItems(items = []) {
      return Array.isArray(items)
        ? items.map(normalizeOrderItem).filter(item => (
          item.productTkId
          || item.productSkuId
          || item.productName
          || item.unitPurchasePrice
          || item.unitSalePrice
          || item.unitWeightG
          || item.unitSizeText
        ))
        : [];
    }

    function getOrderItemSummaryParts(item = {}) {
      const rawProductName = String(item?.productName || '').trim();
      const skuName = String(item?.productSkuName || '').trim();
      const quantity = Number.parseInt(String(item?.quantity || '').trim(), 10);
      let productName = rawProductName;
      if (productName && skuName) {
        [` - ${skuName}`, ` / ${skuName}`].forEach(suffix => {
          if (productName.endsWith(suffix)) {
            productName = productName.slice(0, -suffix.length).trim();
          }
        });
      }
      return {
        productName,
        skuName,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1
      };
    }

    function buildOrderItemsSummary(items = []) {
      const groups = [];
      normalizeOrderItems(items).forEach(item => {
        const meta = getOrderItemSummaryParts(item);
        const key = meta.productName || meta.skuName;
        if (!key) return;
        let group = groups.find(entry => entry.key === key);
        if (!group) {
          group = {
            key,
            productName: meta.productName || key,
            entries: []
          };
          groups.push(group);
        }
        group.entries.push({
          skuName: meta.skuName,
          quantity: meta.quantity
        });
      });
      return groups.map(group => {
        const hasSku = group.entries.some(entry => entry.skuName);
        if (!hasSku) {
          const totalQty = group.entries.reduce((sum, entry) => sum + entry.quantity, 0);
          return totalQty > 1 ? `${group.productName} ×${totalQty}` : group.productName;
        }
        const entryText = group.entries.map(entry => (
          `${entry.skuName}${entry.quantity > 1 ? ` ×${entry.quantity}` : ''}`
        )).join('，');
        return `${group.productName}（${entryText}）`;
      }).join(' / ');
    }

    function deriveOrderItemTotals(items = []) {
      return normalizeOrderItems(items).reduce((acc, item) => {
        const quantity = Number.parseInt(String(item.quantity || '').trim(), 10) || 0;
        const unitPurchasePrice = parseOrderMoneyValue(item.unitPurchasePrice) || 0;
        const unitSalePrice = parseOrderMoneyValue(item.unitSalePrice) || 0;
        const unitWeightG = parseOrderMoneyValue(item.unitWeightG) || 0;
        return {
          quantity: acc.quantity + quantity,
          purchase: acc.purchase + (unitPurchasePrice * quantity),
          sale: acc.sale + (unitSalePrice * quantity),
          weight: acc.weight + (unitWeightG * quantity)
        };
      }, {
        quantity: 0,
        purchase: 0,
        sale: 0,
        weight: 0
      });
    }

    function normalizeOrderRecord(order) {
      const next = { ...order };
      const mergedStatus = normalizeStatusValue(next['入仓状态']) || normalizeStatusValue(next['订单状态']);
      next['订单状态'] = mergedStatus;
      next['是否退款'] = isOrderRefunded(next) ? '1' : '';
      const seq = normalizeOrderSeq(next.seq);
      if (seq !== null) next.seq = seq;
      else delete next.seq;
      const createdAt = getOrderCreatedAt(next);
      if (createdAt) next.createdAt = createdAt;
      delete next.created_at;
      delete next['入仓状态'];
      const items = normalizeOrderItems(next.items);
      if (items.length) {
        const totals = deriveOrderItemTotals(items);
        const summary = buildOrderItemsSummary(items);
        const onlyItem = items.length === 1 ? items[0] : null;
        const topLevelPurchase = String(next['采购价格'] || '').trim();
        const topLevelSale = String(next['售价'] || '').trim();
        next.items = items;
        next['产品名称'] = summary || String(next['产品名称'] || '').trim();
        next['数量'] = totals.quantity ? String(totals.quantity) : '';
        next['采购价格'] = topLevelPurchase || (totals.purchase ? formatOrderSummaryNumber(totals.purchase) : '');
        next['售价'] = topLevelSale || (totals.sale ? formatOrderSummaryNumber(totals.sale) : '');
        if (!String(next['重量'] || '').trim()) {
          next['重量'] = totals.weight ? formatOrderSummaryNumber(totals.weight) : '';
        }
        if (!String(next['尺寸'] || '').trim() && onlyItem?.unitSizeText) {
          next['尺寸'] = onlyItem.unitSizeText;
        }
        next['商品TK ID'] = onlyItem?.productTkId || '';
        next['商品SKU ID'] = onlyItem?.productSkuId || '';
        next['商品SKU名称'] = onlyItem?.productSkuName || '';
      } else {
        delete next.items;
      }
      return next;
    }

    function normalizeOrderList(list) {
      return Array.isArray(list) ? list.map(normalizeOrderRecord) : [];
    }

    function cloneOrder(order) {
      return order ? normalizeOrderRecord({ ...order }) : null;
    }

    function getOrderUpdatedAt(order) {
      return String(order?.updatedAt || order?.updated_at || '').trim();
    }

    function serializeOrder(order) {
      if (!order) return '';
      const normalized = normalizeOrderRecord({ ...order });
      const sorted = {};
      Object.keys(normalized).sort().forEach(key => {
        const value = normalized[key];
        if (typeof value === 'undefined') return;
        sorted[key] = value;
      });
      return JSON.stringify(sorted);
    }

    function ordersEqual(a, b) {
      if (!a && !b) return true;
      if (!a || !b) return false;
      return serializeOrder(a) === serializeOrder(b);
    }

    function mapOrdersById(orders) {
      const map = new Map();
      normalizeOrderList(orders).forEach(order => {
        if (!order?.id) return;
        map.set(String(order.id), order);
      });
      return map;
    }

    function getOrderLabel(order) {
      if (!order) return '';
      return String(order['订单号'] || order['产品名称'] || order.id || '').trim();
    }

    function getOrderChangeType(base, next) {
      if (!base && next) return '新增';
      if (base && !next) return '删除';
      if (base && next && !ordersEqual(base, next)) return '修改';
      return '未改动';
    }

    function confirmConflictResolution({ base, local, remote }) {
      const localLabel = getOrderLabel(local);
      const remoteLabel = getOrderLabel(remote);
      const baseLabel = getOrderLabel(base);
      const label = localLabel || remoteLabel || baseLabel || '未命名订单';
      const localAction = getOrderChangeType(base, local);
      const remoteAction = getOrderChangeType(base, remote);
      return window.confirm(
        `订单「${label}」在当前电脑和云端都被改动了。\n本地：${localAction}\n云端：${remoteAction}\n\n确定保留当前电脑的版本？\n确定 = 本地\n取消 = 云端`
      );
    }

    function mergeOrdersById({ baseOrders = [], localOrders = [], remoteOrders = [] }) {
      const baseMap = mapOrdersById(baseOrders);
      const localMap = mapOrdersById(localOrders);
      const remoteMap = mapOrdersById(remoteOrders);
      const orderedIds = [];
      const seen = new Set();
      const pushId = id => {
        const key = String(id || '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        orderedIds.push(key);
      };

      normalizeOrderList(localOrders).forEach(order => pushId(order.id));
      normalizeOrderList(remoteOrders).forEach(order => pushId(order.id));
      normalizeOrderList(baseOrders).forEach(order => pushId(order.id));

      const merged = [];
      let conflictCount = 0;

      orderedIds.forEach(id => {
        const base = baseMap.get(id) || null;
        const local = localMap.get(id) || null;
        const remote = remoteMap.get(id) || null;
        const localChanged = !ordersEqual(local, base);
        const remoteChanged = !ordersEqual(remote, base);
        let resolved = null;

        if (!base) {
          if (local && remote) {
            if (ordersEqual(local, remote)) resolved = local;
            else {
              conflictCount += 1;
              resolved = confirmConflictResolution({ base, local, remote }) ? local : remote;
            }
          } else {
            resolved = local || remote || null;
          }
        } else if (localChanged && remoteChanged) {
          if (ordersEqual(local, remote)) resolved = local || remote;
          else {
            conflictCount += 1;
            resolved = confirmConflictResolution({ base, local, remote }) ? local : remote;
          }
        } else if (localChanged) {
          resolved = local;
        } else if (remoteChanged) {
          resolved = remote;
        } else {
          resolved = local || remote || base;
        }

        if (resolved) merged.push(cloneOrder(resolved));
      });

      return {
        orders: normalizeOrderList(merged),
        conflictCount
      };
    }

    function mergeOrdersLastWriteWins({
      baseOrders = [],
      localOrders = [],
      remoteOrders = [],
      remoteCursor = ''
    }) {
      const baseMap = mapOrdersById(baseOrders);
      const localMap = mapOrdersById(localOrders);
      const remoteMap = mapOrdersById(remoteOrders);
      const orderedIds = [];
      const seen = new Set();
      const pushId = id => {
        const key = String(id || '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        orderedIds.push(key);
      };

      normalizeOrderList(localOrders).forEach(order => pushId(order.id));
      normalizeOrderList(remoteOrders).forEach(order => pushId(order.id));
      normalizeOrderList(baseOrders).forEach(order => pushId(order.id));

      const merged = [];
      orderedIds.forEach(id => {
        const base = baseMap.get(id) || null;
        const local = localMap.get(id) || null;
        const remote = remoteMap.get(id) || null;
        const localChanged = !ordersEqual(local, base);
        const remoteChanged = !ordersEqual(remote, base);
        let resolved = local || remote || base || null;

        if (!base) {
          if (local && remote) {
            resolved = Date.parse(getOrderUpdatedAt(local) || 0) >= Date.parse(getOrderUpdatedAt(remote) || 0)
              ? local
              : remote;
          } else {
            resolved = local || remote || null;
          }
        } else if (localChanged && remoteChanged) {
          if (ordersEqual(local, remote)) resolved = local || remote;
          else {
            resolved = Date.parse(getOrderUpdatedAt(local) || 0) >= Date.parse(getOrderUpdatedAt(remote) || 0)
              ? local
              : remote;
          }
        } else if (localChanged) {
          resolved = local;
        } else if (remoteChanged) {
          resolved = remote;
        } else {
          resolved = local || remote || base;
        }

        if (resolved) merged.push(cloneOrder(resolved));
      });

      return {
        orders: normalizeOrderList(merged),
        remoteCursor
      };
    }

    function normalizeAccountName(account) {
      return String(account || '').trim();
    }

    function toAccountSlot(account) {
      const normalized = normalizeAccountName(account);
      return normalized || UNASSIGNED_ACCOUNT_SLOT;
    }

    function fromAccountSlot(slot) {
      return slot === UNASSIGNED_ACCOUNT_SLOT ? '' : slot;
    }

    function getAccountFileName(account) {
      const slot = toAccountSlot(account);
      if (slot === UNASSIGNED_ACCOUNT_SLOT) {
        return `${ACCOUNT_FILE_PREFIX}${UNASSIGNED_ACCOUNT_SLOT}${ACCOUNT_FILE_SUFFIX}`;
      }
      return `${ACCOUNT_FILE_PREFIX}${encodeURIComponent(slot)}${ACCOUNT_FILE_SUFFIX}`;
    }

    function parseAccountSlotFromFileName(filename) {
      if (!filename.startsWith(ACCOUNT_FILE_PREFIX) || !filename.endsWith(ACCOUNT_FILE_SUFFIX)) return null;
      const raw = filename.slice(ACCOUNT_FILE_PREFIX.length, -ACCOUNT_FILE_SUFFIX.length);
      if (!raw) return null;
      if (raw === UNASSIGNED_ACCOUNT_SLOT) return UNASSIGNED_ACCOUNT_SLOT;
      try {
        return decodeURIComponent(raw);
      } catch (error) {
        return raw;
      }
    }

    function uniqueAccounts(accounts) {
      return [...new Set((accounts || []).map(normalizeAccountName).filter(Boolean))];
    }

    function listOrderAccounts(orders = state.orders) {
      return uniqueAccounts((orders || []).map(order => order['账号']));
    }

    function groupOrdersByAccountSlot(orders = state.orders) {
      const grouped = {};
      normalizeOrderList(orders).forEach(order => {
        const slot = toAccountSlot(order['账号']);
        if (!grouped[slot]) grouped[slot] = [];
        grouped[slot].push(order);
      });
      return grouped;
    }

    function flattenOrdersByAccountSlot(grouped, preferredSlots = []) {
      const result = [];
      const seen = new Set();
      preferredSlots.forEach(slot => {
        if (seen.has(slot)) return;
        seen.add(slot);
        result.push(...(grouped[slot] || []));
      });
      Object.keys(grouped || {}).forEach(slot => {
        if (seen.has(slot)) return;
        result.push(...(grouped[slot] || []));
      });
      return normalizeOrderList(result);
    }

    function normalizeTrackingNumber(value) {
      return String(value || '').replace(/[\s-]+/g, '').toUpperCase();
    }

    function detectCourierCompany(trackingNumber) {
      const normalized = normalizeTrackingNumber(trackingNumber);
      if (!normalized) return '';
      const matched = COURIER_AUTO_DETECTORS.find(rule => rule.test(normalized));
      return matched ? matched.name : '';
    }

    function getOrderFormCourierFields() {
      const form = $('#ot-form');
      if (!form) return { form: null, company: null, tracking: null };
      return {
        form,
        company: form.querySelector('[name="快递公司"]'),
        tracking: form.querySelector('[name="快递单号"]')
      };
    }

    function maybeAutoDetectCourierFromForm({ force = false } = {}) {
      const { company, tracking } = getOrderFormCourierFields();
      if (!company || !tracking) return '';
      const detected = detectCourierCompany(tracking.value);
      const current = company.value || '';
      const autoDetected = company.dataset.autoDetectedCourier || '';
      if (!detected) return '';
      if (!current || current === autoDetected || force) {
        company.value = detected;
        company.dataset.autoDetectedCourier = detected;
      }
      return detected;
    }

    function todayStr() {
      const date = new Date();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${date.getFullYear()}-${month}-${day}`;
    }

    function addDays(ymd, days) {
      if (!ymd) return '';
      const [year, month, day] = ymd.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + days);
      const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
      const nextDay = String(date.getDate()).padStart(2, '0');
      return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
    }

    function diffDays(a, b) {
      if (!a || !b) return NaN;
      const [ya, ma, da] = a.split('-').map(Number);
      const [yb, mb, db] = b.split('-').map(Number);
      return Math.round((Date.UTC(ya, ma - 1, da) - Date.UTC(yb, mb - 1, db)) / 86400000);
    }

    function computeWarning(order) {
      const status = normalizeStatusValue(order['订单状态']) || normalizeStatusValue(order['入仓状态']);
      const latestWarehouseDate = order['最晚到仓时间'] || '';
      if (status === '订单取消') return { text: '取消订单', cls: 'muted' };
      if (status === '已入仓') return { text: '入仓完成', cls: 'ok' };
      if (status === '已完成') return { text: '订单完成', cls: 'ok' };
      if (status === '已送达') return { text: '订单送达', cls: 'ok' };
      if (!latestWarehouseDate) return { text: '-', cls: 'muted' };
      const delta = diffDays(todayStr(), latestWarehouseDate);
      if (delta < 0) {
        const remaining = -delta;
        if (remaining <= 2) return { text: '延误风险', cls: 'danger' };
        return { text: `剩 ${remaining} 天`, cls: 'info' };
      }
      return { text: '已超期', cls: 'danger' };
    }

    return {
      $,
      uid,
      nowIso,
      showDatePicker,
      parseOrderMoneyValue,
      getPricingExchangeRate,
      computeOrderSaleCny,
      computeOrderEstimatedProfit,
      escapeHtml,
      normalizeStatusValue,
      normalizeOrderRecord,
      normalizeOrderList,
      cloneOrder,
      normalizeOrderSeq,
      getOrderCreatedAt,
      getOrderUpdatedAt,
      ordersEqual,
      mergeOrdersById,
      mergeOrdersLastWriteWins,
      normalizeAccountName,
      toAccountSlot,
      fromAccountSlot,
      getAccountFileName,
      parseAccountSlotFromFileName,
      uniqueAccounts,
      listOrderAccounts,
      groupOrdersByAccountSlot,
      flattenOrdersByAccountSlot,
      detectCourierCompany,
      isOrderRefunded,
      getOrderFormCourierFields,
      maybeAutoDetectCourierFromForm,
      todayStr,
      addDays,
      computeWarning
    };
  }

  return {
    create
  };
})();
