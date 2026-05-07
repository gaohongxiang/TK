const fs = require('fs');
const path = require('path');
const assert = require('assert');

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const appShellSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'layouts', 'AppShell.tsx'), 'utf8');
const calculatorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'calculator', 'CalculatorApp.tsx'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const productsPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const connectionSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'firestore-connection.mjs'), 'utf8');
const reactIslandSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'app', 'ReactIsland.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

assert.doesNotMatch(
  indexSource,
  /GitHub Gist|value="gist"|provider-gist|ot-migrate-from-gist|ot-copy-gist|ot-gistid|ot-token|name="ot-storage-mode"/,
  '页面不应再保留 Gist 或存储模式切换入口'
);

assert.match(
  reactIslandSource,
  /Firebase Firestore/,
  '页面需要保留 Firebase Firestore 作为唯一云端数据源'
);

assert.match(
  connectionSource,
  /const TKFirestoreConnection = \{/,
  '需要独立的 Firestore 连接 ESM 模块'
);

assert.match(
  reactIslandSource,
  /id="app-firestore-modal"/,
  'React island 需要提供全局 Firestore 连接弹层'
);

assert.match(
  reactIslandSource,
  /id="app-firestore-disconnect-modal"[\s\S]*退出当前数据库？[\s\S]*id="app-firestore-disconnect-project"[\s\S]*id="app-cancel-firestore-disconnect"[\s\S]*id="app-confirm-firestore-disconnect"/,
  '退出数据库需要使用 React 站内确认弹层，并展示当前 Firebase 项目'
);

assert.doesNotMatch(
  indexSource,
  /id="app-firestore-modal"|id="app-firestore-disconnect-modal"|id="app-firestore-rules-modal"/,
  '完整 React SPA 重建后全局 Firestore 弹层不应保留在静态 HTML'
);

assert.doesNotMatch(
  indexSource,
  /id="app-firestore-connection"|id="app-firestore-status"/,
  '全局头部不应再保留 Firebase 数据源入口'
);

assert.match(
  reactIslandSource,
  /id="app-firestore-config"/,
  'React 全局 Firestore 连接弹层需要提供 firebaseConfig 输入框'
);

assert.match(
  reactIslandSource,
  /apiKey[\s\S]*authDomain[\s\S]*projectId[\s\S]*appId/s,
  'React 全局 Firestore 连接弹层需要提示常见配置字段'
);

assert.match(
  reactIslandSource,
  /id="app-open-firebase-console"/,
  'React 全局 Firestore 连接弹层需要提供打开 Firebase Console 按钮'
);

assert.match(
  reactIslandSource,
  /id="app-copy-firestore-rules"/,
  'React 全局 Firestore 连接弹层需要提供复制 Firestore 规则按钮'
);

assert.match(
  ordersPageSource,
  /id="ot-open-connection"/,
  '订单模块未连接时需要提供打开全局连接弹层的按钮'
);

assert.match(
  productsPageSource,
  /id="pl-open-connection"/,
  '商品库模块未连接时需要提供打开全局连接弹层的按钮'
);

assert.match(
  calculatorSource,
  /className="calc-toolbar"[\s\S]*className="calc-subnav"/,
  'React 利润计算器需要将模式切换条放在独立的页内工具行里'
);

assert.match(
  calculatorSource,
  /className="module-hero page-hero page-hero-calc"/,
  'React 利润计算器需要使用更明确的页头容器来承接标题层级'
);

assert.match(
  calculatorSource,
  /className="module-hero-title-row"[\s\S]*<h2>利润计算器<\/h2>[\s\S]*className="module-kicker"/,
  'React 页面标题和小字说明需要放进同一行的标题区'
);

assert.match(
  calculatorSource,
  /className="module-hero page-hero page-hero-calc"[\s\S]*根据各项参数统一测算售价、利润，以及确定售价复盘实际利润/,
  'React 利润计算器说明需要保留在标题区域'
);

assert.match(
  calculatorSource,
  /className="calc-tabs"[\s\S]*利润复盘[\s\S]*id="calc-help-btn"/,
  'React 利润计算器说明图标需要紧跟在利润复盘后面'
);

assert.match(
  calculatorSource,
  /from '@\/components\/ui\/button'[\s\S]*from '@\/components\/ui\/tabs'|from '@\/components\/ui\/tabs'[\s\S]*from '@\/components\/ui\/button'/,
  '利润计算器模式切换和帮助弹窗按钮需要使用共享 Button/Tabs primitives'
);

assert.match(
  calculatorSource,
  /<TabsList className="calc-tabs"[\s\S]*<TabsTrigger[\s\S]*data-calc-tab=\{key\}[\s\S]*<Button[\s\S]*id="calc-help-btn"[\s\S]*<Button id="calc-help-close"/,
  '利润计算器页内标签、帮助图标和帮助弹窗确认按钮需要收敛到共享 primitives'
);

assert.match(
  cssSource,
  /\.app-header\s*\{[\s\S]*justify-content:\s*flex-start[\s\S]*flex-wrap:\s*nowrap/s,
  '顶部头部需要保持单行布局，品牌在左导航在右'
);

assert.match(
  cssSource,
  /\.app-brand\s*\{[\s\S]*flex:\s*0 0 auto/s,
  '品牌区需要固定在左侧，不再独占一整行'
);

assert.match(
  cssSource,
  /\.app-header-side\s*\{[\s\S]*margin-left:\s*56px[\s\S]*justify-content:\s*flex-start/s,
  '顶部导航需要排在品牌右侧，并与品牌拉开明显距离'
);

assert.match(
  cssSource,
  /\.module-hero\s*\{[\s\S]*justify-content:\s*center[\s\S]*text-align:\s*center/s,
  '页面标题区域需要整体居中'
);

assert.match(
  cssSource,
  /\.module-hero\s*\{[\s\S]*margin-bottom:\s*32px/s,
  '页面标题区域和正文区域之间需要留出更明显的间距'
);

assert.match(
  cssSource,
  /\.calc-toolbar\s*\{[\s\S]*margin-bottom:\s*10px/s,
  '利润计算器的定价框和正文区域之间需要更紧凑'
);

assert.doesNotMatch(
  indexSource,
  />更多 ·</,
  '顶部导航不应再保留更多入口'
);

assert.match(
  appShellSource,
  /<nav className="modules" aria-label="模块导航">/,
  '顶部仍需通过 React AppShell 保留统一模块导航'
);

assert.match(
  ordersPageSource,
  /id="ot-user"/,
  '订单卡片内需要保留自己的数据库连接状态展示'
);

assert.match(
  productsPageSource,
  /id="pl-user"/,
  '商品库卡片内需要保留自己的数据库连接状态展示'
);

assert.match(
  connectionSource,
  /function open\(/,
  '全局 Firestore 连接模块需要暴露打开弹层的方法'
);

assert.match(
  connectionSource,
  /tk-firestore-config-changed/,
  '全局 Firestore 连接模块需要在配置变更后广播事件'
);

assert.doesNotMatch(
  connectionSource,
  /windowRef\.confirm|\.confirm\?\.\(|\.confirm\(/,
  '退出数据库不应使用浏览器默认 confirm 弹窗'
);

assert.match(
  reactIslandSource,
  /data-rules-url="docs\/firebase\/order-tracker-firestore\.rules"/,
  '复制 Firestore 规则按钮需要指向文档里的规则文件'
);

assert.doesNotMatch(
  indexSource,
  /<script type="module" src="\/src\/orders\/firestore-rules\.mjs"><\/script>/,
  '完整 React SPA 重建后页面不应再单独加载 Firestore 规则脚本'
);

assert.match(
  connectionSource,
  /ORDER_TRACKER_FIRESTORE_RULES/,
  '复制 Firestore 规则逻辑需要优先使用内置规则文本'
);

assert.match(
  indexSource,
  /<script src="https:\/\/www\.gstatic\.com\/firebasejs\/12\.6\.0\/firebase-app-compat\.js" defer><\/script>/,
  '页面需要加载 Firebase app compat 脚本'
);

assert.match(
  indexSource,
  /<script src="https:\/\/www\.gstatic\.com\/firebasejs\/12\.6\.0\/firebase-firestore-compat\.js" defer><\/script>/,
  '页面需要加载 Firestore compat 脚本'
);

assert.match(
  ordersPageSource,
  /同一个 Firebase 项目可以给团队成员共用/,
  '订单数据存储说明里需要说明团队可共用同一个 Firebase 项目'
);

console.log('orders storage mode ui contract ok');
