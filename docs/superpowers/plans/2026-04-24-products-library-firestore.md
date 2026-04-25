# 商品库 Firestore 模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立的商品库模块，在同一个 Firebase Firestore 项目里维护商品资料，并复用现有海外运费计算逻辑生成商品级预估运费。

**Architecture:** 抽出一层共享的运费计算核心，利润计算器继续调用这层核心，商品库模块也调用同一套规则计算预估运费。商品库作为独立视图接入现有 hash 路由，数据单独存入 `products` 集合，界面包含列表、搜索、新增/编辑弹窗和空态引导。

**Tech Stack:** 原生 HTML/CSS/JS、Firebase Firestore compat SDK、现有全局设置与计算器逻辑、Node 契约测试

---

### Task 1: 抽出共享运费计算核心

**Files:**
- Create: `js/shipping-core.js`
- Modify: `js/calc/shipping.js`
- Test: `tests/shipping-core-module.test.js`

- [ ] 写失败测试，覆盖 `computeShippingQuote()` 和最终人民币运费计算
- [ ] 运行 `node tests/shipping-core-module.test.js`，确认失败
- [ ] 新建共享模块，导出运费规则、计算核心、最终人民币运费 helper
- [ ] 让利润计算器改为调用共享模块，保持现有表现不变
- [ ] 运行 `node tests/shipping-core-module.test.js` 和现有运费计算测试，确认通过

### Task 2: 新增商品库 Firestore provider

**Files:**
- Create: `js/products/provider-firestore.js`
- Test: `tests/products-provider-firestore-module.test.js`

- [ ] 写失败测试，覆盖 `products` 集合字段映射、config 解析、空态返回
- [ ] 运行 `node tests/products-provider-firestore-module.test.js`，确认失败
- [ ] 实现 provider，支持读取/写入商品文档、复用已保存的 Firebase config
- [ ] 运行 provider 测试，确认通过

### Task 3: 新增商品库页面与列表视图

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/app.js`
- Create: `js/products/table.js`
- Create: `js/products/index.js`
- Test: `tests/products-view-ui.test.js`

- [ ] 写失败测试，覆盖导航入口、视图容器、表格列、空态提示
- [ ] 运行 `node tests/products-view-ui.test.js`，确认失败
- [ ] 在页面中新增“商品库”视图和导航入口
- [ ] 实现商品表格、搜索、空态、工具栏
- [ ] 运行 UI 契约测试，确认通过

### Task 4: 新增商品弹窗 CRUD 与预估运费自动计算

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Create: `js/products/crud.js`
- Modify: `js/products/index.js`
- Test: `tests/products-crud-module.test.js`

- [ ] 写失败测试，覆盖商品新增/编辑、TK ID 唯一、运费自动计算
- [ ] 运行 `node tests/products-crud-module.test.js`，确认失败
- [ ] 实现商品弹窗、字段校验、运费实时预估、保存回 Firestore
- [ ] 运行 CRUD 测试，确认通过

### Task 5: 集成与回归

**Files:**
- Modify: `js/calc/index.js`
- Modify: `js/orders/index.js`
- Modify: `docs/firebase/order-tracker-setup.md`
- Test: `tests/calc-shipping-quote.test.js`
- Test: `tests/orders-storage-mode-ui.test.js`
- Test: `tests/products-provider-firestore-module.test.js`
- Test: `tests/products-view-ui.test.js`
- Test: `tests/products-crud-module.test.js`

- [ ] 补充商品库依赖的脚本顺序与接入说明
- [ ] 确认订单/利润计算器原有功能不回退
- [ ] 运行核心回归测试与 `git diff --check`
- [ ] 完成后再做一轮手工验证说明
