# 店小秘接口化编辑流程

当用户要求“不点页面表单、走店小秘页面自身接口”时，优先使用本流程。接口脚本和店小秘前端保存 DTO 是主线；Codex Chrome 插件和页面点击只作为备用路线保留，等插件能力更新或用户明确要求时再用。

## 接口边界

- 读取商品：`/api/tiktokProduct/edit.json?id=<商品ID>`。
- 保存商品：`/api/tiktokProduct/add.json`。
- 保存载荷：店小秘前端生成的保存 DTO 序列化为 `tiktokSave.txt`，以 `multipart/form-data` 文件字段提交。
- 注意：`edit.json` 返回的是读取模型，不等于保存 DTO。直接把读取模型原样上传可能触发 `保存对象转换异常,请联系我们!`。
- `op=1`：保存草稿。用于未授权移入待发布时的保守保存。
- `op=2`：发布。禁止使用，除非用户在当前步骤明确授权发布并完成最终复核。
- `op=3`：保存并移入待发布。当前用户已授权编辑完成后使用这个动作；这不是发布。
- `op=5`：定时发布。默认不使用。

## 工作原则

- 输入必须是店小秘 TikTok 商品编辑链接，且链接里能解析出商品 ID。
- 读取接口只做无副作用 GET。
- 保存前必须先生成差异报告，不能直接保存。
- 只改分类、品牌、属性、标题、描述、重量、尺寸、材质、产地、保修等允许字段；需要改价时必须先按 `sku-pricing.md` 生成并确认 SKU 定价报告。
- 默认必须保留 SKU、价格、库存、仓库、运费模板、税务、结算、支付、利润和佣金等字段。用户确认 SKU 定价报告后，只允许修改报告中列出的 SKU 价格字段。
- 保存动作根据当前授权决定：未授权时只允许 `op=1` 保存草稿；当前用户已明确授权“编辑完的商品保存并转入待发布”，所以完整编辑并验证无误后使用 `op=3`。无论如何不得使用 `op=2` 发布，除非用户本次明确说发布。
- 店小秘返回登录失效、验证、权限异常、接口异常、非 JSON、业务错误或无法识别商品对象时停止，不做规避。
- 保存成功后才允许回写数据库；未保存成功不得标记 `店小秘编辑状态=已编辑`。

## 核心发现：读取对象和保存 DTO 不同

这条路线已经验证可行：

- `edit.json` 适合读取原始商品、生成编辑包和做保存后验证。
- 保存时优先复用店小秘编辑页自己的前端模块，让页面 store 生成保存 DTO，再调用前端 service 保存草稿。
- 店小秘前端会把 DTO 转为 `tiktokSave.txt` 文件并提交 `/api/tiktokProduct/add.json`，`op=1` 保存草稿，`op=3` 保存并移入待发布。
- 直接用读取对象拼 `tiktokSave.txt` 属于备用方案，不作为默认保存路线；遇到 `保存对象转换异常` 必须切换到前端 DTO 路线。
- 店小秘商品 ID、TikTok 商品 ID、SKU ID 等 18 位 ID 必须使用页面里的字符串值或原文值，禁止经过普通 JS number 重新序列化。

已验证保存路线的关键模块形态：

- 编辑页入口会加载店小秘 TikTok 商品编辑前端资源。
- store 模块包含基本信息、图片、变种、SKU、物流等分区 store。
- service 模块包含保存函数，当前形态是 `service.v(dto, op)`；资源 hash 会变，不能把文件名写死为唯一依据。
- 保存前端 DTO 时需要删除 `variationBos` 等仅供前端检测的中间字段，保持和店小秘页面保存逻辑一致。

## 已跑通稳定路线：Pinia store 改值 + 前端保存

2026-05-16 已在商品 `172397240566499605` 跑通并验证：

