# TK 项目交接与优化规划

这个文件是当前项目的“接手说明 + 后续规划”。如果更换对话、换 API base_url、换账号、上下文丢失，新的对话先读这个文件，再看 `README.md`、`git status --short`、相关测试文件，就可以继续工作。

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
- 数据分析
- VitePress 文档站
- TK 运营文档

项目长期方向是：

- 工具站提供页面、计算、分析和本地交互能力。
- 用户业务数据只进入用户自己的 Firebase Firestore。
- 本站、Cloudflare Pages、未来可能的 Workers 都不保存用户业务数据。
- 先保持当前原生 JS 体系稳定，再逐步轻模块化。

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

### 2.2 先轻模块化

暂时不要做完整 React/TypeScript 迁移。

此前阶段策略：

- 保持普通 JS。
- 保持 `<script defer>` 加载方式。
- 保持 Vite 构建。
- 不强制把所有文件改成 ES Module。
- 先拆纯函数、配置、provider 元信息、解析逻辑。
- 每次只改一小块，测试通过后再继续。

当前状态：该轻模块化策略已经进入路线二标准 ESM 模块化收尾阶段；主页面加载链已切到 `/src/*.mjs`，但仍然不做 React/TypeScript 大迁移。

暂不做：

- 全量 TypeScript。
- 全量 React/Vue 重写。
- 大规模文件移动。
- 重写订单同步核心。
- 重写 Firebase 数据结构。

### 2.3 不保存用户数据

任何新增功能都必须遵守：

- 订单数据写入用户自己的 Firebase Firestore。
- 商品数据写入用户自己的 Firebase Firestore。
- 数据分析 Excel 只在浏览器本地解析，不上传，不持久化。
- Cloudflare 只托管静态资源。
- 本地工具参数可以保存在用户浏览器 `localStorage`。
- 不增加平台方数据库来保存用户商品、订单、Excel。

## 3. 当前仓库状态

当前工作区有一批未提交改动。

已完成但未提交：

- 数据分析模块：
  - `js/analytics/index.js`
  - `tests/analytics-module.test.js`
- 项目级配置：
  - `js/app-config.js`
  - `tests/app-config.test.js`
- 首页接入数据分析：
  - `index.html`
  - `js/app.js`
  - `css/style.css`
- 主站 Vite 构建：
  - `package.json`
  - `package-lock.json`
  - `vite.config.mjs`
  - `wrangler.toml`
  - `scripts/copy-main-assets.mjs`
  - `tests/main-build-contract.test.js`
- 数据源注册表基础：
  - `js/data-sources/registry.js`
  - `tests/data-source-registry.test.js`
- README 更新：
  - `README.md`
- 忽略规则更新：
  - `.gitignore`

当前曾验证通过：

```bash
npm run build
npm test
git diff --check
```

接手时需要重新跑一遍，因为后续可能有新改动。

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

主站已经接入 Vite，页面入口已经切到 `/src/*.mjs` ESM 模块。旧 `js/` 目录只作为历史参考和对照保留，不再由 `index.html` 加载，也不再复制到构建产物。

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

这里分成三档路线。当前要执行的是第一档“轻模块化”；第二档和第三档先写入规划，暂不直接开工。

### 三档路线对比

| 档位 | 周期估计 | 技术路线 | 当前是否执行 | 风险 | 收益 |
| --- | --- | --- | --- | --- | --- |
| 轻模块化 | 1-2 天 | 原生 JS + `<script defer>` + Vite 构建 | 立即执行 | 低 | 降低单文件压力，保持现有稳定性 |
| 标准模块化 | 3-5 天 | Vite 原生 ES Modules + `import/export` | 暂不执行 | 中 | 依赖关系清晰，减少全局变量 |
| TypeScript 化 | 1-2 周 | ES Modules + TypeScript 类型系统 | 暂不执行 | 高 | 长期可维护性最好，数据结构更稳 |

当前原则：

- 先完成轻模块化。
- 轻模块化完成且线上稳定后，再评估标准模块化。
- 标准模块化稳定后，再考虑 TypeScript。
- 不跳级，不一次性大迁移。

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
tests/app-config.test.js
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

不要一次把所有 `js/` 删除。

### 8.4 迁移顺序

#### M1：迁移纯工具

当前状态：本地进行中，第一步已完成并通过验证。

先迁移：

- `shared/html`
- `shared/format`
- `shared/firebase-config`
- analytics parser/analyzer

这些没有 DOM 或副作用，风险最低。

已完成：

- 新增 `src/shared/html.mjs`，提供 `TKHtml`、`escape`、`shorten` 的 ESM 导出。
- 新增 `src/shared/format.mjs`，提供 `TKFormat`、`integer`、`yen`、`percent` 的 ESM 导出。
- 新增 `src/analytics/parser.mjs`，提供 `TKAnalyticsParser` 和解析纯函数 ESM 导出。
- 新增 `src/analytics/analyzer.mjs`，通过 `import { CHANNELS } from './parser.mjs'` 读取 parser 元信息，并提供 `TKAnalyticsAnalyzer` 和分析纯函数 ESM 导出。
- `tests/shared-utils.test.js` 和 `tests/analytics-module.test.js` 已新增动态 `import()` 断言，确认 M1 模块可被 Node 直接作为 ESM 导入。
- 旧 `js/` 浏览器脚本链暂未替换，页面仍走原有 `<script defer>` 和 `window.Xxx` 全局兼容路径。

