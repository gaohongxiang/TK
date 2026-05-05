const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'sync.js'), 'utf8');
const esmPath = path.join(__dirname, '..', 'src', 'orders', 'sync.mjs');
const esmSource = fs.readFileSync(esmPath, 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders', 'index.mjs'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerSync = \(function \(\) \{/,
  '需要新的订单同步模块'
);

assert.match(
  source,
  /function create\(/,
  '同步模块需要暴露 create 工厂'
);

assert.match(
  esmSource,
  /const OrderTrackerSync = \{/,
  'ESM 同步模块需要保留 OrderTrackerSync 命名导出'
);

assert.match(
  esmSource,
  /function buildOptimisticFirestoreChangeSet\(/,
  'ESM 同步模块需要暴露 Firestore 乐观写入变更集纯函数'
);

assert.match(
  esmSource,
  /function mergeFirestoreOrders\(/,
  'ESM 同步模块需要暴露 Firestore 订单合并纯函数'
);

assert.match(
  esmSource,
  /export \{[\s\S]*OrderTrackerSync[\s\S]*buildOptimisticFirestoreChangeSet[\s\S]*mergeFirestoreOrders[\s\S]*buildFirestoreChangeSet[\s\S]*\}/,
  'ESM 同步模块需要导出命名空间和关键同步纯函数'
);

assert.match(
  source,
  /syncNow/,
  '同步模块里应包含 syncNow 逻辑'
);

assert.match(
  source,
  /remoteNeedsCanonicalCleanup\s*=\s*remote\?\.__needsOrderCleanup === true[\s\S]*upserts\.push\(cloneOrder\(merged\)\)/,
  '云端订单仍有旧兼容字段时，同步模块应强制重写为新结构'
);

assert.match(
  source,
  /void syncNow\(\{ optimisticFirestoreWrite: true \}\)/,
  'Firestore 保存后应立即投递给 SDK 本地写入队列，不应等待 debounce 后才同步'
);

assert.match(
  source,
  /function buildOptimisticFirestoreChangeSet\(/,
  'Firestore 乐观写入需要只构造本地变更集'
);

assert.match(
  source,
  /waitForCommit: false/,
  'Firestore 乐观写入不应等待云端提交完成'
);

assert.match(
  source,
  /function reconcileFirestoreMissingSeqs\(/,
  'Firestore 乐观写入后需要后台补齐缺失的录入编号'
);

assert.match(
  source,
  /firestoreOptimisticWriteSeq[\s\S]*writeSeq = \+\+firestoreOptimisticWriteSeq[\s\S]*writeSeq < firestoreAppliedWriteSeq/,
  'Firestore 连续快速保存时，旧写入确认不应覆盖新写入基线'
);

assert.match(
  source,
  /reconcileFirestoreMissingSeqs\(provider, remote\)/,
  'Firestore 干净同步时需要执行缺失 seq 的最终一致性修复'
);

assert.match(
  indexSource,
  /syncFactory\.create\(/,
  '订单 ESM 入口需要通过同步模块工厂接入同步模块'
);

assert.match(
  indexHtml,
  /<script src="js\/orders\/table\.js" defer><\/script>\s*<script src="js\/orders\/sync\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>\s*<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  'index.html 需要在订单 ESM 入口前继续加载尚未迁移的 sync 普通脚本'
);

(async () => {
  const syncModule = await import(pathToFileURL(esmPath).href);

  const optimisticChangeSet = syncModule.buildOptimisticFirestoreChangeSet({
    state: {
      orders: [
        { id: '1', '账号': 'A', '订单号': 'A-local', updatedAt: '2026-04-20T10:00:00.000Z' },
        { id: '2', '账号': 'A', '订单号': 'B-local', updatedAt: '2026-04-20T10:00:00.000Z' }
      ],
      baseOrders: [
        { id: '1', '账号': 'A', '订单号': 'A-base', updatedAt: '2026-04-20T08:00:00.000Z' },
        { id: '3', '账号': 'A', '订单号': 'C-base', updatedAt: '2026-04-20T08:00:00.000Z' }
      ],
      accounts: ['A', 'B'],
      baseAccounts: ['A'],
      dirtyAccounts: { A: true },
      accountLocalUpdatedAt: { A: '2026-04-20T11:00:00.000Z' },
      accountLocalRevisions: { A: 1 }
    },
    toAccountSlot: account => account || '__unassigned__'
  });

  assert.deepEqual(optimisticChangeSet.touchedSlots, ['A'], 'ESM 同步模块应按脏账号记录触达账号');
  assert.deepEqual(
    optimisticChangeSet.upserts.map(order => [order.id, order['订单号']]),
    [['1', 'A-local'], ['2', 'B-local']],
    'ESM 同步模块应按脏账号构造 Firestore 乐观写入 upserts'
  );
  assert.deepEqual(
    optimisticChangeSet.deletions,
    [{ id: '3', accountName: 'A', deletedAt: '2026-04-20T11:00:00.000Z' }],
    'ESM 同步模块应按脏账号构造 Firestore 乐观写入 deletions'
  );
  assert.deepEqual(optimisticChangeSet.accountUpserts, ['B'], 'ESM 同步模块应构造账号新增变更');
  assert.deepEqual(optimisticChangeSet.accountDeletions, [], 'ESM 同步模块应构造账号删除变更');

  const mergeResult = syncModule.mergeFirestoreOrders({
    baseOrders: [
      { id: '1', '账号': 'A', '订单号': 'base', updatedAt: '2026-04-20T08:00:00.000Z' },
      { id: '2', '账号': 'A', '订单号': 'delete-base', updatedAt: '2026-04-20T08:00:00.000Z' }
    ],
    localOrders: [
      { id: '1', '账号': 'A', '订单号': 'local-newer', updatedAt: '2026-04-20T11:00:00.000Z' }
    ],
    remoteOrders: [
      { id: '1', '账号': 'A', '订单号': 'remote-older', updatedAt: '2026-04-20T10:00:00.000Z' },
      { id: '3', '账号': 'B', '订单号': 'remote-new', updatedAt: '2026-04-20T09:00:00.000Z' }
    ],
    changedOrders: [
      { id: '1', updatedAt: '2026-04-20T10:00:00.000Z' }
    ],
    state: {
      accountLocalUpdatedAt: { A: '2026-04-20T12:00:00.000Z' }
    },
    toAccountSlot: account => account || '__unassigned__',
    nowIso: () => '2026-04-20T12:30:00.000Z'
  });

  assert.equal(mergeResult.orders.find(order => order.id === '1')['订单号'], 'local-newer', 'ESM 同步模块应保留更新时间较新的本地订单');
  assert.equal(mergeResult.orders.find(order => order.id === '3')['订单号'], 'remote-new', 'ESM 同步模块应吸收远端新增订单');
  assert.equal(mergeResult.deletedAtById['2'], '2026-04-20T12:00:00.000Z', 'ESM 同步模块应记录本地删除时间');

  const firestoreChangeSet = syncModule.buildFirestoreChangeSet({
    mergedOrders: [
      { id: '1', '账号': 'A', '订单号': 'same', updatedAt: '2026-04-20T10:00:00.000Z' },
      { id: '2', '账号': 'A', '订单号': 'new', updatedAt: '2026-04-20T10:00:00.000Z' }
    ],
    remoteOrders: [
      { id: '1', '账号': 'A', '订单号': 'same', updatedAt: '2026-04-20T10:00:00.000Z', __needsOrderCleanup: true },
      { id: '3', '账号': 'A', '订单号': 'remote-delete', updatedAt: '2026-04-20T08:00:00.000Z' }
    ],
    deletedAtById: {
      3: '2026-04-20T12:00:00.000Z'
    },
    mergedAccounts: ['A', 'B'],
    remoteAccounts: ['A'],
    nowIso: () => '2026-04-20T12:30:00.000Z'
  });

  assert.deepEqual(
    firestoreChangeSet.upserts.map(order => order.id),
    ['1', '2'],
    'ESM 同步模块应把需要 canonical cleanup 的远端订单强制 upsert'
  );
  assert.deepEqual(
    firestoreChangeSet.deletions,
    [{ id: '3', accountName: 'A', deletedAt: '2026-04-20T12:00:00.000Z' }],
    'ESM 同步模块应构造远端删除变更'
  );
  assert.deepEqual(firestoreChangeSet.accountUpserts, ['B'], 'ESM 同步模块应构造账号新增变更');

  console.log('orders sync module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
