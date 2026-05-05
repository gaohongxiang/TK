const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const viteConfig = fs.readFileSync(path.join(root, 'vite.config.mjs'), 'utf8');
const copyScript = fs.readFileSync(path.join(root, 'scripts', 'copy-main-assets.mjs'), 'utf8');
const smokeScript = fs.readFileSync(path.join(root, 'scripts', 'preview-smoke.mjs'), 'utf8');
const releaseCheckScript = fs.readFileSync(path.join(root, 'scripts', 'release-check.sh'), 'utf8');
const playwrightConfig = fs.readFileSync(path.join(root, 'playwright.config.mjs'), 'utf8');
const releaseE2e = fs.readFileSync(path.join(root, 'tests', 'e2e', 'release.spec.js'), 'utf8');
const releaseWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'release-check.yml'), 'utf8');
const wrangler = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const privacySource = fs.readFileSync(path.join(root, 'public', 'privacy.html'), 'utf8');
const termsSource = fs.readFileSync(path.join(root, 'public', 'terms.html'), 'utf8');
const notFoundSource = fs.readFileSync(path.join(root, 'public', '404.html'), 'utf8');
const sitePageCss = fs.readFileSync(path.join(root, 'public', 'site-page.css'), 'utf8');
const robotsSource = fs.readFileSync(path.join(root, 'public', 'robots.txt'), 'utf8');
const sitemapSource = fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8');
const headersSource = fs.readFileSync(path.join(root, 'public', '_headers'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.webmanifest'), 'utf8'));

assert.notStrictEqual(
  packageJson.type,
  'module',
  '根目录不能设置 type=module，否则现有 CommonJS 测试会被 Node 当作 ESM'
);

assert.strictEqual(
  packageJson.scripts.build,
  'vite build && node scripts/copy-main-assets.mjs',
  '主站 build 需要先跑 Vite，再复制当前传统 JS 模块'
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
  packageJson.scripts['release:check'],
  'sh scripts/release-check.sh',
  '主站需要提供完整发布检查命令'
);

assert.strictEqual(
  packageJson.scripts.test,
  'sh -c \'for f in tests/*.test.js; do node "$f" || exit 1; done\'',
  '根目录需要提供完整测试命令'
);

assert.match(
  viteConfig,
  /outDir:\s*'dist'/,
  'Vite 构建产物需要输出到 dist'
);

assert.match(
  copyScript,
  /cp\(path\.join\(root, 'js'\), path\.join\(distDir, 'js'\)[\s\S]*recursive:\s*true/,
  '构建后需要把现有非 module JS 目录复制到 dist/js'
);

assert.match(
  copyScript,
  /rm\(path\.join\(distDir, 'js', 'orders', 'provider-supabase\.js'\)[\s\S]*force:\s*true/,
  '构建产物不应包含未启用的 Supabase provider'
);

assert.match(
  smokeScript,
  /vite\.js'[\s\S]*'preview'[\s\S]*\/privacy\.html[\s\S]*\/terms\.html[\s\S]*\/manifest\.webmanifest[\s\S]*\/_headers[\s\S]*\/js\/orders\/provider-supabase\.js/,
  'smoke 脚本需要启动 Vite preview 并检查核心静态路径、条款页、Cloudflare headers 文件和 Supabase provider 不在产物中'
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
  /npm test[\s\S]*\.\/scripts\/docs-build\.sh[\s\S]*npm run build[\s\S]*npm run smoke[\s\S]*npm run e2e[\s\S]*git diff --check/,
  '完整发布检查需要覆盖单测、文档、构建、HTTP smoke、浏览器 e2e 和 diff 检查'
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
  htmlSource,
  /href="\/privacy\.html"[\s\S]*隐私与数据边界[\s\S]*href="\/terms\.html"[\s\S]*使用条款/,
  '主站页脚需要提供隐私与数据边界和使用条款入口'
);

assert.match(
  htmlSource,
  /<a class="skip-link" href="#main-content">跳到主要内容<\/a>[\s\S]*<nav class="modules" aria-label="模块导航">[\s\S]*aria-current="page"[\s\S]*<main id="main-content" class="app-main" tabindex="-1">/,
  '主站需要提供跳转主内容链接、main landmark 和当前导航语义'
);

assert.match(
  htmlSource,
  /<main id="main-content" class="app-main" tabindex="-1">[\s\S]*id="view-calc"[\s\S]*id="view-orders"[\s\S]*id="view-products"[\s\S]*id="view-analytics"[\s\S]*<\/main>[\s\S]*<footer>/,
  '主站核心工具视图需要放在 main landmark 内，footer 需要留在 main 之后'
);

assert.match(
  fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8'),
  /a\.setAttribute\('aria-current', 'page'\)[\s\S]*a\.removeAttribute\('aria-current'\)/,
  'hash 路由切换时需要同步导航 aria-current'
);

assert.match(
  fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8'),
  /\.skip-link\s*\{[\s\S]*transform:\s*translateY\(-140%\)[\s\S]*\.skip-link:focus\s*\{[\s\S]*transform:\s*translateY\(0\)/,
  '跳转主内容链接默认隐藏，键盘聚焦时需要可见'
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
  privacySource,
  /<link rel="canonical" href="https:\/\/tk-evu\.pages\.dev\/privacy\.html" \/>[\s\S]*property="og:title" content="隐私与数据边界 · TK 电商工具箱"[\s\S]*property="og:url" content="https:\/\/tk-evu\.pages\.dev\/privacy\.html"[\s\S]*name="twitter:image" content="https:\/\/tk-evu\.pages\.dev\/logo\.png"[\s\S]*name="theme-color" content="#ffffff"[\s\S]*<link rel="stylesheet" href="\/site-page\.css" \/>[\s\S]*商品、SKU、账号[\s\S]*你自己的 Firebase Firestore[\s\S]*商品流量 Excel[\s\S]*当前浏览器内存[\s\S]*href="\/terms\.html"[\s\S]*查看使用条款/,
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
  /\/\s*Cache-Control:\s*public, max-age=300, must-revalidate[\s\S]*\/index\.html[\s\S]*Cache-Control:\s*public, max-age=300, must-revalidate[\s\S]*\/assets\/\*[\s\S]*Cache-Control:\s*public, max-age=31536000, immutable[\s\S]*\/logo\.png[\s\S]*Cache-Control:\s*public, max-age=86400, must-revalidate[\s\S]*\/js\/\*[\s\S]*Cache-Control:\s*public, max-age=300, must-revalidate[\s\S]*\/site-page\.css[\s\S]*Content-Type:\s*text\/css; charset=utf-8[\s\S]*\/robots\.txt[\s\S]*Content-Type:\s*text\/plain; charset=utf-8[\s\S]*\/sitemap\.xml[\s\S]*Content-Type:\s*application\/xml; charset=utf-8/,
  'Cloudflare Pages 需要区分带 hash 的 assets、传统 js 目录和搜索引擎文件的缓存/类型策略'
);

assert.match(
  sitemapSource,
  /<loc>https:\/\/tk-evu\.pages\.dev\/<\/loc>\s*<lastmod>2026-05-05<\/lastmod>[\s\S]*<loc>https:\/\/tk-evu\.pages\.dev\/privacy\.html<\/loc>\s*<lastmod>2026-05-05<\/lastmod>[\s\S]*<loc>https:\/\/tk-evu\.pages\.dev\/terms\.html<\/loc>\s*<lastmod>2026-05-05<\/lastmod>/,
  '主站 sitemap 需要包含首页、隐私页、使用条款页和 lastmod'
);

console.log('main build contract ok');
