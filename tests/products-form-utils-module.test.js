const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'products', 'form-utils.js'), 'utf8');
const crudSource = fs.readFileSync(path.join(root, 'js', 'products', 'crud.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  source,
  /const ProductLibraryFormUtils = \(function \(\) \{/,
  '商品库弹窗需要独立的纯函数模块'
);

assert.match(
  source,
  /function parseSizeInput\(/,
  '商品库弹窗纯函数模块需要负责尺寸解析'
);

assert.match(
  source,
  /function buildBatchSkuDrafts\(/,
  '商品库弹窗纯函数模块需要负责批量 SKU 草稿生成'
);

assert.match(
  source,
  /function matchesBatchSkuName\(/,
  '商品库弹窗纯函数模块需要负责 SKU 名称匹配'
);

assert.match(
  source,
  /function buildEstimatedShippingSnapshot\(/,
  '商品库弹窗纯函数模块需要负责运费快照生成'
);

assert.match(
  crudSource,
  /const formUtils = ProductLibraryFormUtils/,
  '商品库 CRUD 需要接入 ProductLibraryFormUtils'
);

assert.doesNotMatch(
  crudSource,
  /function parseSizeInput\(|function buildBatchSkuDrafts\(|function matchesBatchSkuName\(|function buildEstimatedShippingSnapshot\(|function skuUsesProductDefaults\(/,
  '商品库 CRUD 不应继续内联已经拆出的 SKU 表单纯函数'
);

assert.match(
  htmlSource,
  /<script src="js\/products\/export\.js" defer><\/script>\s*<script src="js\/products\/form-utils\.js" defer><\/script>\s*<script src="js\/products\/crud\.js" defer><\/script>/,
  'index.html 需要在商品 CRUD 前加载 form-utils.js'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.ProductLibraryFormUtils = ProductLibraryFormUtils;`, sandbox);
const utils = sandbox.ProductLibraryFormUtils;

const parsedSize = utils.parseSizeInput('20*10*8');
assert.strictEqual(parsedSize.sizeText, '20×10×8', '尺寸解析需要统一为乘号格式');
assert.strictEqual(parsedSize.lengthCm, '20', '尺寸解析需要拆出长度');
assert.strictEqual(parsedSize.widthCm, '10', '尺寸解析需要拆出宽度');
assert.strictEqual(parsedSize.heightCm, '8', '尺寸解析需要拆出高度');
assert.strictEqual(parsedSize.isComplete, true, '完整尺寸需要标记为可计算');

const incompleteSize = utils.parseSizeInput('20×10');
assert.strictEqual(incompleteSize.sizeText, '20×10', '尺寸不足三段时需要保留原输入');
assert.strictEqual(incompleteSize.lengthCm, '', '尺寸不足三段时长度应为空');
assert.strictEqual(incompleteSize.isComplete, false, '尺寸不足三段时不能标记为完整');

assert.deepStrictEqual(
  Array.from(utils.parseBatchTokens('白、黑,白/蓝|  ')),
  ['白', '黑', '蓝'],
  '批量 SKU token 需要按常见分隔符拆分、去重并过滤空值'
);

const generatedSkus = utils.buildBatchSkuDrafts('白、黑、蓝', 'S、M、L', '普通款、升级款');
assert.strictEqual(generatedSkus.length, 18, '三个规格维度应能批量组合出 SKU 草稿');
assert.strictEqual(generatedSkus[0].skuName, '白 / S / 普通款', '批量 SKU 名称格式不正确');
assert.strictEqual(generatedSkus[17].skuName, '蓝 / L / 升级款', '批量 SKU 组合顺序不正确');

assert.strictEqual(utils.matchesBatchSkuName('白 / S', 'S'), true, '单字符规格应能按 token 精确匹配');
assert.strictEqual(utils.matchesBatchSkuName('白 / M', 'S'), false, '单字符规格不应误匹配其他 SKU');
assert.strictEqual(utils.matchesBatchSkuName('加厚白色 / M', '白色'), true, '两个及以上字符关键词应支持包含匹配');

const dimensions = utils.resolveProductDimensions({
  sizeText: '',
  lengthCm: '20',
  widthCm: '10',
  heightCm: '8'
});
assert.strictEqual(dimensions.sizeText, '20×10×8', '缺少 sizeText 时需要从长宽高恢复尺寸文本');
assert.strictEqual(dimensions.isComplete, true, '长宽高完整时需要标记为可计算');

const snapshot = utils.buildEstimatedShippingSnapshot({
  shippingCore: {
    computeShippingQuote(payload) {
      assert.strictEqual(payload.length, '20', '运费快照需要传入解析后的长度');
      return {
        chargeWeightKg: 0.42,
        alerts: [
          { text: '尺寸未填写完整，当前仅按实重预估，未校验体积重。' },
          { text: '特殊品需确认渠道' }
        ]
      };
    },
    computeCalculatedShippingCost() {
      return 17.02;
    }
  },
  product: {
    cargoType: 'general',
    weightG: '320',
    sizeText: '20×10×8'
  },
  pricingContext: {
    rate: 23.5,
    shippingMultiplier: 1.1,
    labelFee: 1.2
  }
});
assert.strictEqual(snapshot.estimatedShippingFee, '17.02', '运费快照需要保留两位小数');
assert.strictEqual(snapshot.chargeWeightKg, '0.42', '运费快照需要保存计费重');
assert.strictEqual(snapshot.shippingNote, '特殊品需确认渠道', '运费快照需要过滤常规提示并保留关键提示');

assert.strictEqual(utils.skuUsesProductDefaults({}), true, '空 SKU 默认继承商品参数');
assert.strictEqual(utils.skuUsesProductDefaults({ weightG: '120' }), false, '自带重量的 SKU 不应继承商品参数');
assert.strictEqual(utils.formatSizeInput({ lengthCm: '20', widthCm: '10', heightCm: '8' }), '20×10×8', '长宽高需要格式化为尺寸文本');

console.log('products form utils module contract ok');
