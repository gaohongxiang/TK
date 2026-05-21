import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const providerSource = fs.readFileSync(path.join(root, 'src', 'orders', 'provider-firestore.ts'), 'utf8');
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
  /async function pullSnapshot\([\s\S]*changedOrders[\s\S]*remoteCursor/,
  'Firestore provider 需要继续提供远端快照和 cursor 元信息'
);

assert.match(
  providerSource,
  /async function pushChanges\([\s\S]*assignSeq = true[\s\S]*commitPromise/,
  'Firestore provider 需要继续提供带 seq 分配和后台提交 promise 的写入入口'
);

console.log('orders react sync contract ok');
