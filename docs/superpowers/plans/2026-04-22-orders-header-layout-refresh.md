# Orders Header Layout Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重组订单页表格上方布局，让顶部结构变成状态栏、统计卡片、账号行、吸顶控制带四层，并在账号很多时保持稳定。

**Architecture:** 保持现有订单模块拆分方式不变，主要通过 `index.html` 调整主面板容器，`tabs.js` 重构账号行 DOM，`table.js` 重构控制带标记，`style.css` 接管桌面端与移动端布局和吸顶样式。回归测试以静态结构契约和现有模块契约为主。

**Tech Stack:** 原生 HTML / CSS / JavaScript，现有订单模块测试脚本（Node + assert）

---

### Task 1: 钉住新的顶部布局契约

**Files:**
- Create: `tests/orders-header-layout-ui.test.js`
- Modify: `tests/orders-summary-ui.test.js`
- Test: `tests/orders-header-layout-ui.test.js`

- [ ] **Step 1: 写失败测试，描述新的四层布局和账号行结构**

```js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const tabsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'tabs.js'), 'utf8');
const tableSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'table.js'), 'utf8');

assert.match(indexSource, /id="ot-header-status-row"/);
assert.match(indexSource, /id="ot-header-summary-row"/);
assert.match(indexSource, /id="ot-header-accounts-row"/);
assert.match(indexSource, /id="ot-header-controls-row"/);
assert.match(tabsSource, /ot-acc-tabs-all/);
assert.match(tabsSource, /ot-acc-tabs-scroll/);
assert.match(tabsSource, /ot-acc-actions/);
assert.match(tableSource, /ot-sticky-controls/);
```

- [ ] **Step 2: 运行测试，确认当前实现按预期失败**

Run: `node tests/orders-header-layout-ui.test.js`
Expected: FAIL，提示缺少新的顶部分层结构或账号行容器

- [ ] **Step 3: 补充现有统计测试，避免旧结构误通过**

```js
assert.doesNotMatch(indexSource, /id="ot-add" class="btn primary">\\+ 新增订单<\\/button>[\\s\\S]*id="ot-acc-tabs"/);
```

- [ ] **Step 4: 再跑一次相关测试，确认仍然是结构性失败**

Run: `node tests/orders-summary-ui.test.js`
Expected: FAIL 或 PASS，但不能掩盖 `orders-header-layout-ui.test.js` 的失败

### Task 2: 重组主面板顶部结构

**Files:**
- Modify: `index.html`
- Test: `tests/orders-header-layout-ui.test.js`

- [ ] **Step 1: 调整主面板 HTML，拆成四层容器**

```html
<div id="ot-header-status-row" class="ot-header-row ot-header-status-row">...</div>
<div id="ot-header-summary-row" class="ot-header-row ot-header-summary-row">
  <div id="ot-summary-container"></div>
</div>
<div id="ot-header-accounts-row" class="ot-header-row ot-header-accounts-row">
  <div id="ot-acc-tabs"></div>
</div>
<div id="ot-header-controls-row" class="ot-header-row ot-header-controls-row">
  <div id="ot-table-toolbar-container"></div>
</div>
```

- [ ] **Step 2: 从顶部工具栏移除“新增订单”按钮，保留刷新 / 导出 / 退出**

```html
<div class="right">
  <button id="ot-refresh" class="btn sm">↻ 刷新</button>
  <button id="ot-export" class="btn sm">导出 CSV</button>
  <button id="ot-copy-gist" class="btn sm">复制 Gist ID</button>
  <button id="ot-logout" class="btn sm danger">退出</button>
</div>
```

- [ ] **Step 3: 跑布局契约测试**

Run: `node tests/orders-header-layout-ui.test.js`
Expected: 仍可能 FAIL，但失败点应推进到账号行或控制带结构

### Task 3: 重构账号行为固定全部 + 滚动账号 + 固定动作区

**Files:**
- Modify: `js/orders/tabs.js`
- Modify: `css/style.css`
- Test: `tests/orders-header-layout-ui.test.js`
- Test: `tests/orders-tabs-module.test.js`

- [ ] **Step 1: 写出新的账号行 DOM 结构**

```js
container.innerHTML = `
  <div class="ot-acc-row">
    <div id="ot-acc-tabs-all" class="ot-acc-tabs-all">...</div>
    <div id="ot-acc-tabs-scroll" class="ot-acc-tabs-scroll">...</div>
    <div id="ot-acc-actions" class="ot-acc-actions">
      <button class="tab-add" id="ot-tab-add" ...>+</button>
      <button id="ot-add" class="btn primary">+ 新增订单</button>
    </div>
  </div>`;
```

