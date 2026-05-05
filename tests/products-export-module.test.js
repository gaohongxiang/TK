const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'products', 'export.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'js', 'products', 'index.js'), 'utf8');

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
const exporter = sandbox.ProductLibraryExport.create({
  state,
  helpers: {
    getDisplayedProducts() {
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
    },
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

console.log('products export module contract ok');
