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

    function showDatePicker(input) {
      if (!input || input.readOnly || input.disabled || typeof input.showPicker !== 'function') return;
      try {
        input.showPicker();
      } catch (error) {}
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
      ));
    }

    function normalizeStatusValue(value) {
      return String(value || '').trim();
    }

    function normalizeOrderRecord(order) {
      const next = { ...order };
      const mergedStatus = normalizeStatusValue(next['入仓状态']) || normalizeStatusValue(next['订单状态']);
      next['订单状态'] = mergedStatus;
      delete next['入仓状态'];
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
      escapeHtml,
      normalizeStatusValue,
      normalizeOrderRecord,
      normalizeOrderList,
      cloneOrder,
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
