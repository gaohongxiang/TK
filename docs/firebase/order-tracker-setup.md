# 订单跟踪器 · BYO Firebase Firestore 接入说明

这个模式是 `你自己的 Firebase Firestore + Firestore 自带离线缓存`：

1. 先到 [Firebase Console](https://console.firebase.google.com/) 新建一个项目。
2. 在项目里进入 `Firestore Database`，创建数据库。
3. 在 `Project settings -> General` 里创建一个 `Web App`。
4. 复制控制台给你的整段 `firebaseConfig`。
5. 打开 Firestore 的 `Rules` 页面，把 [order-tracker-firestore.rules](./order-tracker-firestore.rules) 里的内容粘贴进去并发布。
6. 打开工具里的订单页，选择 `Firebase Firestore`。
7. 把整段 `firebaseConfig` 粘到配置框里，点击连接。

## 从 GitHub Gist 迁移

1. 在订单页选择 `Firebase Firestore`，先填好 `firebaseConfig`。
2. 点 `从 GitHub Gist 迁移`。
3. 输入 `GitHub Token + Gist ID`。
4. 系统会先读取 GitHub Gist 里已经同步到云端的数据。
5. 如果 Gist 里有数据，会把这份云端数据写入当前 Firestore；如果 Gist 里没有数据，就直接连接当前 Firestore。
6. 如需从 Gist 重新迁移，目标 Firestore 应保持为空。
7. 迁移成功后，页面会自动切换到 Firestore 模式。

## 说明

- 云端只同步到你自己的 Firebase 项目里，不会进入工具作者的数据库。
- Firestore 模式不再使用工具自己的 IndexedDB 会话缓存，而是直接依赖 Firestore 自带的离线缓存。
- 如果你换浏览器或换设备，只要连同一个 Firebase 项目并填同一套 `firebaseConfig`，就能恢复数据。
- 从 GitHub Gist 迁移时，读取的是 Gist 云端已经存在的数据，不包含其他浏览器里尚未同步的本地改动，也不会读取你当前 Firestore 项目里新增的订单。
- 当前这套规则是最省事的直连方案，适合彼此信任的小团队或自用场景；拿到这套 `firebaseConfig` 的成员都能读写全部订单。
