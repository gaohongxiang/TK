import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const srcSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'global-settings.ts'), 'utf8');
const reactCalculatorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'calculator', 'CalculatorApp.tsx'), 'utf8');
const reactOrdersSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const reactProductsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  srcSource,
  /function create\(/,
  '全局设置模块需要暴露 create 工厂'
);

assert.match(
  srcSource,
  /tk\.global-settings\.v1/,
  '全局设置模块需要使用独立的存储 key'
);

assert.match(
  srcSource,
  /setPricingContext/,
  '全局设置模块需要统一保存汇率、运费倍率和贴单费'
);

assert.doesNotMatch(
  srcSource,
  /tk\.profit\.v1|LEGACY_PROFIT_STORAGE_KEY|legacyProfitStorageKey|readLegacyProfitState/,
  '完整 React SPA 不应再保留旧利润计算器存储迁移兼容层'
);

assert.match(
  srcSource,
  /export\s+\{[\s\S]*TKGlobalSettings[\s\S]*create[\s\S]*ensureGlobalSettingsStore[\s\S]*\}/,
  '路线二 M3 需要提供全局设置 ESM 导出'
);

assert.doesNotMatch(
  srcSource,
  /window\.TKGlobalSettings/,
  '全局设置模块不应再挂旧全局命名空间'
);

assert.doesNotMatch(
  srcSource,
  /__tkGlobalSettingsStore|ensureGlobalSettingsStore\(window\)/,
  '完整 React SPA 不应再通过 window 保存全局设置 store'
);

assert.match(
  reactOrdersSource,
  /from '\.\.\/\.\.\/\.\.\/global-settings\.ts'/,
  'React 订单页需要显式导入全局设置模块'
);

assert.match(
  reactProductsSource,
  /from '\.\.\/\.\.\/\.\.\/global-settings\.ts'/,
  'React 商品页需要显式导入全局设置模块'
);

assert.match(
  reactCalculatorSource,
  /from '\.\.\/\.\.\/\.\.\/global-settings\.ts'/,
  'React 利润计算器需要显式导入全局设置模块'
);

assert.match(
  reactCalculatorSource,
  /tk\.calculator\.v1/,
  'React 利润计算器需要使用当前 SPA 的计算器存储 key'
);

assert.doesNotMatch(
  reactCalculatorSource,
  /tk\.profit\.v1/,
  'React 利润计算器不应继续使用旧利润计算器存储 key'
);

assert.match(
  reactCalculatorSource,
  /setPricingContext/,
  'React 利润计算器需要把汇率、运费倍率和贴单费同步到全局设置'
);

const localStorageState = new Map([
  ['tk.global-settings.v1', JSON.stringify({ exchangeRate: 21.5, shippingMultiplier: 1.18, labelFee: 1.6 })]
]);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/global-settings\.js" defer><\/script>/,
  'index.html 不应再加载旧全局设置普通脚本'
);

(async () => {
  const module = await import(`file://${path.join(__dirname, '..', 'src', 'global-settings.ts')}`);
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      return localStorageState.has(key) ? localStorageState.get(key) : null;
    },
    setItem(key, value) {
      localStorageState.set(key, String(value));
    }
  };

  try {
    const esmStore = module.TKGlobalSettings.create();
    assert.equal(esmStore.getExchangeRate(), 21.5, '全局设置 ESM 模块需要读取当前 SPA 汇率');
    assert.deepEqual(
      esmStore.getPricingContext(),
      { rate: 21.5, shippingMultiplier: 1.18, labelFee: 1.6 },
      '全局设置 ESM 模块需要读取当前 SPA 定价上下文'
    );
    esmStore.setExchangeRate(24.12567);
    assert.equal(esmStore.getExchangeRate(), 24.1257, '全局设置 ESM 模块需要按同样精度保存汇率');
    esmStore.setPricingContext({ exchangeRate: 22.33333, shippingMultiplier: 1.25, labelFee: 2 });
    assert.deepEqual(
      esmStore.getPricingContext(),
      { rate: 22.3333, shippingMultiplier: 1.25, labelFee: 2 },
      '全局设置 ESM 模块需要统一保存定价上下文'
    );
    const saved = JSON.parse(localStorageState.get('tk.global-settings.v1') || 'null');
    assert.deepEqual(
      saved,
      { exchangeRate: 22.3333, shippingMultiplier: 1.25, labelFee: 2 },
      '全局设置 ESM 模块需要写入独立存储'
    );
  } finally {
    if (originalLocalStorage === undefined) {
      delete global.localStorage;
    } else {
      global.localStorage = originalLocalStorage;
    }
  }

  console.log('global settings module contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
