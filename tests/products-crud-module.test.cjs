const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const formUtilsPath = path.join(root, 'src', 'products', 'form-utils.ts');
const crudPath = path.join(root, 'src', 'products', 'crud.mjs');
const formUtilsSource = fs.readFileSync(formUtilsPath, 'utf8');
const reactProductsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(
  !fs.existsSync(crudPath),
  '完整 React SPA 重建后商品 CRUD DOM runtime 应删除，商品表单由 React 页面接管'
);

assert.doesNotMatch(
  formUtilsSource,
  /window\.ProductLibraryFormUtils|document\.|querySelector|innerHTML|classList|addEventListener|createElement/,
  '商品表单工具应保持纯 ESM，不应挂旧全局或访问 DOM'
);

assert.match(
  formUtilsSource,
  /export\s+\{[\s\S]*ProductLibraryFormUtils[\s\S]*parseSizeInput[\s\S]*buildBatchSkuDrafts[\s\S]*buildEstimatedShippingSnapshot[\s\S]*\}/,
  '商品表单工具需要导出命名空间和纯函数'
);

assert.match(
  reactProductsSource,
  /from '\.\.\/\.\.\/\.\.\/products\/form-utils\.ts'[\s\S]*id="pl-modal"[\s\S]*id="pl-sku-list"/,
  'React 商品页需要直接接管商品弹窗、SKU 编辑和表单纯函数'
);

assert.match(
  reactProductsSource,
  /try \{[\s\S]*await providerRef\.current\.upsertProduct[\s\S]*catch \(error\)/,
  'React 商品页保存商品时需要兜住 Firestore 异常'
);

assert.match(
  reactProductsSource,
  /try \{[\s\S]*await providerRef\.current\.deleteProduct[\s\S]*catch \(error\)/,
  'React 商品页删除商品时需要兜住 Firestore 异常'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/products\/crud\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 CRUD 普通脚本'
);

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

(async () => {
  const module = await import(pathToFileURL(formUtilsPath).href);
  const snapshot = module.buildEstimatedShippingSnapshot({
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

  assert.equal(snapshot.estimatedShippingFee, '17.02', '商品表单 ESM 需要把预估海外运费写成两位小数快照');
  assert.equal(snapshot.chargeWeightKg, '0.42', '商品表单 ESM 需要保存计费重快照');
  assert.equal(snapshot.shippingNote, '', '商品表单 ESM 不再需要保存命中价卡快照');

  const parsedSize = module.parseSizeInput('20×10×8');
  assert.equal(parsedSize.lengthCm, '20', '商品表单 ESM 尺寸输入需要拆出长度');
  assert.equal(parsedSize.widthCm, '10', '商品表单 ESM 尺寸输入需要拆出宽度');
  assert.equal(parsedSize.heightCm, '8', '商品表单 ESM 尺寸输入需要拆出高度');

  const generatedSkus = module.buildBatchSkuDrafts('白、黑、蓝', 'S、M、L');
  assert.equal(generatedSkus.length, 9, '商品表单 ESM 颜色和尺寸应能批量组合出 9 个 SKU');
  assert.equal(generatedSkus[0].skuName, '白 / S', '商品表单 ESM 批量生成 SKU 的名称格式不正确');
  assert.equal(generatedSkus[8].skuName, '蓝 / L', '商品表单 ESM 批量生成 SKU 的组合顺序不正确');

  const generatedThreeAxisSkus = module.buildBatchSkuDrafts('白、黑、蓝', 'S、M、L', '普通款、升级款、礼盒款');
  assert.equal(generatedThreeAxisSkus.length, 27, '商品表单 ESM 三个规格维度应能批量组合出 27 个 SKU');
  assert.equal(generatedThreeAxisSkus[0].skuName, '白 / S / 普通款', '商品表单 ESM 三规格 SKU 的名称格式不正确');
  assert.equal(generatedThreeAxisSkus[26].skuName, '蓝 / L / 礼盒款', '商品表单 ESM 三规格 SKU 的组合顺序不正确');

  assert.equal(module.matchesBatchSkuName('白 / S', 'S'), true, '商品表单 ESM 单字符规格应能按 SKU 名称 token 精确匹配');
  assert.equal(module.matchesBatchSkuName('白 / M', 'S'), false, '商品表单 ESM 单字符规格不应误匹配其他 SKU');
  assert.equal(module.matchesBatchSkuName('白 / M', '白 / M'), true, '商品表单 ESM 完整 SKU 名称应能命中');
  assert.equal(module.matchesBatchSkuName('白 / M', 'sku_abc'), false, '商品表单 ESM 批量应用不应再按 SKU ID 做模糊匹配');

  const snapshotFromSizeText = module.buildEstimatedShippingSnapshot({
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

  assert.equal(snapshotFromSizeText.estimatedShippingFee, '17.02', '商品表单 ESM 尺寸单输入也需要正常生成运费快照');
  assert.deepStrictEqual(
    plain(module.ProductLibraryFormUtils.buildEstimatedShippingSnapshot({
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
    '商品表单 ESM 命名空间需要保留运费快照行为'
  );

  console.log('products crud removal contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
