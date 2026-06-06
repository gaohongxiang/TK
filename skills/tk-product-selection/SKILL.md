---
name: tk-product-selection
description: 授权电商选品流程：优先使用出海匠、必要时备用 FastMoss，为 TikTok Shop 日本站按统一选品策略筛选合格商品，登记到店小秘待编辑商品，并同步到 TK 采集表。用于用户要求采集、选品、出海匠采集、Chuhaijiang 采集、FastMoss 备用采集、爆品延伸、关键词采集、店铺挖掘、同类商品扩展、店小秘待编辑商品登记或采集表同步时。
---

# TK Product Selection

当用户要求做 TikTok Shop 日本站选品、出海匠或 FastMoss 商品筛选、店小秘待编辑商品登记，或说“帮我采集/选品/按爆品延伸/搜商品”时使用这个 skill。默认优先出海匠；FastMoss 只在用户明确指定、出海匠不可用，或当前策略必须依赖 FastMoss 页面能力时作为备用。

## 核心定位

- 这是用户授权的电商运营流程。对用户汇报和内部计划都使用电商语境：`选品`、`商品筛选`、`店小秘待编辑`、`采集表同步`、`时间排重`。
- 只使用当前已授权 Chrome 会话完成出海匠/FastMoss、TikTok 商品页、店小秘插件和采集表确认；页面操作优先走当前授权页面通道，不用桌面控制代办点击。当前已连接的 Chrome 扩展会话是页面采集和插件采集的唯一业务现场，多个店小秘/TK 账号必须顺序切换，完成一个账号同步后再处理下一个。
- 页面操作必须串行、低频、可恢复：优先复用当前标签/来源页正常跳转，避免批量直开、频繁新建关闭标签、并发打开商品页或连续刷新。
- 辅助脚本分层执行：配置/筛选/同步脚本不负责页面点击；`run-dxm-collection-rpa.mjs` 只负责店小秘插件采集这段浏览器自动化，并把状态写入运行目录。
- 不在回复、日志或结果文件里展示本地配置值、密码、token、cookie、LocalStorage 或长页面内容。排障时只保留业务状态、计数、商品 ID、时间戳和文件路径。不复制 FastMoss 或店小秘 cookie、LocalStorage、IndexedDB；优先在同一个已连接 Chrome 会话里切换店小秘账号。

## 必读资料

- `references/rules.md`：日本站全局规则、统一选品策略库和数据条件。评估商品前必须读取。
- `references/chuhaijiang-selection-sop.md`：默认来源 SOP。用户没有明确指定 FastMoss 时读取。
- `references/fastmoss-selection-sop.md`：备用来源 SOP。只有用户指定 FastMoss、出海匠不可用，或策略必须依赖 FastMoss 页面能力时读取。

执行采集时始终运行本 skill 目录里的脚本：`firestore-sync.mjs`、`local-credentials.mjs`、`select-chuhaijiang-products.mjs`、`select-fastmoss-products.mjs`、`init-dianxiaomi-status.mjs`、`run-dxm-collection-rpa.mjs`。

## 启动检查

1. 先运行 `local-credentials.mjs status`，盘点本机是否已有 `firebaseConfig`、`firebaseAuth`、出海匠/FastMoss 默认账号状态和目标 TK 账号的店小秘绑定；这是配置盘点，不代表两个来源都要打开页面检查。
2. 明确目标 TK 账号、来源偏好、策略和本次数量。用户命令里已有账号就沿用；没写才问。
3. 运行 `firestore-sync.mjs preflight --account <账号名>`，确认目标账号存在、Firebase Auth 可用、采集表可读写。
4. 只检查本次实际使用来源的页面会员状态：默认出海匠就只查出海匠；用户指定 FastMoss 或出海匠不可用切到 FastMoss 时才查 FastMoss。页面会员可用就沿用；页面是游客、过期、权限不足或登录失效时，才使用该来源本地保存账号自动登录；本地账号也过期或登录失败时，标记失效并提醒用户提供新账号密码。
5. 通过 `local-credentials.mjs` 管理本地私密配置，配置缺什么只问什么，本机缺 `firebaseConfig` 时才问；FastMoss 账号全局复用，店小秘按 TK 账号绑定复用。
6. 目标账号必须存在；`firestore-sync.mjs preflight --account <账号名>` 失败时停止，不自动创建账号。
7. 普通登录、账号切换和明确目标店铺选择可以在已授权页面中处理；验证码、平台人工确认、FastMoss 登录失败或本地状态为 `expired` 时停止并记录状态，不继续硬采。

Firestore 身份验证使用 Firebase Authentication 用户身份：同步脚本会用私密配置里的 `firebaseAuth.email/password` 换取 ID token 并按 Firestore Rules 读写。不要把 Firebase Auth 密码写入项目目录；不要把 Google service account 管理员私钥保存进本 skill。

## 来源和策略