当前已验证通过：

```bash
node tests/shared-utils.test.js
node tests/analytics-module.test.js
npm run release:check
```

#### M2：迁移数据分析

当前状态：已完成。

数据分析相对独立。

迁移：

- `analytics/parser`
- `analytics/analyzer`
- `analytics/index`

然后让 `src/main.js` 挂载：

```js
window.TKAnalytics = TKAnalytics;
```

过渡期可继续提供全局对象，避免 `app.js` 一次大改。

已完成：

- 新增 `src/analytics/index.mjs`，通过 ESM `import` 接入 `parser`、`analyzer`、共享 HTML 和格式化工具。
- `src/analytics/index.mjs` 导出 `createAnalyticsModule`、`TKAnalytics` 和 `registerAnalyticsProvider`。
- 浏览器中自动挂载 `window.TKAnalytics`，并兼容旧的 `TKDataSourceRegistry` 注册方式。
- `index.html` 已把数据分析的三段旧普通脚本替换为 `<script type="module" src="/src/analytics/index.mjs"></script>`。
- 旧 `js/analytics/*.js` 暂时保留，作为兼容参考和回退点，不再由主页面加载。
- Vite 构建已开始打包数据分析 ESM 入口；构建提示里不再包含 `js/analytics/parser.js`、`js/analytics/analyzer.js`、`js/analytics/index.js`。
- `tests/analytics-module.test.js` 和 `tests/main-build-contract.test.js` 已覆盖数据分析 ESM 入口、provider 注册和“不上传/不持久化 Excel”的边界。

当前已验证通过：

```bash
node tests/analytics-module.test.js
node tests/main-build-contract.test.js
npm run e2e
npm run release:check
```

#### M3：迁移利润计算器

当前状态：已完成利润计算器 ESM 入口切换。`index.html` 现在通过 `/src/calc/index.mjs` 加载利润计算器；旧 `js/calc/*.js` 文件暂时保留为历史参考和回退，不再进入主页面加载链。

利润计算器数据依赖较少，适合第二批。

迁移时保持：

- DOM id 不变。
- 计算公式不变。
- 测试先行。

已完成：

- 新增 `src/calc/shared.mjs`，提供 `CalcShared` 和 `create` 的 ESM 导出。
- `src/calc/shared.mjs` 保持旧 `js/calc/shared.js` 的存储迁移、折扣解析、金额/重量格式化、小数符号归一化和输入行为 helper。
- `tests/calc-module-split.test.js` 已新增动态 `import()` 断言，确认 calc shared ESM 模块可被 Node 直接导入。
- 新增 `src/shipping-core.mjs`，提供 `TKShippingCore`、`SHIPPING_RULES`、`DEFAULT_CONSTANTS`、`getShippingBand`、`computeShippingQuote` 和 `computeCalculatedShippingCost` 的 ESM 导出。
- `tests/shipping-core-module.test.js` 已新增动态 `import()` 断言，确认共享运费核心 ESM 模块和旧全局模块输出一致。
- 新增 `src/calc/shipping.mjs`，通过 `import { TKShippingCore } from '../shipping-core.mjs'` 复用共享运费核心，并保留旧 `CalcShipping.create` 的返回接口。
- `tests/calc-shipping-quote.test.js` 已新增动态 `import()` 断言，确认 calc shipping ESM 模块能计算 quote、最终人民币运费、回填计算运费和安全处理缺失 DOM 容器。
- 新增 `src/calc/formulas.mjs`，提供旧定价、定价新和利润复盘的纯公式导出：`calcLegacyRow`、`deriveLegacyOrigPrice`、`calcPricingRow`、`derivePricingOrigPrice`、`calcSalePrice`。
- `tests/calc-formulas.test.js` 已新增动态 `import()` 断言，用旧 `CalcLegacyPricing` / `CalcPricing` 的结果对照 ESM 公式输出。
- 新增 `src/calc/legacy.mjs`，提供 `CalcLegacyPricing` 和 `create` 的 ESM 导出，并通过 `src/calc/formulas.mjs` 复用旧定价行计算和原价反推公式。
- `tests/calc-formulas.test.js` 已覆盖 legacy ESM 壳层和旧 `CalcLegacyPricing` 的计算结果一致。
- 新增 `src/calc/pricing.mjs`，提供 `CalcPricing` 和 `create` 的 ESM 导出，并通过 `src/calc/formulas.mjs` 复用定价新和利润复盘公式。
- `tests/calc-formulas.test.js` 已覆盖 pricing ESM 壳层和旧 `CalcPricing` 的公式输出一致；`tests/calc-pricing-sync.test.js` 已覆盖 pricing ESM 壳层的定价新/利润复盘采购价双向同步。
- 新增 `src/global-settings.mjs`，提供全局设置的 ESM 导出，并保持从旧利润计算器存储迁移汇率。
- 新增 `src/calc/index.mjs`，通过 `import` 串起 `TKGlobalSettings`、`CalcShared`、`CalcShipping`、`CalcLegacyPricing` 和 `CalcPricing`。
- `index.html` 已移除旧 `js/calc/shared.js`、`js/calc/shipping.js`、`js/calc/legacy.js`、`js/calc/pricing.js`、`js/calc/index.js` 的页面加载，改为 `<script type="module" src="/src/calc/index.mjs"></script>`。
- `src/global-settings.mjs` 已在浏览器里挂回 `window.TKGlobalSettings` 并初始化 `window.__tkGlobalSettingsStore`。
- `src/shipping-core.mjs` 已在浏览器里挂回 `window.TKShippingCore`。
- `src/shared/html.mjs` 和 `src/shared/format.mjs` 已在浏览器里挂回 `window.TKHtml`、`window.TKFormat`。
- `src/main.mjs` 已统一导入 `global-settings`、`shipping-core`、`shared/html`、`shared/format`、`table-controls`、`searchable-select`、`data-sources/registry` 这些基础 ESM。
- `index.html` 已移除旧 `js/global-settings.js`、`js/shipping-core.js`、`js/shared/html.js`、`js/shared/format.js` 页面加载；旧文件暂时保留为历史参考和回退。

