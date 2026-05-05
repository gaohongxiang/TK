const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'products', 'export.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'js', 'products', 'index.js'), 'utf8');
const srcSource = fs.readFileSync(path.join(root, 'src', 'products', 'export.mjs'), 'utf8');
const srcIndexSource = fs.readFileSync(path.join(root, 'src', 'products', 'index.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  source,
  /const ProductLibraryExport = \(function \(\) \{/,
  '商品库需要独立的导出模块'
);

assert.match(
  source,
  /function promptProductExportAccounts\(/,
  '商品导出模块需要负责账号选择流程'
);

assert.match(
  source,
  /function buildProductExportRows\(/,
  '商品导出模块需要负责 CSV 行构建'
);

assert.match(
  source,
  /async function exportProductsCsv\(/,
  '商品导出模块需要暴露 CSV 导出入口'
);

assert.match(
  source,
  /getDisplayedProducts\(\{\s*activeAccount:\s*'__all__'\s*\}\)/,
  '商品导出需要复用当前搜索筛选后的全账号结果'
);

assert.match(
  indexSource,
  /ProductLibraryExport\.create\(/,
  '商品库入口需要接入导出模块'
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
  indexSource,
  /function promptProductExportAccounts\(|function buildProductExportRows\(|function exportProductsCsv\(/,
  '商品库入口不应继续内联 CSV 导出实现'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.ProductLibraryExport = ProductLibraryExport;`, sandbox);

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

const exporter = sandbox.ProductLibraryExport.create({
  state,
  helpers: {
    getDisplayedProducts: exporterInputProducts,
    normalizeAccountName: value => String(value || '').trim(),
    toAccountSlot: value => String(value || '').trim() || '__unassigned__',
    uniqueAccounts: values => [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
  }
});

const options = exporter.getProductExportAccountOptions();
assert.deepStrictEqual(
  options.map(option => option.key),
  ['A', '__unassigned__'],
  '商品导出账号选项需要包含已关联和未关联商品'
);

const rows = exporter.buildProductExportRows(new Set(['A', '__unassigned__']));
assert.strictEqual(rows.length, 3, '商品导出需要按 SKU 展开行，并包含无 SKU 商品');
assert.strictEqual(rows[0][4], '白 / S', '导出行需要包含 SKU 名称');
assert.strictEqual(rows[0][7], '10×8×6', '继承默认参数的 SKU 需要导出商品默认尺寸');
assert.strictEqual(rows[2][0], '', '未关联账号商品导出账号列应为空');

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
  assert.deepStrictEqual(
    plain(esmExporter.getProductExportAccountOptions()),
    plain(options),
    '商品导出 ESM 账号选项需要保持旧模块行为'
  );
  assert.deepStrictEqual(
    plain(esmExporter.buildProductExportRows(new Set(['A', '__unassigned__']))),
    plain(rows),
    '商品导出 ESM 行构建需要保持旧模块行为'
  );

  console.log('products export module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
