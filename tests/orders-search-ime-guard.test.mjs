import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const ordersSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const productsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const tableToolsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'components', 'ui', 'table-tools.tsx'), 'utf8');
const collectionSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'collection', 'CollectionPage.tsx'), 'utf8');

assert.match(
  tableToolsSource,
  /const \[composing, setComposing\] = useState\(false\)/,
  '共享 TableSearch 需要保留 composition 状态'
);

assert.match(
  tableToolsSource,
  /onCompositionStart=\{\(\) => setComposing\(true\)\}/,
  '共享 TableSearch 需要在 compositionstart 时标记组合输入'
);

assert.match(
  tableToolsSource,
  /onCompositionEnd=\{event => \{[\s\S]*setComposing\(false\)[\s\S]*onChange\(event\.currentTarget\.value\)/,
  '共享 TableSearch 需要在 compositionend 时结束组合输入并继续搜索'
);

assert.doesNotMatch(
  tableToolsSource,
  /if \(!composing\) onChange/,
  '共享 TableSearch 不应在组合输入期间阻止受控 value 更新，否则中文输入会打不进去'
);

assert.match(
  tableToolsSource,
  /onChange=\{event => \{[\s\S]*onChange\(event\.currentTarget\.value\)/,
  '共享 TableSearch 的普通 onChange 需要始终同步输入值'
);

assert.match(
  ordersSource,
  /<TableSearch[\s\S]*id="ot-table-search-input"[\s\S]*onChange=\{onSearchChange\}[\s\S]*id="ot-search-help-btn"/,
  '订单搜索需要使用共享 TableSearch 并提供语法说明按钮'
);

assert.match(
  productsSource,
  /<TableSearch[\s\S]*id="pl-table-search-input"[\s\S]*onChange=\{onSearchChange\}[\s\S]*id="pl-search-help-btn"/,
  '商品搜索需要使用共享 TableSearch 并提供语法说明按钮'
);

assert.match(
  collectionSource,
  /<TableSearch[\s\S]*id="collection-search"[\s\S]*setSearchQuery\(value\)[\s\S]*id="collection-search-help-btn"/,
  '商品采编搜索需要使用共享 TableSearch、同步输入值并提供语法说明按钮'
);

console.log('orders search IME guard ok');