当前已验证通过：

```bash
node tests/global-settings-module.test.js
node tests/calc-module-split.test.js
node tests/calc-formulas.test.js
node tests/calc-pricing-sync.test.js
node tests/calc-shipping-quote.test.js
node tests/shipping-core-module.test.js
npm run release:check
```

下一步：

- 进入 M4 商品管理迁移。
- 暂时不要删除旧 `js/calc/*.js`，等商品/订单依赖边界更清楚且线上稳定后再统一清理。

#### M4：迁移商品管理

商品管理依赖 Firestore 和 SKU UI。

当前状态：已完成商品管理 ESM 入口切换。`index.html` 现在通过 `/src/products/index.mjs` 加载商品管理入口；旧 `js/products/index.js` 文件暂时保留为历史参考和回退，不再进入主页面加载链。

迁移顺序：

- table
- crud 纯函数
- provider
- index

已完成：

- 新增 `src/products/table.mjs`，提供商品表格筛选、排序、SKU 默认值合并、SKU 标签/尺寸/运费格式化、表格渲染壳等 ESM 导出。
- `src/products/table.mjs` 已在浏览器里挂回 `window.ProductLibraryTableView`，供过渡期兼容。
- `tests/products-view-ui.test.js` 已新增动态 `import()` 断言，确认商品表格 ESM 纯函数和旧 `ProductLibraryTableView.deriveDisplayedProducts` 排序结果一致，并覆盖 ESM 渲染壳存在。
- 新增 `src/products/accounts.mjs`，提供商品账号归并、账号槽、账号下拉和账号标签渲染的 ESM 导出，并在浏览器里挂回 `window.ProductLibraryAccounts`。
- 新增 `src/products/form-utils.mjs`，提供商品 CRUD/SKU 弹窗的尺寸解析、批量 SKU 草稿、SKU 名称匹配、运费快照、SKU 默认值判断等纯函数 ESM 导出。
- `tests/products-form-utils-module.test.js` 已新增动态 `import()` 断言，确认商品 CRUD 纯函数 ESM 输出和旧 `ProductLibraryFormUtils` 一致。
- `src/products/form-utils.mjs` 已在浏览器里挂回 `window.ProductLibraryFormUtils`，旧文件暂时保留为历史参考和回退。
- `index.html` 已移除旧 `js/products/form-utils.js` 页面加载；旧文件暂时保留为历史参考和回退。
- 新增 `src/products/provider-firestore.mjs`，提供商品 Firestore provider 的配置解析、展示名、商品/SKU 归一化、Firestore 写入 doc 构造、`create/init/pullProducts/upsertProduct/deleteProduct` 的 ESM 导出。
- `tests/products-provider-firestore-module.test.js` 已新增动态 `import()` 断言，确认 provider 纯函数 ESM 的配置解析和商品/SKU 文档映射保持旧行为。
- `src/products/provider-firestore.mjs` 已在浏览器里挂回 `window.ProductLibraryProviderFirestore`，并注册 `TKDataSourceRegistry.registerProvider('products', ...)`。
- `src/products/index.mjs` 和 `src/orders/products.mjs` 已导入商品 provider ESM；订单商品桥接不再依赖旧普通脚本加载顺序。
- 新增 `src/products/index.mjs`，提供商品管理 ESM 入口，并通过 `window.ProductLibrary` 挂回给旧 hash 路由调用。
- `src/products/index.mjs` 采用懒初始化，避免 ESM 入口执行早于旧 `js/products/*` 子模块时出现 `undefined.create`。
- `index.html` 已移除旧 `js/products/index.js` 的页面加载，改为 `<script type="module" src="/src/products/index.mjs"></script>`。
- `index.html` 已移除旧 `js/products/provider-firestore.js` 页面加载；旧文件暂时保留为历史参考和回退。
- `index.html` 已移除旧 `js/products/table.js` 页面加载；旧文件暂时保留为历史参考和回退。
- `index.html` 已移除旧 `js/products/accounts.js` 页面加载；旧文件暂时保留为历史参考和回退。
- 新增 `src/products/export.mjs`，提供商品导出账号选择、CSV 行构建、CSV 下载和导出相关纯函数的 ESM 导出，并在浏览器里挂回 `window.ProductLibraryExport`。
- `tests/products-export-module.test.js` 已新增动态 `import()` 断言，确认商品导出 ESM 输出和旧 `ProductLibraryExport` 账号选项、CSV 行构建行为一致。
- `index.html` 已移除旧 `js/products/export.js` 页面加载；旧文件暂时保留为历史参考和回退。
- 新增 `src/products/crud.mjs`，提供商品弹窗、SKU 编辑、保存/删除事件绑定的 ESM 导出，并在浏览器里挂回 `window.ProductLibraryCrud`。
- `tests/products-crud-module.test.js` 已新增动态 `import()` 断言，确认商品 CRUD ESM 兼容导出的尺寸解析、批量 SKU、名称匹配和运费快照行为与旧模块一致。
- `index.html` 已移除旧 `js/products/crud.js` 页面加载；旧文件暂时保留为历史参考和回退。

