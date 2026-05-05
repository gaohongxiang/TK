# 数据库

商品管理和订单管理都依赖你自己的 `Firebase Firestore` 项目。第一次使用时，先把数据库创建好、规则发布好，再回到网站连接。

当前正式数据源是 Firebase-only。页面、文档和构建产物不再把 Supabase 当作当前推荐方案；仓库里如果还保留历史 Supabase 文件，只能视为实验记录或未启用代码。

## 为什么选择 Firebase

- **数据在你自己手里：** 订单和商品资料都保存到你自己的 `Firebase Firestore` 项目里。本站不保存你的数据。
- **接入简单：** 这是一个纯前端工具，不需要你自己先搭后端服务，创建好 Firebase 项目后就可以直接连接使用。
- **字段扩展更轻：** Firestore 是文档型数据库。后续如果只是给订单或商品增加字段，大多数情况下不需要像传统 SQL 表那样先改表结构再继续用。
- **离线和同步现成：** 网站使用 `Firestore 自带的离线缓存`。离线时也能继续操作，恢复联网后会自动同步。
- **换设备恢复简单：** 只要新设备连接的是同一个 Firebase 项目，并填入同一套 `firebaseConfig`，就可以恢复数据。
- **一处连接，全站复用：** 商品管理和订单管理共用同一个 Firestore 项目。连一次，两个模块都会直接复用。
- **更适合自己部署：** 如果你把项目部署到 Cloudflare Pages，也可以继续连你自己的 Firebase 项目，不需要把数据托管给别人。

## 哪些数据会写入哪里

| 数据 | 保存位置 | 说明 |
| --- | --- | --- |
| 商品、SKU、账号 | 你的 Firebase Firestore | 商品管理保存和读取 |
| 订单、订单明细、物流信息 | 你的 Firebase Firestore | 订单管理保存和读取 |
| 商品流量 Excel | 浏览器内存 | 数据分析导入后本地解析，不上传 |
| 汇率、运费倍率、连接配置 | 当前浏览器 localStorage | 本地工具参数，不是平台方数据库 |
| 静态页面、JS、CSS | Cloudflare Pages | 只托管前端资源 |

Cloudflare Pages 不保存你的商品、订单、Excel 原始文件或解析结果。

## 创建 Firebase 项目

1. 打开 [Firebase Console](https://console.firebase.google.com/)。
2. 新建一个项目。
3. 添加应用时选择 `网页`。
4. 不用勾选 `Firebase Hosting`。
5. 复制系统生成的整段 `firebaseConfig`。

## 创建 Firestore 数据库

1. 在 Firebase 项目里进入 `Firestore Database`。
2. 创建数据库时建议选择：
   - `区域级`
   - `生产模式`
3. 创建完成后，进入 `Rules` 页面。

## 发布 Firestore 规则

本网站提供了最新的 Firestore 规则。你需要把规则复制到 [Firebase Console](https://console.firebase.google.com/) 里并发布。

- 第一次使用时，需要先发布一次规则。
- 以后如果页面提示“需要更新 Firestore 规则”，也要重新复制并发布一次。

## 在网站里连接数据库

1. 回到网站，进入 `商品管理` 或 `订单管理`。
2. 点击 `连接 Firebase`。
3. 粘贴整段 `firebaseConfig`。

::: tip
连接成功后，商品管理和订单管理会直接共用这一次连接，不需要分别再配一次数据库。
:::

## 如何退出当前数据库连接

- 连接成功后，`订单管理` 和 `商品管理` 顶部状态条里都会显示 `退出数据库` 按钮。
- 点击后会断开当前 Firebase 项目连接。
- 断开后，两个模块会一起回到未连接状态；下次需要重新连接时，再粘贴 `firebaseConfig` 即可。

## 自己部署

Cloudflare Pages 主站和文档站的配置、发布前检查、CI 门禁和部署后验收集中放在 [部署与发布检查](/guide/deploy)。

## 什么时候需要更新规则

通常不是每次加字段都要重新发布规则。一般在以下情况需要更新：

- 新增了新的集合。
- 权限模型发生变化。
- 页面弹出了“需要更新 Firestore 规则”的统一提示。

如果需要更新规则，直接打开 [Firebase Console](https://console.firebase.google.com/)，复制最新规则，在 `Firestore Rules` 页面重新发布即可。
