const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const docsConfig = fs.readFileSync(path.join(root, 'docs', '.vitepress', 'config.mjs'), 'utf8');
const docsIndex = fs.readFileSync(path.join(root, 'docs', 'index.md'), 'utf8');
const overview = fs.readFileSync(path.join(root, 'docs', 'guide', 'overview.md'), 'utf8');
const database = fs.readFileSync(path.join(root, 'docs', 'guide', 'database.md'), 'utf8');
const products = fs.readFileSync(path.join(root, 'docs', 'guide', 'products.md'), 'utf8');
const orders = fs.readFileSync(path.join(root, 'docs', 'guide', 'orders.md'), 'utf8');
const analytics = fs.readFileSync(path.join(root, 'docs', 'guide', 'analytics.md'), 'utf8');
const deploy = fs.readFileSync(path.join(root, 'docs', 'guide', 'deploy.md'), 'utf8');
const faq = fs.readFileSync(path.join(root, 'docs', 'guide', 'faq.md'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const handoff = fs.readFileSync(path.join(root, 'PROJECT_HANDOFF.md'), 'utf8');
const privacy = fs.readFileSync(path.join(root, 'public', 'privacy.html'), 'utf8');
const terms = fs.readFileSync(path.join(root, 'public', 'terms.html'), 'utf8');
const headers = fs.readFileSync(path.join(root, 'public', '_headers'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.webmanifest'), 'utf8'));

assert.match(
  docsConfig,
  /text:\s*'数据分析',\s*link:\s*'\/guide\/analytics'/,
  '文档站侧边栏需要包含数据分析说明页'
);

assert.match(
  docsConfig,
  /text:\s*'部署发布',\s*link:\s*'\/guide\/deploy'/,
  '文档站侧边栏需要包含部署发布说明页'
);

assert.match(
  docsConfig,
  /provider:\s*'local'/,
  '文档站需要保留本地搜索'
);

assert.match(
  docsIndex,
  /商品、订单在你的 Firebase，Excel 只在浏览器本地解析/,
  '文档首页需要直接说明数据边界'
);

assert.match(
  overview,
  /静态工具站 \+ 用户自有数据源[\s\S]*数据分析.*\/guide\/analytics/,
  '概览需要说明项目定位并链接数据分析页'
);

assert.match(
  database,
  /当前正式数据源是 Firebase-only[\s\S]*部署与发布检查.*\/guide\/deploy/,
  '数据库文档需要说明 Firebase-only 并链接部署发布页'
);

assert.match(
  products,
  /商品数据保存到你自己的 Firebase Firestore[\s\S]*导入数据分析和商品管理的关系/,
  '商品文档需要说明数据保存位置和数据分析关系'
);

assert.match(
  orders,
  /订单数据保存到你自己的 Firebase Firestore[\s\S]*保存和同步[\s\S]*Firestore SDK 的本地队列/,
  '订单文档需要说明数据保存位置和本地优先保存'
);

assert.match(
  analytics,
  /不上传到 Cloudflare[\s\S]*不写入 Firestore[\s\S]*商品诊断标签[\s\S]*不把分析结果发送到第三方接口/,
  '数据分析文档需要说明本地解析、诊断标签和不上传边界'
);

assert.match(
  deploy,
  /npm run release:check[\s\S]*隐私页、使用条款页和 404[\s\S]*\.github\/workflows\/release-check\.yml[\s\S]*Framework preset \| `Vite`[\s\S]*Root directory \| `docs`[\s\S]*商品流量 Excel 只在浏览器本地解析/,
  '部署发布页需要覆盖发布检查、CI、主站/文档站 Cloudflare 配置和数据边界'
);

assert.match(
  faq,
  /数据分析会上传我的 Excel 吗[\s\S]*不会[\s\S]*为什么不继续推荐 Supabase[\s\S]*Firebase-only/,
  'FAQ 需要覆盖 Excel 隐私和 Firebase-only 取舍'
);

assert.match(
  readme,
  /正式站点基础文件[\s\S]*public\/privacy\.html[\s\S]*public\/terms\.html[\s\S]*public\/site-page\.css[\s\S]*public\/_headers[\s\S]*Open Graph[\s\S]*sitemap\.xml.*lastmod/s,
  'README 需要列出正式站点基础文件和当前 SEO 元信息覆盖'
);

assert.match(
  handoff,
  /Phase 7：文档补齐[\s\S]*当前状态：已完成[\s\S]*正规网站基础项[\s\S]*Open Graph[\s\S]*404 页面新增 description[\s\S]*sitemap\.xml.*lastmod/s,
  '交接文件需要记录 Phase 7、正规网站基础项和 SEO 元信息已完成'
);

assert.match(
  privacy,
  /property="og:title" content="隐私与数据边界 · TK 电商工具箱"[\s\S]*name="twitter:image" content="https:\/\/tk-evu\.pages\.dev\/logo\.png"[\s\S]*不会把你的订单或商品保存到工具作者的数据库[\s\S]*不会上传或持久化 TikTok Shop 商品流量 Excel[\s\S]*href="\/terms\.html"[\s\S]*查看使用条款/,
  '隐私页需要明确不会保存业务数据或上传 Excel，并提供社交元信息和使用条款入口'
);

assert.match(
  terms,
  /property="og:title" content="使用条款与免责声明 · TK 电商工具箱"[\s\S]*name="twitter:image" content="https:\/\/tk-evu\.pages\.dev\/logo\.png"[\s\S]*使用条款与免责声明[\s\S]*工具结果仅供参考[\s\S]*用户自有数据责任[\s\S]*不保证持续可用/,
  '使用条款页需要说明工具结果边界、用户自有数据责任、社交元信息和可用性免责声明'
);

assert.match(
  headers,
  /X-Frame-Options:\s*DENY[\s\S]*\/index\.html[\s\S]*Cache-Control:\s*public, max-age=300, must-revalidate[\s\S]*\/logo\.png[\s\S]*Cache-Control:\s*public, max-age=86400, must-revalidate[\s\S]*\/site-page\.css[\s\S]*Content-Type:\s*text\/css; charset=utf-8[\s\S]*\/terms\.html[\s\S]*Cache-Control:\s*public, max-age=300, must-revalidate[\s\S]*\/robots\.txt[\s\S]*Content-Type:\s*text\/plain; charset=utf-8[\s\S]*\/sitemap\.xml[\s\S]*Content-Type:\s*application\/xml; charset=utf-8[\s\S]*\/manifest\.webmanifest[\s\S]*Content-Type:\s*application\/manifest\+json/,
  'Cloudflare headers 需要包含基础安全头、首页/logo 缓存、条款页缓存、搜索引擎文件类型和 manifest 类型'
);

assert.match(
  sitemap,
  /https:\/\/tk-evu\.pages\.dev\/privacy\.html[\s\S]*<lastmod>2026-05-05<\/lastmod>[\s\S]*https:\/\/tk-evu\.pages\.dev\/terms\.html[\s\S]*<lastmod>2026-05-05<\/lastmod>/,
  'sitemap 需要包含隐私页、使用条款页和 lastmod'
);

assert.strictEqual(manifest.short_name, 'TK 工具箱', 'manifest 需要保留短名称');
assert.strictEqual(manifest.icons[0].purpose, 'any maskable', 'manifest icon 需要支持 maskable');

console.log('site release contract ok');