当前已验证通过：

```bash
node tests/products-view-ui.test.js
node tests/products-form-utils-module.test.js
node tests/products-provider-firestore-module.test.js
npm test
npm run build
npm run e2e
npm run release:check
```

#### M5：迁移订单管理

订单最复杂，最后迁移。

当前状态：M5 已完成主入口切换。订单页面现在通过 `/src/orders/index.mjs` 加载订单入口；旧 `js/orders/index.js` 暂时保留为历史参考和回退，不再由主页面加载。订单同步和弹窗 CRUD 运行链路已分别由 `src/orders/sync.mjs`、`src/orders/crud.mjs` 接管。

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

订单同步运行链路已按原逻辑机械迁移到 `src/orders/sync.mjs`；当前先完成 ESM 入口挂载和测试覆盖，不删除旧 helper 参考文件。

已完成：

- 新增 `src/orders/shared.mjs`，提供 `OrderTrackerShared`、`create` 以及订单归一化、旧结构迁移/清洗、快递识别、金额/佣金/利润计算等关键纯函数 ESM 导出。
- `src/orders/shared.mjs` 保留旧 `OrderTrackerShared.create()` 返回接口，并让原来依赖 `window` / `document` 的读取点可注入，方便 Node 测试和后续入口迁移。
- `tests/orders-shared-module.test.js` 已新增动态 `import()` 断言，对照旧 `js/orders/shared.js` 验证账号去重、汇率读取、利润计算、快递识别、多明细订单归一化和旧订单结构清洗输出一致。
- 新增 `src/orders/table.mjs`，提供订单表格筛选排序、日期型搜索判断、退款/达人识别、快递汇总、金额格式化、利润颜色、采购/销售/运费/达人佣金/利润摘要统计和表格渲染壳等 ESM 导出。
- `tests/orders-table-view.test.js` 已新增动态 `import()` 断言，对照旧 `js/orders/table.js` 验证搜索筛选、达人搜索、稳定排序、利润颜色和多明细快递紧凑展示口径一致。
- `tests/orders-summary-ui.test.js` 已新增动态 `import()` 断言，对照旧 `js/orders/table.js` 验证摘要统计、摘要金额格式化和当前筛选标题一致。
- 新增 `src/orders/export.mjs`，提供导出账号选项、导出文件名、CSV 转义、CSV 行构造、订单筛选和 CSV 字符串生成等 ESM 纯函数导出，并保留 `OrderTrackerExport.create()` 兼容壳。
- `tests/orders-export-module.test.js` 已新增动态 `import()` 断言，验证 ESM 导出模块的账号选项、文件名、CSV 表头、CSV 双引号转义、未关联账号筛选，以及达人佣金/预估利润按当前汇率计算。
- 新增 `src/orders/tabs.mjs`，提供订单账号归并、账号订单数统计、激活账号兜底、标签 HTML 和删除账号提示文案等 ESM 纯函数导出，并保留 `OrderTrackerTabs.create()` 兼容壳。
- `tests/orders-tabs-module.test.js` 已新增动态 `import()` 断言，对照旧 `js/orders/tabs.js` 验证账号归并，并覆盖账号计数、激活账号兜底、标签 HTML 和删除提示文案。
- 新增 `src/orders/crud.mjs`，提供订单弹窗运行版 `OrderTrackerCrud.create()`，并导出快递选项、商品/SKU 选项、明细草稿缓存合并、明细数量/商品摘要/总重量汇总、快递自动识别状态、达人佣金和预估利润计算等工具函数。
- `tests/orders-crud-module.test.js` 已新增动态 `import()` 断言，验证 ESM CRUD 的运行版工厂、商品/SKU 选项、明细汇总、达人佣金/预估利润计算和明细快递识别规则。
- 新增 `src/orders/session.mjs`，提供订单会话连接文案、配置状态应用、缓存恢复文案、连接状态重置和刷新按钮 loading 状态等 ESM helper，并保留 `OrderTrackerSession.create()` 兼容壳。
- `tests/orders-session-module.test.js` 已新增动态 `import()` 断言，验证 ESM 会话模块的 `init/onEnter` 接口、已连接文案、本地缓存文案、配置状态应用/重置和刷新按钮状态切换。
- 新增 `src/orders/provider-firestore.mjs`，提供 Firestore 配置解析/序列化、显示名、items 归一化、旧结构清洗识别、订单拉取映射、订单写入 doc 构造等 ESM 纯函数，并保留 `OrderTrackerProviderFirestore.create()` 兼容壳。
- `tests/orders-provider-firestore-module.test.js` 已新增动态 `import()` 断言，验证 ESM provider 的配置解析、显示名、items 清洗、拉取订单字段映射、写入 doc 汇总和空字段处理。
- 新增 `src/orders/sync.mjs`，提供 Firestore 乐观写入变更集、订单三方合并、账号合并、远端 canonical cleanup 写回变更集、缺失 seq 检测、远端快照应用判断等同步纯函数，并承载订单同步运行版 `OrderTrackerSync.create()`。
- `tests/orders-sync-module.test.js` 已新增动态 `import()` 断言，验证 ESM sync 的乐观写入 upsert/delete、更新时间冲突合并、本地删除时间记录、远端新增吸收、`__needsOrderCleanup` 强制写回，以及订单入口直接 import `src/orders/sync.mjs`。
- 新增 `src/orders/index.mjs`，提供订单管理 ESM 入口，导出 `createOrderTracker`、`getOrderTracker` 和 `OrderTracker`，并通过 `window.OrderTracker` 挂回给旧 hash 路由调用。
- `src/orders/index.mjs` 采用懒初始化，直接 `import` 已完整迁移的 `shared`、`provider-firestore`、`export`、`tabs`、`session`、`sync`、`crud` ESM helper。
- `src/orders/shared.mjs`、`src/orders/export.mjs`、`src/orders/tabs.mjs`、`src/orders/session.mjs`、`src/orders/provider-firestore.mjs` 已在浏览器里挂回对应旧 `window.OrderTracker...` 命名空间。
- 新增 `src/orders/products.mjs`，提供订单弹窗商品资料读取桥接、按账号筛商品、按 TK ID 查商品、商品缓存重置等 ESM 导出，并在浏览器里挂回 `window.OrderTrackerProducts`。
- `tests/orders-products-module.test.js` 已新增动态 `import()` 断言，确认订单商品桥接 ESM 加载商品、账号筛选、TK ID 查找和缓存重置行为与旧模块一致。
- 新增 `src/orders/firestore-rules.mjs`，提供页面内置 Firestore 规则文本的 ESM 导出，并在浏览器里挂回 `window.ORDER_TRACKER_FIRESTORE_RULES`。
- `tests/orders-firestore-rules.test.js` 已新增动态 `import()` 断言，确认 ESM 内置规则和文档规则保持一致。
- 新增 `src/orders/form-utils.mjs`，提供订单弹窗商品/SKU 标签、商品默认参数合并、订单明细草稿归一化、旧版订单明细恢复、金额/尺寸解析等纯函数 ESM 导出，并在浏览器里挂回 `window.OrderTrackerFormUtils`。
- `tests/orders-form-utils-module.test.js` 已新增动态 `import()` 断言，确认订单表单纯函数 ESM 输出和旧 `OrderTrackerFormUtils` 一致。
- 新增 `src/firestore-connection.mjs`，提供全局 Firestore 连接弹窗、配置解析、本地存储迁移、复制规则和配置变更广播等 ESM 导出，并在浏览器里继续挂回 `window.TKFirestoreConnection`。
- `tests/firestore-connection-module.test.js` 已改为动态 `import()` 断言，确认 Firestore 连接 ESM 模块可直接导入、可解析 `firebaseConfig`，并保留旧全局 API。
- `src/orders/provider-firestore.mjs` 已直接注册 `TKDataSourceRegistry.registerProvider('orders', ...)`，旧 `js/orders/provider-firestore.js` 不再负责页面运行链路。
- `index.html` 已移除旧 `js/orders/index.js` 的页面加载，改为 `<script type="module" src="/src/orders/index.mjs"></script>`。
- `index.html` 已移除旧 `js/orders/shared.js`、`js/orders/provider-firestore.js`、`js/orders/export.js`、`js/orders/tabs.js`、`js/orders/session.js`、`js/orders/products.js`、`js/orders/firestore-rules.js`、`js/orders/form-utils.js`、`js/orders/table.js` 页面加载；旧文件暂时保留为历史参考和回退。
- `index.html` 已移除旧 `js/orders/sync.js` 的页面加载，订单入口直接 import `src/orders/sync.mjs`。
- `index.html` 已移除旧 `js/orders/crud.js` 的页面加载，订单入口直接 import `src/orders/crud.mjs`。
- `index.html` 已移除旧 `js/firestore-connection.js` 的页面加载，改为 `<script type="module" src="/src/firestore-connection.mjs"></script>`。
- 新增 `tests/orders-index-module.test.js`，验证订单 ESM 入口可直接 import、懒初始化、挂回全局，以及旧订单 index 普通脚本不再由主页面加载。

