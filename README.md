# TK 电商工具箱

给 TikTok Shop 日本跨境店使用的静态工具站。项目定位是“工具网站 + 用户自有数据源”：本站提供页面、计算、管理和分析能力，不托管用户的商品、订单、Excel 流量文件等业务数据。

## 功能模块

- 利润计算器：按采购价、平台费、达人佣金、汇率、海外运费测算定价和利润。
- 商品管理：连接用户自己的 Firebase Firestore，管理商品和 SKU。
- 订单管理：连接用户自己的 Firebase Firestore，管理订单、利润、物流单号和同步状态。
- 数据采集：通过 Codex skill 和当前授权采集窗口按账号筛选商品，并把采集表、店小秘状态和拒绝品去重记录同步到用户自己的 Firebase Firestore。
- 数据分析：本地导入 TikTok Shop 商品流量 Excel，生成渠道表现、Top 商品排行、流量漏斗和商品诊断。
- 文档站：使用 VitePress 单独维护使用说明和运营文档。

## 当前架构

主站是完整 Vite React SPA：

- `index.html` 只保留单根 `#root`、`/src/react/main.tsx`、Firebase compat SDK 和 SheetJS。
- `src/react/app/App.tsx` 接管 App Shell、hash 路由、页脚和五个主视图。
- `src/react/features/` 放业务页面：`calculator`、`products`、`orders`、`collection`、`analytics`。
- `src/react/components/ui/` 放本地 shadcn 风格 primitives 和共享 UI 控件。
- `src/react/styles.css` 是样式入口，导入 Tailwind utilities 和 `src/react/styles/base.css`。
- `src/` 下业务纯函数、Firestore provider、解析器和导出逻辑使用 TypeScript 维护。
- `skills/tk-product-selection/` 是 Codex 选品采集 skill 母本；对外采集流程使用 skill 自带脚本保存本地配置、检查账号权限并同步 Firestore，不要求用户安装项目 CLI 或 npm 包。
- `packages/cli/` 是内部 TK CLI，保留给项目开发和排查使用；用户采集路径不依赖它。
- 领域类型入口集中在 `src/products/types.ts`、`src/orders/types.ts`、`src/analytics/types.ts` 和 `src/types/firestore.ts`；当前 `src/` 没有显式 `any`。
- `tsconfig.json` 暂保留 `strict: false`，并开启 `noImplicitReturns`、`noFallthroughCasesInSwitch`、`useUnknownInCatchVariables` 等低风险检查。
- `package.json` 使用 `"type": "module"`，Node 测试也统一为 ESM `.mjs`。
- 数据分析图表使用 ECharts，Excel 原始文件只在浏览器本地解析，分析快照写入用户自己的 Firestore。

旧 `js/` 源目录、旧 `css/style.css`、旧 DOM runtime、旧 React island 二次挂载入口已经清理；构建产物不发布旧 `dist/js/`。

## 数据边界

这是当前项目最重要的原则：

- 本站不保存用户业务数据。
- 用户的商品、订单和采集记录写入用户自己配置的 Firebase Firestore。
- 商品管理、订单管理和数据采集共用同一个 Firestore 连接；页面会检查规则是否支持当前模块，并用用户能理解的文案提示更新规则。
- 数据分析模块只在浏览器内读取 Excel 原始文件，不上传到 Cloudflare；解析后的分析快照会写入用户自己的 Firebase Firestore，刷新后可以恢复最近一次分析。
- 数据采集原始输出保存在本机 `data/collection/fastmoss/`，不会提交到仓库；同步到 Firestore 的只是一张带账号的采集表和拒绝品去重记录。
- 本地参数只保存在用户浏览器 `localStorage`，例如汇率、运费、默认配置等工具参数。

Cloudflare 只负责托管静态网站和文档站，不持有用户的商品、订单、流量文件。

## 目录结构

```text
.
├── index.html
├── src/
│   ├── analytics/
│   ├── calc/
│   ├── orders/
│   ├── products/
│   ├── react/
│   ├── app-config.ts
│   ├── firestore-connection.ts
│   ├── global-settings.ts
│   └── shipping-core.ts
├── public/
├── docs/
├── packages/
│   └── cli/
├── scripts/
├── tests/
├── vite.config.mjs
├── playwright.config.mjs
├── wrangler.toml
└── package.json
```

正式站点基础文件在 `public/`：

- `public/privacy.html`
- `public/terms.html`
- `public/404.html`
- `public/robots.txt`
- `public/sitemap.xml`
- `public/manifest.webmanifest`
- `public/site-page.css`
- `public/_headers`

首页、隐私页和使用条款页包含 canonical、Open Graph、Twitter Card 和 `theme-color`；404 页面为 `noindex`；`sitemap.xml` 包含首页、隐私页、使用条款页和 `lastmod`；`_headers` 配置基础安全头、缓存和内容类型。

