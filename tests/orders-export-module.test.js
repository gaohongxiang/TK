const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'export.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'index.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerExport = \(function \(\) \{/,
  '需要新的订单导出模块'
);

assert.match(
  source,
  /function create\(/,
  '订单导出模块需要暴露 create 工厂'
);

assert.match(
  source,
  /function buildExportFilename\(/,
  '订单导出模块需要包含导出文件名逻辑'
);

assert.match(
  source,
  /async function exportOrdersCsv\(/,
  '订单导出模块需要包含 CSV 导出逻辑'
);

assert.match(
  indexSource,
  /OrderTrackerExport\.create\(/,
  'js/orders/index.js 需要通过 OrderTrackerExport.create 接入导出模块'
);

assert.match(
  htmlSource,
  /<script src="js\/orders\/table\.js" defer><\/script>\s*<script src="js\/orders\/sync\.js" defer><\/script>\s*<script src="js\/orders\/export\.js" defer><\/script>\s*<script src="js\/orders\/tabs\.js" defer><\/script>\s*<script src="js\/orders\/crud\.js" defer><\/script>\s*<script src="js\/orders\/session\.js" defer><\/script>\s*<script src="js\/orders\/shared\.js" defer><\/script>\s*<script src="js\/orders\/index\.js" defer><\/script>/,
  'index.html 需要在 index.js 前先加载 table.js、sync.js、export.js、tabs.js、crud.js、session.js、shared.js'
);

console.log('orders export module contract ok');
