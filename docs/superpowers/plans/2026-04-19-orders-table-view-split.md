# Orders Table View Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the order list table view out of `js/orders/index.js` into an isolated module without changing visible behavior.

**Architecture:** Keep sync, cache, and modal logic inside `js/orders/index.js`, and move search, pagination, sorting, and table rendering into a dedicated global view module. Preserve the existing shared `state` shape so this step stays behavior-preserving and low-risk.

**Tech Stack:** Plain browser JavaScript, global scripts with `defer`, Node assertion scripts for lightweight regression checks.

---

### Task 1: Lock the new table view contract

**Files:**
- Create: `tests/orders-table-view.test.js`

- [ ] **Step 1: Write the failing test**

```js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'table.js'), 'utf8');

assert.match(source, /const OrderTableView = \(function \(\) \{/, '需要新的订单表格视图模块');
assert.match(source, /function deriveDisplayedOrders\(/, '需要暴露纯函数 deriveDisplayedOrders');
assert.match(source, /function render\(/, '需要暴露 render 入口');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/orders-table-view.test.js`
Expected: FAIL because `js/orders/table.js` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `js/orders/table.js` with:

```js
const OrderTableView = (function () {
  function deriveDisplayedOrders() {
    return { isAll: true, sorted: [] };
  }
  function render() {}
  return { deriveDisplayedOrders, render };
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/orders-table-view.test.js`
Expected: PASS

### Task 2: Move pure list derivation logic out of `js/orders/index.js`

**Files:**
- Modify: `js/orders/table.js`
- Modify: `js/orders/index.js`
- Test: `tests/orders-table-view.test.js`

- [ ] **Step 1: Extend the failing test with filtering and paging expectations**

```js
const vm = require('vm');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source + '\nthis.OrderTableView = OrderTableView;', sandbox);

const orders = [
  { id: '1', '账号': 'A', '订单号': 'AA-1', '产品名称': '红色杯子', '快递公司': '顺丰快递' },
  { id: '2', '账号': 'B', '订单号': 'BB-2', '产品名称': '蓝色盘子', '快递公司': '中通快递' }
];

const result = sandbox.OrderTableView.deriveDisplayedOrders({
  orders,
  activeAccount: '__all__',
  searchQuery: '红色',
  sortOrder: 'asc'
});

assert.equal(result.sorted.length, 1);
assert.equal(result.sorted[0].id, '1');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/orders-table-view.test.js`
Expected: FAIL because `deriveDisplayedOrders` still returns an empty list.

- [ ] **Step 3: Implement the pure derivation functions**

Implement in `js/orders/table.js`:

- `normalizeSearchValue`
- `deriveDisplayedOrders`
- `clampPage`

Reuse the current matching fields from `js/orders/index.js`.

- [ ] **Step 4: Update `js/orders/index.js` to delegate list derivation**

Replace the local displayed-order derivation path with `OrderTableView.deriveDisplayedOrders(...)`.

- [ ] **Step 5: Run test to verify it passes**

Run: `node tests/orders-table-view.test.js`
Expected: PASS

### Task 3: Move table/toolbar rendering and event binding

**Files:**
- Modify: `js/orders/table.js`
- Modify: `js/orders/index.js`
- Modify: `index.html`

- [ ] **Step 1: Move toolbar and table rendering helpers**

Move from `js/orders/index.js` into `js/orders/table.js`:

- search input state capture / restore
- toolbar HTML builder
- toolbar binding
- table render flow

- [ ] **Step 2: Define the render entry**

Implement:

```js
OrderTableView.render({
  toolbar,
  footerToolbar,
  wrap,
  orders,
  activeAccount,
  searchQuery,
  sortOrder,
  pageSize,
  currentPage,
  onSearchChange,
  onPageSizeChange,
  onPageChange,
  onSortToggle,
  onEdit,
  onDelete,
  computeWarning
});
```

- [ ] **Step 3: Update `js/orders/index.js` to use the new render entry**

Keep `renderTable()` as a thin adapter that passes state and callbacks into `OrderTableView.render(...)`.

- [ ] **Step 4: Load the new script before `js/orders/index.js`**

Update `index.html` script order so `js/orders/table.js` is loaded before `js/orders/index.js`.

- [ ] **Step 5: Run syntax verification**

Run:

```bash
node --check js/orders/table.js
node --check js/orders/index.js
```

Expected: both exit 0

### Task 4: Final regression verification

**Files:**
- Verify: `tests/orders-table-view.test.js`
- Verify: `js/orders/table.js`
- Verify: `js/orders/index.js`
- Verify: `index.html`

- [ ] **Step 1: Run the table view regression script**

Run: `node tests/orders-table-view.test.js`
Expected: PASS

- [ ] **Step 2: Run syntax checks**

Run:

```bash
node --check js/orders/table.js
node --check js/orders/index.js
```

Expected: both exit 0

- [ ] **Step 3: Run diff format check**

Run:

```bash
git diff --check -- js/orders/table.js js/orders/index.js index.html tests/orders-table-view.test.js
```

Expected: no output
