import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const viteConfig = fs.readFileSync(path.join(root, 'vite.config.mjs'), 'utf8');
const tsconfig = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
const tailwindConfig = fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8');
const componentsJson = JSON.parse(fs.readFileSync(path.join(root, 'components.json'), 'utf8'));
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const reactMain = fs.readFileSync(path.join(root, 'src', 'react', 'main.tsx'), 'utf8');
const reactApp = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const appRuntime = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'AppRuntime.tsx'), 'utf8');
const toastBus = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'toast.ts'), 'utf8');
const toastPrimitive = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'toast.tsx'), 'utf8');
const searchableSelectPrimitive = fs.readFileSync(path.join(root, 'src', 'react', 'components', 'ui', 'searchable-select.tsx'), 'utf8');
const appShell = fs.readFileSync(path.join(root, 'src', 'react', 'layouts', 'AppShell.tsx'), 'utf8');
const utilsSource = fs.readFileSync(path.join(root, 'src', 'react', 'lib', 'utils.ts'), 'utf8');
const reactStyles = fs.readFileSync(path.join(root, 'src', 'react', 'styles.css'), 'utf8');
const ordersPage = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const productsPage = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');

const uiRoot = path.join(root, 'src', 'react', 'components', 'ui');

[
  'react',
  'react-dom',
  '@radix-ui/react-slot',
  'echarts',
  'echarts-for-react',
  'lucide-react',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  'tailwindcss-animate'
].forEach(name => {
  assert.ok(packageJson.dependencies[name], `React 迁移依赖需要包含 ${name}`);
});

assert.ok(
  !packageJson.dependencies['@tanstack/react-table'],
  '商品表格当前不应把 TanStack Table 作为运行时依赖'
);

[
  'typescript',
  '@types/react',
  '@types/react-dom',
  '@tailwindcss/vite',
  '@vitejs/plugin-react',
  'tailwindcss',
  'postcss',
  'autoprefixer'
].forEach(name => {
  assert.ok(packageJson.devDependencies[name], `React 迁移开发依赖需要包含 ${name}`);
});

assert.match(
  viteConfig,
  /import react from '@vitejs\/plugin-react'[\s\S]*import tailwindcss from '@tailwindcss\/vite'[\s\S]*plugins:\s*\[react\(\), tailwindcss\(\)\]/,
  'Vite 配置需要同时接入 React 和 Tailwind 插件'
);

assert.match(
  viteConfig,
  /chunkSizeWarningLimit:\s*550[\s\S]*manualChunks[\s\S]*echarts-core[\s\S]*echarts-react/,
  'Vite 构建需要把 ECharts 懒加载依赖拆成独立缓存 chunk，并设置明确包体告警线'
);

assert.strictEqual(tsconfig.compilerOptions.jsx, 'react-jsx', 'TypeScript 需要启用 React JSX transform');
assert.strictEqual(tsconfig.compilerOptions.strict, false, 'React 迁移初期不要一步开启 strict');
assert.deepStrictEqual(tsconfig.compilerOptions.paths['@/*'], ['src/react/*'], 'React 代码需要配置 @ alias');

