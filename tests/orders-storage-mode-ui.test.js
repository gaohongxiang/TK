const fs = require('fs');
const path = require('path');
const assert = require('assert');

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ordersIndexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'index.js'), 'utf8');
const connectionSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'firestore-connection.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

assert.doesNotMatch(
  indexSource,
  /GitHub Gist|value="gist"|provider-gist|ot-migrate-from-gist|ot-copy-gist|ot-gistid|ot-token|name="ot-storage-mode"/,
  '页面不应再保留 Gist 或存储模式切换入口'
);

assert.match(
  indexSource,
  /Firebase Firestore/,
  '页面需要保留 Firebase Firestore 作为唯一云端数据源'
);

assert.match(
  connectionSource,
  /const TKFirestoreConnection = \(function \(\) \{/,
  '需要独立的全局 Firestore 连接模块'
);

assert.match(
  indexSource,
  /id="app-firestore-modal"/,
  '页面需要提供全局 Firestore 连接弹层'
);

assert.doesNotMatch(
  indexSource,
  /id="app-firestore-connection"|id="app-firestore-status"/,
  '全局头部不应再保留 Firebase 数据源入口'
);

assert.match(
  indexSource,
  /id="app-firestore-config"/,
  '全局 Firestore 连接弹层需要提供 firebaseConfig 输入框'
);

assert.match(
  indexSource,
  /apiKey[\s\S]*authDomain[\s\S]*projectId[\s\S]*appId/s,
  '全局 Firestore 连接弹层需要提示常见配置字段'
);

assert.match(
  indexSource,
  /id="app-open-firebase-console"/,
  '全局 Firestore 连接弹层需要提供打开 Firebase Console 按钮'
);

assert.match(
  indexSource,
  /id="app-copy-firestore-rules"/,
  '全局 Firestore 连接弹层需要提供复制 Firestore 规则按钮'
);

assert.match(
  indexSource,
  /id="ot-open-connection"/,
  '订单模块未连接时需要提供打开全局连接弹层的按钮'
);

assert.match(
  indexSource,
  /id="pl-open-connection"/,
  '商品库模块未连接时需要提供打开全局连接弹层的按钮'
);

assert.match(
  indexSource,
  /class="calc-toolbar"[\s\S]*class="calc-subnav"/,
  '利润计算器需要将模式切换条放在独立的页内工具行里'
);

assert.match(
  indexSource,
  /class="module-hero page-hero page-hero-calc"/,
  '利润计算器需要使用更明确的页头容器来承接标题层级'
);

assert.match(
  indexSource,
  /class="module-hero-title-row"[\s\S]*<h2>利润计算器<\/h2>[\s\S]*class="module-kicker"/,
  '页面标题和小字说明需要放进同一行的标题区'
);

assert.match(
  indexSource,
  /class="module-hero page-hero page-hero-calc"[\s\S]*根据各项参数统一测算售价、利润，以及确定售价复盘实际利润/,
  '利润计算器说明需要保留在标题区域'
);

assert.match(
  indexSource,
  /class="calc-tabs"[\s\S]*利润复盘[\s\S]*id="calc-help-btn"/,
  '利润计算器说明图标需要紧跟在利润复盘后面'
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
  indexSource,
  /<nav class="modules" aria-label="模块导航">/,
  '顶部仍需保留统一模块导航'
);

assert.match(
  indexSource,
  /id="ot-user"/,
  '订单卡片内需要保留自己的数据库连接状态展示'
);

assert.match(
  indexSource,
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

assert.match(
  indexSource,
  /data-rules-url="docs\/firebase\/order-tracker-firestore\.rules"/,
  '复制 Firestore 规则按钮需要指向文档里的规则文件'
);

assert.match(
  indexSource,
  /<script src="js\/orders\/firestore-rules\.js" defer><\/script>/,
  '页面需要预加载内置 Firestore 规则文本'
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
  indexSource,
  /同一个 Firebase 项目可以给团队成员共用/,
  'Firestore 引导里需要说明团队可共用同一个 Firebase 项目'
);

console.log('orders storage mode ui contract ok');
