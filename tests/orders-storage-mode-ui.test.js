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

assert.match(
  indexSource,
  /value="gist"/,
  '订单连接页需要保留 Gist 模式'
);

assert.match(
  indexSource,
  /value="firestore"/,
  '订单连接页需要提供 Firestore 模式'
);

assert.match(
  indexSource,
  /value="firestore" checked/,
  '订单连接页默认应选中 Firestore 模式'
);

assert.match(
  indexSource,
  /Firebase Firestore/,
  '订单连接页需要把长期模式切到 Firebase Firestore'
);

assert.match(
  indexSource,
  /id="ot-firestore-config"/,
  '订单连接页需要提供 firebaseConfig 输入框'
);

assert.match(
  indexSource,
  /apiKey[\s\S]*authDomain[\s\S]*projectId[\s\S]*appId/s,
  'firebaseConfig 输入框需要提示常见配置字段'
);

assert.match(
  indexSource,
  /Firestore 三步接入/,
  '订单连接页需要提供 Firestore 三步接入引导'
);

assert.match(
  indexSource,
  /添加应用时选 <code>网页<\/code>/,
  'Firestore 引导里需要明确应用平台选择网页'
);

assert.match(
  indexSource,
  /不用勾 Hosting/,
  'Firestore 引导里需要明确不必启用 Firebase Hosting'
);

assert.match(
  indexSource,
  /区域级/,
  'Firestore 引导里需要明确数据库位置建议选区域级'
);

assert.match(
  indexSource,
  /模式选 <code>生产模式<\/code>/,
  'Firestore 引导里需要明确数据库模式建议选生产模式'
);

assert.match(
  indexSource,
  /数据保存在你自己的 Firebase 项目里/,
  'Firestore 说明需要明确数据保存在用户自己的 Firebase 项目里'
);

assert.match(
  indexSource,
  /使用 Firestore 自带的离线缓存/,
  'Firestore 说明需要明确本地缓存走 Firestore 自带离线缓存'
);

assert.match(
  indexSource,
  /https:\/\/console\.firebase\.google\.com\//,
  'Firestore 引导里需要提供 Firebase Console 链接'
);

assert.match(
  indexSource,
  /id="ot-open-firebase-console"/,
  'Firestore 引导里需要提供打开 Firebase Console 按钮'
);

assert.match(
  indexSource,
  /id="ot-copy-firestore-rules"/,
  'Firestore 引导里需要提供复制 Firestore 规则按钮'
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
  ordersIndexSource,
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
