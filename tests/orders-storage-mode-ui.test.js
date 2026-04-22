const fs = require('fs');
const path = require('path');
const assert = require('assert');

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ordersIndexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'index.js'), 'utf8');

assert.match(
  indexSource,
  /name="ot-storage-mode"/,
  '订单连接页需要提供存储模式切换'
);

assert.match(
  indexSource,
  /必须选择一个云端存储/,
  '订单连接页需要明确提示必须选择一个云端存储'
);

assert.doesNotMatch(
  indexSource,
  /value="local"/,
  '订单连接页不应再提供仅本地模式'
);

assert.match(
  indexSource,
  /id="ot-supabase-url"/,
  '订单连接页需要提供 Supabase Project ID 输入框'
);

assert.match(
  indexSource,
  /id="ot-supabase-anon-key"/,
  '订单连接页需要提供 Supabase publishable key 输入框'
);

assert.match(
  indexSource,
  /Supabase 三步接入/,
  '订单连接页需要提供 Supabase 三步接入引导'
);

assert.match(
  indexSource,
  /数据保存在你自己的 Supabase 数据库中/,
  'Supabase 说明需要明确数据保存在用户自己的数据库中'
);

assert.match(
  indexSource,
  /只需要准备好自己的 Project ID 和 Publishable key/,
  'Supabase 说明应明确只需要 Project ID 和 Publishable key'
);

assert.match(
  indexSource,
  /需要自行配置，适合数据较多、长期使用/,
  'Supabase 模式卡片应按现有风格说明需要自行配置，适合数据较多、长期使用'
);

assert.match(
  indexSource,
  /General → Project ID/,
  'Supabase 引导里需要说明 Project ID 在 General 页面获取'
);

assert.match(
  indexSource,
  /placeholder="hgrsq......"/,
  'Supabase Project ID 输入框应提示 project ref 格式'
);

assert.match(
  indexSource,
  /API Keys/,
  'Supabase 引导里需要说明 Publishable key 在 API Keys 页面获取'
);

assert.match(
  indexSource,
  /placeholder="sb_publishable_/,
  'Supabase key 输入框占位提示应为 sb_publishable_'
);

assert.doesNotMatch(
  indexSource,
  /publishable \/ anon key/,
  '页面文案不应再混写 anon key'
);

assert.match(
  indexSource,
  /https:\/\/supabase\.com\/dashboard/,
  'Supabase 引导里需要提供新建项目入口链接'
);

assert.match(
  indexSource,
  /https:\/\/supabase\.com\/docs\/guides\/api/,
  'Supabase 引导里需要提供 Data API 说明链接'
);

assert.match(
  indexSource,
  /id="ot-open-supabase-dashboard"/,
  'Supabase 引导里需要提供打开 Dashboard 按钮'
);

assert.match(
  indexSource,
  /id="ot-open-supabase-sql-editor"/,
  'Supabase 引导里需要提供打开 SQL Editor 按钮'
);

assert.match(
  indexSource,
  /id="ot-copy-supabase-schema"/,
  'Supabase 引导里需要提供复制初始化 SQL 按钮'
);

assert.match(
  indexSource,
  /data-schema-url="docs\/supabase\/order-tracker-schema\.sql"/,
  '复制初始化 SQL 按钮需要指向内置 schema 文件'
);

assert.match(
  indexSource,
  /<script src="js\/orders\/supabase-schema\.js" defer><\/script>/,
  '页面需要预加载内置 Supabase schema 文本，避免复制动作依赖运行时拉文件'
);

assert.match(
  ordersIndexSource,
  /ORDER_TRACKER_SUPABASE_SCHEMA/,
  '复制初始化 SQL 逻辑需要优先使用内置 schema 文本'
);

assert.doesNotMatch(
  ordersIndexSource,
  /fetch\(new URL\(schemaUrl, location\.href\)\.href/,
  '复制初始化 SQL 不应依赖运行时 fetch schema 文件'
);

assert.match(
  indexSource,
  /SQL Editor/,
  'Supabase 引导里需要提示去 SQL Editor 执行 schema'
);

assert.match(
  indexSource,
  /团队成员可以共用同一个 Supabase 项目/,
  'Supabase 引导里需要说明团队可共用同一个项目'
);

assert.match(
  indexSource,
  /没有成员级权限隔离/,
  'Supabase 引导里需要说明当前方案没有成员级权限隔离'
);

assert.doesNotMatch(
  indexSource,
  /id="ot-supabase-email"/,
  '订单连接页不应再要求填写 Supabase 邮箱'
);

assert.match(
  indexSource,
  /@supabase\/supabase-js@2/,
  '页面需要加载 Supabase 浏览器客户端'
);

console.log('orders storage mode ui contract ok');