- 直接上传由 `edit.json` 读取对象拼出的 `tiktokSave.txt` 会返回 `保存对象转换异常,请联系我们!`。遇到该错误后不要继续重复上传原始读取对象。
- 正确路线是在真实店小秘编辑页上下文里使用页面已加载的前端 store。当前可用模块形态是：
  - TikTok 编辑主模块：页面资源里的 `index-*.js`，需按导出调用后的 `$id` 识别，不硬编码 hash。
  - 当前已见导出映射：`a()` -> `tiktokGlobalAddStore`，`u()` -> `tiktokGlobalAddBasicStore`，`h()` -> `tiktokGlobalAddProductStore`，`e()` -> `tiktokGlobalSkuAttrStore`，`d()` -> `tiktokGlobalSkuDataStore`，`c()` -> `tiktokGlobalAddOtherStore`，`g()` -> `tiktokGlobalImgStore`，`x()` -> `tiktokcopySiteSkuStore`。
  - 保存 service 当前是 `service-*.js` 的 `v(dto, op)`，但如果组件 ref 不暴露，不要臆造完整 DTO；改用下方 store 改值后触发页面保存命令。
- 页面生产包可能不在 DOM 上暴露分区组件 `ref` / `getFormData()`。这不是阻塞；Pinia store 是活的，动态 `import()` 后调用 store 函数会复用当前页面状态。
- 改 SKU 价格/库存时，直接修改 `tiktokGlobalSkuDataStore.formState.skuDataList`：
  - `row.originalPrice = String(建议售价)`
  - `row.availableStock = '100'`
  - `row.stockInfos[].available_stock = 100`
  - 若有 `siteTableInfoData` / `stockInfoArr`，同步同一 `_combineId` 的价格和库存。
- 保存前先调用 `await skuDataStore.getFormData()` 预览 SKU DTO，确认 `variationListStr` 内的 `originalPrice`、`availableStock`、`stockInfo` 已正确变更。
- 最终触发页面已有的 `保存` 命令，让店小秘前端自己做校验、合并 DTO、序列化 `tiktokSave.txt` 并提交 `/api/tiktokProduct/add.json`，不要点页面表单字段，不要重新扫描大表单。
- 保存后等待页面返回成功消息，再用 `/api/tiktokProduct/edit.json?id=<商品ID>` 验证：标题、分类、重量尺寸、描述长度、描述图片数、`lowPrice`、`highPrice`、商品总库存、每个 SKU 的 `originalPrice`、`availableStock` 和 `stockInfo` 必须全部匹配。
- 产品描述是高风险字段：页面 CKEditor/textarea 和 `tiktokGlobalAddProductStore.formState.description` 有值，不代表最终保存 DTO 会带上描述。若 `edit.json` 验证发现 `description` 为空，不要继续只改 store 或 textarea。
- 店小秘真实保存上传的 `file` 可能是 `application/zip`，里面才是 `tiktokSave.txt`，不是明文 JSON。修描述时读取页面保存 zip DTO，或调用页面通用模块的压缩函数 `Tf` 导出（当前导出名 `cn`）重新生成 `tiktokSave.txt` zip；只补 DTO 根字段 `description`，用 `/api/tiktokProduct/add.json` + `op=1` 保存，再读 `edit.json` 验证。

执行注意：

- Codex Chrome 插件通道可能阻止 `fetch`、`FormData`、`document.createElement` 或 `javascript:` URL；接口化保存不要依赖该插件通道。使用真实已登录 Chrome 标签页的页面上下文执行脚本时，必须按 URL/商品 ID 锁定具体窗口和标签，不能猜前台标签。
- AppleScript `read POSIX file` 读取 JS 时可能把日文/中文字符串读成乱码。脚本里不要硬编码非 ASCII SKU 名称作为对象 key；优先在页面上下文读取 store 里的真实 SKU 名称，或使用 ASCII 规则、ID、`String.fromCharCode`、base64/JSON 安全编码。
- `edit.json` 返回的 18 位 ID 只能用字符串值或页面 store 原值传递；不要经过普通 JS number 重新序列化。
- 页面保存成功但数据库回写失败时，不要重复保存商品，只报告回写错误。

## 已跑通稳定路线：service.b 完整对象 + service.v 保存

2026-05-17 已在采集箱商品 `172397240566499517` 跑通并验证。这个路线用于页面 live store 为空、组件 ref 不暴露，或只需要接口化保存时。不要重新试字段，不要手工拼最小 DTO。

核心步骤：

