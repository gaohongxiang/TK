# TK 技术架构

这份文档记录当前项目技术结构和工程边界。历史升级交接内容已经结束使命；项目现状以本文和 `README.md` 为准。

## 总览

TK 电商工具箱是面向 TikTok Shop 日本跨境店的 Vite React SPA。

当前产品仍按“静态前端 + 用户自有数据源”运行：

- 主站由 Cloudflare Pages 托管静态资源。
- 商品、订单、收支记录、采集记录和分析快照写入用户自己的 Firebase Firestore。
- Excel 原始文件只在浏览器内解析。
- 采集流程由本机 Codex skill 和授权浏览器窗口执行。
- 不规划接入平台第三方接口；商品、订单、收支和采集仍以 Firestore、本地文件和授权浏览器窗口为边界。

## 入口

- `index.html`：单根 `#root`，加载 `/src/react/main.tsx`、Firebase compat SDK 和 SheetJS。
- `src/react/main.tsx`：React 启动入口。
- `src/react/app/App.tsx`：App Shell、hash 路由、导航、全局状态、Firebase 连接入口。
- `src/react/styles.css`：样式入口，导入 Tailwind utilities 和 `src/react/styles/base.css`。

旧 `js/`、旧 DOM runtime、旧 React island 挂载入口和旧 `css/style.css` 已清理。

## 前端模块

业务页面集中在 `src/react/features/`：

- `calculator/CalculatorApp.tsx`：利润计算器、海外运费、定价 V3、包邮转嫁、利润复盘。
- `products/ProductsPage.tsx`：商品、SKU、账号筛选、商品弹窗、CSV 导出。
- `orders/OrdersPage.tsx`：订单、订单明细、退款、包邮转嫁、预估利润、同步状态。
- `finance/FinancePage.tsx`：真实回款、运营成本、押金占用、预估口径和真实口径。
- `collection/CollectionPage.tsx`：采集表、目标账号筛选、店小秘状态。
- `analytics/AnalyticsRoute.tsx`：Excel 导入、ECharts 看板、分析快照。

共享 UI 放在 `src/react/components/ui/`。表格控制、账号标签、导出选项、状态徽标等已经收敛为本地 primitives，不再依赖旧全局 CSS 或 DOM helper。

## 领域代码

`src/` 下保留可被 React 和 Node 测试直接导入的纯函数、provider 和类型：

- `src/calc/`：定价、复盘和包邮转嫁公式。
- `src/orders/`：订单类型、共享计算、Firestore provider、表格筛选、CSV 导出。
- `src/products/`：商品类型、Firestore provider、SKU 表单、表格和导出 helper。
- `src/finance/`：收支类型、汇总口径、Firestore provider、CSV 导出。
- `src/analytics/`：Excel parser、分析器和看板数据结构。
- `src/shipping-core.ts`：海外运费价卡、计费重、运费换算。
- `src/global-settings.ts`：汇率、运费倍率、贴单费、平台费率等全局参数。
- `src/firestore-connection.ts`：Firebase 配置、连接状态和项目连接链接。

原则：

- React 页面负责交互和状态组合。
- 业务计算尽量放在可测试纯函数里。
- Firestore 文档结构由 provider 统一归一化。
- Node 契约测试直接 import 领域模块，避免只测 UI 字符串。

## 数据边界

正式数据源是用户自己的 Firebase Firestore。

| 数据 | 存放位置 |
| --- | --- |
| 商品、SKU、账号 | 用户 Firestore |
| 订单、订单明细、物流、利润 | 用户 Firestore |
| 收支记录、回款、运营成本、押金占用 | 用户 Firestore |
| 采集记录、拒绝品去重 | 用户 Firestore |
| 数据分析快照 | 用户 Firestore |
| Excel 原始文件 | 当前浏览器内存 |
| FastMoss/店小秘采集原始输出 | 本机 `data/collection/` |
| 工具参数 | 浏览器 `localStorage` |

Cloudflare Pages 不保存用户业务数据。不要新增平台方数据库来保存商品、订单、收支记录、Excel 或采集原始数据。

## 账号和搜索

- 商品、订单、收支管理、数据采集共用 `order_accounts` 账号标签。
- 业务数据里的 `accountName` 只负责计数和筛选，不反向生成账号标签。
- 账号过滤先于搜索执行。
- 搜索解析器在 `src/search-query.ts`；订单支持日期语法，商品做文本搜索，收支支持日期、类别和备注搜索，采集支持采集/编辑日期语法。

## 计算口径

