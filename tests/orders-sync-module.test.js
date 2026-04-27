const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'sync.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'index.js'), 'utf8');
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
  indexSource,
  /OrderTrackerSync\.create\(/,
  'js/orders/index.js 需要通过 OrderTrackerSync.create 接入同步模块'
);

assert.match(
  indexHtml,
  /<script src="js\/orders\/table\.js" defer><\/script>\s*<script src="js\/orders\/sync\.js" defer><\/script>\s*<script src="js\/orders\/export\.js" defer><\/script>\s*<script src="js\/orders\/tabs\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>\s*<script src="js\/orders\/session\.js" defer><\/script>\s*<script src="js\/orders\/shared\.js" defer><\/script>\s*<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 需要在 index.js 前先加载 table.js、sync.js、export.js、tabs.js、crud.js、session.js、shared.js'
);

console.log('orders sync module contract ok');