- 来源和策略分开：来源只决定从哪里拿页面数据；策略决定如何找候选和筛选。
- 默认策略是 `mixed-discovery`：出海匠优先，组合轻小类目、页面筛选、少量关键词、同类/店铺线索，不从混杂榜单无脑采。
- 用户说“原 FastMoss 条件”“小店条件”“店铺总销售额 1-8 万日元”时，使用 `small-shop-filter`；这个策略不是 FastMoss 专属。
- 用户说“关键词”“类目榜单”“爆品延伸”“店铺挖掘”“相似商品”“指定链接/种子商品”时，按 `rules.md` 同名策略执行。
- 两个来源都必须遵守同一份全局选品规则、同一套数据库去重和同一套店小秘采集边界。

## 数据边界

- 每次新采集必须创建独立运行目录。FastMoss 用 `data/collection/fastmoss/runs/<run-id>/`，出海匠用 `data/collection/chuhaijiang/runs/<run-id>/`。
- 新批次去重清单必须从 Firestore 现有 `collection_records` 和 `collection_excluded_products` 拉取，并限定目标账号；不要从历史本地运行目录、旧 CSV 或临时缓存拼出去重清单。
- 采集当场完成硬过滤、评分、数据库去重和店小秘插件结果确认；`collection_records` 是一张采编记录表，必须带 `采集状态`，拒绝品只进入轻量去重集合 `collection_excluded_products`。
- 数据库旧商品只用于排除重复，不能计入本次新采集数量；旧商品或未尝试采集的候选商品不能写入本次采集表。
- 基础硬门槛：日本站、真实 TikTok 商品链接、商品近 7 天销量大于 0、通过全局规则。`small-shop-filter` 额外校验店铺总销售额 10,000-80,000 日元、店铺近 7 天销量大于 0。
- 店小秘只允许采集到采集箱/待编辑商品；不自动发布，不修改标题、价格、库存、主图、SKU、运费模板。
- 店小秘提示“该产品在店小秘已有采集记录，是否继续采集？”时，说明该商品已经采集过；必须点击“取消”，不要点击“确定”重复采集。本次记录按 `已采集` 写入，`选品判断` 说明已取消重复采集。
- `collection_records` 只写已尝试店小秘采集的商品，采集状态只允许 `已采集` 或 `采集失败`。成功时 `选品判断` 写成功选品逻辑；失败时写采集失败原因。
- 采集阶段只写采集字段：`账号`、`选品分`、`商品名称`、`店铺名`、`商品价格`、`商品近7天销量`、`采集时间`、`采集状态`、`选品判断`。
- 店小秘编辑追踪字段顺序是 `店小秘编辑状态`、`编辑时间`、`编辑标题`、`编辑判断`；采集阶段不写这几个编辑字段，编辑 skill 后续按既有记录回写。
- 目标数量按成功采集数计算。用户要求 20 个时，候选池应准备 40-60 个合格候选；验证码、插件不可确认或失败商品不占成功目标，自动用后备候选补。

## 页面稳定与减触发

- 每次只处理一个来源页和一个商品页。出海匠/FastMoss 详情、TikTok 商品页、店小秘插件确认不要并发打开；上一商品写入结果后再进入下一商品。
- TikTok 商品页优先从出海匠/FastMoss 详情页的官方链接点击或正常跳转进入；必须直接打开链接时，只单页打开，等待页面稳定后再判断插件，不做批量 `goto`。
- 商品之间保留 20-60 秒的自然间隔；触发过验证后，下一个商品使用更慢节奏。不要连续快速打开、关闭、刷新同一平台页面。
- 店小秘插件浮层出现但 TikTok 商品页仍是 `Security Check`、`Verify to continue`、滑块拼图、空白确认或遮罩时，不点击“开始采集”。先按平台人工确认等待页面恢复。
- 出海匠/FastMoss 列表或详情页出现登录、会员、权限、验证码、人机验证、风险确认、空白页或数据遮挡时，暂停来源采集；不能把空结果当作无货，也不能立刻换来源或换关键词硬采。
- 页面恢复后继续同一来源、同一筛选条件、同一商品；不要因为触发过验证就把旧缓存、半页数据或未确认商品写入本批次。

## 平台人工确认处理

FastMoss、出海匠、TikTok 商品页或店小秘出现验证码、人机验证、风险确认、登录失效、空白确认、付费确认或发布确认时，停止当前页面操作，不接入第三方打码/过验证服务，不模拟绕过。

