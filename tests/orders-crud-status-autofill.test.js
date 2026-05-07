const fs = require('fs');
const path = require('path');
const assert = require('assert');

const crudSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders', 'crud.mjs'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.doesNotMatch(
  crudSource + ordersPageSource,
  /function maybeAutoSetInTransitFromTracking\(/,
  '订单不应再保留根据快递单号自动把订单状态改成在途的旧逻辑'
);

assert.match(
  ordersPageSource,
  /const detected = detectCourierCompany\(trackingNo,\s*COURIER_AUTO_DETECTORS\);[\s\S]*updateItem\(index,\s*\{ trackingNo, courierCompany: detected \|\| item\.courierCompany \}\)/,
  'React 订单明细需要在填写快递单号时按单号自动识别快递公司'
);

assert.match(
  crudSource,
  /function resolveCourierAutodetectState\([\s\S]*detectCourierCompany\(tracking\)/,
  '订单 CRUD helper 需要保留快递自动识别纯函数'
);

console.log('orders crud status manual behavior ok');
