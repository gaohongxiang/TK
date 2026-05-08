import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const providerSource = fs.readFileSync(path.join(root, 'src', 'orders', 'provider-firestore.ts'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const sharedPath = path.join(__dirname, '..', 'src', 'orders', 'shared.ts');

assert.ok(!fs.existsSync(path.join(root, 'src', 'orders', 'sync.mjs')), '完整 React SPA 后不应保留旧订单同步运行层');

assert.match(
  providerSource,
  /async function pullSnapshot/,
  'Firestore provider 需要通过 pullSnapshot 拉取远端变更'
);

assert.match(
  providerSource,
  /async function pushChanges/,
  'Firestore provider 需要通过 pushChanges 推送远端变更'
);

assert.match(
  ordersPageSource,
  /pullSnapshot\(\{ cursor: '' \}\)[\s\S]*pushChanges\(\{[\s\S]*waitForCommit:\s*false/,
  'React 订单页需要直接使用 provider 拉取远端快照并写入本地队列'
);

(async () => {
  const sharedModule = await import(pathToFileURL(sharedPath).href);
  const sharedTools = sharedModule.OrderTrackerShared.create({
    state: { orders: [] },
    constants: {
      UNASSIGNED_ACCOUNT_SLOT: '__unassigned__',
      ACCOUNT_FILE_PREFIX: 'tk-order-tracker__',
      ACCOUNT_FILE_SUFFIX: '.json',
      COURIER_AUTO_DETECTORS: []
    }
  });

  assert.equal(
    typeof sharedTools.mergeOrdersLastWriteWins,
    'function',
    'ESM 共享 helper 需要提供 last-write-wins 合并工具'
  );

  const mergeResult = sharedTools.mergeOrdersLastWriteWins({
    baseOrders: [
      { id: '1', '订单号': 'A-1', updatedAt: '2026-04-20T08:00:00.000Z' }
    ],
    localOrders: [
      { id: '1', '订单号': 'A-1-local', updatedAt: '2026-04-20T11:00:00.000Z' }
    ],
    remoteOrders: [
      { id: '1', '订单号': 'A-1-remote', updatedAt: '2026-04-20T10:00:00.000Z' },
      { id: '2', '订单号': 'B-1', updatedAt: '2026-04-20T10:00:00.000Z' }
    ],
    remoteCursor: '2026-04-20T10:00:00.000Z'
  });

  assert.equal(mergeResult.orders.length, 2, '合并后应保留本地较新的记录并吸收远端新增记录');
  assert.equal(mergeResult.remoteCursor, '2026-04-20T10:00:00.000Z', '合并后应保留最新远端 cursor');
  assert.equal(mergeResult.orders.find(order => order.id === '1')['订单号'], 'A-1-local');
  assert.equal(mergeResult.orders.find(order => order.id === '2')['订单号'], 'B-1');

  console.log('orders sync provider contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