当前已验证通过：

```bash
node tests/orders-shared-module.test.js
node tests/orders-table-view.test.js
node tests/orders-summary-ui.test.js
node tests/orders-export-module.test.js
node tests/orders-tabs-module.test.js
node tests/orders-crud-module.test.js
node tests/orders-session-module.test.js
node tests/orders-provider-firestore-module.test.js
node tests/orders-sync-module.test.js
node tests/orders-index-module.test.js
node tests/firestore-connection-module.test.js
npm test
npm run build
git diff --check
npm run release:check
```

下一步：

- M5 进入观察期。不要急着删除旧 `js/orders/index.js` 或旧 helper；先让 release/e2e 稳定后，再考虑统一清理旧入口参考文件。
- `js/orders/sync.js` 只作为历史参考保留；后续不要轻改 `src/orders/sync.mjs` 的同步语义。

### 8.5 标准模块化期间的构建变化

当前状态：主站页面入口已完成 ESM 切换，构建产物不再发布旧业务 `js/` 目录。

```html
<script type="module" src="/src/main.mjs"></script>
```

已完成：

- 新增 `src/app-config.mjs`，提供 `TKAppConfig` ESM 导出，并在浏览器里继续挂回 `window.TKAppConfig`。
- 新增 `src/main.mjs`，负责年份、文档链接、模块配置表、hash 路由、`aria-current` 同步，以及进入 orders/products/analytics 时调用对应全局入口。
- `src/main.mjs` 保持 `DOMContentLoaded` 后再执行初始路由，避免 ESM 与旧 `defer` helper 混合期间漏掉业务入口挂载。
- `index.html` 已移除旧 `js/app-config.js` 和 `js/app.js` 页面加载，改为 `/src/main.mjs`。
- 旧 `js/app-config.js` 和 `js/app.js` 暂时保留为历史参考和回退，不再由主页面加载。
- `tests/app-config.test.js`、`tests/main-build-contract.test.js`、`scripts/preview-smoke.mjs` 已更新为覆盖 ESM 主入口和 Vite build 产物。
- 新增 `src/table-controls.mjs`，提供表格分页、搜索工具栏 HTML 和事件绑定的 ESM 导出，并由 `src/main.mjs` 挂回 `window.TKTableControls`。
- 新增 `src/data-sources/registry.mjs`，提供数据源注册表 ESM 导出，并由 `src/main.mjs` 挂回 `window.TKDataSourceRegistry`，保证旧 Firestore provider 注册顺序不变。
- `index.html` 已移除旧 `js/table-controls.js` 和 `js/data-sources/registry.js` 页面加载；旧文件暂时保留为历史参考和回退。
- `tests/shared-utils.test.js`、`tests/data-source-registry.test.js`、`tests/orders-table-view.test.js`、`tests/products-view-ui.test.js` 已覆盖这两个基础模块的 ESM 导出、入口挂载和旧页面加载移除。
- 新增 `src/searchable-select.mjs`，提供订单商品/SKU 可搜索下拉框 ESM 导出，并由 `src/main.mjs` 挂回 `window.TKSearchSelect`。
- `index.html` 已移除旧 `js/searchable-select.js` 页面加载；旧文件暂时保留为历史参考和回退。
- `tests/shared-utils.test.js` 和 `tests/orders-crud-module.test.js` 已覆盖可搜索下拉框 ESM 导出、入口挂载和旧页面加载移除。

