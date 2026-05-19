# TK 项目交接与优化规划

这个文件是当前项目的“接手说明 + 历史规划记录”。如果更换对话、换 API base_url、换账号、上下文丢失，新的对话先读这个文件，再看 `README.md`、`git status --short`、相关测试文件，就可以继续工作。

当前项目路径：

```text
/Users/gaohongxiang/projects/TK
```

## 1. 项目定位

TK 电商工具箱是给 TikTok Shop 日本跨境店使用的运营工具站。

当前核心模块：

- 利润计算器
- 商品管理
- 订单管理
- 数据采集
- 数据分析
- VitePress 文档站
- TK 运营文档

项目长期方向是：

- 工具站提供页面、计算、分析和本地交互能力。
- 用户业务数据只进入用户自己的 Firebase Firestore。
- 本站、Cloudflare Pages、未来可能的 Workers 都不保存用户业务数据。
- 原生 JS + Vite ESM 路线已作为历史基线完成。
- 当前 `modern-react-spa` 分支已完成完整 React SPA 重建、视觉系统收敛、TypeScript 迁移、领域类型加固和测试 ESM 化；这是独立现代化分支，不动 `main`，最终验收后再合并。

## 2. 当前硬性决策

### 2.1 Firebase-only

正式产品数据源只使用 Firebase Firestore。

原因：

- Firebase Firestore SDK 自带离线缓存，适合当前“先本地快，再同步云端”的体验。
- 规则和集合结构稳定后，用户一般不需要频繁更新。
- Supabase 表结构、字段、SQL 变更会让用户手动同步，用户打扰较大。
- 当前用户更需要稳定、少维护、少迁移成本。

结论：

- Supabase 先不作为正式功能。
- Supabase 不应出现在页面活跃加载链。
- Supabase 不应作为 README 中的当前推荐数据源。
- 如果保留 Supabase 代码，只能作为历史实验或未启用代码，不进入 UI 和注册表活跃路径。

### 2.2 完整 React SPA 重建

用户已确认不要继续局部微调旧页面，项目在 `modern-react-spa` 分支执行完整 React SPA 重建路线；当前重构主线已完成。

技术选择：

- Vite + React。
- TypeScript。
- Tailwind CSS。
- shadcn/ui。
- ECharts。
- lucide-react。

当前选择暂不使用 Next.js。原因是主站仍是静态工具站，用户业务数据在用户自己的 Firebase Firestore，数据分析 Excel 原始文件只在浏览器本地解析；当前不需要 SSR、Server Components 或后端 API 路由。先用 Vite React 保持部署边界简单。

当前也暂不使用 TanStack Table。商品和订单表格先用本地 shadcn 风格 `Table` primitive、共享 `table-tools` 控件和既有纯函数完成；只有后续出现复杂列配置、虚拟滚动或大量交互排序筛选需求时再评估。

重建原则：

- 允许删除旧 DOM、旧全局脚本兼容层和旧 `css/style.css` 视觉体系。
- 不改变 Firebase 数据结构。
- 不上传或保存用户 Excel 数据。
- 不引入平台方数据库。
- 不推 GitHub，不动 `main`，在本地分支完成验收后再合并。
- 页面显示尽量接近现有线上版本，让用户感知不到架构切换；保留现有导航位置、页面密度、表格信息层级、颜色语义和主要交互位置。
- 如果调整布局，只做明显提升可读性和操作效率的克制优化，不做大换皮。
- 先搭 React SPA App Shell 和设计系统，再按利润计算器、数据分析、商品管理、订单管理顺序重建页面。
- 不改变 Firebase 数据结构。
- 商品/订单重建时复用现有 Firestore provider 和纯函数，先保证数据兼容，再替换 UI。
- 每次修改后至少跑相关测试；准备交付或合并前跑 `npm run release:check`。

### 2.3 不保存用户数据

任何新增功能都必须遵守：

- 订单数据写入用户自己的 Firebase Firestore。
- 商品数据写入用户自己的 Firebase Firestore。
- 数据分析 Excel 原始文件只在浏览器本地解析，不上传；解析后的分析快照写入用户自己的 Firestore。
- Cloudflare 只托管静态资源。
- 本地工具参数可以保存在用户浏览器 `localStorage`。
- 不增加平台方数据库来保存用户商品、订单、Excel。

## 3. 当前仓库状态

当前主重建工作分支：

```text
modern-react-spa
```

当前状态：

- 路线一轻模块化已完成。
- 路线二标准 ESM 模块化主体已完成。
- 完整 Vite React SPA 重建主线已完成，主站改为单根 `#root` 渲染。
- `src/react/app/App.tsx` 已接管主导航、hash 路由、年份、文档链接、页脚和四个主视图。
- 利润计算器已迁到 `src/react/features/calculator/CalculatorApp.tsx`，复用现有公式和运费核心。
- 数据分析页已迁到 React + ECharts，并由 `src/react/features/analytics/AnalyticsRoute.tsx` 按需懒加载；`src/analytics/parser.ts` 和 `src/analytics/analyzer.ts` 仍作为纯函数来源复用。
- 商品管理已迁到完整 React 页面：React 接管连接状态、账号筛选、表格、分页、新增/编辑商品弹窗、SKU 编辑、CSV 导出和商品变更广播；继续复用现有 Firestore provider、商品表格纯函数、SKU 表单纯函数和运费核心，不改变 Firestore 数据结构。
- 订单管理已迁到完整 React 页面；继续复用现有 Firestore provider、订单共享计算、导出和表格筛选 helper，不改变 Firestore 数据结构；旧订单同步运行壳层已删除，保存流程由 React 订单页直接调用 provider。
- 数据采集模块已接入主导航和 React 页面：采集表按共享账号筛选，合格商品和店小秘状态合并到用户 Firestore 的 `collection_records`，拒绝品只写轻量 `collection_excluded_products` 去重记录；页面状态统一为未连接、权限不足、无数据、有数据四种列表状态。
- 账号系统已收敛为三模块共享账号表：商品、订单、数据采集的账号标签只来自统一 `order_accounts`，业务数据里的 `accountName` 只负责计数和筛选，不再反向生成账号标签；空账号或已删除账号的数据只在“全部”里显示。
- 搜索体系已统一：新增 `src/search-query.ts` 共享解析器，订单、商品、数据采集都先按当前账号标签过滤，再在过滤后的数据里搜索；订单支持下单/采购/到仓日期语法，商品只做文本搜索，数据采集支持采集/编辑日期语法。三个模块搜索框右侧都有“说明”弹窗，明确搜索只作用于当前账号标签。
- FastMoss/店小秘采集默认使用当前授权采集窗口。FastMoss 本机配置全局复用；店小秘按 TK 账号绑定复用；多个账号顺序切换，不并行处理多个采集窗口。平台人工确认、付费确认和发布确认仍由用户处理。
- `packages/cli/` 是内部 TK CLI，保留给开发和排查使用；用户采集路径不依赖它。
- 数据采集脚本母本位于 `skills/tk-product-selection/`，全局 skill 的脚本为实际执行入口。常用流程是先检查目标账号，再创建独立运行目录并用 `firestore-sync.mjs dedupe ... --account <目标账号名>` 从数据库生成去重清单，然后用当前授权采集窗口完成 FastMoss 和店小秘页面动作，用 skill 自带筛选/状态脚本生成本批次文件，最后 `firestore-sync.mjs sync ... --account <目标账号名>` 同步。
- 数据采集用户文档已新增：`docs/guide/collection.md`，并接入 VitePress 侧边栏；内部 SOP 仍在 `docs/ops/fastmoss-selection-sop.md`。
- `index.html` 当前只保留 `#root`、`/src/react/main.tsx`、Firebase compat SDK 和 SheetJS；不再加载旧 DOM 入口。
- 已删除旧运行时入口和旧 React 二次挂载文件：`src/main.mjs`、`src/calc/index.mjs`、`src/orders/index.mjs`、`src/products/index.mjs`、`src/analytics/index.mjs`、`src/analytics/charts.mjs`、`src/react/features/analytics/mountAnalytics.tsx`、`src/react/features/products/ProductsTable.tsx`、`src/react/features/products/mountProductsTable.tsx`。
- `src/orders/table.ts` 和 `src/products/table.ts` 已收缩为纯 helper，不再暴露 DOM `render` 壳或挂旧全局表格视图。
- 商品主表已使用本地 shadcn 风格 `Table` / `Button` primitives；商品导出弹层由 React 控制，CSV 行构建和文件名继续复用 `src/products/export.ts`。
- 订单摘要已保留收入、支出、利润、退款和达人佣金口径；退款订单行和订单号达人/退款标签仍由纯函数口径驱动。
- 视觉系统收敛二期已完成到当前目标：商品、订单和数据分析的表格搜索、分页、吸顶控制带、横向滚动外壳和空状态已收敛到 `src/react/components/ui/table-tools.tsx`；商品/订单导出账号选择已收敛到 `ExportOptions`；商品/订单账号标签栏已收敛到 `AccountTabsBar`；表格状态标签、连接状态和同步状态已收敛到 `Badge`；App Shell、导航、skip link、帮助图标、计算器、数据分析和订单摘要样式已迁入 React/Tailwind 常量。
- 旧 React CSS 分模块样式已清理完成：`src/react/styles.css` 只导入 Tailwind utilities 和 `src/react/styles/base.css`；`src/react/styles/base.css` 仅保留 token、明暗主题、body/a 基础规则，React 侧 CSS 总量约 56 行。
- 当前不再依赖旧 `ot-table-*`、`.btn`、旧 modal/action、`.ot-export-*`、`.ot-acc-*`、`.ot-empty`、`.chip`、`.workspace-chip`、`.calc-tab`、旧 App Shell/nav/skip-link 全局视觉样式。
- `scripts/preview-smoke.mjs` 已适配完整 React SPA：首页 HTTP smoke 检查单根 React 入口、SEO meta、Firebase/SheetJS 脚本、构建产物和静态页面；运行后交互由 Playwright 覆盖。
- 构建产物不再发布旧 `dist/js/`。
- 旧 `js/` 源目录已清理；当前主站业务源码在 `src/` 下以 TypeScript/TSX 维护。
- TypeScript 领域类型加固已完成：商品、订单、数据分析、Firestore 配置、全局设置和运费核心都有稳定类型入口；当前 `src/` 已无显式 `any`。
- Node 契约测试已统一为 ESM `.mjs`，不再保留 CommonJS `.cjs` 测试文件。
- `npm run release:check` 已串联 `npm test`、`npm run typecheck`、文档构建、主站构建、HTTP smoke、Playwright e2e 和 `git diff --check`。
- 真实 Firebase 数据手动验收已完成，未发现大问题。
- `route-2-esm-m1` 是稳定基线分支；`modern-react-spa` 是完整 React SPA 重建分支。