## 本地使用

安装依赖：

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

构建产物生成在：

```text
dist/
```

本地预览构建产物：

```bash
npm run preview
```

TK Product Selection skill：

```bash
node skills/tk-product-selection/scripts/local-credentials.mjs status
node skills/tk-product-selection/scripts/firestore-sync.mjs preflight --account NOMA
node skills/tk-product-selection/scripts/firestore-sync.mjs dedupe data/collection/fastmoss/runs/<run-id> --account NOMA
node skills/tk-product-selection/scripts/firestore-sync.mjs sync data/collection/fastmoss/runs/<run-id> --account NOMA
node skills/tk-product-selection/scripts/firestore-sync.mjs mark-dxm-edited --account NOMA --product-url <商品链接> --product-name <商品名称> --edited-title <编辑标题>
```

Codex 会先检查本机配置状态，缺什么才让用户提供什么：缺数据库配置就提供数据库配置，缺 FastMoss 就提供 FastMoss 配置，缺某个 TK 账号的店小秘绑定就提供该账号店小秘信息；已有配置直接复用。平台人工确认只临时处理，不保存。

FastMoss 采集流程：

```bash
# 采集前先确认目标账号存在，且数据采集集合可读写
node skills/tk-product-selection/scripts/firestore-sync.mjs preflight --account NOMA

# 生成本批次数据库去重清单
node skills/tk-product-selection/scripts/firestore-sync.mjs dedupe data/collection/fastmoss/runs/<run-id> --account NOMA

# 使用当前授权采集窗口完成 FastMoss 页面采集，
# 并把页面结果保存到 data/collection/fastmoss/runs/<run-id>/products.json

# 目标账号筛选和店小秘状态
node skills/tk-product-selection/scripts/select-fastmoss-products.mjs data/collection/fastmoss/runs/<run-id>/products.json --account NOMA
node skills/tk-product-selection/scripts/init-dianxiaomi-status.mjs data/collection/fastmoss/runs/<run-id>/selection_candidates.json --account NOMA

# 在同一授权采集窗口里切到目标店小秘账号并采集到店小秘

# 店小秘状态记录完成后，把运行目录同步到 Firestore
node skills/tk-product-selection/scripts/firestore-sync.mjs sync data/collection/fastmoss/runs/<run-id> --account NOMA

# 店小秘商品详情页编辑完成后，回写同一条采集表商品
node skills/tk-product-selection/scripts/firestore-sync.mjs mark-dxm-edited --account NOMA --product-url <商品链接> --product-name <商品名称> --edited-title <编辑标题>
```

默认约定是使用当前授权采集窗口。FastMoss 本机配置全局复用；店小秘按 TK 账号绑定复用。多个账号顺序切换，不并行处理多个采集窗口。

## 检查命令

单元/契约测试：

```bash
npm test
```

TypeScript 类型检查：

```bash
npm run typecheck
```

构建后 HTTP smoke：

```bash
npm run build
npm run smoke
```

浏览器级发布 smoke：

```bash
npm run e2e
```

完整发布检查：

```bash
npm run release:check
```

`release:check` 会依次运行单元/契约测试、TypeScript 类型检查、文档构建、主站构建、HTTP smoke、Playwright e2e 和 `git diff --check`。

## 文档站

文档源码在 `docs/`，使用 VitePress。

工具使用文档包含：

- `docs/guide/database.md`
- `docs/guide/calculator.md`
- `docs/guide/products.md`
- `docs/guide/orders.md`
- `docs/guide/collection.md`
- `docs/guide/analytics.md`

启动文档开发预览：

```bash
./scripts/docs-dev.sh
```

构建文档站：

```bash
./scripts/docs-build.sh
```

文档构建产物生成在：

```text
docs/.vitepress/dist/
```

## 部署

主站建议使用 Cloudflare Pages：

- Framework preset：`Vite`
- Root directory：留空
- Build command：`npm run build`
- Build output directory：`dist`

文档站建议作为单独 Cloudflare Pages 项目：

- Framework preset：`None`
- Root directory：`docs`
- Build command：`npm run build`
- Build output directory：`.vitepress/dist`

仓库里已有 `wrangler.toml`，其中 `pages_build_output_dir = "./dist"`，用于明确主站发布目录。

## Git 注意事项

只提交源码、配置、测试和文档。不要提交：

- `dist/`
- `node_modules/`
- `docs/.vitepress/cache/`
- `docs/.vitepress/dist/`
- `docs/node_modules/`
- `*.xlsx`
- `*.xls`
- `*.csv`

项目里如出现 TikTok Shop 商品流量 Excel，只能用于本地测试分析，不能提交。
