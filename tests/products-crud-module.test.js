const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const srcSource = fs.readFileSync(path.join(root, 'src', 'products', 'crud.mjs'), 'utf8');
const srcIndexSource = fs.readFileSync(path.join(root, 'src', 'products', 'index.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  srcSource,
  /import \{[\s\S]*buildBatchSkuDrafts[\s\S]*buildEstimatedShippingSnapshot[\s\S]*parseSizeInput[\s\S]*\} from '\.\/form-utils\.mjs'/,
  '路线二 M4 需要让商品 CRUD ESM 直接导入商品表单纯函数'
);

assert.match(
  srcSource,
  /const ProductLibraryCrud = \{/,
  '路线二 M4 需要提供商品 CRUD ESM 模块'
);

assert.match(
  srcSource,
  /window\.ProductLibraryCrud = ProductLibraryCrud/,
  '商品 CRUD ESM 模块需要挂回旧全局命名空间'
);

assert.match(
  srcSource,
  /export\s+\{[\s\S]*ProductLibraryCrud[\s\S]*parseSizeInput[\s\S]*buildBatchSkuDrafts[\s\S]*buildEstimatedShippingSnapshot[\s\S]*create[\s\S]*\}/,
  '商品 CRUD ESM 模块需要导出 CRUD 工厂和兼容纯函数'
);

assert.match(
  srcIndexSource,
  /import \{ ProductLibraryCrud \} from '\.\/crud\.mjs'/,
  '商品 ESM 入口需要直接导入商品 CRUD 模块'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/products\/crud\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 CRUD 普通脚本'
);

assert.match(
  srcSource,
  /const editor = readParameterEditor\(\);[\s\S]*!editor\.matchText[\s\S]*editor\.weightG[\s\S]*editor\.sizeText/,
  '商品库 CRUD ESM 保存时需要识别参数调整里当前输入的共用重量和尺寸'
);

assert.match(
  srcSource,
  /querySelectorAll\('#pl-sku-list \.pl-sku-edit-row'\)/,
  '商品库 CRUD ESM SKU 编辑表格需要按新的紧凑行结构读取草稿，避免添加 SKU 时丢失已有行'
);

assert.match(
  srcSource,
  /let eventsBound = false;[\s\S]*function bindEvents\(\) \{[\s\S]*if \(eventsBound\) return;[\s\S]*eventsBound = true;/,
  '商品库 CRUD ESM 事件绑定必须只执行一次，避免新增 SKU、批量生成和删除被重复触发'
);

assert.doesNotMatch(
  srcSource,
  /\$\{skuUsesProductDefaults\(sku\) \? 'disabled' : ''\}/,
  '商品库 CRUD ESM SKU 行里的重量和尺寸输入框不应再因继承共用参数而被禁用'
);

assert.match(
  srcSource,
  /try \{[\s\S]*await saveProduct[\s\S]*catch \(error\)/,
  '商品库 CRUD ESM 保存商品时需要兜住 Firestore 异常'
);

assert.match(
  srcSource,
  /try \{[\s\S]*await deleteProduct[\s\S]*catch \(error\)/,
  '商品库 CRUD ESM 删除商品时需要兜住 Firestore 异常'
);

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

(async () => {
  const module = await import(path.join(root, 'src', 'products', 'crud.mjs'));
  const snapshot = module.ProductLibraryCrud.buildEstimatedShippingSnapshot({
    shippingCore: {
      computeShippingQuote() {
        return {
          cnyFee: 14.38,
          chargeWeightKg: 0.42,
          band: { range: '0 - 0.5 kg' },
          alerts: []
        };
      },
      computeCalculatedShippingCost() {
        return 17.02;
      }
    },
    product: {
      cargoType: 'general',
      weightG: '320',
      lengthCm: '20',
      widthCm: '10',
      heightCm: '8'
    },
    pricingContext: {
      rate: 23.5,
      shippingMultiplier: 1.1,
      labelFee: 1.2
    }
  });

  assert.equal(snapshot.estimatedShippingFee, '17.02', '商品 CRUD ESM 需要把预估海外运费写成两位小数快照');
  assert.equal(snapshot.chargeWeightKg, '0.42', '商品 CRUD ESM 需要保存计费重快照');
  assert.equal(snapshot.shippingNote, '', '商品 CRUD ESM 不再需要保存命中价卡快照');

  const parsedSize = module.ProductLibraryCrud.parseSizeInput('20×10×8');
  assert.equal(parsedSize.lengthCm, '20', '商品 CRUD ESM 尺寸输入需要拆出长度');
  assert.equal(parsedSize.widthCm, '10', '商品 CRUD ESM 尺寸输入需要拆出宽度');
  assert.equal(parsedSize.heightCm, '8', '商品 CRUD ESM 尺寸输入需要拆出高度');

  const generatedSkus = module.ProductLibraryCrud.buildBatchSkuDrafts('白、黑、蓝', 'S、M、L');
  assert.equal(generatedSkus.length, 9, '商品 CRUD ESM 颜色和尺寸应能批量组合出 9 个 SKU');
  assert.equal(generatedSkus[0].skuName, '白 / S', '商品 CRUD ESM 批量生成 SKU 的名称格式不正确');
  assert.equal(generatedSkus[8].skuName, '蓝 / L', '商品 CRUD ESM 批量生成 SKU 的组合顺序不正确');

  const generatedThreeAxisSkus = module.ProductLibraryCrud.buildBatchSkuDrafts('白、黑、蓝', 'S、M、L', '普通款、升级款、礼盒款');
  assert.equal(generatedThreeAxisSkus.length, 27, '商品 CRUD ESM 三个规格维度应能批量组合出 27 个 SKU');
  assert.equal(generatedThreeAxisSkus[0].skuName, '白 / S / 普通款', '商品 CRUD ESM 三规格 SKU 的名称格式不正确');
  assert.equal(generatedThreeAxisSkus[26].skuName, '蓝 / L / 礼盒款', '商品 CRUD ESM 三规格 SKU 的组合顺序不正确');

  assert.equal(module.ProductLibraryCrud.matchesBatchSkuName('白 / S', 'S'), true, '商品 CRUD ESM 单字符规格应能按 SKU 名称 token 精确匹配');
  assert.equal(module.ProductLibraryCrud.matchesBatchSkuName('白 / M', 'S'), false, '商品 CRUD ESM 单字符规格不应误匹配其他 SKU');
  assert.equal(module.ProductLibraryCrud.matchesBatchSkuName('白 / M', '白 / M'), true, '商品 CRUD ESM 完整 SKU 名称应能命中');
  assert.equal(module.ProductLibraryCrud.matchesBatchSkuName('白 / M', 'sku_abc'), false, '商品 CRUD ESM 批量应用不应再按 SKU ID 做模糊匹配');

  const snapshotFromSizeText = module.ProductLibraryCrud.buildEstimatedShippingSnapshot({
    shippingCore: {
      received: null,
      computeShippingQuote(payload) {
        this.received = payload;
        return {
          cnyFee: 14.38,
          chargeWeightKg: 0.42,
          band: { range: '0 - 0.5 kg' },
          alerts: []
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

  assert.equal(snapshotFromSizeText.estimatedShippingFee, '17.02', '商品 CRUD ESM 尺寸单输入也需要正常生成运费快照');

  assert.equal(typeof module.ProductLibraryCrud.create, 'function', '商品 CRUD ESM 需要暴露 create 工厂');
  assert.deepStrictEqual(
    plain(module.ProductLibraryCrud.parseSizeInput('20×10×8')),
    plain(parsedSize),
    '商品 CRUD ESM 需要保留尺寸解析兼容导出'
  );
  assert.deepStrictEqual(
    plain(module.ProductLibraryCrud.buildBatchSkuDrafts('白、黑、蓝', 'S、M、L')),
    plain(generatedSkus),
    '商品 CRUD ESM 需要保留批量 SKU 兼容导出'
  );
  assert.equal(
    module.ProductLibraryCrud.matchesBatchSkuName('白 / M', 'S'),
    false,
    '商品 CRUD ESM 需要保留 SKU 名称匹配行为'
  );
  assert.deepStrictEqual(
    plain(module.ProductLibraryCrud.buildEstimatedShippingSnapshot({
      shippingCore: {
        computeShippingQuote() {
          return {
            cnyFee: 14.38,
            chargeWeightKg: 0.42,
            band: { range: '0 - 0.5 kg' },
            alerts: []
          };
        },
        computeCalculatedShippingCost() {
          return 17.02;
        }
      },
      product: {
        cargoType: 'general',
        weightG: '320',
        lengthCm: '20',
        widthCm: '10',
        heightCm: '8'
      },
      pricingContext: {
        rate: 23.5,
        shippingMultiplier: 1.1,
        labelFee: 1.2
      }
    })),
    plain(snapshot),
    '商品 CRUD ESM 需要保留运费快照行为'
  );

  console.log('products crud module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
