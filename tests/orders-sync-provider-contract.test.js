const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const sharedSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'shared.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'sync.js'), 'utf8');

assert.match(
  syncSource,
  /pullSnapshot/,
  'provider 化后的同步模块需要通过 pullSnapshot 拉取远端变更'
);

assert.match(
  syncSource,
  /pushChanges/,
  'provider 化后的同步模块需要通过 pushChanges 推送远端变更'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${sharedSource}\nthis.OrderTrackerShared = OrderTrackerShared;`, sandbox);

const sharedTools = sandbox.OrderTrackerShared.create({
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
  '共享 helper 需要提供 last-write-wins 合并工具'
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
