# 部署与发布检查

主站和文档站建议拆成两个 `Cloudflare Pages` 项目，都从同一个 GitHub 仓库构建。主站发布工具本体，文档站只发布 `docs/` 里的使用说明和运营资料。

## 发布前本地检查

每次准备部署前，在仓库根目录运行：

```bash
npm run release:check
```

这个命令会依次执行：

- `npm test`
- `./scripts/docs-build.sh`
- `npm run build`
- `npm run smoke`
- `npm run e2e`
- `git diff --check`

其中 `npm run smoke` 会请求构建后的静态路径，`npm run e2e` 会在桌面和移动 Chromium 上用离线 Firebase / Excel fixtures 覆盖利润计算器、商品新增/编辑、订单新增/编辑、数据分析导入、隐私页、使用条款页和 404。

## CI 门禁

仓库已配置 `.github/workflows/release-check.yml`。

触发条件：

- push 到 `main`
- pull request

CI 会安装主站依赖、安装 `docs/` 依赖、安装 Playwright Chromium，然后运行：

```bash
npm run release:check
```

如果 CI 失败，先修失败项，不要直接部署。

## 主站 Cloudflare Pages 配置

主站是仓库根目录的 Vite 项目。

| 配置项 | 值 |
| --- | --- |
| Framework preset | `Vite` |
| Root directory | 留空 |
| Build command | `npm run build` |
| Build output directory | `dist` |

仓库里的 `wrangler.toml` 已声明：

```toml
pages_build_output_dir = "./dist"
```

主站发布后应至少检查：

- 首页能打开。
- `隐私与数据边界` 链接能打开。
- `使用条款` 链接能打开。
- `robots.txt` 和 `sitemap.xml` 能访问。
- 商品管理和订单管理未连接时显示 `连接 Firebase`。
- 数据分析可以选择 Excel 文件，且不会要求连接 Firebase。

## 文档站 Cloudflare Pages 配置

文档站在 `docs/` 目录，建议单独建一个 Cloudflare Pages 项目。

| 配置项 | 值 |
| --- | --- |
| Framework preset | `None` |
| Root directory | `docs` |
| Build command | `npm run build` |
| Build output directory | `.vitepress/dist` |

本地只构建文档站：

```bash
./scripts/docs-build.sh
```

## 数据边界

Cloudflare Pages 只托管静态资源。商品、SKU、订单和物流信息保存到用户自己的 Firebase Firestore；商品流量 Excel 只在浏览器本地解析，不上传到 Cloudflare，不写入 Firestore。
