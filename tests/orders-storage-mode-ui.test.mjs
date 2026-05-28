import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appShellSource = fs.readFileSync(path.join(root, 'src', 'react', 'layouts', 'AppShell.tsx'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const calculatorSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'calculator', 'CalculatorApp.tsx'), 'utf8');
const ordersPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const productsPageSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const connectionSource = fs.readFileSync(path.join(root, 'src', 'firestore-connection.ts'), 'utf8');
const appRuntimeSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'AppRuntime.tsx'), 'utf8');
const formPrimitiveSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'form.tsx'), 'utf8');
const pageHeroSource = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'page-hero.tsx'), 'utf8');

assert.doesNotMatch(
  indexSource,
  /GitHub Gist|value="gist"|provider-gist|ot-migrate-from-gist|ot-copy-gist|ot-gistid|ot-token|name="ot-storage-mode"/,
  '页面不应再保留 Gist 或存储模式切换入口'
);

assert.match(
  appRuntimeSource,
  /Firebase Firestore/,
  '页面需要保留 Firebase Firestore 作为唯一云端数据源'
);

assert.match(
  connectionSource,
  /const TKFirestoreConnection = \{/,
  '需要独立的 Firestore 连接 ESM 模块'
);

assert.match(
  appRuntimeSource,
  /id="app-firestore-modal"/,
  'AppRuntime 需要提供全局 Firestore 连接弹层'
);

assert.doesNotMatch(
  appRuntimeSource,
  /id="app-firestore-disconnect-modal"|断开本机数据库连接|app-confirm-firestore-disconnect/,
  '普通 UI 不应再提供断开本机数据库连接弹层'
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
  appRuntimeSource,
  /id="app-firestore-config"/,
  'React 全局 Firestore 连接弹层需要提供 firebaseConfig 输入框'
);

assert.match(
  appRuntimeSource,
  /apiKey[\s\S]*authDomain[\s\S]*projectId[\s\S]*appId/s,
  'React 全局 Firestore 连接弹层需要提示常见配置字段'
);

assert.match(
  appRuntimeSource,
  /id="app-open-firebase-console"/,
  'React 全局 Firestore 连接弹层需要提供打开 Firebase Console 按钮'
);

assert.match(
  appRuntimeSource,
  /id="app-copy-firestore-rules"/,
  'React 全局 Firestore 连接弹层需要提供复制 Firestore 规则按钮'
);

assert.match(
  appRuntimeSource,
  /商品资料、订单资料和商品采编都可以正常保存/,
  'React 全局 Firestore 连接弹层需要用用户能理解的描述提示商品采编也要放行'
);

assert.match(
  ordersPageSource,
  /id(?:=|:) ['"]ot-open-connection['"]/,
  '订单模块未连接时需要提供打开全局连接弹层的按钮'
);

assert.match(
  productsPageSource,
  /id(?:=|:) ['"]pl-open-connection['"]/,
  '商品库模块未连接时需要提供打开全局连接弹层的按钮'
);

assert.match(
  calculatorSource,
  /const calcToolbarClass = 'calc-toolbar[\s\S]*const calcSubnavClass = 'calc-subnav[\s\S]*className=\{calcToolbarClass\}[\s\S]*className=\{calcSubnavClass\}/,
  'React 利润计算器需要将模式切换条放回内容区工具条里'
);

assert.match(
  calculatorSource,
  /<PageHero[\s\S]*title="利润计算器"[\s\S]*<CalculatorModeActions[\s\S]*\{activePanel\}/,
  'React 利润计算器模式切换需要位于标题之后、计算卡片之前'
);

assert.doesNotMatch(
  calculatorSource,
  /useTopbarActions|setTopbarActions/,
  'React 利润计算器模式切换不应再挂到全局顶栏'
);

assert.match(
  calculatorSource,
  /<PageHero[\s\S]*variant="calc"[\s\S]*title="利润计算器"/,
  'React 利润计算器需要使用更明确的页头容器来承接标题层级'
);

assert.match(
  pageHeroSource,
  /className=\{cn\([\s\S]*module-hero[\s\S]*page-hero[\s\S]*module-hero-title-row[\s\S]*<h2/,
  'React 页面标题需要由 PageHero primitive 承接，标题区不再展示蓝色 kicker'
);

assert.match(
  calculatorSource,
  /<PageHero[\s\S]*description="根据各项参数统一测算售价、利润，以及确定售价复盘实际利润"/,
  'React 利润计算器说明需要保留在标题区域'
);

assert.match(
  calculatorSource,
  /const calcTabsClass = 'calc-tabs[\s\S]*const calcModeTabs[\s\S]*'review', '利润复盘'[\s\S]*className=\{calcTabsClass\}[\s\S]*id="calc-help-btn"/,
  'React 利润计算器说明图标需要跟随内容区利润复盘模式按钮'
);

assert.match(
  calculatorSource,
  /from '@\/components\/ui\/button'[\s\S]*from '@\/components\/ui\/tabs'|from '@\/components\/ui\/tabs'[\s\S]*from '@\/components\/ui\/button'/,
  '利润计算器模式切换和帮助弹窗按钮需要使用共享 Button/Tabs primitives'
);

assert.match(
  formPrimitiveSource,
  /data-slot="form-field"[\s\S]*<Label[\s\S]*data-slot="form-field-hint"/s,
  'FormField primitive 需要统一字段容器、Label 和 hint'
);

assert.match(
  calculatorSource,
  /from '@\/components\/ui\/form'[\s\S]*<FormField htmlFor=\{id\}[\s\S]*<FormField htmlFor=\{cargoId\}[\s\S]*<FormField htmlFor="totalCostNew"[\s\S]*<FormField htmlFor="anchor"/,
  '利润计算器字段包装需要收敛到 FormField primitive，并保留关键输入 id'
);

assert.doesNotMatch(
  calculatorSource,
  /<label htmlFor=|<div className="hint">/,
  '利润计算器不应再直接手写 label/hint 字段包装'
);

assert.match(
  calculatorSource,
  /<TabsList className=\{calcTabsClass\}[\s\S]*<TabsTrigger[\s\S]*className="flex-none[\s\S]*data-calc-tab=\{key\}[\s\S]*<Button[\s\S]*id="calc-help-btn"[\s\S]*<Button id="calc-help-close"/,
  '利润计算器页内标签、帮助图标和帮助弹窗确认按钮需要收敛到共享 primitives，并保持旧版自然宽度标签'
);

assert.match(
  appShellSource,
  /<nav className="app-shell-nav" aria-label="模块导航">[\s\S]*className=\{cn\('app-shell-link'/s,
  '模块导航需要改为左侧栏布局'
);

assert.match(
  appShellSource,
  /app-shell-brand[\s\S]*app-shell-logo[\s\S]*app-shell-title/,
  '品牌区需要固定在左侧导航顶部'
);

assert.match(
  appSource,
  /function TopbarGlobalStatus[\s\S]*data-app-topbar-connection[\s\S]*数据库管理[\s\S]*data-app-topbar-auth[\s\S]*账号管理[\s\S]*权限管理[\s\S]*数据导出[\s\S]*退出登录/,
  '数据库连接、账号状态和统一数据导出需要保留在顶部右侧菜单里，退出只处理账号登录态'
);

assert.match(
  pageHeroSource,
  /max-w-none[\s\S]*text-left/,
  '页面标题区域需要改为紧凑左对齐工作区标题'
);

assert.match(
  pageHeroSource,
  /mb-\[12px\][\s\S]*max-\[768px\]:mb-4/,
  '页面标题区域和正文区域之间需要保持紧凑间距'
);

assert.match(
  calculatorSource,
  /const calcToolbarClass = 'calc-toolbar mb-3 flex min-w-0/,
  '利润计算器内容区模式切换需要使用紧凑工具条'
);

assert.doesNotMatch(
  indexSource,
  />更多 ·</,
  '顶部导航不应再保留更多入口'
);

assert.match(
  appShellSource,
  /<nav className="app-shell-nav" aria-label="模块导航">/,
  '仍需通过 React AppShell 保留统一模块导航'
);

assert.doesNotMatch(
  ordersPageSource,
  /id="ot-user"|id="ot-disconnect-firestore"/,
  '订单卡片内不应重复展示数据库连接和退出数据库入口'
);

assert.doesNotMatch(
  productsPageSource,
  /id="pl-user"|id="pl-disconnect-firestore"/,
  '商品库卡片内不应重复展示数据库连接和退出数据库入口'
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
  '项目连接逻辑不应使用浏览器默认 confirm 弹窗'
);

assert.match(
  appRuntimeSource,
  /data-rules-url="docs\/firebase\/order-tracker-firestore\.rules"/,
  '复制 Firestore 规则按钮需要指向文档里的规则文件'
);

assert.doesNotMatch(
  indexSource,
  /<script type="module" src="\/src\/orders\/firestore-rules\.ts"><\/script>/,
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
  /<script src="https:\/\/www\.gstatic\.com\/firebasejs\/12\.6\.0\/firebase-auth-compat\.js" defer><\/script>/,
  '页面需要加载 Firebase Auth compat 脚本'
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