最近已验证通过：

```bash
node tests/search-query.test.mjs
node tests/orders-table-view.test.mjs
node tests/products-view-ui.test.mjs
node tests/collection-module.test.mjs
node tests/orders-search-ime-guard.test.mjs
npm run typecheck
npm test
npm run typecheck
npm run build
git diff --check
node tests/collection-module.test.mjs
npm run smoke
npx playwright test tests/e2e/release.spec.ts --project=desktop-chromium --project=mobile-chromium
npm run release:check
```

接手时仍应先跑 `git status --short` 看工作区是否干净；如果准备上线，重新跑 `npm run release:check`。

## 4. 当前本地文件注意事项

不要提交这些：

```text
dist/
node_modules/
docs/.vitepress/cache/
docs/.vitepress/dist/
docs/node_modules/
*.xlsx
*.xls
*.csv
```

当前本地有用户数据文件：

```text
商品流量详情4.27-5.3.xlsx
```

这个是用户的 TK 商品流量 Excel，只能用于本地分析，不能提交。

## 5. 当前部署方式

### 5.1 主站

主站已经接入 Vite。当前在 `modern-react-spa` 分支中，页面壳层入口是 `/src/react/main.tsx`；商品管理、订单管理和全局 Firestore 弹窗/Toast 都已由 React 直接接管，不再通过 `/src/products/index.mjs`、`/src/orders/index.mjs` 或静态全局弹窗作为运行入口。旧 `js/` 源目录已清理，不再由 `index.html` 加载，也不再复制到构建产物。

本地安装：

```bash
npm install
```

本地开发：

```bash
npm run dev
```

构建：

```bash
npm run build
```

预览构建产物：

```bash
npm run preview
```

Cloudflare Pages 主站配置：

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: 留空
```

仓库有：

```text
wrangler.toml
```

其中：

```toml
pages_build_output_dir = "./dist"
```

### 5.2 文档站

文档站仍然单独部署 `docs/`。

Cloudflare Pages 文档站配置：

```text
Root directory: docs
Build command: npm run build
Build output directory: .vitepress/dist
```

本地文档开发：

```bash
./scripts/docs-dev.sh
```

文档构建：

```bash
./scripts/docs-build.sh
```

## 6. 阶段规划总览

这里分成三档路线。第一档“轻模块化”和第二档“标准模块化”主体已完成；第三档调整为 React 渐进迁移，先做数据分析页。

### 三档路线对比

| 档位 | 周期估计 | 技术路线 | 当前是否执行 | 风险 | 收益 |
| --- | --- | --- | --- | --- | --- |
| 轻模块化 | 1-2 天 | 原生 JS + `<script defer>` + Vite 构建 | 已完成 | 低 | 降低单文件压力，保持现有稳定性 |
| 标准模块化 | 3-5 天 | Vite 原生 ES Modules + `import/export` | 主体已完成，进入真实数据验收期 | 中 | 依赖关系清晰，减少全局变量 |
| 完整 React SPA | 1-3 周 | Vite + React + TypeScript + Tailwind + shadcn/ui + ECharts | 已完成第一轮重建，进入视觉系统收敛 | 中高 | UI 质感、图表、表格和长期维护性提升 |

旧渐进迁移原则已经被 `modern-react-spa` 分支的新路线取代：

- 旧 `js/` 已完成清理，后续不要恢复双入口。
- 不使用 Next.js，继续保持静态工具站部署方式。
- 使用 Vite React SPA，不做 Next.js。
- 新分支允许全站重建，但显示应尽量保持旧站连续性。
- 每个 React 重建阶段都必须保留“不上传 Excel、不保存平台方用户数据”的边界。

## 7. 路线一：轻模块化，1-2 天

### 7.1 目标

保持原生 JS，不上 TypeScript，不强制改 ES Module。

目标是：

- 减少单文件压力。
- 把纯函数、配置、provider 元信息拆清楚。
- 不破坏当前页面加载顺序。
- 不改变 Firebase 数据结构。
- 不影响订单/商品现有操作。

### 7.2 技术边界

保持：

- `<script defer>`。
- 全局命名空间模式，例如 `const OrderTracker = ...`。
- 当前 Vite 构建方式。
- 当前测试方式。
- 当前 Firebase Firestore provider。

不做：

- 不用 `import/export`。
- 不加 TypeScript。
- 不改 Firebase 文档结构。
- 不重写订单同步。
- 不改 UI 框架。

### 7.3 轻模块化工作包

#### L1：撤掉 Supabase 活跃路径

先做。详见后面的 Phase 1。

输出：

- 页面不加载 Supabase。
- 注册表不注册 Supabase。
- README 写 Firebase-only。

#### L2：新增全局配置

新增：

```text
js/app-config.js
tests/app-config.test.mjs
```

沉淀：

- 文档站地址。
- 正式数据源策略。
- 模块元信息。
- 用户数据边界文案。

不动态重写导航，先只作为共享配置。

#### L3：整理数据源注册表

保留：

```text
orders/firestore
products/firestore
analytics/browser-excel
```

移除：

```text
orders/supabase
```

#### L4：拆数据分析纯函数

从：

```text
js/analytics/index.js
```

拆成：

```text
js/analytics/parser.js
js/analytics/analyzer.js
js/analytics/index.js
```

parser/analyzer 不碰 DOM，不上传数据。

#### L5：抽公共纯函数

候选：

```text
js/shared/html.js
js/shared/format.js
js/shared/firebase-config.js
```

只抽完全一致的纯函数。

#### L6：订单/商品轻整理

只整理入口和 provider 选择，不碰复杂同步。

订单：

- 保持 `orders/sync.js` 稳定。
- 整理 `orders/index.js` 里 provider 获取和产品桥接。当前已拆出 `js/orders/products.js`，provider 选择仍保持 Firestore-only。

商品：

- 保持 `products/provider-firestore.js` 稳定。
- 整理 `products/index.js` 的连接状态和渲染入口。

### 7.4 轻模块化验收

必须通过：

```bash
npm test
npm run build
git diff --check
```

人工重点检查：

- 利润计算器能切换。
- 商品管理能连接 Firebase。
- 商品新增/编辑 SKU 不坏。
- 订单新增/编辑不坏。
- 快递公司、快递单号输入后不消失。
- 数据分析 Excel 本地导入正常。

### 7.5 轻模块化完成标准

轻模块化完成时，项目应满足：

- Supabase 不在活跃路径。
- README 明确 Firebase-only。
- `PROJECT_HANDOFF.md` 已更新。
- 数据分析 parser/analyzer 拆分完成。
- 公共纯函数至少抽出一组。
- 全部测试通过。
- 主站构建通过。

## 8. 路线二：标准模块化，3-5 天

标准模块化已在本地分支 `route-2-esm-m1` 启动，当前只执行低风险的 M1 纯工具迁移。

### 8.1 触发条件

只有满足这些条件才开始：

- 轻模块化已经完成。
- 线上使用稳定。
- 订单/商品近期没有大功能要改。
- 测试覆盖足够守住核心路径。
- 用户确认可以接受一次较大的工程化改动。

### 8.2 目标

把当前普通脚本逐步迁移为 Vite 原生 ES Modules。

目标是：

- 用 `import/export` 明确模块依赖。
- 减少全局变量。
- 让构建工具真正接管业务 JS。
- 为后续 TypeScript 做准备。

### 8.3 推荐目录结构

建议新建：

```text
src/
  main.js
  app/
  shared/
  calc/
  orders/
  products/
  analytics/
  data-sources/
