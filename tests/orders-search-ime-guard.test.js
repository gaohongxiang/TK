const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.match(
  source,
  /const \[composing, setComposing\] = useState\(false\)/,
  'React 订单表格渲染需要保留 searchComposing 状态'
);

assert.match(
  source,
  /onCompositionStart=\{\(\) => setComposing\(true\)\}/,
  'React 订单表格渲染需要在 compositionstart 时标记组合输入'
);

assert.match(
  source,
  /onCompositionEnd=\{event => \{[\s\S]*setComposing\(false\)[\s\S]*onSearchChange\(event\.currentTarget\.value\)/,
  'React 订单表格渲染需要在 compositionend 时结束组合输入并继续搜索'
);

console.log('orders search IME guard ok');