- 在真实已登录店小秘编辑页上下文中动态导入 TikTok 编辑 service 模块。当前模块形态是 `service-*.js`，读取函数导出为 `b(productId)`，保存函数导出为 `v(dto, op)`；hash 可能变化，按模块源码/导出能力识别，不硬编码唯一文件名。
- `const readJson = await service.b(productId)` 后，商品对象在 `readJson.product`。不要把整个 `readJson` 当商品对象，也不要按 `edit.json` 的 `data.product` 路径套用。
- 保存前必须校验：
  - `String(product.idStr || product.id) === productId`
  - `product.dxmState === 'draft'`
  - SKU 数量和本次定价/库存报告一致
- 深拷贝 `product` 作为 `dto`，只覆盖已确认字段：标题、描述、品牌、分类/属性、重量尺寸，以及用户已确认的 SKU 价格/库存。
- 产品属性不能只看 `service.D(categoryId)`，它可能只返回变种属性。保存前必须读页面 Pinia `tiktokGlobalAddStore.attrsInfo.attrsList`，筛出 `isMandatory=1` 的属性，并用 `attrId/attrName/valueList` 生成 `productAttributes`。至少验证日本站常见必填 `原産国/原产地`、`梱包材/材质` 已写入。
- 描述必须从原 `product.description` 提取 `<img>` 标签并原序保留，只替换或追加日文文字；保存后用 `edit.json` 验证图片数和可见文字。
- 改 SKU 价格/库存时，基于 `product.variationList` 深拷贝生成 `variationListStr`：
  - `sku.originalPrice = 建议售价`
  - `sku.availableStock = 100`
  - `sku.stockInfo = JSON.stringify([{ warehouse_id: dto.warehouseId, available_stock: 100 }])`
  - 同步商品级 `lowPrice`、`highPrice`、`price`、`stock`、`lowStock`、`highStock`
- 设置 `dto.variationListStr = JSON.stringify(variations)` 后删除 `dto.variationList`。同时删除明显的前端/响应中间字段：`categoryList`、`productDiagnoses`、`multiShopProductList`、`multiShopDataList`、`replicateResultMap`、`replicateResultObj`。
- 当前流程调用 `await service.v(dto, 3)` 保存并移入待发布；只有未授权移入待发布时才用 `op=1` 保存草稿。`op=2` 只在用户明确授权发布时使用。
- 保存返回成功后，必须重新 GET `/api/tiktokProduct/edit.json?id=<商品ID>` 或调用 `service.b(productId)` 验证：使用 `op=3` 时应为 `dxmState=offline` 且 `dxmOfflineState=waitPublish`；标题、描述图片数、描述文字、必填 `productAttributes`、重量尺寸、`lowPrice/highPrice/stock`、每个 SKU 的 `originalPrice/availableStock/stockInfo` 全部匹配。验证成功后才回写采集表。

已确认的反例：

- 手工拼“看起来够用”的最小 DTO 会被店小秘返回 `参数不能为空`。遇到这个错误不要继续试字段，改用 `service.b(productId)` 取完整对象再覆盖。
- 直接把 `edit.json` 读取模型原样上传会返回 `保存对象转换异常,请联系我们!`。这条路不要重复撞。
- 如果自动从资源列表匹配 `index-*.js`，可能导入到业务 chunk 而不是公共压缩 helper，导致请求层错误。用 `service.v(dto, 1)` 时不需要手动导入压缩 helper。

## 主线：本地接口脚本

脚本路径：

```bash
node skills/tk-product-editor/scripts/dxm-api-editor.mjs help
```

本地接口脚本优先让已登录 Chrome 直接打开店小秘 `edit.json` 接口页，再复制浏览器渲染出的 JSON 文本导入。这个方式复用 Chrome 当前登录态，但不读取 Chrome Profile Cookie、不通过 Codex Chrome 插件、不点店小秘表单。

保存阶段优先使用真实店小秘编辑页里的前端 DTO 路线。它仍然不点页面表单，但会在已登录页面上下文中动态导入页面已经加载的 store/service 模块，按页面自己的 `getFormData()` 结构保存。

