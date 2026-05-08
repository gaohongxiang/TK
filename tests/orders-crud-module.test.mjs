import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const esmPath = path.join(__dirname, '..', 'src', 'orders', 'crud.mjs');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.ok(!fs.existsSync(esmPath), '完整 React SPA 后不应保留未使用的 orders/crud 过渡模块');

assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'orders', 'index.mjs')), '完整 React SPA 重建后旧订单 DOM 入口应删除');

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再通过旧订单 ESM 入口加载 CRUD 模块'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/crud\.js" defer><\/script>/,
  'index.html 不应再加载旧订单 CRUD 普通脚本'
);

assert.match(
  ordersPageSource,
  /ot-item-block[\s\S]*订单明细/,
  '订单弹窗需要提供订单明细区域'
);

assert.match(
  ordersPageSource,
  /id="ot-item-list"/,
  '订单明细编辑器需要提供订单明细列表容器'
);

assert.match(
  ordersPageSource,
  /name="商品TK ID" id="ot-product-select"[\s\S]*name="商品SKU ID" id="ot-sku-select"/,
  '订单弹窗需要保留聚合后的商品和 SKU 字段'
);

assert.match(
  ordersPageSource,
  /id="ot-add-item-btn"[\s\S]*添加明细/,
  '订单弹窗需要支持新增订单明细行'
);

assert.doesNotMatch(
  ordersPageSource,
  /refreshProductsInOpenModal|shouldDeferItemOptionRefresh|markOrderItemFieldInteraction|pointerdown[\s\S]{0,260}data-item-field/,
  'React 订单页不应再保留旧 DOM 编辑区刷新和抢焦点补丁'
);

assert.match(
  ordersPageSource,
  /一个 TK 订单可以包含多个商品和多个 SKU；每条订单明细对应一个商品的一个 SKU/,
  '订单弹窗需要说明 TK 订单与订单明细、SKU 的对应关系'
);

assert.match(
  ordersPageSource,
  /<FormField label="订单号 \*"[\s\S]*<Input name="订单号" required/,
  '订单号需要是必填字段'
);

assert.match(
  ordersPageSource,
  /<FormField label=\{<>总重量\(g\)[\s\S]*id="ot-weight-hint"[\s\S]*<\/span><\/>\}[\s\S]*name="重量"/,
  '订单弹窗需要展示多件重量自动折算提示'
);

assert.match(
  ordersPageSource,
  /from '@\/components\/ui\/searchable-select'[\s\S]*<SearchableSelect[\s\S]*role="product-combobox"[\s\S]*<SearchableSelect[\s\S]*role="sku-combobox"/,
  'React 订单页需要提供可搜索商品和 SKU 下拉组件'
);

assert.match(
  ordersPageSource,
  /COURIER_AUTO_DETECTORS[\s\S]*detectCourierCompany\(trackingNo,\s*COURIER_AUTO_DETECTORS\)[\s\S]*courierCompany:\s*detected \|\| item\.courierCompany/,
  'React 订单明细填写快递单号时需要优先保存自动识别出的快递公司'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/searchable-select\.js" defer><\/script>/,
  'index.html 不应再加载旧可搜索下拉组件普通脚本'
);

console.log('orders crud module contract ok');
