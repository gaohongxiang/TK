# TK 电商工具箱

这是一个给 TikTok Shop 日本跨境店使用的工具站，目前包含：

- 利润计算器
- 商品管理
- 订单管理
- 使用文档
- TK 运营文档

## 现在的结构

这套仓库现在分成两部分：

### 1. 工具主站

主站源码就在仓库根目录：

- `index.html`
- `css/`
- `js/`

这部分还是普通静态站。

### 2. 文档站

文档源码在：

- `docs/`

文档使用 VitePress，准备单独部署成一个独立站点。

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

如果你这个项目已经在线并且能正常访问，**继续用现在的配置就行，不需要为了文档再改主站项目**。

如果你以后要重新创建主站项目，可以按下面这套最简单的方式配：

- 项目类型：`导入现有 Git 存储库`
- Framework preset：`None`
- Root directory：留空
- Build command：留空
- Build output directory：`/`

主站因为本来就是普通静态文件，所以不需要额外构建。

### Pages 项目 2：文档站

文档建议单独建一个 Pages 项目，比如：

- `https://tk-evu-docs.pages.dev/`

这个项目还是导入**同一个 GitHub 仓库**，但只构建 `docs/`。

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

### 这样拆开的好处

- 改工具，只影响主站
- 改文档，只影响文档站
- 文档可以继续用 VitePress 扩展目录、搜索和组件
- 主站不用为了文档构建而变复杂

## 同一个仓库接两个 Pages 项目，要注意什么

这是正常用法，不冲突。

只是要注意：

- 主站项目和文档项目都会监听同一个 GitHub 仓库
- 你每次 push 后，两个项目都有可能一起触发构建

如果你后面想再精细一点，可以去 Cloudflare Pages 里给两个项目分别设置 `Build watch paths`，减少不必要的重复构建。

## 补充

主站顶部的 `文档` 链接现在默认写的是：

- `https://tk-evu-docs.pages.dev/`

如果你最后创建文档站时用的不是这个地址，记得把主站里的文档链接一起改掉。

## 推送 GitHub 时要不要带构建产物

不用。

现在只需要推源码：

- 主站源码：根目录的 `index.html`、`css/`、`js/`
- 文档源码：`docs/`

不需要推这些：

- `dist/`
- `docs/.vitepress/dist/`
- `node_modules/`
- `docs/node_modules/`