- 利润计算器、商品管理、订单管理、数据分析、Firestore 连接和基础共享工具都已由 `/src/*.mjs` 加载。
- `index.html` 已不再列本地 `js/*.js` 普通脚本。
- `scripts/copy-main-assets.mjs` 不再复制旧 `js/` 到 `dist/js/`，只补充正式站点需要稳定访问的 `/logo.png`。
- `public/_headers` 已移除旧 `/js/*` 缓存规则。
- `scripts/preview-smoke.mjs` 会确认 `/logo.png` 可访问，并确认旧 `/js/app.js`、`/js/orders/provider-supabase.js` 不在构建产物中。

当前仍保留旧 `js/` 源文件作为历史参考和回退对照。不要在没有单独清理计划时一次删除旧 `js/`。

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

- 全局变量消失导致旧模块找不到依赖。
- defer 顺序迁移到 import 后执行时机变化。
- Vite dev 和 build 路径差异。
- 测试大量需要更新。
- 订单同步副作用更难排查。

处理原则：

- 先保留 `window.Xxx` 兼容层。
- 一次只迁移一个模块。
- 订单最后迁移。
- 遇到复杂问题不要硬推进，先回到轻模块化稳定版本。

### 8.8 标准模块化完成标准

完成时应满足：

- 主站入口为 `src/main.mjs`。已完成。
- 大多数业务模块使用 `import/export`。已完成。
- `index.html` 不再列大量 `js/*.js` 脚本。已完成。
- 旧 `js/` 不再进入构建产物，当前只作为历史参考保留。已完成。
- `scripts/copy-main-assets.mjs` 不再复制业务 `js/`。已完成。
- `npm test` 通过。
- `npm run build` 通过。

