const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'crud.js'), 'utf8');

assert.doesNotMatch(
  source,
  /function maybeAutoSetInTransitFromTracking\(/,
  '订单 CRUD 不应再保留根据快递单号自动把订单状态改成在途的旧逻辑'
);

assert.match(
  source,
  /function maybeAutoDetectCourierForItemRow\(/,
  '订单 CRUD 需要支持在订单明细里按单号自动识别快递公司'
);

console.log('orders crud status manual behavior ok');
