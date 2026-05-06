const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const srcSource = fs.readFileSync(path.join(root, 'src', 'products', 'export.mjs'), 'utf8');
const srcIndexSource = fs.readFileSync(path.join(root, 'src', 'products', 'index.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  srcSource,
  /function promptProductExportAccounts\(/,
  '商品导出 ESM 模块需要负责账号选择流程'
);

assert.match(
  srcSource,
  /function buildProductExportRows\(/,
  '商品导出 ESM 模块需要负责 CSV 行构建'
);

assert.match(
  srcSource,
  /async function exportProductsCsv\(/,
  '商品导出 ESM 模块需要暴露 CSV 导出入口'
);

assert.match(
  srcSource,
  /getDisplayedProducts\(\{\s*activeAccount:\s*'__all__'\s*\}\)/,
  '商品导出 ESM 需要复用当前搜索筛选后的全账号结果'
);

assert.match(
  srcIndexSource,
  /exportFactory\.create\(/,
  '商品 ESM 入口需要接入导出模块'
);

assert.match(
  srcSource,
  /const ProductLibraryExport = \{/,
  '路线二 M4 需要提供商品导出 ESM 模块'
);

assert.match(
  srcSource,
  /window\.ProductLibraryExport = ProductLibraryExport/,
  '商品导出 ESM 模块需要挂回旧全局命名空间'
);

assert.match(
  srcSource,
  /export\s+\{[\s\S]*ProductLibraryExport[\s\S]*create[\s\S]*csvEscape[\s\S]*formatSizeText[\s\S]*mergeProductSku[\s\S]*\}/,
  '商品导出 ESM 模块需要导出导出工厂和纯函数'
);

assert.match(
  srcIndexSource,
  /import \{ ProductLibraryExport \} from '\.\/export\.mjs'/,
  '商品 ESM 入口需要直接导入商品导出模块'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/products\/export\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 export 普通脚本'
);

assert.doesNotMatch(
  srcIndexSource,
  /function promptProductExportAccounts\(|function buildProductExportRows\(|function exportProductsCsv\(/,
  '商品 ESM 入口不应继续内联 CSV 导出实现'
);

const state = {
  accounts: ['A'],
  activeAccount: '__all__'
};

function exporterInputProducts() {
  return [
    {
      accountName: 'A',
      tkId: 'TK-1',
      name: '杯子',
      defaults: {
        cargoType: 'general',
        weightG: '100',
        sizeText: '10*8*6',
        estimatedShippingFee: '12.3'
      },
      skus: [
        { skuName: '白 / S', skuId: 'sku-1', useProductDefaults: true },
        { skuName: '黑 / M', skuId: 'sku-2', weightG: '120', sizeText: '12×8×6', estimatedShippingFee: '13.8' }
      ]
    },
    {
      accountName: '',
      tkId: 'TK-2',
      name: '盘子',
      cargoType: 'special',
      weightG: '200'
    }
  ];
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

(async () => {
  const module = await import(path.join(root, 'src', 'products', 'export.mjs'));
  assert.strictEqual(typeof module.ProductLibraryExport.create, 'function', '商品导出 ESM 需要暴露 create 工厂');
  assert.strictEqual(module.csvEscape('a"b'), '"a""b"', '商品导出 ESM 需要保留 CSV 转义行为');
  assert.strictEqual(module.formatSizeText({ sizeText: '10*8*6' }), '10×8×6', '商品导出 ESM 需要保留尺寸格式化行为');

  const esmExporter = module.ProductLibraryExport.create({
    state,
    helpers: {
      getDisplayedProducts: exporterInputProducts,
      normalizeAccountName: value => String(value || '').trim(),
      toAccountSlot: value => String(value || '').trim() || '__unassigned__',
      uniqueAccounts: values => [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
    }
  });
  const options = esmExporter.getProductExportAccountOptions();
  assert.deepStrictEqual(
    options.map(option => option.key),
    ['A', '__unassigned__'],
    '商品导出 ESM 账号选项需要包含已关联和未关联商品'
  );

  const rows = esmExporter.buildProductExportRows(new Set(['A', '__unassigned__']));
  assert.strictEqual(rows.length, 3, '商品导出 ESM 需要按 SKU 展开行，并包含无 SKU 商品');
  assert.strictEqual(rows[0][4], '白 / S', '商品导出 ESM 行需要包含 SKU 名称');
  assert.strictEqual(rows[0][7], '10×8×6', '商品导出 ESM 继承默认参数的 SKU 需要导出商品默认尺寸');
  assert.strictEqual(rows[2][0], '', '商品导出 ESM 未关联账号商品导出账号列应为空');

  assert.deepStrictEqual(
    plain(esmExporter.getProductExportAccountOptions()),
    plain(options),
    '商品导出 ESM 账号选项需要保持稳定'
  );
  assert.deepStrictEqual(
    plain(esmExporter.buildProductExportRows(new Set(['A', '__unassigned__']))),
    plain(rows),
    '商品导出 ESM 行构建需要保持稳定'
  );

  console.log('products export module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
