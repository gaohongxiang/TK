const fs = require('fs');
const path = require('path');
const assert = require('assert');

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sessionSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'session.js'), 'utf8');
const docsSource = fs.readFileSync(path.join(__dirname, '..', 'docs', 'firebase', 'order-tracker-setup.md'), 'utf8');

assert.match(
  indexSource,
  /id="ot-migrate-from-gist"/,
  'Firestore 配置区需要提供从 GitHub Gist 迁移按钮'
);

assert.doesNotMatch(
  indexSource,
  /id="ot-migrate-firestore"/,
  '订单主界面不应额外保留重复的迁移按钮'
);

assert.match(
  indexSource,
  /id="ot-migrate-gist-modal"/,
  '订单模块需要提供从 GitHub Gist 迁移的确认弹窗'
);

assert.match(
  indexSource,
  /如果 Gist 里已有云端数据，会迁移到当前填写的 Firestore 项目；如果没有数据，就直接连接 Firestore/,
  '迁移说明需要明确有数据才迁移，没有数据就直接连接'
);

assert.match(
  indexSource,
  /迁移读取的是 GitHub Gist 里已经同步到云端的数据，不包含其他浏览器里尚未同步的本地改动/,
  '迁移说明需要明确迁移源是 Gist 云端数据'
);

assert.match(
  sessionSource,
  /async function connectOrMigrateFirestore\(/,
  '订单会话模块需要实现 Firestore 连接或可选迁移流程'
);

assert.match(
  sessionSource,
  /await gistProvider\.pullSnapshot\(\)/,
  '迁移流程需要直接读取 Gist 云端快照'
);

assert.match(
  sessionSource,
  /targetSnapshot\.orders\.length/,
  '迁移流程需要检查目标 Firestore 是否已有订单数据'
);

assert.match(
  sessionSource,
  /await firestoreProvider\.pushChanges\(/,
  '迁移流程需要把 Gist 云端订单推送到 Firestore'
);

assert.match(
  sessionSource,
  /await syncNow\(\{\s*forcePull: true\s*\}\)/,
  '连接或迁移完成后需要切换到 Firestore 并强制刷新'
);

assert.match(
  docsSource,
  /从 GitHub Gist 迁移/,
  'Firestore 接入文档需要补充从 GitHub Gist 迁移说明'
);

console.log('orders migration ui contract ok');
