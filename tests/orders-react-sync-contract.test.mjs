import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const providerSource = fs.readFileSync(path.join(root, 'src', 'orders', 'provider-firestore.ts'), 'utf8');
const syncStatusSource = fs.readFileSync(path.join(root, 'src', 'firestore-sync-status.ts'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(!fs.existsSync(path.join(root, 'src', 'orders', 'sync.mjs')), '完整 React SPA 后不应保留未使用的 orders/sync 运行壳层');

assert.doesNotMatch(
  ordersPageSource,
  /from '..\/..\/..\/orders\/sync\.mjs'|OrderTrackerSync|syncNow|queueSync|commitLocalOrders/,
  'React 订单页不应再依赖旧订单同步运行层'
);

assert.doesNotMatch(
  indexHtml,
  /<script src="js\/orders\/sync\.js" defer><\/script>|<script type="module" src="\/src\/orders\/sync\.mjs"><\/script>/,
  '主站不应再加载旧订单同步脚本'
);

assert.match(
  ordersPageSource,
  /async function persistOrderUpsert\([\s\S]*upserts:\s*\[payload\][\s\S]*accountUpserts:\s*accountName \? \[accountName\] : \[\][\s\S]*assignSeq:\s*true[\s\S]*waitForCommit:\s*false/,
  'React 订单页保存时只能 upsert 当前订单，不能用本地列表缺失推导远端删除'
);

assert.doesNotMatch(
  ordersPageSource,
  /async function persistOrderUpsert\([\s\S]*pullSnapshot\(\{ cursor: '' \}\)[\s\S]*deletions/,
  'React 订单页保存单条订单时不应拉全量远端并生成 deletions'
);

assert.match(
  ordersPageSource,
  /async function persistOrderDeletion\([\s\S]*deletions:\s*\[\{[\s\S]*id:\s*deletedId[\s\S]*assignSeq:\s*false[\s\S]*waitForCommit:\s*false/,
  'React 订单页只有明确删除当前订单时才写入该订单 tombstone'
);

assert.match(
  ordersPageSource,
  /function OrderTrashModal\([\s\S]*id="ot-trash-modal"[\s\S]*已删除订单[\s\S]*onRestore\(id\)[\s\S]*onPermanentlyDelete\(id\)[\s\S]*彻底删除/,
  'React 订单页需要提供已删除订单回收站，并且每条订单都有恢复和彻底删除操作'
);

assert.match(
  ordersPageSource,
  /async function restoreOrder\([\s\S]*deletedAt:\s*''[\s\S]*upserts:\s*\[payload\][\s\S]*assignSeq:\s*false/,
  'React 订单页恢复订单只能 upsert 当前订单清除 deletedAt'
);

assert.match(
  ordersPageSource,
  /async function permanentlyDeleteOrder\([\s\S]*window\.confirm\([\s\S]*providerRef\.current\.permanentlyDeleteOrder\(id,\s*\{ waitForCommit:\s*false \}\)/,
  'React 订单页彻底删除订单必须二次确认，并调用 provider 物理删除当前订单'
);

assert.match(
  ordersPageSource,
  /buildFirestoreSyncStatus[\s\S]*subscribeSnapshot[\s\S]*hasPendingWrites[\s\S]*queueing[\s\S]*confirmed/,
  'React 订单页需要使用共享同步状态和实时订阅区分本机待上传与云端已同步'
);

assert.match(
  syncStatusSource,
  /本机待上传队列[\s\S]*云端已同步/,
  '共享 Firestore 同步状态文案需要区分本机待上传和云端已同步'
);

assert.match(
  ordersPageSource,
  /assignSeq:\s*true[\s\S]*waitForCommit:\s*false[\s\S]*result\?\.commitPromise\?\.then/,
  'React 订单页需要保持 Firestore 本地队列写入，不等待云端提交后再更新界面'
);

assert.match(
  ordersPageSource,
  /function mergeAssignedOrders\([\s\S]*result\?\.assignedOrders[\s\S]*setOrders\(displayedOrders\)[\s\S]*getOrderPageForId\([\s\S]*setCurrentPage\(focusedPage\)/,
  'React 订单页保存后需要用 Firestore 分配的 seq 回填本地列表，并自动定位到该订单所在页'
);

assert.match(
  providerSource,
  /async function pullSnapshot\([\s\S]*deletedOrders[\s\S]*changedOrders[\s\S]*remoteCursor/,
  'Firestore provider 需要继续提供远端快照、已删除订单和 cursor 元信息'
);

assert.match(
  providerSource,
  /function subscribeSnapshot\([\s\S]*hasPendingWrites[\s\S]*onSnapshot|function subscribeSnapshot\([\s\S]*onSnapshot[\s\S]*hasPendingWrites/,
  'Firestore provider 需要提供实时订阅，其他页面新增订单后当前页可自动刷新'
);

assert.match(
  providerSource,
  /async function pushChanges\([\s\S]*assignSeq = true[\s\S]*commitPromise/,
  'Firestore provider 需要继续提供带 seq 分配和后台提交 promise 的写入入口'
);

assert.match(
  providerSource,
  /async function permanentlyDeleteOrder\([\s\S]*batch\.delete\(orderRef\(currentDb,\s*normalizedId\)\)/,
  'Firestore provider 需要提供只删除当前订单文档的彻底删除入口'
);

console.log('orders react sync contract ok');
