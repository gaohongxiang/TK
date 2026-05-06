const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const esmPath = path.join(__dirname, '..', 'src', 'orders', 'session.mjs');
const esmSource = fs.readFileSync(esmPath, 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders', 'index.mjs'), 'utf8');
const syncSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders', 'sync.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.match(
  esmSource,
  /const OrderTrackerSession = \{/,
  'ESM 订单会话模块需要保留 OrderTrackerSession 命名导出'
);

assert.match(
  esmSource,
  /function create\(/,
  'ESM 订单会话模块需要暴露 create 工厂'
);

assert.match(
  esmSource,
  /export \{[\s\S]*OrderTrackerSession[\s\S]*buildConnectedUserText[\s\S]*buildLocalCacheMessage[\s\S]*setRefreshButtonLoading[\s\S]*\}/,
  'ESM 订单会话模块需要导出命名空间和会话状态纯函数'
);

assert.match(
  esmSource,
  /window\.OrderTrackerSession = OrderTrackerSession/,
  'ESM 订单会话模块需要挂回旧全局命名空间'
);

assert.match(
  esmSource,
  /rootWindow\?\.TKFirestoreConnection/,
  '订单会话模块需要通过全局 Firestore 连接模块读取配置'
);

assert.doesNotMatch(
  esmSource,
  /gist|storageMode|parseConfigInput\(|connectOrMigrateFirestore|ot-migrate-from-gist|input\[name="ot-storage-mode"\]/,
  '订单会话模块不应再保留 Gist 迁移或存储模式切换逻辑'
);

assert.match(
  esmSource,
  /tk-firestore-config-changed/,
  '订单会话模块需要监听全局 Firestore 配置变化事件'
);

assert.match(
  esmSource,
  /#ot-open-connection/,
  '订单会话模块需要绑定未连接状态下的打开连接按钮'
);

assert.match(
  esmSource,
  /setRefreshButtonLoading\(refreshBtn,\s*true\)[\s\S]*syncNow[\s\S]*setRefreshButtonLoading\(refreshBtn,\s*false\)/,
  '订单会话模块需要在手动刷新时给刷新按钮加上转圈状态'
);

assert.match(
  esmSource,
  /async function onEnter\(/,
  '订单会话模块需要包含进入模块时的恢复逻辑'
);

assert.match(
  syncSource,
  /cancelPendingSync/,
  '同步模块需要提供取消待同步任务的接口'
);

assert.match(
  syncSource,
  /orders、order_accounts、sync_state 和 products[\s\S]*notifyRulesUpdateNeeded/,
  '订单同步在 Firestore 权限不足时需要触发全局规则更新提示'
);

assert.match(
  indexSource,
  /sessionFactory\.create\(/,
  '订单 ESM 入口需要通过会话模块工厂接入会话模块'
);

assert.match(
  indexSource,
  /import \{ OrderTrackerSession \} from '\.\/session\.mjs'/,
  '订单 ESM 入口需要直接导入会话 ESM helper'
);

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再通过旧订单 ESM 入口加载会话模块'
);

assert.match(
  ordersPageSource,
  /tk-firestore-config-changed[\s\S]*id="ot-open-connection"[\s\S]*id="ot-refresh"/,
  'React 订单页需要直接接管 Firestore 配置变化、连接按钮和刷新按钮'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/session\.js" defer><\/script>/,
  'index.html 不应再加载旧订单会话普通脚本'
);

(async () => {
  const sessionModule = await import(pathToFileURL(esmPath).href);
  const esmSessionTools = sessionModule.OrderTrackerSession.create({
    state: {},
    helpers: {
      $: () => null,
      loadCfg: () => null,
      saveCfg: () => {},
      loadAccounts: () => []
    },
    ui: {
      toast: () => {},
      setSync: () => {},
      openModal: () => {},
      exportOrdersCsv: () => {},
      bindCrudEvents: () => {},
      renderAccTabs: () => {},
      renderTable: () => {}
    },
    providers: {
      getProviderByMode: () => ({
        init: async () => {},
        isConnected: () => false
      })
    },
    sync: {
      setRemoteProvider: () => {},
      hydrateCache: async () => false,
      syncNow: async () => true,
      resetTrackerState: () => {},
      renderLocalOrders: () => {},
      queueSync: () => {},
      cancelPendingSync: () => {}
    },
    window: {
      addEventListener: () => {}
    }
  });

  assert.equal(typeof esmSessionTools.init, 'function', 'ESM 会话模块需要返回 init');
  assert.equal(typeof esmSessionTools.onEnter, 'function', 'ESM 会话模块需要返回 onEnter');

  assert.equal(
    sessionModule.buildConnectedUserText({
      remoteProvider: { getDisplayName: () => '项目A' }
    }),
    '已连接 · 项目A',
    'ESM 会话模块应生成已连接用户文案'
  );

  assert.equal(
    sessionModule.buildLocalCacheMessage({
      cachedPrefix: 'Firestore 本地缓存已恢复',
      orderCount: 3,
      dirty: true
    }),
    'Firestore 本地缓存已恢复 · 3 条，等待同步…',
    'ESM 会话模块应生成本地缓存恢复文案'
  );

  const state = {
    clientId: 'old',
    firestoreConfigText: 'old-config',
    firestoreProjectId: 'old-project',
    loaded: true
  };
  sessionModule.applyStoredState(state, { clientId: 'new-client' });
  sessionModule.applyGlobalConfig(state, { configText: 'new-config', projectId: 'new-project' });
  assert.equal(state.clientId, 'new-client', 'ESM 会话模块应恢复本地 clientId');
  assert.equal(state.firestoreConfigText, 'new-config', 'ESM 会话模块应应用全局 Firestore 配置');
  sessionModule.resetConnectionState(state);
  assert.equal(state.loaded, false, 'ESM 会话模块应重置连接 loaded 状态');
  assert.equal(state.firestoreProjectId, '', 'ESM 会话模块应清理 Firestore projectId');

  const calls = [];
  const button = {
    disabled: false,
    classList: {
      add: value => calls.push(['add', value]),
      remove: value => calls.push(['remove', value])
    },
    setAttribute: (key, value) => calls.push(['attr', key, value])
  };
  sessionModule.setRefreshButtonLoading(button, true);
  sessionModule.setRefreshButtonLoading(button, false);
  assert.deepEqual(
    calls,
    [
      ['add', 'is-spinning'],
      ['attr', 'aria-busy', 'true'],
      ['remove', 'is-spinning'],
      ['attr', 'aria-busy', 'false']
    ],
    'ESM 会话模块应切换刷新按钮 loading 状态'
  );

  console.log('orders session module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