- 在本次运行目录记录 `page_confirmation_state.json`，只写恢复需要的业务信息。
- 在本次运行目录维护 `rpa_state.json`、`rpa_events.jsonl`、`collection_attempts.json` 和最终 `collection_records.csv`；`collection_records.csv` 只从已尝试结果生成。
- 首次进入 `verification_blocked` 或阻塞对象变化时，立即运行 `scripts/notify-human-verification.mjs --run-dir <run-dir> --platform <平台> --stage <阶段> --product-id <商品ID>` 播放提示音；同一 key 已提醒过则不要重复响。
- 保持当前可见页面，不立即关闭；用户有自动确认插件时，按 10-15 秒轻量检查页面是否恢复，默认最多等待 5 分钟，不反复催问用户。
- 页面恢复后继续同一商品或同一来源筛选条件。阻塞发生在来源列表/详情阶段且还没有进入店小秘采集时，不写 `collection_records`，只保留现场并继续或暂停本批次。
- 阻塞发生在 TikTok 商品页且等待超时或仍无法确认店小秘采集结果时，先让当前页保留到用户可见；记录失败原因后再关闭该商品页并补采下一个候选。用户明确要求继续等时，不写失败。
- 已进入店小秘采集动作的商品如果等待超时，写 `采集状态=采集失败`，并在 `选品判断` 写页面确认等待超时、未确认店小秘采集成功的原因。
- 不能把空表、遮罩层、半页数据、验证页或旧缓存当成真实结果。

## 默认流程

1. 做启动检查，确认工作目录、目标账号、来源、策略和本次数量。
2. 读取 `rules.md` 和本次来源 SOP。
3. 运行 `preflight`，确认账号与 Firestore 读写权限。
4. 创建本次运行目录，立即运行 `dedupe` 生成数据库来源的 `dedupe_manifest.json`。
5. 在真实出海匠或备用 FastMoss 页面低频串行采集候选，保存 `products.json`；出海匠必须逐个进详情页取得 TikTok 官方商品链接。
6. 运行对应筛选脚本完成硬过滤、评分、数据库去重和业务复核，生成候选和拒绝文件；候选不足目标成功数的 2 倍时继续补候选。
7. 运行 `run-dxm-collection-rpa.mjs <run-dir> --account <账号名> --target-successes <数量>`，让固定状态机逐个打开真实 TikTok 商品页、检查验证、检查店小秘按钮、点击“开始采集”、判断成功/重复/失败并写结果。
8. RPA runner 记录 `采集时间`、`采集状态` 和本次采集结果对应的 `选品判断`，只让已尝试店小秘采集的商品进入 `collection_records.csv`；用户说“继续”时使用 `--continue-blocked --retry-verification` 从同一阻塞商品恢复。
9. 复核数量和硬门槛后运行 `firestore-sync.mjs sync <run-dir> --account <账号名>`，再打开 TK 网站数据采集页确认状态。

## 脚本索引

```bash
node <skill-dir>/scripts/local-credentials.mjs status
node <skill-dir>/scripts/local-credentials.mjs set-firebase-auth --email <Firebase登录邮箱> --password <Firebase登录密码>
node <skill-dir>/scripts/local-credentials.mjs set-chuhaijiang --username <出海匠账号> --password <出海匠密码>
node <skill-dir>/scripts/firestore-sync.mjs preflight --account NOMA
node <skill-dir>/scripts/firestore-sync.mjs dedupe data/collection/chuhaijiang/runs/<run-id> --account NOMA
node <skill-dir>/scripts/select-chuhaijiang-products.mjs data/collection/chuhaijiang/runs/<run-id>/products.json --account NOMA --strategy mixed-discovery
node <skill-dir>/scripts/select-fastmoss-products.mjs data/collection/fastmoss/runs/<run-id>/products.json --account NOMA --strategy small-shop-filter
node <skill-dir>/scripts/init-dianxiaomi-status.mjs data/collection/chuhaijiang/runs/<run-id>/selection_candidates.json --account NOMA
node <skill-dir>/scripts/run-dxm-collection-rpa.mjs data/collection/chuhaijiang/runs/<run-id> --account NOMA --target-successes 20
node <skill-dir>/scripts/run-dxm-collection-rpa.mjs data/collection/chuhaijiang/runs/<run-id> --account NOMA --target-successes 20 --continue-blocked --retry-verification
node <skill-dir>/scripts/firestore-sync.mjs sync data/collection/chuhaijiang/runs/<run-id> --account NOMA
```

不要让用户手动运行这些命令；Codex 自己执行并汇报当前阶段。实际来源的运行目录必须贯穿 `dedupe`、筛选、`init-dianxiaomi-status` 和 `sync`。
数据库前置校验和同步使用 skill 自带脚本路径，例如 `scripts/firestore-sync.mjs preflight --account <账号名>` 和 `scripts/firestore-sync.mjs sync <run-dir> --account <账号名>`；采集流程不依赖项目内 `npm run tk`。

## 输出要求

- 本次运行目录。
- 采集表 `collection_records.csv`：`账号`、`选品分`、`商品名称`、`店铺名`、`商品价格`、`商品近7天销量`、`采集时间`、`采集状态`、`选品判断`，以及真实 TK 商品链接和来源链接。
- RPA 状态文件：`rpa_state.json`、`rpa_events.jsonl`、`page_confirmation_state.json`、`collection_attempts.json`。
- 候选过程文件、拒绝品表和数据库去重清单。
- Firestore 同步结果：已采集、采集失败、拒绝品数量，以及需要用户处理的页面或商品。

最终业务判断使用简洁表格：

| 商品名称 | 选品判断 | 操作 |

拒绝品只列决定性原因，不写泛泛优缺点。