## 9. 路线三：TypeScript 化，1-2 周

TypeScript 是长期路线，不是当前阶段。

### 9.1 触发条件

只有满足这些条件才开始：

- 标准模块化完成。
- 业务模块已经基本走 `import/export`。
- 核心测试稳定。
- Firebase-only 数据结构稳定。
- 用户确认可以接受较长工程化周期。

### 9.2 目标

给核心数据结构加类型，减少字段混乱和回归。

重点类型：

- 商品 Product
- SKU ProductSku
- 订单 Order
- 订单明细 OrderItem
- Firebase 配置 FirebaseConfig
- Firestore 文档 ProductDoc / OrderDoc
- 数据分析 Excel 行 AnalyticsRawRow
- 数据分析标准记录 AnalyticsRecord
- 数据源 Provider 接口

### 9.3 推荐目录结构

```text
src/
  main.ts
  types/
    firebase.ts
    order.ts
    product.ts
    analytics.ts
    data-source.ts
  shared/
  calc/
  orders/
  products/
  analytics/
  data-sources/
```

### 9.4 迁移顺序

#### T1：只加类型文件

先新增 `src/types/*.ts`，不迁移业务逻辑。

#### T2：迁移 analytics

数据分析最独立，先转 TS。

#### T3：迁移 shared

格式化、HTML escape、Firebase config parser。

#### T4：迁移 products

商品和 SKU 类型很适合 TS。

#### T5：迁移 orders

订单最后迁移。

尤其谨慎：

- `orders/sync`
- `orders/provider-firestore`
- `orders/crud`

### 9.5 TypeScript 配置

需要新增：

```text
tsconfig.json
```

建议先不要开最严格：

```json
{
  "compilerOptions": {
    "strict": false,
    "checkJs": false
  }
}
```

稳定后再逐步提高：

```json
{
  "strict": true,
  "noImplicitAny": true
}
```

### 9.6 TypeScript 风险

主要风险：

- 旧数据字段有中文 key，类型定义会比较复杂。
- Firestore 历史兼容字段较多。
- 空字符串、null、undefined 的现有行为不能随意改变。
- 类型收紧可能导致大量小问题，影响节奏。

处理原则：

- 先类型描述现状，不顺手改行为。
- 保留中文订单字段映射。
- 不趁 TS 迁移重构数据结构。
- 每迁移一个模块都跑完整测试。

### 9.7 TypeScript 完成标准

完成时应满足：

- 主入口为 `src/main.ts`。
- 核心数据结构有类型。
- Provider 接口有类型。
- Analytics parser/analyzer 有类型。
- Products CRUD 有类型。
- Orders 关键数据结构有类型。
- `npm test` 通过。
- `npm run build` 通过。
- 线上 Firebase 老数据兼容。

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

需要改：

- `index.html`
- `js/orders/index.js`
- `js/orders/provider-supabase.js`
- `js/data-sources/registry.js`
- `tests/data-source-registry.test.js`
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

4. 从 `js/orders/provider-supabase.js` 处理注册逻辑。

推荐做法：

- 不在活跃路径加载这个文件。
- 如果文件保留，不影响运行。
- 不让测试要求它注册。

5. 更新 `tests/data-source-registry.test.js`：

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
tests/app-config.test.js
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
node tests/app-config.test.js
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
node tests/data-source-registry.test.js
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

- `tests/analytics-module.test.js` 改成分别读取三个文件。
- 继续验证：
  - Excel 行解析。
  - 日元/百分比清洗。
  - 渠道 GMV 汇总。
  - 诊断标签。
  - 不出现 `fetch`、`XMLHttpRequest`、`sendBeacon`、`firebase`、`Firestore`、`localStorage.setItem`。

验收：

```bash
node tests/analytics-module.test.js
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
- 新增 `tests/products-form-utils-module.test.js`，覆盖商品 SKU 表单纯函数模块、CRUD 接入和 `index.html` 加载顺序。
- `js/products/index.js` 从约 650 行降到约 350 行，目前只保留连接、加载、主渲染、事件编排。
- `js/products/crud.js` 已移除 SKU 表单纯函数内联实现，改为通过 `ProductLibraryFormUtils` 调用。
- 新增 `js/orders/products.js`，负责订单弹窗读取商品资料、按账号筛商品、按 TK ID 查商品、Firestore 配置变化时清理商品缓存。
- `js/orders/index.js` 从约 570 行降到约 515 行，产品桥接逻辑不再内联在入口文件。
- 新增 `js/orders/form-utils.js`，负责订单弹窗商品/SKU 标签、商品默认参数合并、订单明细草稿归一化、旧版订单明细恢复、金额/尺寸解析等纯函数。
- 新增 `tests/orders-form-utils-module.test.js`，覆盖订单表单纯函数模块、CRUD 接入和 `index.html` 加载顺序。
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
for f in tests/orders-*.test.js; do node "$f" || exit 1; done
npm test
npm run build
git diff --check
```

