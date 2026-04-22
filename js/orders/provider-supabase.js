/* ============================================================
 * 订单跟踪器：Supabase provider
 * ============================================================ */
const OrderTrackerProviderSupabase = (function () {
  function create({ state, helpers }) {
    const { nowIso, normalizeOrderList, uniqueAccounts } = helpers;
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

    function normalizePulledOrder(row) {
      const payload = row?.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
      return {
        id: String(row?.id || payload.id || '').trim(),
        ...payload,
        '账号': typeof row?.account_name === 'string' ? row.account_name : (payload['账号'] || ''),
        updatedAt: row?.updated_at || payload.updatedAt || '',
        deletedAt: row?.deleted_at || payload.deletedAt || ''
      };
    }

    function stripOrderMeta(order) {
      const next = { ...(order || {}) };
      delete next.updatedAt;
      delete next.deletedAt;
      return next;
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
        .select('id, account_name, payload, updated_at, deleted_at')
        .order('updated_at', { ascending: true });
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
          .select('id, account_name, payload, updated_at, deleted_at')
          .is('deleted_at', null)
          .order('updated_at', { ascending: true }),
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

      const orderRows = normalizeOrderList(upserts).map(order => ({
        id: String(order.id),
        account_name: String(order['账号'] || '').trim() || null,
        payload: stripOrderMeta(order),
        updated_at: order.updatedAt || nowIso(),
        deleted_at: null
      }));

      const deletedOrderRows = deletions.map(item => {
        const deletedAt = item?.deletedAt || item?.updatedAt || nowIso();
        return {
          id: String(item.id),
          account_name: String(item.accountName || '').trim() || null,
          payload: {},
          updated_at: deletedAt,
          deleted_at: deletedAt
        };
      });

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
      if (deletedOrderRows.length) {
        const { error } = await currentClient.from('orders').upsert(deletedOrderRows, { onConflict: 'id' });
        if (error) throw error;
      }
      if (accountRows.length) {
        const { error } = await currentClient.from('order_accounts').upsert(accountRows, { onConflict: 'name' });
        if (error) throw error;
      }
      if (deletedAccountRows.length) {
        const { error } = await currentClient.from('order_accounts').upsert(deletedAccountRows, { onConflict: 'name' });
        if (error) throw error;
      }

      const updatedAt = latestIso([
        ...orderRows.map(row => row.updated_at),
        ...deletedOrderRows.map(row => row.updated_at),
        ...accountRows.map(row => row.updated_at),
        ...deletedAccountRows.map(row => row.updated_at),
        nowIso()
      ]);

      const { error: syncError } = await currentClient.from('sync_state').upsert({
        scope: 'orders',
        updated_at: updatedAt,
        last_client_id: clientId || null
      }, { onConflict: 'scope' });
      if (syncError) throw syncError;

      return {
        updatedAt,
        remoteCursor: updatedAt
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
