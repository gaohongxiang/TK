const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'index.js'), 'utf8');

assert.match(
  source,
  /getSearchComposing:\s*\(\)\s*=>\s*state\.searchComposing/,
  '订单表格渲染需要读取 searchComposing 状态'
);

assert.match(
  source,
  /onSearchCompositionStart:\s*\(\)\s*=>\s*\{\s*state\.searchComposing\s*=\s*true;/,
  '订单表格渲染需要在 compositionstart 时标记组合输入'
);

assert.match(
  source,
  /onSearchCompositionEnd:\s*value\s*=>\s*\{\s*state\.searchComposing\s*=\s*false;/,
  '订单表格渲染需要在 compositionend 时结束组合输入并继续搜索'
);

console.log('orders search IME guard ok');
