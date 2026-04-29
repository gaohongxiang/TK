# 订单跟踪器 · BYO Supabase 接入说明

这个模式是 `本地优先 + 你自己的 Supabase`：

1. 先到 [Supabase Dashboard](https://supabase.com/dashboard) 新建一个项目。
2. 确认项目启用了 `Data API`；如果你想先看官方说明，可以直接看 [Data API 文档](https://supabase.com/docs/guides/api)。
3. 确认项目对外暴露的表启用了 `RLS`。
4. 打开 `SQL Editor`，执行最新的 [order-tracker-schema.sql](/supabase/order-tracker-schema.sql)。
5. 在 `General` 页面复制 `Project ID`；再到 `API Keys` 页面复制 `Publishable key`。
6. 打开工具里的订单页，选择 `Supabase`。
7. 填入 `Project ID` 和 `Publishable key`。
8. 点击“连接并开始使用”。

如果你之前已经在用 Gist：

1. 在订单页选择 `Supabase`，先填好 `Project ID` 和 `Publishable key`。
2. 点 `从 GitHub Gist 迁移`。
3. 在弹窗里填入 `Gist Token` 和 `Gist ID`。
4. 系统会先读取 GitHub Gist 里已经同步到云端的数据。
5. 如果 Gist 里有数据，会把这份云端数据写入当前 Supabase；如果 Gist 里没有数据，就直接连接当前 Supabase。
6. 目标 Supabase 必须先执行过最新初始化 SQL；如需从 Gist 重新迁移，目标库应保持为空库。如果目标库里已经有订单数据，迁移会停止。
7. 迁移成功后，页面会自动切换到 Supabase 模式。

补充说明：

- 订单会先写入浏览器本地数据库（IndexedDB），页面仍然是秒开和离线可用。
- 云端只同步到你自己的 Supabase 项目里，不会进入工具作者的数据库。
- 如果你换浏览器或换设备，只要连同一个 Supabase 项目并填同一套 `Project ID + Publishable key`，就能恢复数据。
- 从 GitHub Gist 迁移时，读取的是 Gist 云端已经存在的数据，不包含其他浏览器里尚未同步的本地改动。
- 最新 Supabase 结构已经改成正式多列；如果你之前建过旧版 `payload jsonb` 结构，建议直接用一个空的 Supabase 项目重新执行最新 SQL，再从 Gist 迁移一次。
- 如果团队里的人彼此信任，也可以共用同一个 Supabase 项目；只要大家填同一套 `Project ID + key`，看到的就是同一份订单数据。
- 当前这套直连方案没有成员级权限隔离，也没有操作审计；拿到这套 `Project ID + key` 的人都能读写全部订单，所以更适合小团队或自用场景。
- 因为这是浏览器直接通过 Data API 访问你自己的项目，所以请始终启用 RLS，并只把这个项目用于你自己的订单数据。
- 创建项目时如果能直接勾选 `Enable automatic RLS`，建议勾上；但只勾这个还不够，仍然要执行上面的 SQL，把表结构和 policy 一起建好。
- 如果你创建项目时忘了勾 `RLS`，也不用重建项目；执行上面的 SQL 后，脚本会对这 3 张表显式执行 `enable row level security`。
