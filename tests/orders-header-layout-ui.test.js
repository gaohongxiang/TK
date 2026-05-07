const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { readReactStyleSource } = require('./helpers/react-style-source.cjs');

const root = path.join(__dirname, '..');

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const reactCheckboxSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'checkbox.tsx'), 'utf8');
const reactTabsSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'tabs.tsx'), 'utf8');
const reactTableToolsSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'table-tools.tsx'), 'utf8');
const reactMainSource = fs.readFileSync(path.join(root, 'src', 'react', 'main.tsx'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const tableSource = fs.readFileSync(path.join(root, 'src', 'orders', 'table.mjs'), 'utf8');
const cssSource = readReactStyleSource(root);

assert.match(
  ordersPageSource,
  /id="ot-header-status-row"[\s\S]*id="ot-header-summary-row"[\s\S]*id="ot-header-accounts-row"/,
  '订单主面板顶部需要拆成状态、统计、账号三层'
);

assert.match(
  ordersPageSource,
  /id="ot-table-toolbar-container"[\s\S]*id="ot-table-footer-toolbar-container"/,
  'React 订单表格需要提供上下两处搜索和分页控制带'
);

assert.match(
  ordersPageSource,
  /id="ot-acc-tabs-all"/,
  '账号区需要提供固定的全部标签容器'
);

assert.match(
  ordersPageSource,
  /id="ot-acc-tabs-scroll"/,
  '账号区需要提供横向滚动的账号容器'
);

assert.match(
  ordersPageSource,
  /id="ot-acc-actions"[\s\S]*id="ot-add"/,
  '账号区右侧需要固定显示新增订单按钮'
);

assert.match(
  ordersPageSource,
  /from '@\/components\/ui\/checkbox'[\s\S]*from '@\/components\/ui\/tabs'|from '@\/components\/ui\/tabs'[\s\S]*from '@\/components\/ui\/checkbox'/,
  '订单管理账号标签和导出弹层需要开始使用共享 Checkbox/Tabs primitives'
);

assert.match(
  ordersPageSource,
  /<Tabs[\s\S]*id="ot-acc-tabs"[\s\S]*<TabsTrigger[\s\S]*active=\{activeAccount === '__all__'\}[\s\S]*<TabsList[\s\S]*ot-acc-tabs-scroll-inner[\s\S]*<TabsTrigger[\s\S]*active=\{activeAccount === account\}/,
  '订单账号筛选需要迁到共享 Tabs/TabsTrigger，同时保留现有账号区 DOM 语义'
);

assert.match(
  ordersPageSource,
  /<Checkbox id="ot-export-all"[\s\S]*<Checkbox[\s\S]*className="ot-export-checkbox"/,
  '订单导出账号选择需要迁到共享 Checkbox primitive'
);

assert.match(
  reactTabsSource + reactCheckboxSource,
  /data-slot="tabs-trigger"[\s\S]*data-slot="checkbox"/,
  '共享 Tabs 和 Checkbox primitives 需要暴露 data-slot'
);

assert.doesNotMatch(
  ordersPageSource,
  /id="ot-acc-actions"[\s\S]*id="ot-tab-add"/,
  '添加账号按钮不应再放在新增订单旁边'
);

const statusRowSlice = (ordersPageSource.match(/id="ot-header-status-row"[\s\S]*?id="ot-header-summary-row"/) || [''])[0];

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
  /id="ot-refresh"[\s\S]*aria-label="刷新订单数据"[\s\S]*<RefreshCw/,
  '刷新按钮需要收成图标按钮并保留无障碍名称'
);

assert.match(
  statusRowSlice,
  /id="ot-refresh"[\s\S]*<RefreshCw/,
  '刷新图标需要使用 lucide 图标并保持图标按钮形态'
);

assert.match(
  ordersPageSource,
  /data-react-orders-page-ready="true"/,
  'React 订单页面外壳需要提供可测试的挂载完成标记'
);

assert.match(
  reactAppSource,
  /id="view-orders"[\s\S]*<OrdersPage \/>/,
  'React App 需要直接渲染订单页面外壳'
);

assert.ok(
  !fs.existsSync(path.join(root, 'src', 'orders', 'tabs.mjs')),
  'React SPA 重建后旧订单账号标签 runtime 应删除'
);

assert.match(
  ordersPageSource,
  /id="ot-table-toolbar-container"[\s\S]*id="ot-table-search-input"[\s\S]*id="ot-table-footer-toolbar-container"/,
  'React 订单页需要直接输出订单吸顶控制带和底部分页'
);

assert.ok(
  !fs.existsSync(path.join(root, 'src', 'table-controls.mjs')),
  '完整 React SPA 重建后旧 DOM 表格控件 runtime 应删除'
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
  ordersPageSource,
  /from '@\/components\/ui\/table-tools'[\s\S]*<TableToolbar[\s\S]*<TableSearch/,
  '订单表格控制带需要使用共享 table-tools primitives'
);

assert.match(
  ordersPageSource,
  /function ProductPager[\s\S]*<TablePager/,
  '订单分页需要通过共享 TablePager primitive 渲染'
);

assert.match(
  reactTableToolsSource,
  /function TableToolbar[\s\S]*sticky top-3[\s\S]*function TableViewport[\s\S]*overflow-x-auto/,
  '共享 table-tools 需要承载吸顶控制带和横向滚动外壳'
);

assert.doesNotMatch(
  cssSource,
  /\.ot-table-toolbar|\.ot-table-search|\.ot-table-wrap|\.ot-table-pagination/,
  '表格控制带、搜索、分页和横向滚动不应继续依赖旧 ot-* 全局 CSS'
);

assert.match(
  reactTableToolsSource,
  /w-80[\s\S]*max-\[768px\]:w-full/,
  '共享表格搜索框需要保留桌面 320px 和移动端全宽布局'
);

console.log('orders header layout ui contract ok');
