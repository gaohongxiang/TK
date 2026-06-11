# TK 电商工具箱

给 TikTok Shop 日本跨境店使用的工具站。当前主站是静态 React SPA，业务数据仍由用户自己的 Firebase Firestore、本地文件或浏览器存储承载；不规划接入平台第三方接口。

## 功能

- 利润计算器：定价 V1/V2/V3、海外运费、包邮转嫁、成交利润复盘。
- 商品管理：连接用户自己的 Firestore 管理商品和 SKU。
- 订单管理：连接用户自己的 Firestore 管理订单、成本、利润、物流单号和同步状态。
- 收支管理：记录真实回款、运营成本和押金占用，对比订单预估利润和实际净额。
- 数据采集：通过 Codex skill 做选品采集、去重、店小秘状态同步。
- 数据分析：本地导入 TikTok Shop 流量 Excel，生成渠道、商品和漏斗分析。
- 文档站：VitePress 使用说明和运营文档。

## 计算口径

当前主口径是定价 V3，已同步到利润复盘、订单管理、汇总和 CSV 导出。

- 不包邮：平台费按 `商品售价 + 买家运费 350円` 计算；达人佣金按商品售价计算。
- 包邮转嫁定价：把买家原本支付的 350円 运费放进商品售价；目标折扣档位完整转嫁时，`包邮原价 = 不包邮原价 + 350 ÷ 目标折扣`。
- 包邮转嫁利润：收入扣回 350円；平台费和达人佣金按平台实际商品售价计算。
- 利润复盘：商品售价按订单实际售价填写；包邮转嫁开关只标记口径，不自动加减 350円。
- 退款订单：收入、平台费、达人佣金按 0 处理；利润按 `0 - 采购价 - 预估运费` 复盘。

## 架构

- `src/react/app/App.tsx`：App Shell、hash 路由和主视图。
- `src/react/features/`：`calculator`、`products`、`orders`、`finance`、`collection`、`analytics`。
- `src/react/components/ui/`：本地 UI primitives。
- `src/calc/`、`src/orders/`、`src/products/`、`src/finance/`、`src/analytics/`：纯函数、类型、导出和 Firestore provider。
- `skills/tk-product-selection/`：选品采集 skill 和同步脚本。
- `docs/`：VitePress 文档站。
- `packages/cli/`：内部排查用 CLI，用户流程不依赖它。

旧 `js/`、旧 `css/style.css`、旧 DOM runtime 和旧 React island 入口已经清理。

更完整的模块边界、数据流、测试和平台接口边界见 [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)。

## 数据边界

- 本站不保存用户业务数据。
- Cloudflare Pages 只托管静态页面，不持有业务数据。
- 商品、订单、收支记录、采集记录写入用户自己的 Firestore。
- 数据分析模块只在浏览器内读取 Excel 原始文件；分析快照会写入用户自己的 Firebase Firestore。
- 采集原始输出保存在本机 `data/collection/`，不提交仓库。
- 工具参数保存在浏览器 `localStorage`。

## 本地开发

```bash
npm install
npm run dev
```

构建和预览：

```bash
npm run build
npm run preview
```

常用检查：

```bash
npm test
npm run typecheck
npm run release:check
```

## 文档

```bash
./scripts/docs-dev.sh
./scripts/docs-build.sh
```

主要文档：

- `docs/guide/database.md`
- `docs/guide/calculator.md`
- `docs/guide/products.md`
- `docs/guide/orders.md`
- `docs/guide/finance.md`
- `docs/guide/collection.md`
- `docs/guide/analytics.md`

## 部署

主站使用 Cloudflare Pages：

- Framework preset：`Vite`
- Build command：`npm run build`
- Build output directory：`dist`

文档站可单独部署：

- Root directory：`docs`
- Build command：`npm run build`
- Build output directory：`.vitepress/dist`

## Git

不要提交：

- `dist/`
- `node_modules/`
- `docs/.vitepress/cache/`
- `docs/.vitepress/dist/`
- `*.xlsx`
- `*.xls`
- `*.csv`
- `data/collection/`
