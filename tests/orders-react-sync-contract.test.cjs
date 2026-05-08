const fs = require('fs');
const path = require('path');
const assert = require('assert');

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
  /providerRef\.current\.pullSnapshot\(\{ cursor: '' \}\)[\s\S]*remoteMap[\s\S]*upserts[\s\S]*deletions[\s\S]*providerRef\.current\.pushChanges\(\{/,
  'React 订单页保存时需要直接拉取远端快照、计算 upserts/deletions 并写入 Firestore provider'
);

assert.match(
  ordersPageSource,
  /assignSeq:\s*true[\s\S]*waitForCommit:\s*false[\s\S]*result\?\.commitPromise\?\.then/,
  'React 订单页需要保持 Firestore 本地队列写入，不等待云端提交后再更新界面'
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
