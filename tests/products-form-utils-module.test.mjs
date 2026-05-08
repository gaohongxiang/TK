import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const srcSource = fs.readFileSync(path.join(root, 'src', 'products', 'form-utils.ts'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  srcSource,
  /function parseSizeInput\(/,
  '商品库弹窗 ESM 纯函数模块需要负责尺寸解析'
);

assert.match(
  srcSource,
  /function buildBatchSkuDrafts\(/,
  '商品库弹窗 ESM 纯函数模块需要负责批量 SKU 草稿生成'
);

assert.match(
  srcSource,
  /function matchesBatchSkuName\(/,
  '商品库弹窗 ESM 纯函数模块需要负责 SKU 名称匹配'
);

assert.match(
  srcSource,
  /function buildEstimatedShippingSnapshot\(/,
  '商品库弹窗 ESM 纯函数模块需要负责运费快照生成'
);

assert.match(
  srcSource,
  /export\s+\{[\s\S]*ProductLibraryFormUtils[\s\S]*parseSizeInput[\s\S]*buildBatchSkuDrafts[\s\S]*buildEstimatedShippingSnapshot[\s\S]*\}/,
  '路线二 M4 需要提供商品 CRUD 纯函数 ESM 导出'
);

assert.doesNotMatch(
  srcSource,
  /window\.ProductLibraryFormUtils|document\.|querySelector|innerHTML|classList|addEventListener/,
  '商品 CRUD 纯函数 ESM 模块不应再挂旧全局命名空间或访问 DOM'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/products\/form-utils\.js" defer><\/script>/,
  'index.html 不应再加载旧商品表单工具普通脚本'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/products\/crud\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 CRUD 普通脚本'
);

(async () => {
  const module = await import(`file://${path.join(root, 'src', 'products', 'form-utils.ts')}`);
  const parsedSize = module.parseSizeInput('20*10*8');
  assert.strictEqual(parsedSize.sizeText, '20×10×8', '商品 CRUD ESM 尺寸解析需要统一为乘号格式');
  assert.strictEqual(parsedSize.lengthCm, '20', '商品 CRUD ESM 尺寸解析需要拆出长度');
  assert.strictEqual(parsedSize.widthCm, '10', '商品 CRUD ESM 尺寸解析需要拆出宽度');
  assert.strictEqual(parsedSize.heightCm, '8', '商品 CRUD ESM 尺寸解析需要拆出高度');
  assert.strictEqual(parsedSize.isComplete, true, '商品 CRUD ESM 完整尺寸需要标记为可计算');

  const incompleteSize = module.parseSizeInput('20×10');
  assert.strictEqual(incompleteSize.sizeText, '20×10', '商品 CRUD ESM 尺寸不足三段时需要保留原输入');
  assert.strictEqual(incompleteSize.lengthCm, '', '商品 CRUD ESM 尺寸不足三段时长度应为空');
  assert.strictEqual(incompleteSize.isComplete, false, '商品 CRUD ESM 尺寸不足三段时不能标记为完整');

  assert.deepStrictEqual(
    module.parseBatchTokens('白、黑,白/蓝|  '),
    ['白', '黑', '蓝'],
    '商品 CRUD ESM 批量 SKU token 需要按常见分隔符拆分、去重并过滤空值'
  );

  const generatedSkus = module.buildBatchSkuDrafts('白、黑、蓝', 'S、M、L', '普通款、升级款');
  assert.strictEqual(generatedSkus.length, 18, '商品 CRUD ESM 三个规格维度应能批量组合出 SKU 草稿');
  assert.strictEqual(generatedSkus[0].skuName, '白 / S / 普通款', '商品 CRUD ESM 批量 SKU 名称格式不正确');
  assert.strictEqual(generatedSkus[17].skuName, '蓝 / L / 升级款', '商品 CRUD ESM 批量 SKU 组合顺序不正确');

  assert.strictEqual(module.matchesBatchSkuName('白 / S', 'S'), true, '商品 CRUD ESM 单字符规格应能按 token 精确匹配');
  assert.strictEqual(module.matchesBatchSkuName('白 / M', 'S'), false, '商品 CRUD ESM 单字符规格不应误匹配其他 SKU');
  assert.strictEqual(module.matchesBatchSkuName('加厚白色 / M', '白色'), true, '商品 CRUD ESM 两个及以上字符关键词应支持包含匹配');

  const dimensions = module.resolveProductDimensions({
    sizeText: '',
    lengthCm: '20',
    widthCm: '10',
    heightCm: '8'
  });
  assert.strictEqual(dimensions.sizeText, '20×10×8', '商品 CRUD ESM 缺少 sizeText 时需要从长宽高恢复尺寸文本');
  assert.strictEqual(dimensions.isComplete, true, '商品 CRUD ESM 长宽高完整时需要标记为可计算');

  const snapshot = module.buildEstimatedShippingSnapshot({
    shippingCore: {
      computeShippingQuote(payload) {
        assert.strictEqual(payload.length, '20', '商品 CRUD ESM 运费快照需要传入解析后的长度');
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
  assert.strictEqual(snapshot.estimatedShippingFee, '17.02', '商品 CRUD ESM 运费快照需要保留两位小数');
  assert.strictEqual(snapshot.chargeWeightKg, '0.42', '商品 CRUD ESM 运费快照需要保存计费重');
  assert.strictEqual(snapshot.shippingNote, '特殊品需确认渠道', '商品 CRUD ESM 运费快照需要过滤常规提示并保留关键提示');

  assert.strictEqual(module.skuUsesProductDefaults({}), true, '商品 CRUD ESM 空 SKU 默认继承商品参数');
  assert.strictEqual(module.skuUsesProductDefaults({ weightG: '120' }), false, '商品 CRUD ESM 自带重量的 SKU 不应继承商品参数');
  assert.strictEqual(module.formatSizeInput({ lengthCm: '20', widthCm: '10', heightCm: '8' }), '20×10×8', '商品 CRUD ESM 长宽高需要格式化为尺寸文本');
  assert.equal(typeof module.ProductLibraryFormUtils.parseSizeInput, 'function', '商品 CRUD ESM 纯函数模块需要暴露命名空间');
  assert.deepStrictEqual(
    module.parseSizeInput('20*10*8'),
    { ...parsedSize },
    '商品 CRUD ESM 尺寸解析需要保持稳定'
  );
  assert.deepStrictEqual(
    module.buildBatchSkuDrafts('白、黑、蓝', 'S、M、L', '普通款、升级款'),
    Array.from(generatedSkus, sku => ({ ...sku })),
    '商品 CRUD ESM 批量 SKU 草稿需要保持稳定'
  );
  assert.equal(module.matchesBatchSkuName('加厚白色 / M', '白色'), true, '商品 CRUD ESM 需要保留 SKU 名称匹配');
  assert.equal(module.skuUsesProductDefaults({ weightG: '120' }), false, '商品 CRUD ESM 需要保留 SKU 默认值判断');
  assert.deepStrictEqual(
    module.buildEstimatedShippingSnapshot({
      shippingCore: {
        computeShippingQuote() {
          return {
            chargeWeightKg: 0.42,
            alerts: [{ text: '特殊品需确认渠道' }]
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
    }),
    {
      estimatedShippingFee: '17.02',
      chargeWeightKg: '0.42',
      shippingNote: '特殊品需确认渠道'
    },
    '商品 CRUD ESM 运费快照需要保留原输出结构'
  );

  console.log('products form utils module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
