/* ============================================================
 * 订单跟踪器：Supabase provider
 * ============================================================ */
const OrderTrackerProviderSupabase = (function () {
  function create({ state, helpers }) {
    const { nowIso, normalizeOrderList, uniqueAccounts } = helpers;
    const ORDER_SELECT_COLUMNS = [
      'id',
      'seq',
      'created_at',
      'updated_at',
      'deleted_at',
      'account_name',
      'ordered_at',
      'purchase_date',
      'latest_warehouse_at',
      'warning_text',
      'order_no',
      'product_name',
      'quantity',
      'purchase_price',
      'weight_text',
      'size_text',
      'order_status',
      'courier_company',
      'tracking_no'
    ].join(', ');
    let client = null;

    function latestIso(values) {
      return (values || []).filter(Boolean).sort().slice(-1)[0] || '';
    }

    function getProjectHost(url) {
      try {
        return new URL(String(url || '').trim()).host;
      } catch (error) {
        return '';
      }
    }

    function hydrateConfig(raw) {
      return {
        url: String(raw?.url || raw?.supabaseUrl || '').trim(),
        anonKey: String(raw?.anonKey || raw?.supabaseAnonKey || '').trim(),
        user: String(raw?.user || '').trim()
      };
    }

    function serializeConfig(config) {
      const next = hydrateConfig(config || state);
      return {
        url: next.url,
        anonKey: next.anonKey,
        user: next.user
      };
    }

    function getCacheKey(config = state) {
      const next = hydrateConfig(config);
      if (!next.url) return 'supabase:pending';
      return `supabase:${next.url}`;
    }

    function getDisplayName(config = state) {
      const next = hydrateConfig(config);
      if (next.user) return `${next.user} · Supabase`;
      const host = getProjectHost(next.url);
      if (host) return `${host} · Supabase`;
      return 'Supabase';
    }

    function parseSeq(value) {
      const parsed = Number.parseInt(String(value ?? '').trim(), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function toNullableText(value) {
      const text = String(value ?? '').trim();
      return text ? text : null;
    }

    function toNullableDate(value) {
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

    function toIsoTimestamp(value, fallback = '') {
      const text = String(value ?? '').trim();
      if (text) {
        const parsed = Date.parse(text);
        if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
      }
      if (fallback) return fallback;
      return nowIso();
    }

    function getOrderCreatedAt(order) {
      const direct = String(order?.createdAt || order?.created_at || '').trim();
      if (direct) return toIsoTimestamp(direct);
      const updated = String(order?.updatedAt || order?.updated_at || '').trim();
      if (updated) return toIsoTimestamp(updated);
      return nowIso();
    }

    function normalizePulledOrder(row) {
      const seq = parseSeq(row?.seq);
      return {
        id: String(row?.id || '').trim(),
        ...(seq !== null ? { seq } : {}),
        createdAt: row?.created_at || '',
        updatedAt: row?.updated_at || '',
        deletedAt: row?.deleted_at || '',
        '账号': typeof row?.account_name === 'string' ? row.account_name : '',
        '下单时间': row?.ordered_at || '',
        '采购日期': row?.purchase_date || '',
        '最晚到仓时间': row?.latest_warehouse_at || '',
        '订单预警': row?.warning_text || '',
        '订单号': row?.order_no || '',
        '产品名称': row?.product_name || '',
        '数量': row?.quantity == null ? '' : String(row.quantity),
        '采购价格': row?.purchase_price == null ? '' : String(row.purchase_price),
        '重量': row?.weight_text || '',
        '尺寸': row?.size_text || '',
        '订单状态': row?.order_status || '',
        '快递公司': row?.courier_company || '',
        '快递单号': row?.tracking_no || ''
      };
    }

    function buildOrderRow(order) {
      const seq = parseSeq(order?.seq);
      const createdAt = getOrderCreatedAt(order);
      const updatedAt = toIsoTimestamp(order?.updatedAt || order?.updated_at, createdAt);
      return {
        id: String(order?.id || '').trim(),
        seq,
        created_at: createdAt,
        updated_at: updatedAt,
        deleted_at: null,
        account_name: toNullableText(order?.['账号']),
        ordered_at: toNullableDate(order?.['下单时间']),
        purchase_date: toNullableDate(order?.['采购日期']),
        latest_warehouse_at: toNullableDate(order?.['最晚到仓时间']),
        warning_text: toNullableText(order?.['订单预警']),
        order_no: toNullableText(order?.['订单号']),
        product_name: toNullableText(order?.['产品名称']),
        quantity: toNullableInteger(order?.['数量']),
        purchase_price: toNullableDecimal(order?.['采购价格']),
        weight_text: toNullableText(order?.['重量']),
        size_text: toNullableText(order?.['尺寸']),
        order_status: toNullableText(order?.['订单状态']),
        courier_company: toNullableText(order?.['快递公司']),
        tracking_no: toNullableText(order?.['快递单号'])
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

    async function fetchMaxSeq(currentClient) {
      let query = currentClient.from('orders').select('seq').order('seq', { ascending: false });
      if (typeof query.limit === 'function') query = query.limit(1);
      const result = await query;
      if (result.error) throw result.error;
      const first = Array.isArray(result.data) && result.data.length ? result.data[0] : null;
      return parseSeq(first?.seq) || 0;
    }

    async function assignOrderSeqs(currentClient, orders = []) {
      const normalized = normalizeOrderList(orders).map(order => ({ ...order }));
      if (!normalized.length) return normalized;

      const remoteMaxSeq = await fetchMaxSeq(currentClient);
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

    async function requireClient() {
      if (!client) throw new Error('Supabase client 尚未初始化');
      return client;
    }

    async function init(config) {
      const next = hydrateConfig(config);
      if (!next.url || !next.anonKey) throw new Error('请填写 Project ID 和 Publishable key');
      if (!window?.supabase?.createClient) throw new Error('Supabase 浏览器客户端未加载');

      state.supabaseUrl = next.url;
      state.supabaseAnonKey = next.anonKey;
      state.user = next.user || getProjectHost(next.url);

      client = window.supabase.createClient(next.url, next.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
      return serializeConfig(state);
    }

    function isReady() {
      return !!client;
    }

    function isConnected() {
      return !!client;
    }

    async function signOut() {
      return;
    }

    async function pullSnapshot({ cursor = '' } = {}) {
      const currentClient = await requireClient();

      let changedOrdersQuery = currentClient
        .from('orders')
        .select(ORDER_SELECT_COLUMNS)
        .order('updated_at', { ascending: false });
      if (cursor) {
        changedOrdersQuery = changedOrdersQuery.gt('updated_at', cursor);
      }

      let changedAccountsQuery = currentClient
        .from('order_accounts')
        .select('name, updated_at, deleted_at')
        .order('updated_at', { ascending: true });
      if (cursor) {
        changedAccountsQuery = changedAccountsQuery.gt('updated_at', cursor);
      }

      const [changedOrdersResult, changedAccountsResult, fullOrdersResult, fullAccountsResult] = await Promise.all([
        changedOrdersQuery,
        changedAccountsQuery,
        currentClient
          .from('orders')
          .select(ORDER_SELECT_COLUMNS)
          .is('deleted_at', null)
          .order('seq', { ascending: true }),
        currentClient
          .from('order_accounts')
          .select('name, updated_at, deleted_at')
          .is('deleted_at', null)
          .order('updated_at', { ascending: true })
      ]);

      if (changedOrdersResult.error) throw changedOrdersResult.error;
      if (changedAccountsResult.error) throw changedAccountsResult.error;
      if (fullOrdersResult.error) throw fullOrdersResult.error;
      if (fullAccountsResult.error) throw fullAccountsResult.error;

      const changedOrders = normalizeOrderList((changedOrdersResult.data || []).map(normalizePulledOrder));
      const orders = normalizeOrderList((fullOrdersResult.data || []).map(normalizePulledOrder));
      const changedAccounts = (changedAccountsResult.data || []).map(row => ({
        name: String(row?.name || '').trim(),
        updatedAt: row?.updated_at || '',
        deletedAt: row?.deleted_at || ''
      }));
      const activeAccounts = uniqueAccounts((fullAccountsResult.data || []).map(row => row?.name));
      const accountUpdatedAt = latestIso((fullAccountsResult.data || []).map(row => row?.updated_at));
      const remoteCursor = latestIso([
        cursor,
        ...changedOrders.map(order => order.updatedAt || order.deletedAt || ''),
        ...changedAccounts.map(account => account.updatedAt || account.deletedAt || '')
      ]);

      return {
        orders,
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
      const currentClient = await requireClient();
      const assignedOrders = await assignOrderSeqs(currentClient, upserts);
      const orderRows = assignedOrders.map(buildOrderRow);

      const accountRows = uniqueAccounts(accountUpserts).map(name => ({
        name,
        updated_at: nowIso(),
        deleted_at: null
      }));

      const deletedAccountRows = uniqueAccounts(accountDeletions).map(name => {
        const deletedAt = nowIso();
        return {
          name,
          updated_at: deletedAt,
          deleted_at: deletedAt
        };
      });

      if (orderRows.length) {
        const { error } = await currentClient.from('orders').upsert(orderRows, { onConflict: 'id' });
        if (error) throw error;
      }

      if (deletions.length) {
        const results = await Promise.all(deletions.map(item => {
          const deletedAt = item?.deletedAt || item?.updatedAt || nowIso();
          return currentClient
            .from('orders')
            .update({
              deleted_at: deletedAt,
              updated_at: deletedAt
            })
            .eq('id', String(item?.id || ''));
        }));
        const failed = results.find(result => result?.error);
        if (failed?.error) throw failed.error;
      }

      if (accountRows.length) {
        const { error } = await currentClient.from('order_accounts').upsert(accountRows, { onConflict: 'name' });
        if (error) throw error;
      }

      if (deletedAccountRows.length) {
        const results = await Promise.all(deletedAccountRows.map(row => (
          currentClient
            .from('order_accounts')
            .update({
              updated_at: row.updated_at,
              deleted_at: row.deleted_at
            })
            .eq('name', row.name)
        )));
        const failed = results.find(result => result?.error);
        if (failed?.error) throw failed.error;
      }

      const updatedAt = latestIso([
        ...orderRows.map(row => row.updated_at),
        ...deletions.map(item => item?.deletedAt || item?.updatedAt || ''),
        ...accountRows.map(row => row.updated_at),
        ...deletedAccountRows.map(row => row.updated_at),
        nowIso()
      ]);

      const { error: syncError } = await currentClient.from('sync_state').upsert({
        scope: 'orders',
        updated_at: updatedAt,
        last_client_id: clientId || null,
        schema_version: 2
      }, { onConflict: 'scope' });
      if (syncError) throw syncError;

      return {
        updatedAt,
        remoteCursor: updatedAt,
        assignedOrders: normalizeOrderList(assignedOrders)
      };
    }

    return {
      key: 'supabase',
      label: 'Supabase',
      init,
      isReady,
      isConnected,
      hydrateConfig,
      serializeConfig,
      getCacheKey,
      getDisplayName,
      signOut,
      pullSnapshot,
      pushChanges
    };
  }

  return {
    create
  };
})();