```

过渡期可以并存：

```text
js/
src/
```

当前过渡期已结束，旧 `js/` 源目录已清理。

### 8.4 迁移顺序

#### M1：迁移纯工具

当前状态：已完成。完整 React SPA 已接管主站，旧 `js/` 浏览器脚本链和旧全局兼容层已清理。

历史迁移顺序：

- `shared/firebase-config`
- analytics parser/analyzer

这些没有 DOM 或副作用，风险最低。

已完成：

- 新增 `src/analytics/parser.ts`，提供 `TKAnalyticsParser` 和解析纯函数 ESM 导出。
- 新增 `src/analytics/analyzer.ts`，通过 `import { CHANNELS } from './parser.ts'` 读取 parser 元信息，并提供 `TKAnalyticsAnalyzer` 和分析纯函数 ESM 导出。
- `tests/shared-utils.test.mjs` 现在保护未使用的旧 shared 迁移壳层不再回归，并确认 React analytics 使用本地格式化 helper；`tests/analytics-module.test.mjs` 继续确认 analytics parser/analyzer 可被 Node 直接作为 ESM 导入。
- 旧 `js/` 浏览器脚本链已替换，页面不再走 `<script defer>` 本地业务脚本或 `window.Xxx` 全局兼容入口。

当前已验证通过：

```bash
node tests/shared-utils.test.mjs
node tests/analytics-module.test.mjs
npm run release:check
```

#### M2：迁移数据分析

当前状态：已完成。

数据分析相对独立。

迁移：

- `analytics/parser`
- `analytics/analyzer`
- `analytics/index`

已完成：

- 数据分析页已由 React 入口直接接入 `src/analytics/parser.ts` 和 `src/analytics/analyzer.ts`，不再通过旧 `TKDataSourceRegistry` 注册方式。
- 旧 `src/analytics/index.mjs`、`src/analytics/charts.mjs` 和旧 `js/analytics/*.js` 已删除。
- Vite 构建只打包 React 数据分析路由和 parser/analyzer 纯函数；构建产物不包含旧 `js/analytics/*`。
- `tests/analytics-module.test.mjs` 和 `tests/main-build-contract.test.mjs` 已覆盖 React 数据分析入口和“原始 Excel 不上传、分析快照进 Firestore”的边界。

当前已验证通过：

```bash
node tests/analytics-module.test.mjs
node tests/main-build-contract.test.mjs
npm run e2e
npm run release:check
```

#### M3：迁移利润计算器

当前状态：完整 React SPA 已接管利润计算器。`index.html` 只加载 `/src/react/main.tsx`；旧 `src/calc/index.mjs` 和旧 calc DOM 壳层已删除，React 页面直接复用纯公式和共享运费核心。

利润计算器数据依赖较少，适合第二批。

迁移时保持：

- DOM id 不变。
- 计算公式不变。
- 测试先行。

已完成：

- 新增 `src/shipping-core.ts`，提供 `TKShippingCore`、`SHIPPING_RULES`、`DEFAULT_CONSTANTS`、`getShippingBand`、`computeShippingQuote` 和 `computeCalculatedShippingCost` 的 ESM 导出。
- `tests/shipping-core-module.test.mjs` 已新增动态 `import()` 断言，确认共享运费核心 ESM 模块和旧全局模块输出一致。
- 新增 `src/calc/formulas.ts`，提供旧定价、定价新和利润复盘的纯公式导出：`calcLegacyRow`、`deriveLegacyOrigPrice`、`calcPricingRow`、`derivePricingOrigPrice`、`calcSalePrice`。
- React 利润计算器已直接导入 `src/calc/formulas.ts` 和 `src/shipping-core.ts`；`src/calc/shared.ts`、`src/calc/shipping.mjs`、`src/calc/legacy.mjs`、`src/calc/pricing.mjs` 这些旧 DOM 壳层已删除。
- `tests/calc-formulas.test.mjs` 已改为断言纯公式输出和 React 页面直连公式；`tests/calc-shipping-quote.test.mjs` 已改为断言 React 页面直连共享运费核心；`tests/calc-react-state-sync.test.mjs` 保护定价新/利润复盘共用同一份 React 状态。
- 新增 `src/global-settings.ts`，提供全局设置的 ESM 导出；当前完整 React SPA 只使用 `tk.global-settings.v1` 保存汇率、运费倍率和贴单费，不再保留旧利润计算器存储迁移。
- 旧 `src/calc/index.mjs` 已删除；`index.html` 已移除旧 `js/calc/shared.js`、`js/calc/shipping.js`、`js/calc/legacy.js`、`js/calc/pricing.js`、`js/calc/index.js` 以及 `/src/calc/index.mjs` 的页面加载。
- `src/global-settings.ts` 已收敛为 ESM helper，并使用模块内共享 store；不再挂旧 `window.TKGlobalSettings` API，也不再通过 `window.__tkGlobalSettingsStore` 共享状态。
- `src/shipping-core.ts` 已收敛为纯 ESM helper，不再挂旧 `window.TKShippingCore`。
- 历史阶段中 `src/main.mjs` 曾统一导入 `global-settings`、`shipping-core`、`shared/html`、`shared/format`、`table-controls`、`searchable-select`、`data-sources/registry` 这些基础 ESM；当前完整 React SPA 已删除该入口，并已删除旧 `src/shared/html.mjs`、`src/shared/format.mjs`、`src/table-controls.mjs`、`src/data-sources/registry.mjs`。
- `index.html` 已移除旧 `js/global-settings.js`、`js/shipping-core.js`、`js/shared/html.js`、`js/shared/format.js` 页面加载；旧 `js/` 源目录已统一清理。

当前已验证通过：

```bash
node tests/global-settings-module.test.mjs
node tests/calc-module-split.test.mjs
node tests/calc-formulas.test.mjs
node tests/calc-react-state-sync.test.mjs
node tests/calc-shipping-quote.test.mjs
node tests/shipping-core-module.test.mjs
npm run release:check
```

下一步：利润计算器已完成迁移，后续只按功能需求迭代，不再恢复旧 calc DOM 壳层。

#### M4：迁移商品管理

商品管理依赖 Firestore 和 SKU UI。

当前状态：已完成商品管理 React SPA 入口切换。商品管理由 `src/react/features/products/ProductsPage.tsx` 直接接管，`index.html` 不再加载 `/src/products/index.mjs` 或旧 `js/products/index.js`。

迁移顺序：

- table
- crud 纯函数
- provider
- index

已完成：

- 新增 `src/products/table.ts`，提供商品表格筛选、排序、SKU 默认值合并、SKU 标签/尺寸/运费格式化等纯函数 ESM 导出。
- `src/products/table.ts` 已收敛为纯 ESM helper，不再挂旧 `window.ProductLibraryTableView` 或 DOM render。
- `tests/products-view-ui.test.mjs` 已新增动态 `import()` 断言，确认商品表格 ESM 纯函数排序、筛选和 React 渲染壳存在。
- 新增 `src/products/accounts.ts`，提供账号名称归一化、去重和账号槽等纯函数 ESM 导出；账号标签列表来自统一共享账号表，不再从商品数据反向归并生成。
- 新增 `src/products/form-utils.ts`，提供商品 CRUD/SKU 弹窗的尺寸解析、批量 SKU 草稿、SKU 名称匹配、运费快照、SKU 默认值判断等纯函数 ESM 导出。
- `tests/products-form-utils-module.test.mjs` 已新增动态 `import()` 断言，确认商品表单纯函数 ESM 输出稳定。
- `src/products/form-utils.ts` 已收敛为纯 ESM helper，不再挂旧 `window.ProductLibraryFormUtils`。
- `index.html` 已移除旧 `js/products/form-utils.js` 页面加载；旧 `js/` 源目录已统一清理。
- 新增 `src/products/provider-firestore.ts`，提供商品 Firestore provider 的配置解析、展示名、商品/SKU 归一化、Firestore 写入 doc 构造、`create/init/pullProducts/upsertProduct/deleteProduct` 的 ESM 导出。
- `tests/products-provider-firestore-module.test.mjs` 已新增动态 `import()` 断言，确认 provider 纯函数 ESM 的配置解析和商品/SKU 文档映射保持旧行为。
- `src/products/provider-firestore.ts` 已收敛为纯 ESM provider，不再挂旧 `window.ProductLibraryProviderFirestore` 或注册 `TKDataSourceRegistry`；商品页和订单页直接 import 使用。
- 订单商品资料读取已由 React 订单页直接导入商品 provider ESM，不再依赖旧普通脚本加载顺序。
- 完整 React SPA 重建后已删除 `src/products/index.mjs`，商品管理入口由 `src/react/features/products/ProductsPage.tsx` 接管。
- `index.html` 已移除旧 `js/products/index.js` 的页面加载，商品管理不再通过旧 hash DOM 入口启动。
- `index.html` 已移除旧 `js/products/provider-firestore.js`、`js/products/table.js`、`js/products/accounts.js` 页面加载；旧 `js/` 源目录已统一清理。
- 新增 `src/products/export.ts`，提供商品导出账号选项、CSV 行构建、文件名和 CSV 转义等纯函数 ESM 导出；账号选择弹层和 CSV 下载由 React 商品页直接处理，不再挂旧 `window.ProductLibraryExport`。
- `tests/products-export-module.test.mjs` 已新增动态 `import()` 断言，确认商品导出 ESM 账号选项、CSV 行构建行为稳定，并阻止 DOM 弹层/下载逻辑回流到 helper。
- `index.html` 已移除旧 `js/products/export.js` 页面加载；旧 `js/` 源目录已统一清理。
- 完整 React SPA 重建后已删除 `src/products/crud.mjs`，商品弹窗、SKU 编辑、保存/删除事件绑定由 React 商品页接管。
- `tests/products-crud-module.test.mjs` 已改为断言旧商品 CRUD DOM runtime 不存在，并确认尺寸解析、批量 SKU、名称匹配和运费快照等纯函数行为稳定。
- `index.html` 已移除旧 `js/products/crud.js` 页面加载；旧商品 CRUD runtime 已删除。

当前已验证通过：

```bash
node tests/products-view-ui.test.mjs
node tests/products-form-utils-module.test.mjs
node tests/products-provider-firestore-module.test.mjs
npm test
npm run build
npm run e2e
npm run release:check
```

#### M5：迁移订单管理

订单最复杂，最后迁移。

当前状态：M5 已完成到 React SPA 运行入口。订单页面现在由 `src/react/features/orders/OrdersPage.tsx` 直接接管 Firestore 连接、商品关联、表格、账号标签、订单弹窗、账号弹窗、CSV 导出和数据存储说明弹窗；全局 Firestore 连接、规则提示、退出确认和 Toast 由 `src/react/app/AppRuntime.tsx` 渲染。`index.html` 不再加载 `/src/orders/index.mjs`、`/src/firestore-connection.ts` 或 `/src/orders/firestore-rules.ts`；旧订单运行壳层已删除，只保留仍被 React 页面复用的业务 helper/provider。

顺序：

- shared
- table
- export
- tabs
- crud
- session
- sync
- provider-firestore
- index

订单同步运行链路已由 React 订单页直接接管；旧 `src/orders/sync.mjs` 运行壳层已删除，订单页直接调用 Firestore provider 的 `pullSnapshot()` / `pushChanges()`。

已完成：

- 新增 `src/orders/shared.ts`，提供 `OrderTrackerShared`、`create` 以及订单归一化、旧结构迁移/清洗、快递识别、金额/佣金/利润计算等关键纯函数 ESM 导出。
- `src/orders/shared.ts` 保留旧 `OrderTrackerShared.create()` 返回方法，并让原来依赖 `window` / `document` 的读取点可注入，方便 Node 测试和后续入口迁移。
- `tests/orders-shared-module.test.mjs` 已新增动态 `import()` 断言，对照旧 `js/orders/shared.js` 验证账号去重、汇率读取、利润计算、快递识别、多明细订单归一化和旧订单结构清洗输出一致。
- 新增 `src/orders/table.ts`，提供订单表格筛选排序、日期型搜索判断、退款/达人识别、快递汇总、金额格式化、利润颜色、采购/销售/运费/达人佣金/利润摘要统计和表格渲染壳等 ESM 导出。
- `tests/orders-table-view.test.mjs` 已新增动态 `import()` 断言，对照旧 `js/orders/table.js` 验证搜索筛选、达人搜索、稳定排序、利润颜色和多明细快递紧凑展示口径一致。
- `tests/orders-summary-ui.test.mjs` 已新增动态 `import()` 断言，对照旧 `js/orders/table.js` 验证摘要统计、摘要金额格式化和当前筛选标题一致。
- 新增 `src/orders/export.ts`，提供导出账号选项、导出文件名、CSV 转义、CSV 行构造、订单筛选和 CSV 字符串生成等纯函数 ESM 导出；导出弹层和 CSV 下载由 React 订单页直接处理，不再保留旧 DOM 兼容壳。
- `tests/orders-export-module.test.mjs` 已新增动态 `import()` 断言，验证 ESM 导出模块的账号选项、文件名、CSV 表头、CSV 双引号转义、未关联账号筛选，以及达人佣金/预估利润按当前汇率计算。
- 完整 React SPA 重建后已删除 `src/orders/tabs.mjs`，订单账号标签栏、账号计数和新增订单入口由 React 订单页直接渲染。
- `tests/orders-tabs-module.test.mjs` 已改为断言旧订单账号标签 DOM runtime 不存在，并保护 React 订单页直接接管账号标签栏。
- 完整 React SPA 重建后已删除 `src/orders/crud.mjs` 过渡模块；订单弹窗交互由 React 订单页直接实现，复用 `src/orders/shared.ts` 和 `src/orders/form-utils.ts` 的真实纯函数入口。
- `tests/orders-crud-module.test.mjs` 已改为断言旧 CRUD 过渡模块不存在，并保护 React 订单页的明细区、商品/SKU 搜索下拉、重量汇总和快递自动识别；`tests/orders-react-form-behavior.test.mjs` 覆盖订单表单关键纯函数和 React 页面直连逻辑。
- 完整 React SPA 重建后已删除 `src/orders/session.mjs`，Firestore 配置变化、连接按钮、刷新按钮 loading 和连接状态由 React 订单页直接接管。
- `tests/orders-session-module.test.mjs` 已改为断言旧订单会话 DOM runtime 不存在，并保护 React 订单页直接接管配置变化、连接和刷新状态。
- 新增 `src/orders/provider-firestore.ts`，提供 Firestore 配置解析/序列化、显示名、items 归一化、旧结构清洗识别、订单拉取映射、订单写入 doc 构造等 ESM 纯函数，并保留 `OrderTrackerProviderFirestore.create()` 兼容壳。
- `tests/orders-provider-firestore-module.test.mjs` 已新增动态 `import()` 断言，验证 ESM provider 的配置解析、显示名、items 清洗、拉取订单字段映射、写入 doc 汇总和空字段处理。
- 完整 React SPA 重建后已删除 `src/orders/sync.mjs` 旧同步运行壳层；React 订单页直接使用 Firestore provider 拉远端快照、计算 upsert/delete/account 变更，并用 `waitForCommit: false` 投递 SDK 本地写入队列。
- `tests/orders-react-sync-contract.test.mjs` 已新增断言，保护订单页直连 `pullSnapshot()` / `pushChanges()`、后台 `commitPromise` 和 provider 的 cursor/seq 能力；`tests/orders-sync-provider-contract.test.mjs` 已改为保护 provider 同步方法而不是旧 sync 壳层。
- 完整 React SPA 重建后已删除 `src/orders/index.mjs`，订单运行入口由 `src/react/features/orders/OrdersPage.tsx` 接管，不再挂旧 `window.OrderTracker`。
- 完整 React SPA 重建后已删除 `src/orders/products.mjs`，订单页直接通过 `ProductLibraryProviderFirestore` 拉取商品资料，监听 `tk-products-changed` 并在页面内完成商品关联。
- `tests/orders-products-module.test.mjs` 已改为断言旧订单商品桥接 runtime 不存在，并保护 React 订单页直接读取商品资料、监听商品变更和按账号/TK ID 关联商品。
- 新增 `src/orders/firestore-rules.ts`，提供页面内置 Firestore 规则文本的 ESM 导出；Firestore 连接模块直接 import 规则文本，不再挂旧 `window.ORDER_TRACKER_FIRESTORE_RULES`。
- `tests/orders-firestore-rules.test.mjs` 已新增动态 `import()` 断言，确认 ESM 内置规则和文档规则保持一致。
- 新增 `src/orders/form-utils.ts`，提供订单弹窗商品/SKU 标签、商品默认参数合并、订单明细草稿归一化、旧版订单明细恢复、金额/尺寸解析等纯函数 ESM 导出；不再挂旧 `window.OrderTrackerFormUtils`。
- `tests/orders-form-utils-module.test.mjs` 已新增动态 `import()` 断言，确认订单表单纯函数 ESM 输出稳定。
- 新增 `src/firestore-connection.ts`，提供 Firestore 配置解析、复制规则、配置变更广播和 React UI 注册 API；订单、商品、同步和 Toast 入口已改为 ESM import，不再挂旧 `window.TKFirestoreConnection`，也不再保留旧本地存储迁移兼容层。
- `tests/firestore-connection-module.test.mjs` 已改为动态 `import()` 断言，确认 Firestore 连接 ESM 模块可直接导入、可解析 `firebaseConfig`，并保护不要回退到旧全局 API。
- `src/orders/provider-firestore.ts` 已收敛为纯 ESM provider，不再注册 `TKDataSourceRegistry`；React 订单页直接 import 使用。
- `index.html` 已移除旧 `js/orders/index.js` 的页面加载；React SPA 阶段也已移除 `<script type="module" src="/src/orders/index.mjs"></script>`，订单运行入口改为 `src/react/features/orders/OrdersPage.tsx`。
- `index.html` 已移除旧 `js/orders/shared.js`、`js/orders/provider-firestore.js`、`js/orders/export.js`、`js/orders/tabs.js`、`js/orders/session.js`、`js/orders/products.js`、`js/orders/firestore-rules.js`、`js/orders/form-utils.js`、`js/orders/table.js` 页面加载；旧 `js/` 源目录已统一清理。
- `index.html` 已移除旧 `js/orders/sync.js` 的页面加载；订单同步运行入口改为 `src/react/features/orders/OrdersPage.tsx`，不再保留 `src/orders/sync.mjs` 过渡层。
- `index.html` 已移除旧 `js/orders/crud.js` 的页面加载；订单弹窗运行入口改为 `src/react/features/orders/OrdersPage.tsx`，不再保留 `src/orders/crud.mjs` 过渡层。
- `index.html` 已移除旧 `js/firestore-connection.js`、`/src/firestore-connection.ts` 和 `/src/orders/firestore-rules.ts` 的页面加载；连接模块和规则文本现在由 React 入口依赖图加载。
- 新增 `tests/orders-index-module.test.mjs`，验证订单 ESM 入口可直接 import、懒初始化、挂回全局，以及旧订单 index 普通脚本不再由主页面加载。

当前已验证通过：

```bash
node tests/orders-shared-module.test.mjs
node tests/orders-table-view.test.mjs
node tests/orders-summary-ui.test.mjs
node tests/orders-export-module.test.mjs
node tests/orders-tabs-module.test.mjs
node tests/orders-crud-module.test.mjs
node tests/orders-react-form-behavior.test.mjs
node tests/orders-session-module.test.mjs
node tests/orders-provider-firestore-module.test.mjs
node tests/orders-react-sync-contract.test.mjs
node tests/orders-index-module.test.mjs
node tests/firestore-connection-module.test.mjs
npm test
npm run build
git diff --check
npm run release:check
```

下一步：

- M5 进入观察期。旧订单入口和同步/CRUD 运行壳层已清理，后续不要恢复双入口。
- 后续订单同步语义以 React 订单页和 `src/orders/provider-firestore.ts` 为准。

### 8.5 标准模块化期间的构建变化

当前状态：主站页面入口已完成 ESM 切换，构建产物不再发布旧业务 `js/` 目录。

```html
<script type="module" src="/src/react/main.tsx"></script>
```

已完成：

- 新增 `src/app-config.ts`，提供 `TKAppConfig` ESM 导出；React App 直接 import 使用，不再挂旧 `window.TKAppConfig`。
- 完整 React SPA 重建后已删除 `src/main.mjs`，主站入口改为 `/src/react/main.tsx`。
- `index.html` 已移除旧 `js/app-config.js` 和 `js/app.js` 页面加载，改为 `/src/react/main.tsx`。
- 旧 `js/app-config.js` 和 `js/app.js` 源文件已随旧目录统一清理，不再维护双入口。
- `tests/app-config.test.mjs`、`tests/main-build-contract.test.mjs`、`scripts/preview-smoke.mjs` 已更新为覆盖 ESM 主入口和 Vite build 产物。
- 完整 React SPA 重建后已删除 `src/table-controls.mjs` 和 `src/data-sources/registry.mjs`；表格控制带由 React 页面和 primitives 直接渲染，Firestore provider 由页面直接 import。
- `index.html` 已移除旧 `js/table-controls.js` 和 `js/data-sources/registry.js` 页面加载；旧文件已随旧目录统一清理。
- `tests/shared-utils.test.mjs`、`tests/data-source-registry.test.mjs`、`tests/orders-table-view.test.mjs`、`tests/products-view-ui.test.mjs` 已更新为保护旧 DOM 表格控件/数据源注册表不存在，以及 React 页面直接接管对应职责。
- 订单商品/SKU 可搜索下拉已进入 `src/react/components/ui/searchable-select.tsx`，旧 DOM 版 `src/searchable-select.mjs` 已清理。
- `index.html` 已移除旧 `js/searchable-select.js` 页面加载；旧文件已随旧目录统一清理。
- `tests/shared-utils.test.mjs` 和 `tests/orders-crud-module.test.mjs` 已覆盖可搜索下拉框 ESM 导出、入口挂载和旧页面加载移除。

- 利润计算器、商品管理、订单管理、数据分析、Firestore 连接和基础共享工具都已由 React 入口依赖图加载。
- `index.html` 已不再列本地 `js/*.js` 普通脚本。
- `scripts/copy-main-assets.mjs` 不再复制旧 `js/` 到 `dist/js/`，只补充正式站点需要稳定访问的 `/logo.png`。
- `public/_headers` 已移除旧 `/js/*` 缓存规则。
- `scripts/preview-smoke.mjs` 会确认 `/logo.png` 可访问，并确认旧 `/js/app.js`、`/js/orders/provider-supabase.js` 不在构建产物中。

旧 `js/` 源文件已清理；不要再恢复双入口或继续维护两套业务源码。

迁移中不要同时维护两套入口太久。

### 8.6 标准模块化测试要求

需要新增或调整：

- 模块 import 测试。
- 构建产物测试。
- 入口挂载测试。
- 核心纯函数测试。

每次迁移一个模块后跑：

```bash
npm test
npm run build
git diff --check
```

### 8.7 标准模块化风险

主要风险：

- 全局变量消失导致旧模块找不到依赖。当前旧本地业务入口已清理，风险主要来自文档或后续改动误恢复旧链路。
- defer 顺序迁移到 import 后执行时机变化。当前主站只保留 React 入口，本地业务脚本不再混用 defer。
- Vite dev 和 build 路径差异。
- 测试大量需要更新。
- 订单同步副作用更难排查。

处理原则：

- 不恢复 `window.Xxx` 兼容层或旧本地 `js/` 双入口。
- 一次只改一个模块或一个页面，继续保持 `npm test`、`npm run build`、`git diff --check`、`npm run release:check`。
- 订单相关改动需要重点检查 Firestore provider、商品关联和快递/利润字段。

### 8.8 标准模块化完成标准

完成时应满足：

- 主站入口为 `src/react/main.tsx`。已完成。
- 业务模块使用 React 入口依赖图和 ESM `import/export`。已完成。
- `index.html` 不再列大量 `js/*.js` 脚本。已完成。
- 旧 `js/` 源目录已清理，构建产物也不发布 `dist/js/`。已完成。
- `scripts/copy-main-assets.mjs` 不再复制业务 `js/`。已完成。
- `npm test` 通过。
- `npm run build` 通过。

## 9. 路线三：完整 React SPA，1-3 周

路线三目标是提升主站 UI 质感、图表能力、复杂表格能力和长期维护性。当前 `modern-react-spa` 分支已完成完整 React SPA 第一轮重建，并进入视觉系统和旧 CSS 依赖收敛阶段。

### 9.1 技术选型

最终选择：

```text
Vite
React
TypeScript
Tailwind CSS
shadcn/ui
ECharts
lucide-react
```

暂不选择：

- Next.js：当前主站是静态工具站，不需要 SSR、Server Components 或 API routes。
- TanStack Table：当前商品/订单表格已由本地 `Table` primitive、共享 `table-tools` 控件和既有纯函数支撑，暂不为库而重写数据逻辑。
- Ant Design：成型快，但视觉容易变成通用后台，和当前工具站的自定义体验不完全匹配。
- 全量 Mantine/Bootstrap：先不引入整套外观，避免一次性改动过大。

图表统一使用 ECharts，不继续手写复杂 SVG 气泡图、环形图和图例逻辑。

### 9.2 触发条件

路线三已经由用户确认启动并完成第一轮重建，后续收敛时仍必须满足：

- 当前 React SPA 可构建、可测试。
- 不改变 Firebase 数据结构。
- 不改变数据分析隐私边界。
- 一次只改一个页面或一类共享组件。
- 每一步都通过测试后本地提交。

### 9.3 目录规划

当前 React 代码结构：

```text
src/
  react/
    main.tsx
    app/
      AppRuntime.tsx
    components/
      ui/
      charts/
      layout/
    features/
      analytics/
        AnalyticsApp.tsx
      products/
      orders/
    lib/
      cn.ts
      format.ts
```

现有 `src/analytics/parser.ts`、`src/analytics/analyzer.ts`、`src/products/*.ts`、`src/orders/*.ts`、`src/calc/formulas.ts` 和 `src/shipping-core.ts` 作为纯函数/helper/provider 保留，React 页面直接 import 使用。

### 9.4 第一阶段：React 基础设施

目标：建立完整 React SPA 入口和基础运行层。

已新增依赖：

```bash
npm install react react-dom echarts echarts-for-react lucide-react clsx tailwind-merge class-variance-authority tailwindcss-animate tslib
npm install -D typescript @types/react @types/react-dom @vitejs/plugin-react tailwindcss postcss autoprefixer
```

已新增/调整：

```text
tsconfig.json
tailwind.config.ts
postcss.config.js
vite.config.mjs
src/react/main.tsx
src/react/app/AppRuntime.tsx
```

当前状态：

- `index.html` 只保留 `#root`、`/src/react/main.tsx`、Firebase compat SDK 和 SheetJS。
- 利润计算器、商品管理、订单管理、数据分析都由 React App Shell 渲染。
- 旧 DOM 入口和旧 React 二次挂载文件已删除。

### 9.5 第二阶段：迁移数据分析页

目标：数据分析页改成 React + shadcn/ui + ECharts。

当前状态：已完成 React 数据分析页首轮迁移和体验优化。`index.html` 数据分析区域只保留 `#analytics-react-root`，React 上传、KPI、运营总览、商品机会 scatter、Top 商品、诊断卡片和明细表已接管页面；Excel 仍只在浏览器内用 SheetJS 解析，不上传、不保存。

已完成优化：

- 数据分析只在进入 `#analytics` 时按需加载，避免首页提前加载 ECharts。
- ECharts 使用 core 入口并只注册 `pie`、`funnel`、`scatter` 等实际图表。
- Vite 已把 `echarts-core` 和 `echarts-react` 拆成独立 lazy chunk。
- 运营总览把渠道 GMV donut 和流量漏斗合并到一个 ECharts canvas，下方保留可读漏斗摘要。
- 商品机会图改成 ECharts scatter，避免旧手写 SVG 气泡图的文字重叠问题。
- 客单价展示为 `円/单`，件均展示为 `円/件`，避免两个价格指标含义混淆。

范围：

- Excel 上传组件。
- KPI 卡片。
- 渠道 GMV/成交件数环形图。
- 商品机会散点/气泡图。
- Top 商品排行。
- 商品诊断卡片。
- 商品明细表格。

不做：

- 不写入 Firebase。
- 不保存 Excel 到 localStorage。
- 不上传 Excel。
- 不迁移商品/订单。

ECharts 图表：

- 运营总览：`pie` donut 展示渠道 GMV 结构，`funnel` 展示曝光、点击、加购、订单、成交件数。
- 商品机会图：`scatter`，x=曝光，y=转化率，symbolSize=GMV，tooltip 展示商品名、GMV、订单、曝光、诊断。
- 后续只在真实 Excel 反馈明确时再微调 visualMap、象限线或筛选交互，避免过度设计。

### 9.6 第三阶段：商品管理 React 化

当前状态：已完成。

- 商品页由 `src/react/features/products/ProductsPage.tsx` 接管。
- 商品表格使用本地 `Table` primitive 和共享 `table-tools` 搜索/分页/滚动外壳。
- shadcn 风格 Dialog/Form/Tabs/Button/Input/Select/Checkbox 等 primitives 已接入。
- 继续保留现有 `src/products/provider-firestore.ts` 和 Firestore 文档结构。

### 9.7 第四阶段：订单管理 React 化

订单最后迁移，因为它依赖：

- Firestore 离线缓存。
- 订单同步。
- 商品/SKU 关联。
- 快递识别。
- 利润计算。
- 多明细订单。

当前状态：已完成。

- 订单页由 `src/react/features/orders/OrdersPage.tsx` 接管。
- 订单表格使用本地 `Table` primitive 和共享 `table-tools` 搜索/分页/滚动外壳。
- 订单弹窗、账号弹窗、导出弹层和数据存储说明弹窗都由 React 渲染。
- 旧 `src/orders/sync.mjs` 已删除，订单同步语义以 React 订单页和 `src/orders/provider-firestore.ts` 为准。

### 9.8 视觉系统收敛二期

当前状态：阶段性完成。

- 新增/完善 shared primitives：`TableToolbar`、`TableSearch`、`TablePager`、`TableViewport`、`TableFrame`、`EmptyState`、`ExportOptions`、`AccountTabsBar`、`Badge`。
- 商品管理和订单管理共享账号标签栏、导出账号选择、表格控制带、空状态和状态 badge。
- `DialogActions` 已进入 Dialog primitive，弹窗底部按钮不再依赖旧 `.actions` / modal CSS。
- 旧 `.btn`、`.modal-*`、`ot-table-*`、`.ot-export-*`、`.ot-acc-*`、`.ot-empty`、`.chip`、`.workspace-chip`、`.calc-tab` 已从运行样式中移除。
- 每个阶段均已运行 `npm test`、`npm run typecheck`、`npm run build`、`git diff --check` 和 `npm run release:check`，Playwright release smoke 通过。
- 后续如果继续优化，优先做功能体验和真实数据验收；不要为了追求零 CSS 行数把合理的 token/global base 也硬迁走。

### 9.9 TypeScript 策略

当前主站应用源码和业务 helper/provider 已迁到 TypeScript，测试发布门禁已加入 `npm run typecheck`。领域类型加固已完成，当前 `src/` 已无显式 `any`；TypeScript 仍暂不追求一步 `strict: true`。

当前配置重点：

```json
{
  "compilerOptions": {
    "strict": false,
    "checkJs": false,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "useUnknownInCatchVariables": true
  }
}
```

已建立并使用的核心类型入口：

- `src/products/types.ts`：商品、SKU、商品 provider、导出和运费快照类型。
- `src/orders/types.ts`：订单、订单明细、订单 provider、摘要和导出类型。
- `src/analytics/types.ts`：分析记录、渠道、诊断、SheetJS 浏览器类型和 ECharts 页面输入类型。
- `src/types/firestore.ts`：Firebase compat 配置、App、Firestore、Collection、Doc 和 Batch 边界类型。
- `src/shipping-core.ts`、`src/global-settings.ts`：运费计算与全局定价设置类型。

`strict: true` 已试跑评估，当前仍会暴露较多深层空值/隐式参数问题，暂不建议一次打开。后续如果继续做，应按模块逐步消化，而不是为了 strict 大范围改业务逻辑。

### 9.10 账号管理抽屉

当前状态：已完成。

账号新增、拖动排序、编辑账号名和删除账号名已接入商品管理、订单管理和数据采集。账号标签上的管理入口只对具体账号显示，“全部”不显示。

- 账号管理入口放在账号标签自身附近，只对具体账号显示，“全部”不显示编辑/删除。
- 编辑账号名时校验非空和不重名。
- 编辑成功后更新统一账号表，并迁移相关业务数据的账号引用：商品 `accountName`、订单 `accountName`、采集记录 `accountName`、采集行里的账号字段和拒绝品去重记录。
- 删除账号名时必须二次确认，确认文案直接说明“不会删除商品、订单或采集记录；这些数据之后只在全部里显示”。
- 删除只删除统一账号标签，不删除、不清空、不迁移任何模块的业务数据，不做级联删除。
- 删除后所有模块中属于该账号的数据都会落到“全部”里，包括商品、订单、数据采集以及未来新增模块的数据；原因是账号标签列表只来自统一账号表，业务数据保留原账号字段但不再生成标签入口。
- 未来新增模块必须复用统一账号表，删除账号名后也只能让数据进入“全部”，不能在模块内私自删除或清空账号数据。
- 删除后广播 `tk-accounts-changed`，当前模块和其他已挂载模块刷新账号列表；如果当前正选中被删除账号，自动回到“全部”。
- 不引入新权限系统，不引入 TanStack Table，不为了账号抽屉重写表格。

实现位置：

- `src/accounts/firestore-account-actions.ts`：共享账号重命名、删除和排序 helper。
- `src/react/components/ui/account-tabs-bar.tsx`：账号标签菜单入口。
- `src/react/components/ui/account-manage-dialogs.tsx`：编辑账号名和删除确认弹窗。
- 商品、订单、数据采集 provider 均暴露 `renameAccount` 和 `deleteAccount`，页面调用同一套账号语义。
- `tests/accounts-management-contract.test.mjs` 覆盖菜单、弹窗、三模块接线、重命名迁移和删除不删业务数据。

### 9.11 测试要求

每一步至少跑：

```bash
npm test
npm run build
git diff --check
```

改数据分析 React 页后还要跑：

```bash
npx playwright test tests/e2e/release.spec.ts -g "covers calculator" --project=desktop-chromium --project=mobile-chromium
```

准备上线前跑：

```bash
npm run release:check
```

## 10. TypeScript 领域类型加固记录

现代化重构主线已完成，类型加固长任务也已完成到当前目标；这部分是完成记录，不再是下一步待办。

目标：

- 已建立核心领域类型，让商品、SKU、订单、订单明细、分析记录和 Firestore 配置有稳定类型入口。
- 已收紧业务 helper/provider 的输入输出，核心 `src/` 代码没有显式 `any`。
- 保持 `strict: false`，没有一口气打开全局 `strict: true`。
- 不改变 Firestore 数据结构，不改变字段名，不做数据迁移。
- 不改计算口径，不改订单利润、退款、达人佣金、商品关联、SKU 匹配和数据分析解析逻辑。
- 不引入新状态管理库，不引入 TanStack Table，不大改 UI。

已新建或整理的类型文件：

```text
src/products/types.ts
src/orders/types.ts
src/analytics/types.ts
src/types/firestore.ts
```

完成阶段：

1. Phase T1：商品类型
   - 定义 `Product`、`ProductSku`、`ProductAccount`、商品导出行等类型。
   - 收紧 `src/products/table.ts`、`src/products/form-utils.ts`、`src/products/export.ts`。
   - provider 先只收紧公开 helper 的输入输出，Firestore 原始 doc 仍可用 `unknown`/宽类型在边界内清洗。

2. Phase T2：订单类型
   - 定义 `Order`、`OrderItem`、`OrderAccount`、`OrderStatus`、订单摘要类型。
   - 收紧 `src/orders/shared.ts`、`src/orders/table.ts`、`src/orders/form-utils.ts`、`src/orders/export.ts`。
   - 订单历史结构清洗函数要继续兼容旧数据，不要为了类型删除兼容逻辑。

3. Phase T3：Firestore provider 边界
   - 定义 Firestore 配置、pull snapshot、push changes、cursor/seq、doc 映射相关类型。
   - 收紧 `src/products/provider-firestore.ts` 和 `src/orders/provider-firestore.ts`。
   - 所有 Firestore doc 进入应用前仍经过归一化/清洗函数。

4. Phase T4：数据分析类型
   - 统一 parser/analyzer 和 React analytics 的 `AnalyticsRecord`、`AnalyticsChannel`、`AnalyticsAnalysis` 类型。
   - 收紧 `src/analytics/parser.ts`、`src/analytics/analyzer.ts`、`src/react/features/analytics/chartOptions.ts`。
   - 保持 Excel 原始文件只在浏览器本地解析，不写入 localStorage 或上传远端；解析后的分析快照写入用户自己的 Firestore。

5. Phase T5：UI 页面接线类型
   - 让 `ProductsPage.tsx`、`OrdersPage.tsx`、`CalculatorApp.tsx` 使用领域类型。
   - 保留局部 UI 草稿类型，不要为了类型抽象过度复杂化页面状态。

6. Phase T6：逐步收紧 tsconfig
   - 已打开 `noImplicitReturns`、`noFallthroughCasesInSwitch`、`useUnknownInCatchVariables`。
   - 已评估 `strict: true`，当前错误量仍不适合一次开启。

每个阶段完成后至少运行：

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

大阶段完成后运行：

```bash
npm run release:check
```

执行结果：

- T1-T5 已分别完成本地提交；T6 收尾提交完成后仍不推 GitHub。
- 每阶段均已跑 `npm test`、`npm run typecheck`、`npm run build`、`git diff --check`。
- 最终大阶段需要重新跑 `npm run release:check` 作为当前交付门禁。

### 9.12 完成标准

第一阶段完成标准：

- 项目能安装 React/TS/Tailwind 依赖。
- Vite build 通过。
- 旧页面功能不变。
- 存在 React 局部挂载，可独立挂载。

数据分析 React 化完成标准：

- 真实 Excel 可导入。
- ECharts 图表无明显重叠、tooltip 可读。
- 数据仍只在浏览器内解析。
- e2e 覆盖数据分析导入和图表渲染。
- 旧手写复杂图表逻辑可删除或停止加载。

当前数据分析 React 化状态：

- 自动测试、构建、smoke 和关键浏览器 e2e 已通过。
- 已用按需加载避免 ECharts 进入首页首包；当前 ECharts vendor chunk 约 532 kB，gzip 约 178 kB，只在数据分析页加载。
- 仍建议用户用真实 TikTok Shop 商品流量 Excel 再看一次移动端布局和 tooltip 体验；如果没有明显问题，就可以进入商品管理 React 化。

## 10. 当前执行阶段细化

### Phase 0：确认工作区

目标：避免覆盖用户改动，确认当前未提交内容。

执行：

```bash
git status --short
npm test
npm run build
git diff --check
```

验收：

- 能看到当前未提交文件。
- 构建通过。
- 测试通过。
- 没有空白错误。

### Phase 1：撤掉 Supabase 活跃路径

目标：项目正式回到 Firebase-only。

当前状态：已完成。

历史改动范围：

- `index.html`
- 旧 `js/orders/index.js`
- 旧 `js/orders/provider-supabase.js`
- 旧 `js/data-sources/registry.js`
- `tests/data-source-registry.test.mjs`
- `README.md`
- `PROJECT_HANDOFF.md`

具体动作：

1. 从 `index.html` 删除：

```html
<script src="js/orders/provider-supabase.js" defer></script>
```

2. 从 `js/orders/index.js` 删除或停用：

```js
const providerSupabase = ...
```

以及 `getProviderByMode(mode)` 中的 Supabase 分支。

3. `getProviderByMode(mode)` 只保留：

```js
if (mode === 'firestore') return providerFirestore;
return null;
```

4. 从旧 Supabase provider 处理注册逻辑。

推荐做法：

- 不在活跃路径加载这个文件。
- 如果文件保留，不影响运行。
- 不让测试要求它注册。

5. 更新 `tests/data-source-registry.test.mjs`：

- 删除 Supabase 加载断言。
- 删除 Supabase 注册断言。
- 保留 Firestore 和 analytics browser-excel 注册断言。

6. 更新 README：

- 当前数据源策略写成 Firebase-only。
- Supabase 不写成当前功能。
- 如需提，只写“暂不启用”或“不作为正式方向”。

验收命令：

```bash
npm test
npm run build
git diff --check
```

验收标准：

- 页面不加载 Supabase provider。
- 注册表不要求 Supabase。
- Supabase 实验文件不自动注册到正式数据源注册表。
- 订单、商品仍能走 Firestore。
- 测试通过。
- 构建通过。

风险：

- 一些测试可能写死脚本顺序，需要同步更新测试契约。
- 不要误删 Firestore provider。
- 不要改动订单同步核心。

### Phase 2：轻模块化第一步，新增全局配置

目标：先把不会影响业务行为的常量沉淀出来。

当前状态：已完成。

建议新增：

```text
js/app-config.js
tests/app-config.test.mjs
```

建议内容：

```js
const TKAppConfig = {
  docsUrl: 'https://tk-evu-docs.pages.dev/',
  dataPolicy: {
    officialSource: 'firestore',
    storesUserBusinessData: false,
    analyticsPersistence: 'memory-only'
  },
  modules: [
    { key: 'calc', label: '利润计算器' },
    { key: 'products', label: '商品管理' },
    { key: 'orders', label: '订单管理' },
    { key: 'analytics', label: '数据分析' }
  ]
};
```

加载顺序建议：

```html
<script src="js/app-config.js" defer></script>
<script src="js/app.js" defer></script>
```

第一步不要把导航改成 JS 动态渲染。只允许：

- `app.js` 使用 `TKAppConfig.modules` 校验模块。
- 文档链接可继续写死，或者读取配置但必须保证页面无 JS 时基本可读。

验收：

```bash
node tests/app-config.test.mjs
npm test
npm run build
```

风险：

- `app.js` 当前很简单，不要为了配置化重写路由。
- 保持 hash 路由行为不变。

### Phase 3：轻模块化第二步，整理数据源注册表

目标：注册表只表达当前正式数据源和本地分析源。

保留：

```text
orders/firestore
products/firestore
analytics/browser-excel
```

不保留：

```text
orders/supabase
products/supabase
```

建议 `js/data-sources/registry.js` 的职责：

- 注册 provider 元信息。
- 按 domain/key 查询 provider。
- 列出 domain 下 provider。
- 记录数据边界字段：
  - `ownership: 'user-owned'`
  - `storesUserData: false`
  - `localFirst: true`
  - `offline: 'firestore-persistence' | 'memory-only'`

不应该做：

- 不连接 Firebase。
- 不读写订单。
- 不保存用户配置。
- 不负责 UI。

验收：

```bash
node tests/data-source-registry.test.mjs
npm test
```

### Phase 4：轻模块化第三步，拆数据分析纯函数

目标：把 `js/analytics/index.js` 里纯函数拆出来，让数据分析更容易维护。

当前状态：已完成。

建议拆分：

```text
js/analytics/parser.js
js/analytics/analyzer.js
js/analytics/index.js
```

职责：

- `parser.js`
  - `normalizeNumber`
  - `normalizePercent`
  - `parseRows`
  - `normalizeRecord`
- `analyzer.js`
  - `buildChannelTotals`
  - `diagnoseProduct`
  - `analyze`
- `index.js`
  - DOM 绑定
  - 文件选择
  - SheetJS 调用
  - render 函数

普通脚本加载顺序：

```html
<script src="js/analytics/parser.js" defer></script>
<script src="js/analytics/analyzer.js" defer></script>
<script src="js/analytics/index.js" defer></script>
```

全局命名建议：

```js
const TKAnalyticsParser = ...
const TKAnalyticsAnalyzer = ...
const TKAnalytics = ...
```

测试调整：

- `tests/analytics-module.test.mjs` 改成分别读取三个文件。
- 继续验证：
  - Excel 行解析。
  - 日元/百分比清洗。
  - 渠道 GMV 汇总。
  - 诊断标签。
  - 不出现 `fetch`、`XMLHttpRequest`、`sendBeacon`、`firebase`、`Firestore`、`localStorage.setItem`。

验收：

```bash
node tests/analytics-module.test.mjs
npm test
npm run build
```

风险：

- 加载顺序必须在 `index.js` 前。
- 不要把 DOM 渲染混入 parser/analyzer。
- 不要引入构建期 import/export，保持当前普通脚本路线。

### Phase 5：轻模块化第四步，抽公共纯函数

目标：减少重复，但不碰最复杂业务流程。

当前状态：已完成第一批，已新增 `js/shared/html.js` 和 `js/shared/format.js`，并让数据分析渲染层使用。

候选新增：

```text
js/shared/format.js
js/shared/html.js
js/shared/firebase-config.js
```

可抽：

- `escapeHtml`
- `formatInteger`
- `formatYen`
- `normalizeNumber`
- Firebase config 解析
- 安全 JSON/宽松对象解析

不要先抽：

- 订单同步合并。
- Firestore 批量写入。
- 订单 CRUD DOM 逻辑。
- 商品 SKU 弹窗复杂交互。

验收：

```bash
npm test
npm run build
```

风险：

- 多个模块各自有细微差异，不要强行抽成一个函数导致行为变化。
- 先抽完全一致的纯函数。
- 每抽一个公共函数，就加一个测试。

### Phase 6：订单/商品模块轻整理

当前状态：已完成。

已完成：

- 新增 `js/products/accounts.js`，负责商品账号汇总、账号 Tabs、弹窗账号下拉。
- 新增 `js/products/export.js`，负责商品 CSV 账号选择弹层、导出行生成、CSV 下载。
- 新增 `js/products/form-utils.js`，负责商品弹窗尺寸解析、批量 SKU 草稿生成、SKU 名称匹配、商品/SKU 物流参数判断和预估运费快照等纯函数。
- 新增 `tests/products-form-utils-module.test.mjs`，覆盖商品 SKU 表单纯函数模块、CRUD 接入和 `index.html` 加载顺序。
- `js/products/index.js` 从约 650 行降到约 350 行，目前只保留连接、加载、主渲染、事件编排。
- `js/products/crud.js` 曾移除 SKU 表单纯函数内联实现，改为通过 `ProductLibraryFormUtils` 调用；在 modern React SPA 分支里，旧商品 CRUD runtime 已被删除，React 商品页直接 import `src/products/form-utils.ts`。
- 新增 `js/orders/products.js`，负责订单弹窗读取商品资料、按账号筛商品、按 TK ID 查商品、Firestore 配置变化时清理商品缓存。
- `js/orders/index.js` 从约 570 行降到约 515 行，产品桥接逻辑不再内联在入口文件。
- 新增 `js/orders/form-utils.js`，负责订单弹窗商品/SKU 标签、商品默认参数合并、订单明细草稿归一化、旧版订单明细恢复、金额/尺寸解析等纯函数。
- 新增 `tests/orders-form-utils-module.test.mjs`，覆盖订单表单纯函数模块、CRUD 接入和 `index.html` 加载顺序。
- `js/orders/crud.js` 已移除上述纯函数内联实现，改为通过 `OrderTrackerFormUtils` 调用。
- `index.html` 已调整加载顺序：先加载 `js/products/provider-firestore.js`，在 `js/products/crud.js` 前加载 `js/products/form-utils.js`，并在 `js/orders/crud.js` 前加载 `js/orders/form-utils.js`，再加载 `js/orders/products.js` 和 `js/orders/index.js`，保证商品/订单页面刷新时表单工具和商品桥接可用。
- 未改 `js/products/provider-firestore.js` 数据结构。
- 未改 `js/orders/sync.js`。
- 未改 Firebase 离线优先保存策略。

目标：保持功能不变，降低文件复杂度。

订单优先顺序：

1. 保持 `orders/sync.js` 不大改。已完成。
2. 先整理 `orders/index.js` 的 provider 选择和产品读取桥接。已完成商品读取桥接拆分，provider 选择仍保持当前简单 Firestore-only 逻辑。
3. 再整理 `orders/crud.js` 中和 Firebase 无关的表单纯逻辑。已完成，新增 `js/orders/form-utils.js` 和测试。

商品优先顺序：

1. 保持 `products/provider-firestore.js` 数据结构不变。已完成。
2. 先整理 `products/index.js` 的连接状态和渲染入口。已拆出账号和导出模块。
3. 再整理 SKU 表单纯函数。已完成，新增 `js/products/form-utils.js` 和测试。

验收：

```bash
for f in tests/orders-*.test.mjs; do node "$f" || exit 1; done
npm test
npm run build
git diff --check
```

当前已验证通过：

```bash
for f in tests/orders-*.test.mjs; do node "$f" || exit 1; done
npm test
npm run build
git diff --check
```

风险：

- 订单同步曾经修过快递单号输入框焦点/消失问题，不能回退。
- Firestore 离线缓存流程不能破坏。
- 保存时不应等待云端提交，保持本地快。

### Phase 7：文档补齐

目标：让用户和后续开发者都知道怎么用。

当前状态：已完成。

已更新：

- `README.md`
- `PROJECT_HANDOFF.md`
- `docs/guide/database.md`
- `docs/guide/orders.md`
- `docs/guide/products.md`
- `docs/guide/overview.md`
- `docs/guide/analytics.md`
- `docs/guide/deploy.md`
- `docs/guide/faq.md`
- `docs/index.md`
- `docs/.vitepress/config.mjs`

重点写清：

- Firebase-only。
- 用户数据在用户自己的 Firebase。
- Excel 本地解析。
- Cloudflare 只部署静态站。
- 主站本地开发命令。
- Cloudflare Pages 构建配置。
- 发布前检查、GitHub Actions 门禁和部署后验收。
- 数据分析指标、诊断标签和不上传 Excel 的边界。

正规网站基础项：

- 新增 `public/privacy.html`，说明隐私与数据边界。
- 新增 `public/terms.html`，说明工具使用条款、免责声明和第三方服务边界。
- 新增 `public/404.html`。
- 新增 `public/robots.txt`。
- 新增 `public/sitemap.xml`。
- 新增 `public/manifest.webmanifest`。
- 新增 `public/site-page.css`，让隐私页、使用条款页和 404 复用同一套静态页样式。
- 新增 `public/_headers`，用于 Cloudflare Pages 基础安全响应头、静态资源缓存、搜索引擎文件类型和 manifest 类型。
- 主站 `<head>` 新增 canonical、Open Graph、Twitter Card、`theme-color` 和 manifest 链接；隐私页、使用条款页也新增 canonical、robots、Open Graph、Twitter Card、`theme-color` 和 manifest 链接。
- 404 页面新增 description、noindex、`theme-color`、manifest 和公共静态页样式；`sitemap.xml` 已包含首页、隐私页、使用条款页和 `lastmod`。
- 主站页脚新增 `隐私与数据边界`、`使用条款` 和 `数据库说明` 入口。
- 主站新增跳转主内容链接、`main` landmark 和导航 `aria-current` 同步，保证 hash 路由下键盘导航和当前模块语义不回退。
- `tests/main-build-contract.test.mjs` 已覆盖隐私页、使用条款页、404、robots、sitemap、manifest、SEO meta、Cloudflare headers、页脚入口、主内容 landmark、跳转主内容链接和导航当前项语义。
- 新增 `tests/site-release-contract.test.mjs`，防止 Phase 7 文档、数据边界说明和正规网站基础项回退。
- 新增 `scripts/preview-smoke.mjs` 和 `npm run smoke`，构建后实际启动 Vite preview 检查核心静态路径和构建产物。
- 新增 `playwright.config.mjs`、`tests/e2e/release.spec.ts` 和 `npm run e2e`，基于 production preview 用离线 Firebase / Excel fixtures 在桌面和移动 Chromium 上覆盖浏览器级主流程。
- 新增 `scripts/release-check.sh` 和 `npm run release:check`，把单测、TypeScript 类型检查、文档构建、主站构建、HTTP smoke、浏览器 e2e 和 diff 检查串成发布门禁。
- 新增 `.github/workflows/release-check.yml`，push 到 `main` 或 PR 时自动安装主站/docs 依赖、安装 Playwright Chromium 并运行 `npm run release:check`。
- 新增 `docs/guide/deploy.md`，把 Cloudflare Pages 主站/文档站配置、发布前检查、CI 门禁、部署后验收和数据边界集中成独立文档页。

验收：

```bash
npm run release:check
```

当前已验证通过：

```bash
npm run release:check
./scripts/docs-build.sh
npm test
npm run build
npm run smoke
npm run e2e
git diff --check
test -f dist/privacy.html && test -f dist/terms.html && test -f dist/404.html && test -f dist/robots.txt && test -f dist/sitemap.xml && test -f dist/manifest.webmanifest && test -f dist/_headers
```

最近一次本地继续优化后已再次验证通过：

```bash
npm run release:check
```

提交状态：

```text
本地已有提交：release: prepare tk toolbox static site（基线提交，hash 以 `git log --oneline --decorate` 为准）
当前分支状态：main...origin/main [ahead 本地提交数]
本地保护分支：local/release-prep-static-site（基线保护分支，后续本地继续优化可按需快进）
```

注意：这个提交只在本地，不要直接 `git push`，否则会触发 GitHub / Cloudflare Pages 线上部署。当前本机已加 `.git/hooks/pre-push` 防护，普通 `git push` 会被阻止；只有明确要上线时才使用 `TK_ALLOW_PUSH=1 git push`。

## 11. 文件地图

### 主站入口

```text
index.html
src/react/main.tsx
src/react/styles.css
src/react/styles/
public/
```

### 构建

```text
package.json
package-lock.json
vite.config.mjs
wrangler.toml
playwright.config.mjs
scripts/copy-main-assets.mjs
scripts/preview-smoke.mjs
scripts/release-check.sh
.github/workflows/release-check.yml
```

### 数据源

```text
js/data-sources/registry.js
src/firestore-connection.ts
js/orders/provider-firestore.js
js/products/provider-firestore.js
```

### 订单

```text
js/orders/index.js
js/orders/session.js
js/orders/tabs.js
js/orders/export.js
js/orders/shared.js
src/orders/firestore-rules.ts
src/orders/form-utils.ts
src/orders/table.ts
```

### 商品

```text
js/products/index.js
js/products/provider-firestore.js
js/products/accounts.js
js/products/form-utils.js
js/products/table.js
src/products/export.ts
```

### 数据分析

```text
js/analytics/parser.js
js/analytics/analyzer.js
js/analytics/index.js
```

### 站点基础

```text
public/privacy.html
public/terms.html
public/404.html
public/robots.txt
public/sitemap.xml
public/manifest.webmanifest
public/site-page.css
public/_headers
```

### 测试

```text
tests/*.test.mjs
```

### 文档

```text
README.md
PROJECT_HANDOFF.md
docs/
docs/guide/deploy.md
```

## 12. 测试策略

当前项目主要是 Node 静态契约测试和纯函数测试。

常用命令：

```bash
npm test
```

单测举例：

```bash
node tests/analytics-module.test.mjs
node tests/data-source-registry.test.mjs
node tests/main-build-contract.test.mjs
node tests/products-view-ui.test.mjs
node tests/orders-session-module.test.mjs
```

构建验证：

```bash
npm run build
```

补丁检查：

```bash
git diff --check
```

每个阶段至少跑：

```bash
npm run release:check
```

如果改文档站，再跑：

```bash
./scripts/docs-build.sh
```

## 13. 验收标准

阶段性工作完成必须满足：

- `npm test` 通过。
- `npm run build` 通过。
- `npm run smoke` 通过。
- `git diff --check` 无输出。
- `git status --short` 中没有用户数据文件。
- `dist/` 和 `node_modules/` 仍被忽略。
- 页面入口符合 ESM 加载契约，`index.html` 不再列本地旧 `js/*.js` 普通脚本。
- 构建产物包含稳定 `/logo.png`，不包含旧 `dist/js/`。
- Firebase Firestore 是唯一正式远端数据源。
- README 和本文件同步更新。

### 13.1 当前真实数据手动验收清单

自动测试已覆盖离线 fixtures 和 production preview。用户已用真实 Firebase 配置完成一轮手动验收，未发现大问题。已覆盖：

- 本地启动：`npm run dev`，打开 Vite 提供的本地地址。
- 商品管理：连接 Firestore，新增商品，新增/编辑 SKU，刷新页面后确认仍能读回。
- 订单管理：新增订单，选择商品/SKU，检查采购价、销售价、利润字段和状态自动填充。
- 订单编辑：修改物流公司、物流单号、状态和利润相关字段，保存后刷新确认读回。
- 同步状态：断网/恢复网络或刷新页面时，确认没有明显卡死、重复写入或错误弹窗。
- 数据分析：导入一份 TikTok Shop 商品流量 Excel，确认渠道表现、Top 商品、漏斗和诊断标签能正常生成。
- 静态页：打开 `/privacy.html`、`/terms.html`、`/404.html`，确认样式和链接正常。

当前完整 React SPA 重构主线已完成。后续开发不再恢复旧 DOM/全局脚本双入口，优先做真实数据验收、类型收紧、UI 细节和功能体验优化。

## 14. 风险清单

### 14.1 ESM 入口加载顺序

风险：

- 新 ESM import 顺序变化可能导致全局兼容挂载缺失。
- provider 必须在业务入口初始化前完成注册。
- shared/table/crud/session 的依赖关系不能随便改。

处理：

- 改 `index.html` 后必须跑 `npm test`。
- 如果测试写死顺序，优先判断是测试需要更新还是加载顺序真的错了。

### 14.2 Firestore 离线缓存

订单/商品依赖 Firebase SDK 离线缓存。

风险：

- 保存逻辑如果等待云端，会变慢。
- 如果改 provider 写入方式，可能让快递单号等字段再次出现保存后消失。

处理：

- 不轻易改 `provider-firestore.js` 写入路径。
- 不轻易改订单同步语义；当前运行链路在 React 订单页和 `src/orders/provider-firestore.ts`。
- 改订单保存后要重点测试新增/编辑订单、快递公司、快递单号输入。

### 14.3 Supabase 遗留代码

当前 `modern-react-spa` 分支已无旧 `js/orders/provider-supabase.js` 活跃文件或加载路径。

风险：

- 误加载会让项目方向不清晰。
- 测试可能仍要求它注册。

处理：

- Phase 1 先从活跃路径撤掉。
- 不恢复 Supabase 活跃路径。
- 文档只写 Firebase-only。

### 14.4 数据分析隐私

Excel 必须本地解析。

风险：

- 后续增加导出/保存功能时误写入 Firestore 或远端。

处理：

- 测试继续禁止 `fetch`、`XMLHttpRequest`、`sendBeacon`、`firebase`、`Firestore`、`localStorage.setItem` 出现在 analytics 模块。

### 14.5 React SPA 后续收敛

风险：

- 一次改太多，测试难定位。
- Tailwind/shadcn 全局样式可能影响现有原生 CSS。
- 数据分析迁移时误引入上传、缓存或远端保存逻辑。
- 商品/订单改动可能碰到 Firestore 离线缓存和同步副作用。

处理：

- 当前全站入口已是 React SPA，不恢复旧 DOM/全局脚本双入口。
- Tailwind 样式、primitives 和 `src/react/styles/` 基础样式要重点检查。
- 视觉系统后续优化优先复用现有 primitives；每一步跑相关测试，大阶段跑 `npm run release:check`。
- ECharts 只在数据分析页使用。
- 商品/订单保持现有 React + TypeScript 运行链路。
- 每一步跑 `npm test`、`npm run typecheck`、`npm run build` 和相关 e2e。

## 15. 中断恢复流程

如果对话中断、新对话接手，按顺序执行：

1. 读本文件。
2. 读 `README.md`。
3. 看状态：

```bash
git status --short
```

4. 跑验证：

```bash
npm run release:check
```

5. 如果测试失败，先看最近改了哪些文件：

```bash
git diff --stat
```

6. 不要回滚用户改动。
7. 优先修复当前问题或做小步优化，不再启动无目标的大重构。

## 16. 本地提交状态

当前 `modern-react-spa` 分支已有本地提交记录；不要直接推 GitHub，除非用户明确确认上线或合并。

最近关键本地提交包括：

```text
e16f39e test: migrate contract tests to esm
6715c70 refactor: migrate app modules to typescript
```

继续修改时保持小步提交，每次提交前至少跑相关测试；准备合并或上线前跑完整 `npm run release:check`。

## 17. 推荐下一步

当前现代化重构主线已完成：完整 Vite React SPA、TypeScript/TSX 业务源码、ESM 测试、Tailwind/shadcn 风格 primitives、ECharts 数据分析、旧 `js/`/`css/style.css` 清理、发布检查和 Playwright smoke 都已通过验证。

建议下一步：

1. 准备上线、合并或推送前重新跑 `npm run release:check`，确认文档、构建、smoke 和 e2e 仍全部通过。
2. 用真实商品、订单和 TikTok Shop 商品流量 Excel 再做一轮手动验收，重点看 Firestore 读写、订单商品关联、ECharts tooltip、移动端布局和商品明细表。
3. 如果要继续开长任务，优先做真实业务验收反馈、可访问性/移动端细节或局部 strict 类型消化；不要为了形式继续大拆架构。
4. 不改变 Firestore 数据结构，不上传或保存 Excel，不引入平台方数据库。
5. GitHub 推送仍受当前网络影响；如需推送，换网络/VPN 后执行 `TK_ALLOW_PUSH=1 git -c http.version=HTTP/1.1 push origin HEAD:main`。