当前已验证通过：

```bash
for f in tests/orders-*.test.js; do node "$f" || exit 1; done
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
- `tests/main-build-contract.test.js` 已覆盖隐私页、使用条款页、404、robots、sitemap、manifest、SEO meta、Cloudflare headers、页脚入口、主内容 landmark、跳转主内容链接和导航当前项语义。
- 新增 `tests/site-release-contract.test.js`，防止 Phase 7 文档、数据边界说明和正规网站基础项回退。
- 新增 `scripts/preview-smoke.mjs` 和 `npm run smoke`，构建后实际启动 Vite preview 检查核心静态路径和构建产物。
- 新增 `playwright.config.mjs`、`tests/e2e/release.spec.js` 和 `npm run e2e`，基于 production preview 用离线 Firebase / Excel fixtures 在桌面和移动 Chromium 上覆盖浏览器级主流程。
- 新增 `scripts/release-check.sh` 和 `npm run release:check`，把单测、文档构建、主站构建、HTTP smoke、浏览器 e2e 和 diff 检查串成发布门禁。
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
css/style.css
js/app.js
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
src/firestore-connection.mjs
js/orders/provider-firestore.js
js/products/provider-firestore.js
src/orders/products.mjs
```

### 订单

```text
js/orders/index.js
js/orders/session.js
js/orders/tabs.js
js/orders/export.js
js/orders/shared.js
src/orders/firestore-rules.mjs
src/orders/form-utils.mjs
src/orders/crud.mjs
src/orders/sync.mjs
src/orders/table.mjs
```

### 商品

```text
js/products/index.js
js/products/provider-firestore.js
js/products/accounts.js
js/products/form-utils.js
js/products/table.js
src/products/crud.mjs
src/products/export.mjs
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
tests/*.test.js
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
node tests/analytics-module.test.js
node tests/data-source-registry.test.js
node tests/main-build-contract.test.js
node tests/products-view-ui.test.js
node tests/orders-session-module.test.js
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
- `git diff --check` 无输出。
- `git status --short` 中没有用户数据文件。
- `dist/` 和 `node_modules/` 仍被忽略。
- 页面脚本加载顺序符合现有测试。
- Firebase Firestore 是唯一正式远端数据源。
- README 和本文件同步更新。

## 14. 风险清单

### 14.1 脚本加载顺序

当前项目还是普通 `<script defer>`。

风险：

- 新脚本插入位置会破坏旧测试。
- provider 必须在业务 index 前加载。
- shared/table/crud/session 的顺序不能随便改。

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
- 不轻易改订单同步语义；当前运行链路在 `src/orders/sync.mjs`。
- 改订单保存后要重点测试新增/编辑订单、快递公司、快递单号输入。

### 14.3 Supabase 遗留代码

当前仓库有 `js/orders/provider-supabase.js`。

风险：

- 误加载会让项目方向不清晰。
- 测试可能仍要求它注册。

处理：

- Phase 1 先从活跃路径撤掉。
- 是否删除文件由用户决定。
- 文档只写 Firebase-only。

### 14.4 数据分析隐私

Excel 必须本地解析。

风险：

- 后续增加导出/保存功能时误写入 Firestore 或远端。

处理：

- 测试继续禁止 `fetch`、`XMLHttpRequest`、`sendBeacon`、`firebase`、`Firestore`、`localStorage.setItem` 出现在 analytics 模块。

### 14.5 大规模模块化

风险：

- 一次改太多，测试难定位。
- 上 TypeScript/ESM 会牵扯全局变量和加载顺序。

处理：

- 先轻模块化。
- 先纯函数。
- 一次只拆一个模块。

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
7. 优先完成当前 Phase，不要跳到大重构。

## 16. 本地提交状态

当前改动已经整理成一个本地提交：

```text
release: prepare tk toolbox static site
```

同一提交也有一个本地保护分支：

```text
local/release-prep-static-site
```

之所以没有继续拆成多个提交：当前 `README.md`、`index.html`、`tests/main-build-contract.test.js` 等文件同时承载构建、数据边界、数据分析、正规站点基础和发布门禁契约。按文件强拆会产生中间不可测试的提交，不适合现在这个已验证的发布准备状态。

如果以后确实需要拆提交，建议先新建临时分支，用 `git reset --soft cb54688` 后重新分组，并且每组都跑相关测试；不要在当前线上保护分支上直接试拆。

## 17. 推荐下一步

当前第一轮轻模块化、Phase 7 文档补齐、正规网站基础项、可访问性基础语义、部署发布指南和浏览器级 Playwright smoke 都已完成并通过验证。

建议下一步：

1. 不要 push 当前本地提交，除非明确准备让线上版本更新。
2. 需要上线前，先重新跑 `npm run release:check`。
3. 准备上线时，再解除本机 push 防护：`TK_ALLOW_PUSH=1 git push`。
4. 部署到 Cloudflare Pages 后，按 `docs/guide/deploy.md` 做线上手动验收。
5. 线上稳定后，再评估路线二“标准模块化”，不要直接跳 TypeScript。