如果 Chrome API 页面复制不可用，再使用用户提供的当前请求 cURL 作为登录态输入；不得自行读取浏览器 Cookie 文件。

### 1. 读取商品对象

优先使用 Chrome API 页面读取：

```bash
node skills/tk-product-editor/scripts/dxm-api-editor.mjs read-chrome-page \
  --edit-url 'https://www.dianxiaomi.com/web/tiktokProduct/edit?id=<商品ID>#productInfo' \
  --out-dir data/dxm-api/<商品ID>
```

如果已经手动或脚本复制了 API 页面文本，可导入：

```bash
node skills/tk-product-editor/scripts/dxm-api-editor.mjs import-browser-copy \
  --input data/dxm-api/<商品ID>/read-response.browser-copy.txt \
  --edit-url 'https://www.dianxiaomi.com/web/tiktokProduct/edit?id=<商品ID>#productInfo' \
  --out-dir data/dxm-api/<商品ID>
```

备用 cURL 读取：

```bash
node skills/tk-product-editor/scripts/dxm-api-editor.mjs read-api \
  --edit-url 'https://www.dianxiaomi.com/web/tiktokProduct/edit?id=<商品ID>#productInfo' \
  --curl-file data/dxm-api/session.curl \
  --out-dir data/dxm-api/<商品ID>
```

输出文件：

- `original-response.json`：接口原始响应。
- `original-product.json`：识别出的完整商品对象。
- `inspect.json`：字段路径候选，用于判断补丁路径。
- `manifest.json`：本次读取元数据。

如果脚本无法识别商品对象，用 `--product-path <路径>` 指定，例如 `data.product`。

店小秘 ID、TikTok 商品 ID 等 18 位整数必须按原文保留；不要用普通 `JSON.parse` 临时脚本读取后再保存，否则会发生精度丢失。

### 2. 生成补丁和差异报告

补丁示例：

```json
{
  "set": {
    "title": "NOMA-...",
    "description": "...",
    "brand": "No Brand",
    "packageWeight": 0.2,
    "packageLength": 12,
    "packageWidth": 8,
    "packageHeight": 4
  }
}
```

生成差异：

```bash
node skills/tk-product-editor/scripts/dxm-api-editor.mjs diff \
  --input data/dxm-api/<商品ID>/original-product.json \
  --patch data/dxm-api/<商品ID>/patch.json \
  --edit-url 'https://www.dianxiaomi.com/web/tiktokProduct/edit?id=<商品ID>#productInfo' \
  --out-dir data/dxm-api/<商品ID>-patched
```

输出文件：

- `diff-report.md`：给用户确认的差异报告。
- `patched-product.json`：应用白名单补丁后的完整商品对象。
- `tiktokSave.txt`：准备上传保存的完整商品对象。

如果补丁触及 SKU、价格、库存、仓库、运费模板、税务等受保护字段，脚本必须报错并停止。

### 3. 确认后保存并移入待发布：首选前端 DTO 路线

用户确认 `diff-report.md` 后才允许保存。推荐流程：

1. 打开真实店小秘编辑页，确认当前 URL 的商品 ID 和读取对象一致。
2. 在页面上下文读取已加载资源列表，从 `performance.getEntriesByType('resource')` 找到 TikTok 商品编辑相关的 store/service 资源；资源 hash 可能变化，按导出函数和保存行为识别，不硬编码单个 hash。
3. 动态 `import()` 页面已加载模块，复用店小秘当前登录态和前端转换逻辑。
4. 从页面 store 读取 `sharedData.id`、店铺、类目、品牌、属性、图片、描述、变种、SKU、物流等表单数据。
5. 只把已确认的白名单字段覆盖到 DTO：分类、品牌、属性、标题、描述、重量、尺寸等。
6. SKU、库存、仓库、运费模板、税务、结算等字段从页面 store 原样带出，不自行重建。价格默认原样带出；只有用户已确认 SKU 定价报告时，才按报告覆盖对应 SKU 价格字段。
7. 删除前端中间字段，例如 `variationBos`。
8. 调用保存 service：当前授权下用 `await service.v(dto, 3)`。
9. 保存返回成功后，重新读取 `edit.json` 或 `service.b(productId)` 验证关键字段完全匹配，且 `dxmOfflineState=waitPublish`，再回写数据库。

