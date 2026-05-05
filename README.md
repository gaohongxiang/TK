# TK 电商工具箱

给 TikTok Shop 日本跨境店使用的运营工具站。项目定位是“工具网站 + 用户自有数据源”：本站提供页面和计算/分析能力，不托管用户的商品、订单、Excel 流量文件等业务数据。

## 功能模块

- 利润计算器：按采购价、平台费、达人佣金、汇率、海外运费测算定价和利润。
- 商品管理：连接用户自己的 Firebase Firestore，管理商品和 SKU。
- 订单管理：连接用户自己的 Firebase Firestore，管理订单、利润、物流单号和同步状态。
- 数据分析：本地导入 TikTok Shop 商品流量 Excel，生成渠道表现、Top 商品排行、流量漏斗和商品诊断。
- 使用文档 / TK 运营文档：使用 VitePress 单独维护。

## 数据边界

这是当前项目最重要的原则：

- 本站不保存用户业务数据。
- 用户的商品和订单数据写入用户自己配置的 Firebase Firestore。
- 商品管理、订单管理使用 Firestore 的离线缓存能力，先保证本地交互速度，再由 Firebase SDK 同步到云端。
- 数据分析模块只在浏览器内读取 Excel 文件，解析结果只存在当前页面内存里，不上传到 Cloudflare，也不会写入本站数据库。
- 本地参数只保存在用户浏览器 `localStorage`，例如汇率、运费、默认配置等工具参数。

因此，Cloudflare 只负责托管静态网站和文档站，不持有用户的商品、订单、流量文件。

## 当前技术结构

仓库现在分成两部分。

### 1. 工具主站

主站源码在仓库根目录：

- `index.html`
- `css/`
- `js/`
- `package.json`
- `vite.config.mjs`
- `wrangler.toml`

当前主站已经接入 Vite 构建，但业务脚本仍保持原来的普通 `<script defer>` 加载方式。这样可以先获得标准构建、预览和 Cloudflare Pages 输出目录，同时不打乱现有订单/商品模块的加载顺序。

### 2. 文档站

文档源码在：

- `docs/`

文档使用 VitePress，建议作为独立 Cloudflare Pages 项目部署。部署配置、发布前检查和部署后验收集中记录在 `docs/guide/deploy.md`。

## 项目规划

### 第一阶段：稳定当前静态站

目标是先把核心业务闭环做完整，并保持部署简单。

- 保留现有 `index.html + css + js` 静态结构。
- 继续使用用户自己的 Firebase Firestore 作为商品/订单数据源。
- 新增数据分析模块，用浏览器本地解析 Excel，不上传用户文件。
- 用测试约束关键模块入口、脚本加载顺序、数据解析逻辑和隐私边界。

### 第二阶段：工程化改造

当前已完成主站构建入口，后续再逐步迁移到 TypeScript。

- 使用 Vite 统一构建工具主站。已完成。
- Cloudflare Pages 主站构建输出改为 `dist/`。已完成。
- 保留现有普通 JS 模块加载顺序，构建后复制 `js/` 到 `dist/js/`。已完成。
- 将利润计算、商品、订单、数据分析拆成独立模块目录。已基本完成。
- 商品管理已拆出 `accounts` 和 `export` 子模块，入口文件只保留连接、加载、渲染编排。已完成。
- 数据分析已拆成 `parser`、`analyzer`、`index` 三层，Excel 解析和汇总诊断不依赖 DOM。已完成。
- 已新增 `js/shared/html.js` 和 `js/shared/format.js`，先服务数据分析和商品管理渲染层。已完成。
- 引入类型定义，约束订单、商品、SKU、分析行数据结构。
- 将通用表格、弹窗、Toast、连接状态抽成共享组件。
- 保留 Cloudflare 部署，构建产物仍然是静态文件。

### 第三阶段：用户自有数据源抽象

当前正式数据源策略是 Firebase-only。注册表只用于明确当前数据边界和后续扩展位置，不把 Supabase 作为正式功能暴露给用户。

- `js/data-sources/registry.js`：全局数据源注册表。已完成。
- `FirebaseProvider`：当前商品和订单默认实现。已注册。
- `BrowserExcelProvider`：数据分析 Excel 只在浏览器内存解析。已注册。
- `js/app-config.js`：项目级配置，明确正式数据源为 Firestore、本站不保存用户业务数据。已完成。
- `LocalFileProvider`：未来可选，适合只用本地导入/导出的轻量用户。暂不实现。

当前注册表只描述和发现数据源，不改变现有 Firebase 离线缓存流程，也不保存用户数据。

## 主站本地开发

第一次使用，先安装主站依赖：

```bash
npm install
```

启动主站开发预览：

```bash
npm run dev
```

构建主站：

```bash
npm run build
```

构建产物会生成在：

```bash
dist/
```

本地预览构建产物：

```bash
npm run preview
```

运行测试：

```bash
npm test
```

构建后跑发布 smoke：

```bash
npm run build
npm run smoke
```

`npm run smoke` 会启动本地 `vite preview`，实际请求首页、隐私页、使用条款页、404、robots、sitemap、manifest、Cloudflare headers 文件、主站脚本，并确认未启用的 Supabase provider 没进入构建产物。

浏览器级发布 smoke：

