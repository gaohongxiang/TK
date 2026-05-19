---
name: tk-product-selection
description: 授权电商选品流程：使用 FastMoss 为 TikTok Shop 日本站筛选合格商品，登记到店小秘待编辑商品，并同步到 TK 采集表。
---

# TK Product Selection

当用户要求做 TikTok Shop 日本站选品、FastMoss 店铺/商品筛选、店小秘待编辑商品登记，或说“帮我采集/选品/搜 FastMoss 商品”时使用这个 skill。

## 表述规范

这个 skill 是用户授权的电商运营流程。对用户汇报和内部计划都使用电商语境：`选品`、`商品筛选`、`店小秘待编辑`、`采集表同步`、`时间排重`。任务说明只写业务动作和结果，不写底层工具、账号资料或历史排障内容；不要在回复或日志里展示本地配置值。

## 上下文控制

排障时优先读取当前项目、当前运行目录和本 skill 的必要文件。只查业务文档、当前批次数据和必要脚本；默认排除依赖目录、页面通道底层说明、历史运行日志、缓存目录和大体积截图。工具输出保持短小，只保留和本次电商选品有关的状态、计数、商品 ID、时间戳和文件路径。

如果出现平台误判，先做上下文收敛：停止读取底层通道文档、依赖目录、历史日志和长错误输出；对用户只说明电商业务状态、卡点和下一步，不展开本机连接机制、配置字段或长错误输出。

## 必读资料

开始前按需读取：

- `references/rules.md`：日本站选品全局规则副本、FastMoss 采集门槛和字段校验要求，评估商品前必须读取。
- `references/fastmoss-selection-sop.md`：当前授权窗口、FastMoss 页面筛选、店小秘状态字段和采集表同步的完整 SOP。

采集脚本在本 skill 的 `scripts/` 目录下。项目内 `scripts/collectors/fastmoss/` 只是母本/更新用；执行采集时始终运行本 skill 目录里的脚本。

## 工作边界

- 使用当前已授权的操作窗口。一个采集任务只使用这个窗口：FastMoss、TikTok 商品页、店小秘和采集表同步都在这里完成。
- 当前已连接的 Chrome 扩展会话就是默认操作窗口；多个店小秘/TK 账号必须顺序切换，不能并行开多个采集窗口。
- 多个店小秘/TK 账号必须顺序切换：完成当前账号、同步状态，再在同一个已授权窗口里切到下一个店小秘/TK 账号继续。
- 当前授权窗口是唯一采集通道。FastMoss 页面筛选、页面读取、TikTok 商品页确认、店小秘按钮点击都在这个窗口里完成。
- 页面操作优先走当前授权页面通道；不要使用桌面控制方式代办页面点击。
- 辅助脚本只负责本地配置状态、账号检查、筛选、状态初始化和同步，不负责页面点击。
- 采集前只做三类判断：本地配置是否齐、页面是否需要人工确认、商品是否符合选品规则。配置齐全时，不再向用户反复确认操作窗口或账号切换。
- 本地配置统一由 `local-credentials.mjs` 管理。只检查是否已配置；配置缺什么只问什么；本机缺 `firebaseConfig` 时才问数据库配置。不要在回复、日志或结果文件里展示任何本地配置值。
- FastMoss 配置全局复用；店小秘配置按 TK 账号绑定复用，同一个 TK 账号已有绑定时直接使用。
- 采集前必须明确目标 TK 账号；用户命令里已经写账号就沿用，没写才问。目标账号必须存在于 TK 网站共享账号列表；运行本 skill 自带 `scripts/firestore-sync.mjs preflight --account <账号名>` 检查，账号不存在就让用户检查或先在商品/订单模块新增，不自动创建。
- 普通页面进入、账号切换和明确目标店铺选择按本地配置状态处理。只有平台人工确认、付费确认或发布确认必须停止让用户处理。
- 普通登录、账号切换和明确目标店铺选择由 Codex 按本地配置处理；遇到验证码、平台人工确认或付费/发布确认才停止。FastMoss 登录失败、会员过期或本地状态标记为 `expired` 时，停止并让用户重新提供可用资料。
- FastMoss 页面状态失效、会员过期、账号不可用或页面提示需要重新进入时，不要反复重试；标记本地状态失效，让用户重新提供资料后再继续。
- 只使用当前已授权的操作窗口，不创建新的操作环境。
- 不复制 FastMoss 或店小秘 cookie、LocalStorage、IndexedDB；需要切号时只在同一个已连接 Chrome 会话里切换店小秘账号。
- 不迁移账号资料。切换 TK 账号时优先在同一个已授权窗口里切换店小秘账号。
- FastMoss 条件固定为日本、日元、店铺总销售额 10,000-80,000、店铺近 7 天销量大于 0、商品近 7 天销量大于 0。
- 每次新采集必须创建独立运行目录。该批次的候选、拒绝、采集记录和去重清单都只写入这个目录。
- 新批次去重清单必须从数据库现有 `collection_records` 和 `collection_excluded_products` 拉取，并限定目标账号；不要从历史本地运行目录、旧 CSV 或临时缓存拼出去重清单。
- 数据库旧商品只用于排除重复，不能计入本次新采集数量；如果页面或店小秘返回的是旧商品，必须标记 `是否旧商品=是`、`是否计入本次=否` 并补采新商品。
- 同步前必须逐条校验 `商品近7天销量` 和 `店铺总销售额（日元）`。这两个字段不能为空；商品近 7 天销量必须大于 0；店铺总销售额必须在 10,000-80,000 日元内。不满足的商品只能留在过程文件里并标记不计入，必须补采替换品。
- 店小秘只允许采集到采集箱/待编辑商品。
- 同步到 `collection_records` 的商品必须已经尝试店小秘采集；采集表字段顺序使用 `采集时间`、`采集状态`、`选品判断`。采集状态只允许 `已采集` 或 `采集失败`；成功时 `选品判断` 写成功选品逻辑，失败时写采集失败原因，不写店小秘编辑失败、跳过或不合格原因。尚未尝试采集的候选商品只能留在过程文件，不能以 `待采集` 写入采集表。
- 不自动发布商品，不修改标题、价格、库存、主图、SKU、运费模板。
- 遇到 FastMoss、TikTok 商品页或店小秘要求平台人工确认、验证码/人机验证、付费确认或发布确认，按“平台人工确认处理”执行；普通页面进入、切号和明确目标店铺选择按用户已提供的信息代办。
- 平台人工确认必须由用户本人或用户已安装的确认插件处理。Codex 不接入第三方打码/过验证服务，不模拟绕过，只在页面恢复正常后继续。
- 用户说“采集20个”或“采集20个符合条件商品”时，默认目标是采集到 20 个已经完成筛选、符合条件且尝试进入店小秘采集箱的商品。

