const fs = require('fs');
const path = require('path');
const assert = require('assert');

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const tabsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'tabs.js'), 'utf8');
const tableSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'table.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

assert.match(
  indexSource,
  /id="ot-header-status-row"[\s\S]*id="ot-header-summary-row"[\s\S]*id="ot-header-accounts-row"[\s\S]*id="ot-header-controls-row"/,
  '订单主面板顶部需要拆成状态、统计、账号、控制四层'
);

assert.match(
  indexSource,
  /id="ot-acc-tabs-all"/,
  '账号区需要提供固定的全部标签容器'
);

assert.match(
  indexSource,
  /id="ot-acc-tabs-scroll"/,
  '账号区需要提供横向滚动的账号容器'
);

assert.match(
  indexSource,
  /id="ot-acc-actions"[\s\S]*id="ot-add"/,
  '账号区右侧需要固定显示新增订单按钮'
);

assert.doesNotMatch(
  indexSource,
  /id="ot-acc-actions"[\s\S]*id="ot-tab-add"/,
  '添加账号按钮不应再放在新增订单旁边'
);

const statusRowSlice = (indexSource.match(/id="ot-header-status-row"[\s\S]*?id="ot-header-summary-row"/) || [''])[0];

assert.doesNotMatch(
  statusRowSlice,
  /id="ot-add"/,
  '新增订单不应再出现在顶部状态栏动作组中'
);

assert.match(
  statusRowSlice,
  /id="ot-sync"[\s\S]*id="ot-refresh"[\s\S]*id="ot-storage-help-btn"/,
  '刷新按钮需要紧跟在同步状态后面，并放在存储说明图标前面'
);

assert.match(
  statusRowSlice,
  /id="ot-refresh"[^>]*aria-label="刷新订单数据"[^>]*>[\s\S]*<svg/,
  '刷新按钮需要收成图标按钮并保留无障碍名称'
);

assert.match(
  statusRowSlice,
  /id="ot-refresh"[\s\S]*A7 7[\s\S]*A7 7/,
  '刷新图标需要使用断开的双弧线样式，避免头尾连成一圈'
);

assert.match(
  tabsSource,
  /#ot-acc-tabs-all/,
  '账号标签渲染需要写入固定的全部标签容器'
);

assert.match(
  tabsSource,
  /#ot-acc-tabs-scroll/,
  '账号标签渲染需要写入横向滚动的账号容器'
);

assert.match(
  tabsSource,
  /ot-acc-tabs-scroll-inner[\s\S]*id="ot-tab-add"/,
  '添加账号按钮需要跟在账号滚动区末尾'
);

assert.match(
  tableSource,
  /tableControls\.buildTableToolbarMarkup\(\{[\s\S]*prefix: 'ot'[\s\S]*includeSearch/,
  '表格视图需要通过共用控件输出订单吸顶控制带'
);

assert.match(
  fs.readFileSync(path.join(__dirname, '..', 'js', 'table-controls.js'), 'utf8'),
  /ot-table-toolbar-left/,
  '共用表格控件需要把搜索区放到控制带左侧'
);

assert.match(
  cssSource,
  /\.ot-acc-shell/,
  '样式表需要定义账号行三段结构'
);

assert.match(
  cssSource,
  /\.ot-acc-tabs-scroll/,
  '样式表需要定义账号横向滚动区域'
);

assert.match(
  cssSource,
  /\.ot-acc-actions[\s\S]*margin-left: 16px/,
  '样式表需要让账号区和新增订单按钮之间保留明显间距'
);

assert.match(
  cssSource,
  /\.ot-refresh-inline/,
  '样式表需要定义顶部内联刷新图标按钮'
);

assert.match(
  cssSource,
  /\.ot-refresh-inline\s*\{[\s\S]*background:\s*transparent;/,
  '刷新图标按钮需要去掉灰底'
);

assert.match(
  cssSource,
  /\.ot-refresh-inline\.is-spinning[\s\S]*ot-refresh-spin/,
  '刷新图标按钮在刷新时需要持续转圈'
);

assert.match(
  cssSource,
  /\.ot-sticky-controls/,
  '样式表需要定义表格控制带吸顶样式'
);

assert.match(
  cssSource,
  /\.ot-table-wrap\s*\{[^}]*margin:\s*0;[^}]*\}/,
  '表格横向滚动区不应再用负边距撑到卡片最边缘'
);

assert.match(
  cssSource,
  /\.ot-table-wrap\s*\{[^}]*padding:\s*0 2px;[^}]*\}/,
  '表格横向滚动区需要和吸顶控制带保持接近的可视宽度'
);

assert.match(
  cssSource,
  /\.ot-table-search[\s\S]*width: 320px/,
  '搜索框需要加长到更适合桌面端输入的宽度'
);

console.log('orders header layout ui contract ok');