最小伪代码：

```js
const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
const storeUrl = resources.find((url) => url.includes('/assets/index-') && url.endsWith('.js'));
const serviceUrl = resources.find((url) => url.includes('/assets/service-') && url.endsWith('.js'));
const stores = await import(storeUrl);
const service = await import(serviceUrl);

const baseStore = stores.a();
const skuAttrStore = stores.d();
const skuDataStore = stores.e();

const dto = {
  ...baseStore.getFormData?.(),
  id: String(baseStore.sharedData?.id || baseStore.id || '<商品ID>'),
  productName: '<确认后的标题>',
  description: '<确认后的描述HTML>',
  categoryId: '<确认后的末级分类ID>',
  productAttributes: '<确认后的属性JSON>',
  ...skuAttrStore.getFormData(),
  ...skuDataStore.getFormData()
};

Reflect.deleteProperty(dto, 'variationBos');
const result = await service.v(dto, 3);
```

实际执行时不能只照抄伪代码；必须先检查当前页面资源导出名和 store 结构。若资源名或导出名变化，先停止并重新探查页面模块，不猜测保存。

### 3B. 备用：原始文件上传保存草稿

用户确认 `diff-report.md` 后才允许保存：

```bash
node skills/tk-product-editor/scripts/dxm-api-editor.mjs save-api \
  --input data/dxm-api/<商品ID>-patched/tiktokSave.txt \
  --edit-url 'https://www.dianxiaomi.com/web/tiktokProduct/edit?id=<商品ID>#productInfo' \
  --curl-file data/dxm-api/session.curl \
  --confirm-save-draft YES \
  --out data/dxm-api/<商品ID>-patched/save-response.json
```

该命令固定提交 `op=1`。如果店小秘实际文件字段名不是默认 `tiktokSave`，用 `--file-field <字段名>` 重新执行；不要猜测多次保存，需要从接口错误或网络请求里确认字段名。

如果接口返回 `保存对象转换异常,请联系我们!`，说明当前 `tiktokSave.txt` 不是店小秘后端需要的保存 DTO。立即停止这条备用路线，改用“前端 DTO 路线”，不得反复上传。

### 4. 保存成功后回写数据库

只有保存接口明确成功后，才执行：

```bash
node skills/tk-product-editor/scripts/dxm-api-editor.mjs backwrite \
  --account <账号> \
  --product-url <TK商品链接> \
  --product-name '<商品名称>' \
  --edited-title '<编辑标题>' \
  --confirm-saved YES
```

回写失败时不重复保存商品，只报告数据库错误。

## 备用：页面片段/插件路线

保留 `read-snippet`、`save-snippet` 作为备用路线。只有本地接口登录态不可用、前端 DTO 路线不可执行、用户明确要求，或 Codex Chrome 插件后续支持在真实页面上下文稳定执行同源请求时，才使用备用路线。

备用路线仍必须遵守：

- 保存前先生成差异报告。
- 只保存 `op=1` 草稿。
- 不改 SKU、库存、仓库、运费模板、税务、结算等保护字段。价格默认不改；需要改价时必须先确认 SKU 定价报告，且只改报告中的 SKU 价格字段。
- 遇到登录失效、验证或接口异常立即停止。

## 异常处理

- `edit.json` 返回 HTML、登录页、验证码、人机验证或非 JSON：停止，让用户处理登录或验证。
- `edit.json` 返回业务失败：停止，保留返回体给用户判断。
- 无法识别完整商品对象：停止，让用户提供 `--product-path` 或补充接口响应片段。
- 差异报告出现不应改动字段：停止，改补丁，不保存。
- 保存接口返回失败：停止，不回写数据库。
- 保存接口返回 `保存对象转换异常,请联系我们!`：停止原始上传路线，改为前端 DTO 路线；未验证成功前不回写数据库。
- 保存后重新读取 `edit.json`，若分类、标题、描述、属性或重量尺寸与本次确认值不一致：停止，不回写数据库。
- 保存成功但回写数据库失败：报告数据库失败，保留保存结果和回写命令，等待用户处理。