## 平台人工确认处理

平台人工确认包括 FastMoss、TikTok 商品页、店小秘页面出现验证码、人机验证、风险确认、页面空白确认、付费确认或发布确认。处理目标是不卡死、不丢状态、不把未知结果当成功。

- 一旦发现页面进入平台人工确认，立即停止当前页面操作，不继续点击、刷新、重复读取大段页面内容。
- 在本次运行目录写入或更新 `page_confirmation_state.json`，记录 `status: "verification_blocked"`、目标账号、阶段、商品 ID、商品名称、商品链接、当前页面地址、阻塞时间和最近一次轻量检查时间；不记录账号资料、cookie、LocalStorage、截图或长页面文本。
- 不反复询问用户。用户有自动确认插件时，保持当前页，按 10-15 秒间隔轻量检查页面是否恢复业务内容；默认最多等待 5 分钟。
- 页面恢复后，把 `page_confirmation_state.json` 更新为 `status: "resumed"`，继续同一个商品的采集步骤，并在完成后关闭该商品页。
- 等待超时或页面仍无法确认采集结果时，关闭当前商品页；如果已经进入某个候选商品的店小秘采集动作，则在 `collection_records.csv` 写 `采集状态=采集失败`，`选品判断` 写清失败原因，例如“页面出现平台人工确认，等待超时，未确认店小秘采集成功。”，然后继续补采下一个候选商品。
- 如果阻塞发生在 FastMoss 列表采集阶段且尚未进入具体商品，保留已采集的 `products.json` 局部结果；页面恢复后继续当前筛选条件。若同一列表连续两次阻塞且没有新增商品，停止本批次页面采集并让用户处理页面状态。
- 平台人工确认期间不能把空表、半页数据、遮罩层数据或旧页面缓存当成真实结果；也不能把旧商品或未尝试采集的候选商品算入本次新采集数量。

## 默认流程

1. 确认当前工作目录是用户希望保存采集结果的项目目录。
2. 读取 `references/rules.md` 和 `references/fastmoss-selection-sop.md`。
3. 确认目标账号，运行本地配置检查；缺采集表同步配置、FastMoss 或该 TK 账号店小秘绑定时，只索要缺失项并保存。
4. 运行 `scripts/firestore-sync.mjs preflight --account <账号名>`；所有输出和同步记录都要包含 `账号` 字段。
5. 创建新的 `data/collection/fastmoss/runs/<run-id>/`，立即运行 `scripts/firestore-sync.mjs dedupe data/collection/fastmoss/runs/<run-id> --account <账号名>`，生成数据库来源的 `dedupe_manifest.json`。
6. 确认当前操作窗口已可用；不可用才让用户处理。普通页面进入、切号和目标店铺选择由 Codex 按本地配置状态完成。
7. 使用当前授权窗口在真实 FastMoss 页面采集店铺和商品，并把页面结果保存到本次运行目录的 `products.json`。
8. 采集当场完成硬过滤、评分、数据库去重和业务复核，生成候选、拒绝和采集记录文件。
9. 对符合条件的新商品，在同一个授权窗口里打开真实 TikTok Shop 商品页，点击店小秘“开始采集”，只放进采集箱/待编辑商品；遇到平台人工确认按状态机等待、恢复或写失败原因；每完成或放弃一个商品都关闭对应商品页，避免页面过多。
10. 同步前复核合格 20 条：`商品近7天销量` 非空且大于 0，`店铺总销售额（日元）` 非空且在 10,000-80,000 内，`是否计入本次` 为 `是`，`是否旧商品` 为 `否`，且商品 ID 不在 `dedupe_manifest.json`。
11. 记录店小秘采集结果后，运行 `scripts/firestore-sync.mjs sync data/collection/fastmoss/runs/<run-id> --account <账号名>` 同步到 Firestore，并打开 TK 网站数据采集页确认状态；不要让用户手动导入结果。