- [ ] **Step 2: 保持现有账号切换、重命名、删除、新增账号交互继续工作**

```js
container.querySelectorAll('[data-tab-acc]').forEach(...)
const addBtn = container.querySelector('#ot-tab-add');
const createBtn = container.querySelector('#ot-add');
```

- [ ] **Step 3: 写最小 CSS，让全部固定、账号区横向滚动、右侧动作固定**

```css
.ot-acc-row { display:grid; grid-template-columns:auto minmax(0,1fr) auto; }
.ot-acc-tabs-scroll { overflow-x:auto; white-space:nowrap; }
.ot-acc-actions { display:flex; gap:8px; }
```

- [ ] **Step 4: 跑账号相关测试**

Run: `node tests/orders-tabs-module.test.js`
Expected: PASS

- [ ] **Step 5: 跑新布局测试**

Run: `node tests/orders-header-layout-ui.test.js`
Expected: 失败点推进到表格控制带或吸顶结构

### Task 4: 重组表格控制带并实现吸顶

**Files:**
- Modify: `js/orders/table.js`
- Modify: `css/style.css`
- Test: `tests/orders-header-layout-ui.test.js`
- Test: `tests/orders-table-view.test.js`

- [ ] **Step 1: 让顶部控制带输出新的吸顶容器类名**

```js
return `
  <div class="ot-table-toolbar ot-sticky-controls">
    <div class="ot-sticky-controls-inner">
      <div class="ot-table-toolbar-left">...</div>
      <div class="ot-table-toolbar-right">...</div>
    </div>
  </div>`;
```

- [ ] **Step 2: 保留底部分页工具栏，但顶部控制带改成搜索左、分页右**

```js
${includeSearch ? `<div class="ot-table-toolbar-left">...</div>` : ''}
<div class="ot-table-toolbar-right">...</div>
```

- [ ] **Step 3: 写最小吸顶样式**

```css
.ot-sticky-controls {
  position: sticky;
  top: 12px;
  z-index: 20;
  background: var(--panel);
}
```

- [ ] **Step 4: 运行表格视图测试**

Run: `node tests/orders-table-view.test.js`
Expected: PASS

- [ ] **Step 5: 运行新布局测试**

Run: `node tests/orders-header-layout-ui.test.js`
Expected: PASS

### Task 5: 完成桌面端与移动端布局收口

**Files:**
- Modify: `css/style.css`
- Modify: `tests/orders-summary-ui.test.js`
- Test: `tests/orders-summary-ui.test.js`

- [ ] **Step 1: 补齐顶部四层、统计卡片并排、移动端堆叠样式**

```css
.ot-header-row { margin-bottom: 14px; }
.ot-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (max-width: 768px) {
  .ot-summary-grid { grid-template-columns: 1fr; }
  .ot-acc-row { grid-template-columns: 1fr; }
  .ot-acc-actions { justify-content:flex-end; }
}
```

- [ ] **Step 2: 更新统计测试，让它断言新的结构仍保留统计卡片容器**

```js
assert.match(indexSource, /id="ot-header-summary-row"/);
assert.match(indexSource, /id="ot-summary-container"/);
```

- [ ] **Step 3: 运行统计 UI 测试**

Run: `node tests/orders-summary-ui.test.js`
Expected: PASS

### Task 6: 回归验证

**Files:**
- Modify: `docs/superpowers/specs/2026-04-22-orders-header-layout-refresh-design.md`（仅当实现偏离 spec 时）

- [ ] **Step 1: 运行本次改动直接相关测试**

Run:

```bash
node tests/orders-header-layout-ui.test.js
node tests/orders-summary-ui.test.js
node tests/orders-table-view.test.js
node tests/orders-tabs-module.test.js
node tests/orders-session-module.test.js
```

Expected: 全部 PASS

- [ ] **Step 2: 运行订单页核心回归**

Run:

```bash
node tests/orders-crud-module.test.js
node tests/orders-export-module.test.js
node tests/orders-search-ime-guard.test.js
node tests/orders-shared-module.test.js
node tests/orders-crud-pagination.test.js
node tests/orders-sync-module.test.js
git diff --check
```

Expected: 全部 PASS，`git diff --check` 无输出
