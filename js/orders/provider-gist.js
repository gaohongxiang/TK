/* ============================================================
 * 订单跟踪器：GitHub Gist provider
 * ============================================================ */
const OrderTrackerProviderGist = (function () {
  function create({ state, constants, helpers }) {
    const {
      GIST_FILENAME,
      META_FILENAME,
      REMOTE_DATA_VERSION,
      UNASSIGNED_ACCOUNT_SLOT
    } = constants;
    const {
      nowIso,
      normalizeOrderList,
      uniqueAccounts,
      listOrderAccounts,
      groupOrdersByAccountSlot,
      flattenOrdersByAccountSlot,
      toAccountSlot,
      fromAccountSlot,
      getAccountFileName,
      parseAccountSlotFromFileName
    } = helpers;

    function latestIso(values) {
      return (values || []).filter(Boolean).sort().slice(-1)[0] || '';
    }

    function hydrateConfig(raw) {
      return {
        token: String(raw?.token || '').trim(),
        gistId: String(raw?.gistId || '').trim(),
        user: String(raw?.user || '').trim()
      };
    }

    function serializeConfig(config) {
      const next = hydrateConfig(config || state);
      return {
        token: next.token,
        gistId: next.gistId,
        user: next.user
      };
    }

    function getDisplayName(config = state) {
      const next = hydrateConfig(config);
      if (next.user && next.gistId) return `${next.user} · Gist ${next.gistId.slice(0, 7)}…`;
      if (next.gistId) return `Gist ${next.gistId.slice(0, 7)}…`;
      if (next.user) return `${next.user} · GitHub Gist`;
      return 'GitHub Gist';
    }

    function getCacheKey(config = state) {
      const next = hydrateConfig(config);
      return next.gistId ? `gist:${next.gistId}` : 'gist:pending';
    }

    async function init(config) {
      const next = hydrateConfig(config);
      if (next.token) state.token = next.token;
      if (next.gistId) state.gistId = next.gistId;
      if (typeof next.user === 'string') state.user = next.user;
      return serializeConfig(state);
    }

    function isReady() {
      return !!(state.token && state.gistId);
    }

    function isConnected() {
      return isReady();
    }

    function buildMetaPayload(updatedAt = nowIso(), orders = [], accounts = []) {
      return {
        version: REMOTE_DATA_VERSION,
        updatedAt,
        accounts: uniqueAccounts([...(accounts || []), ...listOrderAccounts(orders)])
      };
    }

    function normalizeMetaPayload(data, fallbackUpdatedAt = '') {
      return {
        version: typeof data?.version === 'number' ? data.version : REMOTE_DATA_VERSION,
        updatedAt: typeof data?.updatedAt === 'string' && data.updatedAt ? data.updatedAt : fallbackUpdatedAt,
        accounts: uniqueAccounts(data?.accounts)
      };
    }

    function normalizeAccountPayload(data, account, fallbackUpdatedAt = '') {
      return {
        version: typeof data?.version === 'number' ? data.version : REMOTE_DATA_VERSION,
        account: String(typeof data?.account === 'string' ? data.account : account || '').trim(),
        updatedAt: typeof data?.updatedAt === 'string' && data.updatedAt ? data.updatedAt : fallbackUpdatedAt,
        orders: normalizeOrderList(data?.orders)
      };
    }

    function buildAccountPayload(account, orders, updatedAt) {
      return {
        version: REMOTE_DATA_VERSION,
        account: String(account || '').trim(),
        updatedAt: updatedAt || nowIso(),
        orders: normalizeOrderList(orders)
      };
    }

    async function gh(method, path, body) {
      const response = await fetch('https://api.github.com' + path, {
        method,
        headers: {
          'Authorization': 'token ' + state.token,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`GitHub API ${response.status}: ${text.slice(0, 200)}`);
      }
      return response.json();
    }

    async function verifyToken() {
      return gh('GET', '/user');
    }

    async function createGist() {
      const gist = await gh('POST', '/gists', {
        description: 'TK Toolbox · Order Tracker Data (private)',
        public: false,
        files: {
          [META_FILENAME]: { content: JSON.stringify(buildMetaPayload(nowIso()), null, 2) }
        }
      });
      return gist.id;
    }

    async function readGistFileJson(file) {
      let content = file?.content || '';
      if (file?.truncated && file?.raw_url) {
        const response = await fetch(file.raw_url);
        content = await response.text();
      }
      return JSON.parse(content || '{}');
    }

    function normalizeLegacySnapshot(data, gistUpdatedAt = '') {
      return {
        version: typeof data?.version === 'number' ? data.version : REMOTE_DATA_VERSION,
        updatedAt: typeof data?.updatedAt === 'string' && data.updatedAt ? data.updatedAt : gistUpdatedAt,
        orders: normalizeOrderList(data?.orders)
      };
    }

    async function pullSnapshot() {
      const gist = await gh('GET', '/gists/' + state.gistId);
      const files = gist.files || {};
      const grouped = {};
      const accountRemoteUpdatedAt = {};
      const metaFile = files[META_FILENAME] || null;
      const legacyFile = files[GIST_FILENAME] || null;
      const fallbackUpdatedAt = gist.updated_at || '';

      let meta = normalizeMetaPayload(null, fallbackUpdatedAt);
      let hasMeta = false;
      if (metaFile) {
        meta = normalizeMetaPayload(await readGistFileJson(metaFile), fallbackUpdatedAt);
        hasMeta = true;
      }

      for (const [filename, file] of Object.entries(files)) {
        const slot = parseAccountSlotFromFileName(filename);
        if (!slot) continue;
        const payload = normalizeAccountPayload(
          await readGistFileJson(file),
          fromAccountSlot(slot),
          fallbackUpdatedAt
        );
        grouped[slot] = payload.orders;
        accountRemoteUpdatedAt[slot] = payload.updatedAt;
      }

      Object.keys(grouped).forEach(slot => {
        const orders = grouped[slot] || [];
        const account = fromAccountSlot(slot);
        const shouldKeep = orders.length > 0
          || slot === UNASSIGNED_ACCOUNT_SLOT
          || meta.accounts.includes(account);
        if (!shouldKeep) {
          delete grouped[slot];
          delete accountRemoteUpdatedAt[slot];
        }
      });

      const declaredSlots = meta.accounts.map(toAccountSlot);
      const allSlots = [...new Set([...declaredSlots, ...Object.keys(grouped)])];
      if (hasMeta || allSlots.length) {
        return {
          format: 'split',
          hasMeta,
          hasLegacy: !!legacyFile,
          metaUpdatedAt: meta.updatedAt || fallbackUpdatedAt,
          accounts: uniqueAccounts([...meta.accounts, ...Object.keys(grouped).map(fromAccountSlot)]),
          grouped,
          accountRemoteUpdatedAt,
          orders: flattenOrdersByAccountSlot(grouped, allSlots),
          updatedAt: latestIso([meta.updatedAt, ...Object.values(accountRemoteUpdatedAt)])
        };
      }

      if (legacyFile) {
        const legacy = normalizeLegacySnapshot(await readGistFileJson(legacyFile), fallbackUpdatedAt);
        const legacyGrouped = groupOrdersByAccountSlot(legacy.orders);
        Object.keys(legacyGrouped).forEach(slot => {
          accountRemoteUpdatedAt[slot] = legacy.updatedAt || fallbackUpdatedAt;
        });
        return {
          format: 'legacy',
          hasMeta: false,
          hasLegacy: true,
          metaUpdatedAt: '',
          accounts: listOrderAccounts(legacy.orders),
          grouped: legacyGrouped,
          accountRemoteUpdatedAt,
          orders: legacy.orders,
          updatedAt: legacy.updatedAt || fallbackUpdatedAt
        };
      }

      return {
        format: 'split',
        hasMeta: false,
        hasLegacy: false,
        metaUpdatedAt: '',
        accounts: [],
        grouped: {},
        accountRemoteUpdatedAt: {},
        orders: [],
        updatedAt: fallbackUpdatedAt
      };
    }

    function buildSplitFilesPayload({
      grouped,
      slots,
      includeMeta = false,
      metaUpdatedAt = '',
      remoteGrouped = {},
      removeLegacyFile = false,
      accounts = [],
      accountLocalUpdatedAt = {}
    }) {
      const files = {};
      const accountPayloads = {};
      const deletedSlots = [];
      let metaPayload = null;

      if (includeMeta) {
        metaPayload = buildMetaPayload(
          metaUpdatedAt || nowIso(),
          flattenOrdersByAccountSlot(grouped),
          accounts
        );
        files[META_FILENAME] = { content: JSON.stringify(metaPayload, null, 2) };
      }

      (slots || []).forEach(slot => {
        const account = fromAccountSlot(slot);
        const orders = normalizeOrderList(grouped[slot] || []);
        const filename = getAccountFileName(account);
        if (!orders.length) {
          if (remoteGrouped[slot]) {
            files[filename] = null;
            deletedSlots.push(slot);
          }
          return;
        }
        const payload = buildAccountPayload(account, orders, accountLocalUpdatedAt[slot] || nowIso());
        accountPayloads[slot] = payload;
        files[filename] = { content: JSON.stringify(payload, null, 2) };
      });

      if (removeLegacyFile) files[GIST_FILENAME] = null;

      return {
        files,
        metaPayload,
        accountPayloads,
        deletedSlots
      };
    }

    async function pushChanges({
      grouped,
      slots,
      includeMeta = false,
      metaUpdatedAt = '',
      remoteGrouped = {},
      removeLegacyFile = false,
      accounts = [],
      accountLocalUpdatedAt = {}
    }) {
      const payload = buildSplitFilesPayload({
        grouped,
        slots,
        includeMeta,
        metaUpdatedAt,
        remoteGrouped,
        removeLegacyFile,
        accounts,
        accountLocalUpdatedAt
      });
      if (Object.keys(payload.files).length) {
        await gh('PATCH', '/gists/' + state.gistId, { files: payload.files });
      }
      return {
        ...payload,
        nextAccountRemoteUpdatedAt: Object.fromEntries(
          Object.entries(payload.accountPayloads).map(([slot, value]) => [slot, value.updatedAt])
        )
      };
    }

    async function signOut() {}

    return {
      key: 'gist',
      label: 'GitHub Gist',
      init,
      isReady,
      isConnected,
      hydrateConfig,
      serializeConfig,
      getCacheKey,
      getDisplayName,
      verifyToken,
      createGist,
      pullSnapshot,
      pushChanges,
      signOut
    };
  }

  return {
    create
  };
})();
