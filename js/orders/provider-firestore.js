/* ============================================================
 * 订单跟踪器：Firebase Firestore provider
 * ============================================================ */
const OrderTrackerProviderFirestore = (function () {
  function create({ state, helpers }) {
    const { nowIso, normalizeOrderList, uniqueAccounts } = helpers;
    let app = null;
    let db = null;

    function latestIso(values) {
      return (values || []).filter(Boolean).sort().slice(-1)[0] || '';
    }

    function toPlainObject(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      return value;
    }

    function runLooseObjectParser(text) {
      try {
        return Function(`"use strict"; return (${text});`)();
      } catch (error) {
        return null;
      }
    }

    function parseConfigInput(raw) {
      if (!raw) return null;
      if (typeof raw === 'object') {
        const cfg = toPlainObject(raw);
        return cfg ? sanitizeConfig(cfg) : null;
      }

      const text = String(raw || '').trim();
      if (!text) return null;
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1 || end < start) return null;
      const body = text.slice(start, end + 1);

      const fromJson = (() => {
        try {
          return JSON.parse(body);
        } catch (error) {
          return null;
        }
      })();
      if (fromJson) return sanitizeConfig(fromJson);

      return sanitizeConfig(runLooseObjectParser(body));
    }

    function sanitizeConfig(raw) {
      const cfg = toPlainObject(raw);
      if (!cfg) return null;
      const next = {};
      ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId', 'measurementId'].forEach(key => {
        const value = String(cfg[key] || '').trim();
        if (value) next[key] = value;
      });
      if (!next.apiKey || !next.projectId || !next.appId) return null;
      if (!next.authDomain) next.authDomain = `${next.projectId}.firebaseapp.com`;
      return next;
    }

    function normalizeConfigText(raw) {
      const parsed = parseConfigInput(raw);
      return parsed ? JSON.stringify(parsed, null, 2) : '';
    }

    function hydrateConfig(raw) {
      const parsed = parseConfigInput(raw?.configText || raw?.firestoreConfigText || raw?.firebaseConfig || raw?.config || raw);
      return {
        config: parsed,
        configText: parsed ? JSON.stringify(parsed, null, 2) : '',
        projectId: parsed?.projectId || String(raw?.projectId || raw?.firestoreProjectId || '').trim(),
        user: String(raw?.user || '').trim()
      };
    }

    function serializeConfig(config) {
      const next = hydrateConfig(config || state);
      return {
        firestoreConfigText: next.configText,
        firestoreProjectId: next.projectId,
        user: next.user
      };
    }

    function getDisplayName(config = state) {
      const next = hydrateConfig(config);
      if (next.user) return `${next.user} · Firestore`;
      if (next.projectId) return `${next.projectId} · Firestore`;
      return 'Firebase Firestore';
    }

    function getCacheKey(config = state) {
      const next = hydrateConfig(config);
      return next.projectId ? null : null;
    }

    function usesBuiltInLocalCache() {
      return true;
    }

    function toNullableText(value) {
      const text = String(value ?? '').trim();
      return text ? text : null;
    }

    function toNullableInteger(value) {
      const text = String(value ?? '').trim();
      if (!text) return null;
      const parsed = Number.parseInt(text, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function toNullableDecimal(value) {
      const text = String(value ?? '').replace(/,/g, '').trim();
      if (!text) return null;
      const parsed = Number.parseFloat(text);
      return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
    }

    function toBoolean(value) {
      const raw = String(value ?? '').trim().toLowerCase();
      return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
    }

    function toIsoString(value, fallback = '') {
      if (!value && fallback) return fallback;
      if (!value) return '';
      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
      }
      if (typeof value?.toDate === 'function') return value.toDate().toISOString();
      if (value instanceof Date) return value.toISOString();
      return fallback || '';
    }

    function parseSeq(value) {
      const parsed = Number.parseInt(String(value ?? '').trim(), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function normalizeOrderItems(items = []) {
      if (!Array.isArray(items)) return [];
      return items.map(item => ({
        lineId: String(item?.lineId || '').trim() || nowIso(),
        productTkId: String(item?.productTkId || '').trim(),
        productSkuId: String(item?.productSkuId || '').trim(),
        productSkuName: String(item?.productSkuName || '').trim(),
        productName: String(item?.productName || '').trim(),
        quantity: toNullableInteger(item?.quantity) || 1,
        unitPurchasePrice: toNullableDecimal(item?.unitPurchasePrice),
        unitSalePrice: toNullableDecimal(item?.unitSalePrice),
        unitWeightG: toNullableDecimal(item?.unitWeightG),
        unitSizeText: toNullableText(item?.unitSizeText)
      }));
    }

    function getOrderItemSummaryParts(item = {}) {
      const rawProductName = String(item?.productName || '').trim();
      const skuName = String(item?.productSkuName || '').trim();
      const quantity = toNullableInteger(item?.quantity) || 1;
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
        quantity
      };
    }

    function deriveOrderItemTotals(items = []) {
      return normalizeOrderItems(items).reduce((acc, item) => ({
        quantity: acc.quantity + (item.quantity || 0),
        purchase: acc.purchase + ((item.unitPurchasePrice || 0) * (item.quantity || 0)),
        sale: acc.sale + ((item.unitSalePrice || 0) * (item.quantity || 0)),
        weight: acc.weight + ((item.unitWeightG || 0) * (item.quantity || 0))
      }), {
        quantity: 0,
        purchase: 0,
        sale: 0,
        weight: 0
      });
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

    function getOrderCreatedAt(order) {
      const direct = String(order?.createdAt || order?.created_at || '').trim();
      if (direct) return toIsoString(direct, nowIso());
      const updated = String(order?.updatedAt || order?.updated_at || '').trim();
      if (updated) return toIsoString(updated, nowIso());
      return nowIso();
    }

    function normalizePulledOrder(data) {
      const seq = parseSeq(data?.seq);
      const items = normalizeOrderItems(data?.items);
      const totals = deriveOrderItemTotals(items);
      const totalQuantity = items.length ? totals.quantity : (data?.quantity ?? '');
      const totalPurchase = (data?.purchasePrice ?? '') !== '' && data?.purchasePrice != null
        ? data?.purchasePrice
        : (items.length ? totals.purchase : data?.purchasePrice);
      const totalSale = (data?.salePrice ?? '') !== '' && data?.salePrice != null
        ? data?.salePrice
        : (items.length ? totals.sale : data?.salePrice);
      const productSummary = items.length ? buildOrderItemsSummary(items) : (data?.productName || '');
      return {
        id: String(data?.id || '').trim(),
        ...(seq !== null ? { seq } : {}),
        ...(items.length ? { items } : {}),
        createdAt: toIsoString(data?.createdAt || data?.created_at || ''),
        updatedAt: toIsoString(data?.updatedAt || data?.updated_at || ''),
        deletedAt: toIsoString(data?.deletedAt || data?.deleted_at || ''),
        '账号': data?.accountName || '',
        '下单时间': data?.orderedAt || '',
        '采购日期': data?.purchaseDate || '',
        '最晚到仓时间': data?.latestWarehouseAt || '',
        '订单预警': data?.warningText || '',
        '订单号': data?.orderNo || '',
        '商品TK ID': data?.productTkId || '',
        '商品SKU ID': data?.productSkuId || '',
        '商品SKU名称': data?.productSkuName || '',
        '产品名称': productSummary,
        '数量': totalQuantity == null || totalQuantity === '' ? '' : String(totalQuantity),
        '是否退款': data?.isRefunded ? '1' : '',
        '采购价格': totalPurchase == null || totalPurchase === '' ? '' : String(totalPurchase),
        '售价': totalSale == null || totalSale === '' ? '' : String(totalSale),
        '预估运费': data?.estimatedShippingFee == null ? '' : String(data.estimatedShippingFee),
        '预估利润': data?.estimatedProfit == null ? '' : String(data.estimatedProfit),
        '重量': data?.weightText || '',
        '尺寸': data?.sizeText || '',
        '订单状态': data?.orderStatus || '',
        '快递公司': data?.courierCompany || '',
        '快递单号': data?.trackingNo || ''
      };
    }

    function buildOrderDoc(order) {
      const seq = parseSeq(order?.seq);
      const createdAt = getOrderCreatedAt(order);
      const updatedAt = toIsoString(order?.updatedAt || order?.updated_at, createdAt || nowIso()) || nowIso();
      const items = normalizeOrderItems(order?.items);
      const totals = deriveOrderItemTotals(items);
      const productSummary = items.length ? buildOrderItemsSummary(items) : toNullableText(order?.['产品名称']);
      const onlyItem = items.length === 1 ? items[0] : null;
      const topLevelWeight = toNullableText(order?.['重量']);
      const topLevelSize = toNullableText(order?.['尺寸']);
      const topLevelPurchase = toNullableDecimal(order?.['采购价格']);
      const topLevelSale = toNullableDecimal(order?.['售价']);
      return {
        id: String(order?.id || '').trim(),
        ...(seq !== null ? { seq } : {}),
        createdAt,
        updatedAt,
        deletedAt: null,
        accountName: toNullableText(order?.['账号']),
        orderedAt: toNullableText(order?.['下单时间']),
        purchaseDate: toNullableText(order?.['采购日期']),
        latestWarehouseAt: toNullableText(order?.['最晚到仓时间']),
        warningText: toNullableText(order?.['订单预警']),
        orderNo: toNullableText(order?.['订单号']),
        productTkId: toNullableText(onlyItem?.productTkId || order?.['商品TK ID']),
        productSkuId: toNullableText(onlyItem?.productSkuId || order?.['商品SKU ID']),
        productSkuName: toNullableText(onlyItem?.productSkuName || order?.['商品SKU名称']),
        productName: productSummary,
        quantity: items.length ? totals.quantity : toNullableInteger(order?.['数量']),
        isRefunded: toBoolean(order?.['是否退款']),
        purchasePrice: topLevelPurchase ?? (items.length ? Number(totals.purchase.toFixed(2)) : null),
        salePrice: topLevelSale ?? (items.length ? Number(totals.sale.toFixed(2)) : null),
        estimatedShippingFee: toNullableDecimal(order?.['预估运费']),
        estimatedProfit: toNullableDecimal(order?.['预估利润']),
        weightText: topLevelWeight || (items.length && totals.weight ? Number(totals.weight.toFixed(2)).toString() : null),
        sizeText: topLevelSize || toNullableText(onlyItem?.unitSizeText || ''),
        orderStatus: toNullableText(order?.['订单状态']),
        courierCompany: toNullableText(order?.['快递公司']),
        trackingNo: toNullableText(order?.['快递单号']),
        items: items.length ? items.map(item => ({
          lineId: item.lineId,
          productTkId: toNullableText(item.productTkId),
          productSkuId: toNullableText(item.productSkuId),
          productSkuName: toNullableText(item.productSkuName),
          productName: toNullableText(item.productName),
          quantity: toNullableInteger(item.quantity),
          unitPurchasePrice: toNullableDecimal(item.unitPurchasePrice),
          unitSalePrice: toNullableDecimal(item.unitSalePrice),
          unitWeightG: toNullableDecimal(item.unitWeightG),
          unitSizeText: toNullableText(item.unitSizeText)
        })) : null
      };
    }

    function sortOrdersForSeqAssignment(left, right) {
      const leftCreatedAt = Date.parse(getOrderCreatedAt(left) || 0);
      const rightCreatedAt = Date.parse(getOrderCreatedAt(right) || 0);
      if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

      const leftUpdatedAt = Date.parse(String(left?.updatedAt || left?.updated_at || '').trim() || 0);
      const rightUpdatedAt = Date.parse(String(right?.updatedAt || right?.updated_at || '').trim() || 0);
      if (leftUpdatedAt !== rightUpdatedAt) return leftUpdatedAt - rightUpdatedAt;

      return String(left?.id || '').localeCompare(String(right?.id || ''));
    }

    function orderRef(currentDb, id) {
      return currentDb.collection('orders').doc(String(id || '').trim());
    }

    function accountDocId(name = '') {
      const raw = String(name || '').trim();
      return raw ? encodeURIComponent(raw) : '__unassigned__';
    }

    function accountRef(currentDb, name) {
      return currentDb.collection('order_accounts').doc(accountDocId(name));
    }

    function syncStateRef(currentDb) {
      return currentDb.collection('sync_state').doc('app');
    }

    async function requireDb() {
      if (!db) throw new Error('Firestore 尚未初始化');
      return db;
    }

    async function getQuerySnapshot(query) {
      if (!query || typeof query.get !== 'function') throw new Error('Firestore 查询不可用');
      try {
        return await query.get({ source: 'server' });
      } catch (error) {
        return query.get();
      }
    }

    async function getDocSnapshot(docRef) {
      if (!docRef || typeof docRef.get !== 'function') throw new Error('Firestore 文档不可用');
      try {
        return await docRef.get({ source: 'server' });
      } catch (error) {
        return docRef.get();
      }
    }

    async function fetchOrderDocs(currentDb) {
      const snapshot = await getQuerySnapshot(currentDb.collection('orders'));
      return snapshot.docs.map(doc => normalizePulledOrder(doc.data() || {}));
    }

    async function fetchMaxSeq(currentDb) {
      const orders = await fetchOrderDocs(currentDb);
      return orders.reduce((max, order) => Math.max(max, parseSeq(order?.seq) || 0), 0);
    }

    async function assignOrderSeqs(currentDb, orders = []) {
      const normalized = normalizeOrderList(orders).map(order => ({ ...order }));
      if (!normalized.length) return normalized;

      const remoteMaxSeq = await fetchMaxSeq(currentDb);
      let nextSeq = Math.max(
        remoteMaxSeq,
        ...normalized.map(order => parseSeq(order?.seq) || 0)
      );

      normalized
        .filter(order => parseSeq(order?.seq) === null)
        .sort(sortOrdersForSeqAssignment)
        .forEach(order => {
          nextSeq += 1;
          order.seq = nextSeq;
        });

      return normalized;
    }

    async function commitMutations(currentDb, mutations) {
      if (!mutations.length) return;
      const chunkSize = 400;
      for (let index = 0; index < mutations.length; index += chunkSize) {
        const batch = currentDb.batch();
        mutations.slice(index, index + chunkSize).forEach(apply => apply(batch));
        await batch.commit();
      }
    }

    async function init(config) {
      const next = hydrateConfig(config);
      if (!next.config || !next.projectId) throw new Error('请粘贴完整的 firebaseConfig');
      if (!window?.firebase?.initializeApp) throw new Error('Firebase 浏览器客户端未加载');

      const appName = `tk-orders-${next.projectId}`;
      app = window.firebase.apps.find(item => item.name === appName) || window.firebase.initializeApp(next.config, appName);
      db = app.firestore();
      if (!app.__tkOrdersFirestoreConfigured) {
        if (typeof db.settings === 'function') {
          try {
            db.settings({ ignoreUndefinedProperties: true });
          } catch (error) {
            const message = String(error?.message || '');
            if (!/settings can no longer be changed|already been started/i.test(message)) throw error;
          }
        }

        if (typeof db.enablePersistence === 'function') {
          try {
            await db.enablePersistence({ synchronizeTabs: true });
          } catch (error) {
            // 多标签页或浏览器限制下允许继续工作，直接退回无持久化会话。
          }
        }

        app.__tkOrdersFirestoreConfigured = true;
      }

      state.firestoreConfigText = next.configText;
      state.firestoreProjectId = next.projectId;
      state.user = next.projectId;
      return serializeConfig(state);
    }

    function isReady() {
      return !!db;
    }

    function isConnected() {
      return !!db;
    }

    async function signOut() {
      return;
    }

    async function pullSnapshot({ cursor = '' } = {}) {
      const currentDb = await requireDb();
      const [ordersSnap, accountsSnap, syncStateSnap] = await Promise.all([
        getQuerySnapshot(currentDb.collection('orders')),
        getQuerySnapshot(currentDb.collection('order_accounts')),
        getDocSnapshot(syncStateRef(currentDb))
      ]);

      const allOrderRecords = ordersSnap.docs.map(doc => normalizePulledOrder(doc.data() || {}));
      const activeOrders = normalizeOrderList(
        allOrderRecords
          .filter(order => !order.deletedAt)
          .sort((left, right) => (parseSeq(left.seq) || Number.MAX_SAFE_INTEGER) - (parseSeq(right.seq) || Number.MAX_SAFE_INTEGER))
      );
      const changedOrders = normalizeOrderList(
        allOrderRecords.filter(order => {
          const updatedAt = order.deletedAt || order.updatedAt || '';
          return !cursor || updatedAt > cursor;
        })
      );

      const accountRows = accountsSnap.docs.map(doc => {
        const data = doc.data() || {};
        return {
          name: String(data?.name || '').trim(),
          updatedAt: toIsoString(data?.updatedAt || ''),
          deletedAt: toIsoString(data?.deletedAt || '')
        };
      });
      const changedAccounts = accountRows.filter(account => {
        const updatedAt = account.deletedAt || account.updatedAt || '';
        return !cursor || updatedAt > cursor;
      });
      const activeAccounts = uniqueAccounts(accountRows.filter(row => !row.deletedAt).map(row => row.name));
      const accountUpdatedAt = latestIso(accountRows.filter(row => !row.deletedAt).map(row => row.updatedAt));

      const syncMeta = syncStateSnap.exists ? (syncStateSnap.data() || {}) : {};
      const remoteCursor = latestIso([
        cursor,
        toIsoString(syncMeta.updatedAt || ''),
        ...allOrderRecords.map(order => order.deletedAt || order.updatedAt || ''),
        ...accountRows.map(account => account.deletedAt || account.updatedAt || '')
      ]);

      return {
        orders: activeOrders,
        accounts: activeAccounts,
        changedOrders,
        changedAccounts,
        updatedAt: remoteCursor,
        accountsUpdatedAt: accountUpdatedAt,
        remoteCursor
      };
    }

    async function pushChanges({
      upserts = [],
      deletions = [],
      accountUpserts = [],
      accountDeletions = [],
      clientId = ''
    } = {}) {
      const currentDb = await requireDb();
      const updatedAt = nowIso();
      const assignedOrders = await assignOrderSeqs(currentDb, upserts);
      const mutations = [];

      assignedOrders.forEach(order => {
        const row = buildOrderDoc({
          ...order,
          updatedAt
        });
        mutations.push(batch => batch.set(orderRef(currentDb, row.id), row, { merge: true }));
      });

      deletions.forEach(item => {
        const deletedAt = toIsoString(item?.deletedAt || updatedAt, updatedAt) || updatedAt;
        const id = String(item?.id || '').trim();
        if (!id) return;
        mutations.push(batch => batch.set(orderRef(currentDb, id), {
          id,
          accountName: toNullableText(item?.accountName || ''),
          updatedAt: deletedAt,
          deletedAt
        }, { merge: true }));
      });

      accountUpserts.forEach(name => {
        const normalized = String(name || '').trim();
        if (!normalized) return;
        mutations.push(batch => batch.set(accountRef(currentDb, normalized), {
          id: accountDocId(normalized),
          name: normalized,
          updatedAt,
          deletedAt: null,
          createdAt: updatedAt
        }, { merge: true }));
      });

      accountDeletions.forEach(name => {
        const normalized = String(name || '').trim();
        if (!normalized) return;
        mutations.push(batch => batch.set(accountRef(currentDb, normalized), {
          id: accountDocId(normalized),
          name: normalized,
          updatedAt,
          deletedAt: updatedAt
        }, { merge: true }));
      });

      mutations.push(batch => batch.set(syncStateRef(currentDb), {
        scope: 'app',
        updatedAt,
        lastClientId: String(clientId || '').trim(),
        schemaVersion: 1
      }, { merge: true }));

      await commitMutations(currentDb, mutations);
      return {
        updatedAt,
        remoteCursor: updatedAt,
        assignedOrders
      };
    }

    return {
      key: 'firestore',
      label: 'Firebase Firestore',
      parseConfigInput,
      normalizeConfigText,
      serializeConfig,
      getCacheKey,
      getDisplayName,
      usesBuiltInLocalCache,
      init,
      isReady,
      isConnected,
      signOut,
      pullSnapshot,
      pushChanges
    };
  }

  return {
    create
  };
})();
