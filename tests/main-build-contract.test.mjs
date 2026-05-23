import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const viteConfig = fs.readFileSync(path.join(root, 'vite.config.mjs'), 'utf8');
const copyScript = fs.readFileSync(path.join(root, 'scripts', 'copy-main-assets.mjs'), 'utf8');
const smokeScript = fs.readFileSync(path.join(root, 'scripts', 'preview-smoke.mjs'), 'utf8');
const releaseCheckScript = fs.readFileSync(path.join(root, 'scripts', 'release-check.sh'), 'utf8');
const playwrightConfig = fs.readFileSync(path.join(root, 'playwright.config.mjs'), 'utf8');
const releaseE2e = fs.readFileSync(path.join(root, 'tests', 'e2e', 'release.spec.ts'), 'utf8');
const releaseWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'release-check.yml'), 'utf8');
const wrangler = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const privacySource = fs.readFileSync(path.join(root, 'public', 'privacy.html'), 'utf8');
const termsSource = fs.readFileSync(path.join(root, 'public', 'terms.html'), 'utf8');
const notFoundSource = fs.readFileSync(path.join(root, 'public', '404.html'), 'utf8');
const sitePageCss = fs.readFileSync(path.join(root, 'public', 'site-page.css'), 'utf8');
const robotsSource = fs.readFileSync(path.join(root, 'public', 'robots.txt'), 'utf8');
const sitemapSource = fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8');
const headersSource = fs.readFileSync(path.join(root, 'public', '_headers'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.webmanifest'), 'utf8'));

assert.strictEqual(
  packageJson.type,
  'module',
  '根目录应声明 ESM，业务 TypeScript 模块由 Node/Vite 按 ESM 解析'
);

assert.ok(
  fs.readdirSync(path.join(root, 'tests')).filter(file => file.endsWith('.test.js')).length === 0,
  'contract 测试不应使用 package ESM 下语义不清的 .js 后缀'
);

assert.ok(
  fs.readdirSync(path.join(root, 'tests')).filter(file => file.endsWith('.test.cjs')).length === 0,
  'contract 测试应统一使用 ESM .mjs 后缀，不再保留 CommonJS .cjs'
);

assert.match(
  packageJson.scripts.build,
  /^vite build && node scripts\/copy-main-assets\.mjs(?: && .+)?$/,
  '主站 build 需要先跑 Vite，再补充稳定静态资源，后面可追加构建产物生成'
);

assert.strictEqual(
  packageJson.scripts.preview,
  'vite preview --host 0.0.0.0',
  '主站需要提供 Vite preview 命令'
);

assert.strictEqual(
  packageJson.scripts.smoke,
  'node scripts/preview-smoke.mjs',
  '主站需要提供构建产物 smoke 命令'
);

assert.strictEqual(
  packageJson.scripts.e2e,
  'playwright test',
  '主站需要提供浏览器级 e2e smoke 命令'
);

assert.strictEqual(
  packageJson.scripts.typecheck,
  'tsc --noEmit',
  '主站需要提供 TypeScript 类型检查命令'
);

assert.strictEqual(
  packageJson.scripts['release:check'],
  'sh scripts/release-check.sh',
  '主站需要提供完整发布检查命令'
);

assert.strictEqual(
  packageJson.scripts.test,
  'sh -c \'for f in tests/*.test.mjs; do node "$f" || exit 1; done\'',
  '根目录需要提供完整测试命令'
);

assert.match(
  viteConfig,
  /outDir:\s*'dist'/,
  'Vite 构建产物需要输出到 dist'
);

assert.match(
  viteConfig,
  /@vitejs\/plugin-react[\s\S]*@tailwindcss\/vite[\s\S]*plugins:\s*\[react\(\), tailwindcss\(\)\]/,
  'React 渐进迁移阶段需要通过 Vite React 插件接入 TSX，并接入 Tailwind utilities'
);

assert.match(
  copyScript,
  /assertExists\(path\.join\(distDir, 'index\.html'\)\)[\s\S]*cp\(path\.join\(root, 'logo\.png'\), path\.join\(distDir, 'logo\.png'\)[\s\S]*assertExists\(path\.join\(distDir, 'logo\.png'\)\)/,
  '构建后需要补充公开分享和 manifest 依赖的稳定 logo.png'
);

assert.doesNotMatch(
  copyScript,
  /path\.join\(root, 'js'\)|path\.join\(distDir, 'js'\)/,
  '标准模块化后构建脚本不应再复制旧业务 js 目录'
);

assert.match(
  smokeScript,
  /vite\.js'[\s\S]*'preview'[\s\S]*\/privacy\.html[\s\S]*\/terms\.html[\s\S]*\/manifest\.webmanifest[\s\S]*\/_headers[\s\S]*\/logo\.png[\s\S]*\/js\/app\.js[\s\S]*\/js\/orders\/provider-supabase\.js/,
  'smoke 脚本需要启动 Vite preview 并检查核心静态路径、logo、Cloudflare headers 文件，以及旧业务 js 不在产物中'
);

assert.match(
  smokeScript,
  /<div id="root"><\\\/div>[\s\S]*firebase-auth-compat\\\.js[\s\S]*firebase-firestore-compat\\\.js[\s\S]*xlsx\\\.full\\\.min\\\.js/,
  '完整 React SPA 重建后 smoke 首页检查应按单根 React 入口、Auth/Firestore 和第三方运行时脚本校验'
);

assert.match(
  playwrightConfig,
  /testDir:\s*'\.\/tests\/e2e'[\s\S]*name:\s*'desktop-chromium'[\s\S]*name:\s*'mobile-chromium'[\s\S]*command:\s*'npm run build && npx vite preview --host 127\.0\.0\.1 --port 4174 --strictPort'/,
  'Playwright 需要基于构建产物启动 production preview，并覆盖桌面和移动浏览器项目'
);

assert.match(
  releaseE2e,
  /installOfflineFixtures[\s\S]*window\.firebase[\s\S]*window\.XLSX[\s\S]*installRuntimeGuards[\s\S]*page\.on\('console'[\s\S]*page\.on\('pageerror'[\s\S]*page\.on\('requestfailed'[\s\S]*TK-E2E-001[\s\S]*ORDER-E2E-001[\s\S]*activateFooterRoute[\s\S]*\/privacy\.html[\s\S]*\/terms\.html[\s\S]*\/404\.html/,
  '浏览器级 smoke 需要用离线 fixtures 覆盖商品、订单、分析、页脚路由、静态页，并守住运行时错误'
);

assert.match(
  releaseCheckScript,
  /npm test[\s\S]*npm run typecheck[\s\S]*\.\/scripts\/docs-build\.sh[\s\S]*npm run build[\s\S]*npm run smoke[\s\S]*npm run e2e[\s\S]*git diff --check/,
  '完整发布检查需要覆盖单测、类型检查、文档、构建、HTTP smoke、浏览器 e2e 和 diff 检查'
);

assert.match(
  releaseWorkflow,
  /actions\/setup-node@v4[\s\S]*node-version:\s*22[\s\S]*npm ci[\s\S]*working-directory:\s*docs[\s\S]*playwright install --with-deps chromium[\s\S]*npm run release:check/,
  'CI workflow 需要安装主站和文档依赖、安装 Playwright 浏览器并运行完整发布检查'
);

assert.match(
  wrangler,
  /pages_build_output_dir\s*=\s*"\.\/dist"/,
  'Cloudflare Pages 配置需要指向 dist'
);

assert.match(
  gitignore,
  /^dist\/$/m,
  'dist 构建产物不应提交'
);

assert.match(
  gitignore,
  /^node_modules\/$/m,
  'node_modules 不应提交'
);

assert.match(
  reactAppSource,
  /href="\/privacy\.html"[\s\S]*隐私与数据边界[\s\S]*href="\/terms\.html"[\s\S]*使用条款/,
  '主站 React App 页脚需要提供隐私与数据边界和使用条款入口'
);

assert.match(
  reactAppSource,
  /skipLinkClass = 'skip-link[\s\S]*appWrapClass = 'wrap[\s\S]*appMainClass = 'app-main[\s\S]*<a className=\{skipLinkClass\} href="#main-content">跳到主要内容<\/a>[\s\S]*<AppShell[\s\S]*modules=\{visibleModules\}[\s\S]*active=\{renderedActive\}[\s\S]*docsUrl=\{config\.docsUrl\}[\s\S]*authEmail=\{authSession\.user\?\.email \|\| authSession\.user\?\.uid \|\| ''\}[\s\S]*<main id="main-content" className=\{appMainClass\} tabIndex=\{-1\}>/,
  '主站需要由 React App 提供跳转主内容链接、AppShell 和 main landmark'
);

assert.match(
  fs.readFileSync(path.join(root, 'src', 'react', 'layouts', 'AppShell.tsx'), 'utf8'),
  /modulesNavClass = 'modules[\s\S]*<nav className=\{modulesNavClass\} aria-label="模块导航">[\s\S]*aria-current=\{isActive \? 'page' : undefined\}/,
  'React AppShell 需要保留统一模块导航和当前导航语义'
);

assert.match(
  reactAppSource,
  /<main id="main-content" className=\{appMainClass\}[\s\S]*id="view-calc"[\s\S]*id="view-login"[\s\S]*id="view-orders"[\s\S]*id="view-products"[\s\S]*id="view-finance"[\s\S]*id="view-collection"[\s\S]*id="view-analytics"[\s\S]*<\/main>[\s\S]*<footer(?:\s+className=\{appFooterClass\})?>/,
  '主站核心工具视图需要由 React 放在 main landmark 内，footer 需要留在 main 之后'
);

assert.match(
  reactAppSource,
  /function viewClass\(active: string, key: string\) \{[\s\S]*active === key \? 'relative block' : 'relative hidden'/,
  '主站视图容器不能创建 z-index stacking context，否则页面内 fixed 弹窗会被 footer 盖住'
);

assert.match(
  reactAppSource,
  /appFooterClass = 'relative mt-\[30px\] grid justify-items-center[\s\S]*appFooterCopyClass[\s\S]*appFooterLinksClass[\s\S]*appFooterCopyrightClass[\s\S]*<span className=\{appFooterCopyClass\}>[\s\S]*<span className=\{appFooterLinksClass\}>[\s\S]*<span className=\{appFooterCopyrightClass\}>/,
  '主站 footer 需要把说明、链接和版权分层排版，且不能用 z-index 抢商品弹窗点击'
);

assert.match(
  fs.readFileSync(path.join(root, 'src', 'react', 'layouts', 'AppShell.tsx'), 'utf8'),
  /aria-current=\{isActive \? 'page' : undefined\}/,
  'hash 路由切换时需要通过 React AppShell 同步导航 aria-current'
);

assert.match(
  reactAppSource,
  /skipLinkClass = 'skip-link[\s\S]*-translate-y-\[140%\][\s\S]*focus:translate-y-0/,
  '跳转主内容链接默认隐藏，键盘聚焦时需要可见'
);

assert.doesNotMatch(
  htmlSource,
  /href="css\/style\.css"/,
  '现代 React SPA 不应再从 index.html 直连旧 css/style.css'
);

assert.ok(
  !fs.existsSync(path.join(root, 'css', 'style.css')),
  '现代 React SPA 样式应进入 src/react/styles.css 和 styles modules，不再保留旧 css/style.css 入口'
);

assert.match(
  fs.readFileSync(path.join(root, 'src', 'react', 'styles.css'), 'utf8'),
  /tailwindcss\/utilities[\s\S]*@import "\.\/styles\/base\.css"/,
  'React 样式入口需要只保留 Tailwind utilities 和基础 token 样式'
);

assert.doesNotMatch(
  fs.readFileSync(path.join(root, 'src', 'react', 'styles.css'), 'utf8'),
  /09-responsive\.css|02-calculator-core\.css|05-analytics\.css|08-calculator-reference\.css/,
  '已迁入 React/Tailwind 的旧样式模块不应继续从 React 样式入口导入'
);

assert.match(
  htmlSource,
  /<link rel="canonical" href="https:\/\/tk-evu\.pages\.dev\/" \/>[\s\S]*property="og:title" content="TK 电商工具箱"[\s\S]*property="og:image" content="https:\/\/tk-evu\.pages\.dev\/logo\.png"[\s\S]*name="twitter:card" content="summary"[\s\S]*name="twitter:image" content="https:\/\/tk-evu\.pages\.dev\/logo\.png"[\s\S]*name="theme-color" content="#ffffff"/,
  '主站需要提供 canonical、Open Graph、Twitter 和 theme-color 基础元信息'
);

assert.match(
  htmlSource,
  /<link rel="manifest" href="\/manifest\.webmanifest" \/>/,
  '主站需要链接 Web App manifest'
);

assert.match(
  htmlSource,
  /<script type="module" src="\/src\/react\/main\.tsx"><\/script>/,
  '现代 React SPA 阶段主站壳层入口需要由 React 入口加载'
);

assert.match(
  htmlSource,
  /<div id="root"><\/div>[\s\S]*<script type="module" src="\/src\/react\/main\.tsx"><\/script>/,
  'React SPA 入口只应暴露单一 root 挂载点'
);

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/firestore-connection\.ts"><\/script>|<script type="module" src="\/src\/orders\/firestore-rules\.ts"><\/script>/,
  '完整 React SPA 重建后 Firestore 连接和规则模块应由 React 入口依赖图加载'
);

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/main\.mjs"><\/script>/,
  '现代 React SPA 阶段不应再加载旧主站壳层入口'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/app-config\.js" defer><\/script>|<script src="js\/app\.js" defer><\/script>/,
  '主站不应再加载旧 app-config.js 或 app.js 普通脚本'
);

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/analytics\/index\.mjs"><\/script>/,
  '现代 React SPA 阶段数据分析页不应再加载旧 DOM 入口'
);

assert.match(
  reactAppSource,
  /id="view-calc"[\s\S]*<CalculatorApp \/>/,
  '现代 React SPA 阶段利润计算器需要由 React App 直接渲染'
);

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/products\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后商品管理页面不应再加载旧 DOM 入口'
);

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/orders\/index\.mjs"><\/script>/,
  '完整 React SPA 重建后订单管理页面不应再加载旧 DOM 入口'
);

assert.match(
  fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8'),
  /OrderTrackerProviderFirestore[\s\S]*ProductLibraryProviderFirestore[\s\S]*id="ot-modal"[\s\S]*id="ot-export-modal"/,
  '完整 React SPA 重建后订单管理页面需要由 React 直接接管 Firestore、弹窗和导出'
);

assert.match(
  privacySource,
  /<link rel="canonical" href="https:\/\/tk-evu\.pages\.dev\/privacy\.html" \/>[\s\S]*property="og:title" content="隐私与数据边界 · TK 电商工具箱"[\s\S]*property="og:url" content="https:\/\/tk-evu\.pages\.dev\/privacy\.html"[\s\S]*name="twitter:image" content="https:\/\/tk-evu\.pages\.dev\/logo\.png"[\s\S]*name="theme-color" content="#ffffff"[\s\S]*<link rel="stylesheet" href="\/site-page\.css" \/>[\s\S]*商品、SKU、账号[\s\S]*你自己的 Firebase Firestore[\s\S]*商品流量 Excel 原始文件[\s\S]*当前浏览器内存[\s\S]*数据分析快照和商品明细[\s\S]*你自己的 Firebase Firestore[\s\S]*href="\/terms\.html"[\s\S]*查看使用条款/,
  '隐私页需要提供 canonical、社交分享元信息、使用条款入口，并说明商品订单和 Excel 的数据保存位置'
);

assert.doesNotMatch(
  privacySource,
  /<style>/,
  '隐私页不应内联整段静态页样式，避免正规页面样式重复'
);

assert.match(
  privacySource,
  /Cloudflare 只托管静态资源|Cloudflare 只发布静态文件/,
  '隐私页需要说明 Cloudflare 只托管静态资源'
);

assert.match(
  termsSource,
  /<link rel="canonical" href="https:\/\/tk-evu\.pages\.dev\/terms\.html" \/>[\s\S]*property="og:title" content="使用条款与免责声明 · TK 电商工具箱"[\s\S]*property="og:url" content="https:\/\/tk-evu\.pages\.dev\/terms\.html"[\s\S]*name="twitter:image" content="https:\/\/tk-evu\.pages\.dev\/logo\.png"[\s\S]*name="theme-color" content="#ffffff"[\s\S]*<link rel="stylesheet" href="\/site-page\.css" \/>[\s\S]*使用条款与免责声明[\s\S]*工具结果仅供参考[\s\S]*Firebase Firestore[\s\S]*不提供法律、税务、财务/,
  '使用条款页需要提供 canonical、社交分享元信息，并说明工具结果边界、Firebase 用户责任和专业意见边界'
);

assert.doesNotMatch(
  termsSource,
  /<style>/,
  '使用条款页不应内联整段静态页样式，避免正规页面样式重复'
);

assert.match(
  notFoundSource,
  /<meta name="description" content="TK 电商工具箱页面不存在[\s\S]*<meta name="robots" content="noindex" \/>[\s\S]*<meta name="theme-color" content="#ffffff" \/>[\s\S]*<link rel="manifest" href="\/manifest\.webmanifest" \/>[\s\S]*<link rel="stylesheet" href="\/site-page\.css" \/>[\s\S]*<body class="site-page-error">[\s\S]*页面不存在[\s\S]*返回工具首页/,
  '主站需要提供 noindex、description、manifest 和公共样式的 404 页面'
);

assert.match(
  sitePageCss,
  /\.panel[\s\S]*box-shadow:[\s\S]*\.notice[\s\S]*\.site-page-error/,
  '隐私页、使用条款页和 404 需要复用公共静态页样式'
);

assert.match(
  robotsSource,
  /Sitemap:\s*https:\/\/tk-evu\.pages\.dev\/sitemap\.xml/,
  '主站需要提供 robots.txt 并声明 sitemap'
);

assert.strictEqual(manifest.name, 'TK 电商工具箱', 'manifest 需要提供完整站点名');
assert.strictEqual(manifest.start_url, '/', 'manifest 入口需要指向主站首页');
assert.strictEqual(manifest.display, 'standalone', 'manifest 需要声明 standalone 显示模式');
assert.strictEqual(manifest.icons[0].src, '/logo.png', 'manifest 需要复用现有 logo');

assert.match(
  headersSource,
  /X-Content-Type-Options:\s*nosniff[\s\S]*Referrer-Policy:\s*strict-origin-when-cross-origin[\s\S]*Permissions-Policy:\s*camera=\(\), microphone=\(\), geolocation=\(\)/,
  'Cloudflare Pages 需要声明基础安全响应头'
);

assert.match(
  headersSource,
  /\/\s*Cache-Control:\s*public, max-age=300, must-revalidate[\s\S]*\/index\.html[\s\S]*Cache-Control:\s*public, max-age=300, must-revalidate[\s\S]*\/assets\/\*[\s\S]*Cache-Control:\s*public, max-age=31536000, immutable[\s\S]*\/logo\.png[\s\S]*Cache-Control:\s*public, max-age=86400, must-revalidate[\s\S]*\/site-page\.css[\s\S]*Content-Type:\s*text\/css; charset=utf-8[\s\S]*\/robots\.txt[\s\S]*Content-Type:\s*text\/plain; charset=utf-8[\s\S]*\/sitemap\.xml[\s\S]*Content-Type:\s*application\/xml; charset=utf-8/,
  'Cloudflare Pages 需要区分带 hash 的 assets、稳定 logo 和搜索引擎文件的缓存/类型策略'
);

assert.doesNotMatch(
  headersSource,
  /\/js\/\*/,
  '标准模块化后 Cloudflare headers 不应再保留旧 js 目录规则'
);

assert.match(
  sitemapSource,
  /<loc>https:\/\/tk-evu\.pages\.dev\/<\/loc>\s*<lastmod>2026-05-05<\/lastmod>[\s\S]*<loc>https:\/\/tk-evu\.pages\.dev\/privacy\.html<\/loc>\s*<lastmod>2026-05-05<\/lastmod>[\s\S]*<loc>https:\/\/tk-evu\.pages\.dev\/terms\.html<\/loc>\s*<lastmod>2026-05-05<\/lastmod>/,
  '主站 sitemap 需要包含首页、隐私页、使用条款页和 lastmod'
);

console.log('main build contract ok');