当前主口径是定价 V3，并同步到利润复盘、订单管理、汇总和 CSV 导出。

- 不包邮：平台费按 `商品售价 + 买家运费 350円` 计算；达人佣金按商品售价计算。
- 包邮转嫁定价：`包邮原价 = 不包邮原价 + 350 ÷ 目标折扣`。目标折扣档位完整转嫁 350円；其他折扣按同一个包邮原价自然浮动。
- 包邮转嫁利润：收入扣回 350円；平台费和达人佣金按平台实际商品售价计算。
- 利润复盘：售价按订单实际售价填；包邮转嫁开关只标记口径，不自动加减 350円。
- 退款订单：收入、平台费、达人佣金按 0 处理；利润按 `0 - 采购价 - 预估运费`。

`ENABLE_FREE_SHIPPING_CALC` 仍是旧“真包邮”开关，当前保持关闭；后续可删除或重做，不应混入包邮转嫁口径。

## 收支口径

收支管理用于把订单预估利润和真实现金流分开看。

- 预估口径：预估收入直接取订单管理当前筛选范围内的预估利润，运营成本来自手工录入的订单外成本。
- 真实口径：实际净额 = TK 提现回款 - 订单成本 - 运营成本；订单成本由采购价和当前全局贴单费组成，不再扣订单预估运费。
- 押金占用：押金 - 押金退回 - 押金扣除；押金本身只表示资金占用，押金扣除才算运营成本。
- 公共账：没有账号归属的收支记录只进入“全部”和“公共账”，不会混入某个店铺账号。

## 采集架构

采集不是网页内按钮流程，而是 Codex skill + 当前授权浏览器窗口：

- skill 母本：`skills/tk-product-selection/`
- 本机输出：`data/collection/`
- Firestore 同步：`skills/tk-product-selection/scripts/firestore-sync.mjs`
- FastMoss 筛选：`select-fastmoss-products.mjs`
- 店小秘状态初始化：`init-dianxiaomi-status.mjs`

默认策略：

- FastMoss 配置全局复用。
- 店小秘按 TK 账号绑定复用。
- 多账号顺序执行，不并行多个采集窗口。
- 平台人工确认、验证码、付费确认和发布确认由用户处理。

## 平台接口边界

当前不把平台第三方接口作为技术路线。主要原因是第三方应用审核和权限范围不稳定，商品、SKU、库存、订单、履约和对账能力不能作为当前项目的可靠依赖。

因此项目保持这些边界：

- 不在前端或仓库保存平台应用密钥、长期 token 或店铺授权信息。
- 不设计第三方应用授权、签名代理、token refresh 或平台 API 同步链路。
- 商品和订单以手工录入、CSV/Excel、本地采集辅助和 Firestore 为主。
- 需要平台后台操作的部分，仍由用户在已登录的浏览器或店小秘完成。

## 测试

常用检查：

```bash
npm test
npm run typecheck
npm run release:check
```

相关契约测试覆盖：

- 计算器和包邮转嫁：`tests/calc-formulas.test.mjs`
- React 计算器状态：`tests/calc-react-state-sync.test.mjs`
- 订单共享计算：`tests/orders-shared-module.test.mjs`
- 订单表单行为：`tests/orders-react-form-behavior.test.mjs`
- 订单汇总/导出/provider/table：`tests/orders-summary-ui.test.mjs`、`tests/orders-export-module.test.mjs`、`tests/orders-provider-firestore-module.test.mjs`、`tests/orders-table-view.test.mjs`
- 商品 provider/form/table/export：`tests/products-*.test.mjs`
- 收支 provider/summary/page/export：`tests/finance-module.test.mjs`
- 数据分析：`tests/analytics-module.test.mjs`
- 发布 smoke/e2e：`npm run smoke`、`npm run e2e`

提交前至少跑相关测试；上线前跑 `npm run release:check`。

## 部署

主站：

- Cloudflare Pages
- Framework preset：`Vite`
- Build command：`npm run build`
- Build output directory：`dist`

文档站：

- Root directory：`docs`
- Build command：`npm run build`
- Build output directory：`.vitepress/dist`

仓库有 `wrangler.toml`，主站输出目录为 `./dist`。

## Git 边界

不要提交：

- `dist/`
- `node_modules/`
- `docs/.vitepress/cache/`
- `docs/.vitepress/dist/`
- `*.xlsx`
- `*.xls`
- `*.csv`
- `data/collection/`
- 任何真实店铺授权信息、平台密钥、Firebase 私密凭据或采集原始隐私数据。