```bash
npm run e2e
```

`npm run e2e` 会基于构建产物启动 production preview，用离线 Firebase / Excel fixtures 在桌面和移动 Chromium 上覆盖利润计算器、商品新增/编辑、订单新增/编辑、数据分析导入、隐私页、使用条款页和 404。

完整发布检查：

```bash
npm run release:check
```

这个命令会依次运行单元/契约测试、文档构建、主站构建、HTTP smoke、浏览器级 e2e 和 `git diff --check`。
同一套检查也配置在 `.github/workflows/release-check.yml`，push 到 `main` 或提交 PR 时会自动运行。

### 第四阶段：Cloudflare 增强

只有在确实需要服务端能力时再增加 Cloudflare Workers。

- 用户自有数据库连接配置仍保存在用户浏览器，或由用户自己的后端管理。
- Workers 只适合做公共配置、静态接口、代理公开资源、版本检查等非用户业务数据能力。
- 不把订单、商品、Excel 原始数据写入平台方数据库。

## 平时怎么改文档

第一次使用，先装文档依赖：

```bash
cd docs
npm install
```

之后在仓库根目录直接跑：

```bash
./scripts/docs-dev.sh
```

这会启动文档的热更新预览。你改完文档，页面会自动刷新。

如果你想先确认文档能不能正常构建，可以跑：

```bash
./scripts/docs-build.sh
```

这会在 `docs/.vitepress/dist/` 里生成文档站静态文件。

## 怎么部署

现在推荐把主站和文档站拆成两个 Cloudflare Pages 项目，都导入同一个 GitHub 仓库。

### Pages 项目 1：工具主站

当前主站域名：

- `https://tk-evu.pages.dev/`

如果这个项目已经在线并且能正常访问，继续用现在的配置即可。

如果以后要重新创建主站项目，可以按下面配置：

- 项目类型：`导入现有 Git 存储库`
- Framework preset：`Vite`
- Root directory：留空
- Build command：`npm run build`
- Build output directory：`dist`

仓库里已经有 `wrangler.toml`，其中 `pages_build_output_dir = "./dist"`，用于明确 Cloudflare Pages 的发布目录。

### Pages 项目 2：文档站

文档建议单独建一个 Pages 项目，比如：

- `https://tk-evu-docs.pages.dev/`

这个项目还是导入同一个 GitHub 仓库，但只构建 `docs/`。

创建文档站时，Cloudflare Pages 建议这样填：

- 项目类型：`导入现有 Git 存储库`
- Framework preset：`None`
- Root directory：`docs`
- Build command：`npm run build`
- Build output directory：`.vitepress/dist`

文档站源码本身就在 `docs/` 里，Cloudflare 进入这个目录后会：

1. 自动安装 `docs/package.json` 里的依赖
2. 执行 `npm run build`
3. 发布 `.vitepress/dist`

## 同一个仓库接两个 Pages 项目，要注意什么

这是正常用法，不冲突。

只是要注意：

- 主站项目和文档项目都会监听同一个 GitHub 仓库。
- 每次 push 后，两个项目都有可能一起触发构建。
- 如果后面想再精细一点，可以去 Cloudflare Pages 里给两个项目分别设置 `Build watch paths`，减少不必要的重复构建。

## Git 注意事项

只需要推源码：

- 主站源码：根目录的 `index.html`、`css/`、`js/`
- 主站静态发布文件：`public/`
- 主站构建配置：`package.json`、`package-lock.json`、`vite.config.mjs`、`wrangler.toml`
- 构建辅助脚本：`scripts/`
- 文档源码：`docs/`
- 测试文件：`tests/`
- 项目说明：`README.md`

不需要推这些：

- `dist/`
- `docs/.vitepress/dist/`
- `docs/.vitepress/cache/`
- `node_modules/`
- `docs/node_modules/`
- 用户导出的 Excel / CSV 数据文件，例如 `商品流量详情4.27-5.3.xlsx`

主站顶部的 `文档` 链接现在默认写的是：

- `https://tk-evu-docs.pages.dev/`

如果最后创建文档站时用的不是这个地址，需要同步修改主站里的文档链接。

## 正式站点基础文件

主站已经补了基础发布文件：

- `public/privacy.html`：隐私与数据边界说明。
- `public/terms.html`：使用条款与免责声明。
- `public/404.html`：Cloudflare Pages 404 页面。
- `public/robots.txt`：搜索引擎抓取配置。
- `public/sitemap.xml`：主站 sitemap。
- `public/manifest.webmanifest`：基础 Web App manifest。
- `public/site-page.css`：隐私页、使用条款页和 404 共用样式。
- `public/_headers`：Cloudflare Pages 安全响应头和缓存策略。

这些文件会由 Vite 自动复制到 `dist/`。首页、隐私页和使用条款页都声明了 canonical、Open Graph、Twitter Card 和 `theme-color`；404 页面声明 noindex、description、manifest 和公共样式；`robots.txt` 指向主站 sitemap；`sitemap.xml` 包含首页、隐私页、使用条款页和 `lastmod`；`_headers` 里配置了基础安全头、静态资源缓存、搜索引擎文件类型、公共页面样式类型和 manifest 类型。主站页脚也提供了 `隐私与数据边界`、`使用条款` 和 `数据库说明` 入口。
