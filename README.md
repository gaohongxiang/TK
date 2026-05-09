# TK 电商工具箱

给 TikTok Shop 日本跨境店使用的静态工具站。项目定位是“工具网站 + 用户自有数据源”：本站提供页面、计算、管理和分析能力，不托管用户的商品、订单、Excel 流量文件等业务数据。

## 功能模块

- 利润计算器：按采购价、平台费、达人佣金、汇率、海外运费测算定价和利润。
- 商品管理：连接用户自己的 Firebase Firestore，管理商品和 SKU。
- 订单管理：连接用户自己的 Firebase Firestore，管理订单、利润、物流单号和同步状态。
- 数据分析：本地导入 TikTok Shop 商品流量 Excel，生成渠道表现、Top 商品排行、流量漏斗和商品诊断。
- 文档站：使用 VitePress 单独维护使用说明和运营文档。

## 当前架构

主站是完整 Vite React SPA：

- `index.html` 只保留单根 `#root`、`/src/react/main.tsx`、Firebase compat SDK 和 SheetJS。
- `src/react/app/App.tsx` 接管 App Shell、hash 路由、页脚和四个主视图。
- `src/react/features/` 放四大业务页面：`calculator`、`products`、`orders`、`analytics`。
- `src/react/components/ui/` 放本地 shadcn 风格 primitives 和共享 UI 控件。
- `src/react/styles.css` 是样式入口，导入 Tailwind utilities 和 `src/react/styles/base.css`。
- `src/` 下业务纯函数、Firestore provider、解析器和导出逻辑使用 TypeScript 维护。
- 领域类型入口集中在 `src/products/types.ts`、`src/orders/types.ts`、`src/analytics/types.ts` 和 `src/types/firestore.ts`；当前 `src/` 没有显式 `any`。
- `tsconfig.json` 暂保留 `strict: false`，并开启 `noImplicitReturns`、`noFallthroughCasesInSwitch`、`useUnknownInCatchVariables` 等低风险检查。
- `package.json` 使用 `"type": "module"`，Node 测试也统一为 ESM `.mjs`。
- 数据分析图表使用 ECharts，Excel 只在浏览器本地解析。

旧 `js/` 源目录、旧 `css/style.css`、旧 DOM runtime、旧 React island 二次挂载入口已经清理；构建产物不发布旧 `dist/js/`。

## 数据边界

这是当前项目最重要的原则：

- 本站不保存用户业务数据。
- 用户的商品和订单数据写入用户自己配置的 Firebase Firestore。
- 商品管理、订单管理使用 Firestore SDK 的离线缓存能力，先保证本地交互速度，再由 Firebase SDK 同步到云端。
- 数据分析模块只在浏览器内读取 Excel 文件，解析结果只存在当前页面内存里，不上传到 Cloudflare，也不会写入本站数据库或 Firestore。
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
