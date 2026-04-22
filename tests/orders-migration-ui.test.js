const fs = require('fs');
const path = require('path');
const assert = require('assert');

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sessionSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'session.js'), 'utf8');
const docsSource = fs.readFileSync(path.join(__dirname, '..', 'docs', 'supabase', 'order-tracker-setup.md'), 'utf8');

assert.match(
  indexSource,
  /id="ot-migrate-from-gist"/,
  'Supabase 配置区需要提供从 GitHub Gist 迁移按钮'
);

assert.doesNotMatch(
  indexSource,
  /id="ot-migrate-supabase"/,
  '订单主界面不应再保留旧的迁移到 Supabase 按钮'
);

assert.match(
  indexSource,
  /id="ot-migrate-gist-modal"/,
  '订单模块需要提供从 GitHub Gist 迁移的确认弹窗'
);

assert.match(
  indexSource,
  /如果 Gist 里已有云端数据，会迁移到当前填写的 Supabase 项目；如果没有数据，就直接连接 Supabase/,
  '迁移说明需要明确有数据才迁移，没有数据就直接连接'
);

assert.match(
  indexSource,
  /迁移读取的是 GitHub Gist 里已经同步到云端的数据，不包含其他浏览器里尚未同步的本地改动/,
  '迁移说明需要明确迁移源是 Gist 云端数据'
);

assert.match(
  sessionSource,
  /async function connectOrMigrateSupabase\(/,
  '订单会话模块需要实现 Supabase 连接或可选迁移流程'
);

assert.match(
  sessionSource,
  /await gistProvider\.pullSnapshot\(\)/,
  '迁移流程需要直接读取 Gist 云端快照'
);

assert.match(
  sessionSource,
  /targetSnapshot\.orders\.length/,
  '迁移流程需要检查目标 Supabase 是否已有订单数据'
);

assert.match(
  sessionSource,
  /await supabaseProvider\.pushChanges\(/,
  '迁移流程需要把 Gist 云端订单推送到 Supabase'
);

assert.match(
  sessionSource,
  /await syncNow\(\{ forcePull: true \}\)/,
  '连接或迁移完成后需要切换到 Supabase 并强制刷新'
);

assert.doesNotMatch(
  sessionSource,
  /await syncNow\(\{ forcePull: false \}\)/,
  '新的迁移流程不应要求先切回 Gist 页面同步当前已加载数据'
);

assert.match(
  docsSource,
  /从 GitHub Gist 迁移/,
  'Supabase 接入文档需要补充从 GitHub Gist 迁移说明'
);

console.log('orders migration ui contract ok');
