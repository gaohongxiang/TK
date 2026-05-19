import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const esmPath = path.join(root, 'src', 'orders', 'tabs.mjs');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');

assert.ok(
  !fs.existsSync(esmPath),
  '完整 React SPA 重建后旧订单账号标签 DOM runtime 应删除'
);

assert.ok(!fs.existsSync(path.join(root, 'src', 'orders', 'index.mjs')), '完整 React SPA 重建后旧订单 DOM 入口应删除');

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后 index.html 不应再通过旧订单 ESM 入口加载账号标签模块'
);

assert.match(
  ordersPageSource,
  /const allAccounts = accounts[\s\S]*<AccountTabsBar[\s\S]*id="ot-acc-tabs"[\s\S]*id: 'ot-tab-add'[\s\S]*id="ot-add"/,
  'React 订单页需要通过共享账号表渲染 AccountTabsBar 和新增订单入口'
);

assert.doesNotMatch(
  ordersPageSource,
  /mergeAccountOrder|orders\.map\(order => order\['账号'\]\)[\s\S]*setAccounts/,
  '订单账号标签只能来自 order_accounts 共享账号表，不能从订单数据反推账号列表'
);

assert.match(
  ordersPageSource,
  /orders\.filter\(order => normalizeAccountName\(order\['账号'\]\) === account\)\.length/,
  'React 订单页需要直接统计账号订单数量'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/tabs\.js" defer><\/script>/,
  'index.html 不应再加载旧订单账号标签普通脚本'
);

console.log('orders tabs runtime removal contract ok');