## 脚本运行方式

从用户项目目录运行脚本，保持输出进入该项目的 `data/collection/fastmoss/runs/`。辅助脚本不操作浏览器页面，只处理配置状态、筛选、采集表生成和同步：

```bash
node <skill-dir>/scripts/local-credentials.mjs status
node <skill-dir>/scripts/firestore-sync.mjs preflight --account NOMA
node <skill-dir>/scripts/firestore-sync.mjs dedupe data/collection/fastmoss/runs/<run-id> --account NOMA
node <skill-dir>/scripts/select-fastmoss-products.mjs data/collection/fastmoss/runs/<run-id>/products.json --account NOMA
node <skill-dir>/scripts/init-dianxiaomi-status.mjs data/collection/fastmoss/runs/<run-id>/selection_candidates.json --account NOMA
node <skill-dir>/scripts/firestore-sync.mjs sync data/collection/fastmoss/runs/<run-id> --account NOMA
```

`NOMA` 是本次要同步和采集到店小秘的目标账号。一个任务只用当前授权窗口；FastMoss 阶段和店小秘阶段都继续使用同一窗口。多个账号按顺序在同一窗口里切换店小秘账号。

本地配置只用配置检查脚本检查是否齐全。缺资料时让用户提供缺失项并由脚本保存；不要把保存命令、配置值或读取结果粘贴进回复、日志或采集文件。

Firestore 同步脚本：

```bash
node <skill-dir>/scripts/firestore-sync.mjs accounts
node <skill-dir>/scripts/firestore-sync.mjs preflight --account NOMA
node <skill-dir>/scripts/firestore-sync.mjs dedupe data/collection/fastmoss/runs/<run-id> --account NOMA
node <skill-dir>/scripts/firestore-sync.mjs sync data/collection/fastmoss/runs/<run-id> --account NOMA
```

`firestore-sync.mjs` 直接读取本地配置里的采集表同步配置，不依赖项目内 `npm run tk` 或任何外部 npm CLI。

不要让用户手动运行这些命令；Codex 自己执行并向用户说明当前阶段即可。

## 输出要求

采集或筛选完成后，输出：

- 采集表：`collection_records`，每行是一条合格商品记录，包含目标账号、商品名称、真实 TK 商品链接、FastMoss 链接、商品近 7 天销量、选品分、采集时间、采集状态和选品判断。`店铺总销售额（日元）` 只作为筛选校验字段，不进入采集表默认展示/导出。采集阶段只写采集字段：`账号`、`选品分`、`商品名称`、`店铺名`、`商品价格`、`商品近7天销量`、`采集时间`、`采集状态`、`选品判断`。`选品判断` 放在 `采集状态` 后面；成功写成功选品逻辑，失败写采集失败原因，不能重复拼接同一内容，也不能混入店小秘编辑判断。
- 本地采集表补录文件：`collection_records.csv`
- 店小秘编辑追踪字段顺序：`店小秘编辑状态`、`编辑时间`、`编辑标题`、`编辑判断`。采集阶段不写这几个编辑字段；编辑技能成功时才写 `店小秘编辑状态=已编辑`、编辑时间、编辑标题和成功判断，失败/跳过/不合格时才写 `店小秘编辑状态=编辑失败`、编辑时间和失败判断。`商品名称` 属于采集字段，是采集时的原始标题，不由编辑技能维护。
- 本地候选过程文件：`selection_candidates.csv`
- 拒绝品表：`selection_rejects.csv`
- 本次运行目录：`data/collection/fastmoss/runs/<run-id>/`
- 数据库去重清单：`dedupe_manifest.json`，来源必须是 Firestore，包含同账号旧商品 ID/链接/键；这些旧商品不得计入本次新采集。
- 数据库同步：合格商品采集结果写入用户 Firestore 的同一张 `collection_records` 采集表；拒绝品只写入 `collection_excluded_products` 的最小去重记录。同一个账号下的同一个核心 TK 链接或商品 ID 只更新状态，不重复新增；不同账号的数据互不覆盖。
- 简短说明：采集到多少候选品、多少拒绝品、多少已采集到店小秘、哪些需要用户处理。

最终业务判断使用简洁表格：

| 商品名称 | 选品判断 | 操作 |

拒绝品只列决定性原因，不写泛泛优缺点。