assert.match(
  viteConfig,
  /resolve:\s*\{[\s\S]*alias:\s*\{[\s\S]*'@':\s*'\/src\/react'/,
  'Vite dev/build 需要同步配置 @ alias，否则 shadcn 组件导入无法解析'
);

assert.match(
  tailwindConfig,
  /content:\s*\['\.\/index\.html', '\.\/src\/react\/\*\*\/\*\.\{ts,tsx\}'\]/,
  'Tailwind 只应先扫描 React 迁移目录和 index.html'
);

assert.match(
  reactMain,
  /import '\.\/styles\.css'/,
  'React 入口需要加载 React 专用 Tailwind 样式入口'
);

assert.match(
  reactStyles,
  /tailwindcss\/theme[\s\S]*tailwindcss\/utilities[\s\S]*@source "\.\/\*\*\/\*\.\{ts,tsx\}"/,
  'React Tailwind 样式入口应只引入 theme/utilities，避免 preflight reset 影响旧页面'
);

assert.strictEqual(componentsJson.rsc, false, 'shadcn 配置需要关闭 RSC');
assert.strictEqual(componentsJson.tsx, true, 'shadcn 配置需要使用 TSX');
assert.strictEqual(componentsJson.aliases.components, '@/components', 'shadcn components alias 需要指向 React 目录 alias');

assert.match(
  indexSource,
  /<div id="root"><\/div>[\s\S]*<script type="module" src="\/src\/react\/main\.tsx"><\/script>/,
  '首页需要只提供单一 React SPA mount 容器和入口'
);

assert.match(
  reactMain,
  /getElementById\('root'\)[\s\S]*createRoot\(root\)\.render\(<App \/>/,
  'React 入口需要只挂载单一 App root，且避免重复挂载'
);

assert.match(
  appShell,
  /function AppShell[\s\S]*<nav className="app-shell-nav" aria-label="模块导航">[\s\S]*href=\{`#\$\{module\.key\}`\}[\s\S]*<div className="app-shell-mobile-bar" data-react-app-shell-ready="true">[\s\S]*renderSidebar/,
  'React AppShell 需要接管主导航，并改为左侧导航加移动端顶部栏'
);

assert.match(
  appShell,
  /<nav className="app-shell-nav"[\s\S]*onCollapsedChange[\s\S]*app-shell-icon-button/,
  '左侧 TK 电商工具箱导航需要支持折叠，业务状态不应重复塞进侧栏'
);

assert.match(
  reactApp,
  /function TopbarGlobalStatus[\s\S]*data-app-topbar-connection[\s\S]*数据库管理[\s\S]*data-app-topbar-auth[\s\S]*账号管理[\s\S]*权限管理[\s\S]*退出登录/,
  '数据库连接和账号状态需要统一放在顶部右侧全局菜单，退出只处理账号登录态'
);

assert.match(
  reactApp,
  /import \{ AppRuntime \} from '\.\/AppRuntime'[\s\S]*import\('\.\.\/features\/analytics\/AnalyticsRoute'\)[\s\S]*AnalyticsPane[\s\S]*<AppRuntime \/>/,
  'React 数据分析应按路由懒加载，避免首屏提前加载图表库'
);

assert.match(
  appRuntime,
  /data-app-runtime-ready="true"[\s\S]*id="app-firestore-modal"[\s\S]*<Textarea[\s\S]*id="app-firestore-rules-modal"[\s\S]*<Alert[\s\S]*<Toast/,
  'React App 内的全局运行层需要接管 Firestore 弹窗和 Toast'
);

assert.doesNotMatch(
  appRuntime,
  /app-firestore-disconnect-modal|app-confirm-firestore-disconnect|断开本机数据库连接/,
  'React App 内的全局运行层不应再提供断开数据库入口'
);

[
  'alert.tsx',
  'badge.tsx',
  'button.tsx',
  'card.tsx',
  'checkbox.tsx',
  'dialog.tsx',
  'form.tsx',
  'input.tsx',
  'label.tsx',
  'select.tsx',
  'search-help.tsx',
  'searchable-select.tsx',
  'table.tsx',
  'tabs.tsx',
  'textarea.tsx',
  'toast.tsx',
  'tooltip.tsx'
].forEach(file => {
  assert.ok(fs.existsSync(path.join(uiRoot, file)), `视觉系统二期 Phase A 需要提供 ${file} primitive`);
});

[
  'button.tsx',
  'card.tsx',
  'dialog.tsx',
  'form.tsx',
  'input.tsx',
  'select.tsx',
  'textarea.tsx',
  'tabs.tsx',
  'badge.tsx',
  'alert.tsx',
  'toast.tsx',
  'searchable-select.tsx',
  'search-help.tsx'
].forEach(file => {
  const source = fs.readFileSync(path.join(uiRoot, file), 'utf8');
  assert.match(source, /data-slot=/, `${file} 需要暴露 data-slot，便于后续 UI 收敛和测试`);
  assert.match(source, /var\(--|color-mix\(in_srgb|class-variance-authority|cn\(/, `${file} 需要复用现有 token 或 Tailwind/cva 样式`);
});

const searchHelpSource = fs.readFileSync(path.join(uiRoot, 'search-help.tsx'), 'utf8');
assert.match(
  searchHelpSource,
  /createPortal\(dialog, document\.body\)/,
  '搜索说明弹窗需要挂到 body，避免被表格工具条层叠和滚动容器影响'
);
assert.match(
  searchHelpSource,
  /size="smIcon"[\s\S]*<HelpCircle/,
  '搜索说明入口需要是纯图标按钮'
);
assert.doesNotMatch(
  searchHelpSource,
  /<HelpCircle[\s\S]*说明[\s\S]*<\/Button>/,
  '搜索说明入口按钮不应再显示“说明”文字'
);

assert.match(
  fs.readFileSync(path.join(uiRoot, 'input.tsx'), 'utf8'),
  /inputVariants[\s\S]*tone:[\s\S]*readonly[\s\S]*primary[\s\S]*expense[\s\S]*success/s,
  'Input primitive 需要承接计算器的重点/费用/成功/只读视觉状态'
);

assert.match(
  fs.readFileSync(path.join(uiRoot, 'select.tsx'), 'utf8'),
  /appearance-none[\s\S]*bg-none/,
  'Select primitive 需要隐藏原生下拉箭头，保持货物类型和基准折扣档位显示简洁'
);

assert.match(
  fs.readFileSync(path.join(uiRoot, 'status-strip.tsx'), 'utf8'),
  /syncStatusBaseClass = 'sync[\s\S]*border-0[\s\S]*bg-transparent[\s\S]*px-0/,
  '商品管理和订单管理同步状态文本不应带边框或底色'
);

assert.match(
  fs.readFileSync(path.join(uiRoot, 'input.tsx'), 'utf8'),
  /min-h-10[\s\S]*readonly:[\s\S]*tk-input-tone-readonly[\s\S]*expense:[\s\S]*tk-input-tone-expense[\s\S]*success:[\s\S]*tk-input-tone-success/s,
  'Input primitive 的计算器语义输入框需要保持 GitHub main 同款柔和红色/绿色底色'
);

assert.match(
  fs.readFileSync(path.join(root, 'src', 'react', 'styles', 'base.css'), 'utf8'),
  /\.tk-input-tone-success[\s\S]*background:\s*linear-gradient\(180deg,\s*rgba\(138,\s*255,\s*207,\s*\.18\),\s*rgba\(138,\s*255,\s*207,\s*\.08\)\)[\s\S]*\.tk-input-tone-expense[\s\S]*background:\s*linear-gradient\(180deg,\s*rgba\(240,\s*138,\s*134,\s*\.18\),\s*rgba\(240,\s*138,\s*134,\s*\.08\)\)/s,
  '计算器语义输入框需要用 background 简写覆盖基础蓝底，避免透明红绿叠色发灰'
);

assert.match(
  toastBus,
  /import \{ TKFirestoreConnection \} from '..\/..\/firestore-connection\.ts'[\s\S]*TKFirestoreConnection\.showToast\(message, type\)/,
  '商品、订单等 React 页面 Toast 需要通过 ESM Firestore 连接模块进入 AppRuntime showToast'
);

assert.match(
  toastPrimitive,
  /data-slot="toast"[\s\S]*border-\[var\(--danger\)\][\s\S]*border-\[var\(--ok\)\]/,
  'Toast primitive 需要承接全局提示容器的视觉状态'
);

assert.match(
  searchableSelectPrimitive,
  /function SearchableSelect\([\s\S]*data-role="trigger"[\s\S]*data-option-value/,
  '可搜索下拉框需要进入共享 React UI primitive，而不是留在订单页本地实现'
);

assert.doesNotMatch(
  ordersPage + productsPage,
  /querySelector\('#toast'\)|toast\.className|showToast\.timer|className = `toast/,
  '商品和订单页面不应再直接改 #toast DOM class，避免覆盖 React/Tailwind Toast 样式'
);

assert.doesNotMatch(
  appRuntime + ordersPage + productsPage,
  /modal-copy/,
  'React 弹窗说明文字不应继续依赖 legacy modal-copy CSS class'
);

assert.match(
  utilsSource,
  /twMerge\(clsx\(inputs\)\)/,
  'React 工具层需要提供 shadcn 常用 cn helper'
);

console.log('app runtime contract ok');
