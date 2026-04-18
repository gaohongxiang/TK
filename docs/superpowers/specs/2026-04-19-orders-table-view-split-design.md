# 订单列表视图拆分设计

## 目标

把订单跟踪器中“订单列表表格视图”从 `js/orders/index.js` 中拆出来，形成独立的视图模块；本阶段不改 Gist 同步、IndexedDB、本地缓存、账号合并逻辑，也不改页面交互和视觉表现。

## 当前问题

- `js/orders/index.js` 同时承担了数据存储、云端同步、弹窗交互、账号标签、搜索、分页、排序、表格渲染。
- 最近已经出现过搜索框失焦、中文输入法被打断等问题，根因都在表格工具栏与整块重渲染耦合过深。
- 后续继续改订单列表交互时，容易因为 `renderTable()` 的副作用波及同步或其他 UI。

## 方案

### 方案 A：一次性把 `js/orders/index.js` 拆成 store / sync / view 三个文件

- 优点：边界最清晰，长期最好维护。
- 缺点：改动范围大，本轮风险高，验证成本也高。

### 方案 B：先单独拆出 table view 模块

- 优点：直接命中最近最脆弱的区域，改动范围可控。
- 优点：可以在不动同步逻辑的前提下，先建立模块边界。
- 缺点：`js/orders/index.js` 仍会保留不少业务逻辑，后续还需要第二阶段继续拆。

### 方案 C：不拆文件，只在 `js/orders/index.js` 内部重排函数

- 优点：改动最少。
- 缺点：结构问题基本不解决，后续回归风险仍然高。

## 选型

采用方案 B。

## 设计

### 新文件

- `js/orders/table.js`

职责：

- 订单列表搜索、分页、排序、空状态、表格 HTML 生成
- 搜索输入框焦点和光标恢复
- 搜索框 IME 组合输入保护
- 顶部/底部分页工具栏渲染与事件绑定

不负责：

- 订单数据持久化
- Gist 同步
- 账号增删改
- 弹窗与表单提交

### 对外接口

暴露全局对象 `OrderTableView`，至少提供：

- `deriveDisplayedOrders(...)`
- `render(...)`

其中：

- `deriveDisplayedOrders` 保持纯函数，便于用 Node 脚本做回归检查。
- `render` 接收容器、状态、订单数据和回调，完成 DOM 渲染与交互绑定。

### `js/orders/index.js` 调整

- 保留同步、缓存、账号、弹窗和订单 CRUD 逻辑。
- `renderTable()` 改为收集状态和回调，然后委托给 `OrderTableView.render(...)`。
- 删除 `js/orders/index.js` 中与 table view 直接相关的工具函数，避免双份逻辑。

## 风险控制

- 不改变现有状态结构，仍使用 `state.searchQuery`、`state.pageSize`、`state.currentPage`、`state.sortOrder`。
- 不改变顶部和底部分页的交互文案。
- 不改变搜索范围字段。
- 先写最小 Node 校验，锁住新模块接口和纯函数行为，再做实现。

## 验证

- Node 级回归检查：新模块暴露接口、搜索过滤、分页边界。
- `node --check js/orders/table.js`
- `node --check js/orders/index.js`
- `git diff --check`
