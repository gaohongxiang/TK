const fs = require('fs');
const path = require('path');
const assert = require('assert');

const srcSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'global-settings.mjs'), 'utf8');
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
  /tk\.profit\.v1/,
  '全局设置模块需要兼容从旧利润计算器存储迁移汇率'
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

assert.match(
  srcSource,
  /ensureGlobalSettingsStore\(window\)/,
  '全局设置模块仍需要初始化浏览器共享设置 store'
);

assert.match(
  reactOrdersSource,
  /from '\.\.\/\.\.\/\.\.\/global-settings\.mjs'/,
  'React 订单页需要显式导入全局设置模块'
);

assert.match(
  reactProductsSource,
  /from '\.\.\/\.\.\/\.\.\/global-settings\.mjs'/,
  'React 商品页需要显式导入全局设置模块'
);

assert.match(
  reactCalculatorSource,
  /from '\.\.\/\.\.\/\.\.\/global-settings\.mjs'/,
  'React 利润计算器需要显式导入全局设置模块'
);

const localStorageState = new Map([
  ['tk.profit.v1', JSON.stringify({ rateNew: 21.5 })]
]);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/global-settings\.js" defer><\/script>/,
  'index.html 不应再加载旧全局设置普通脚本'
);

(async () => {
  const module = await import(`file://${path.join(__dirname, '..', 'src', 'global-settings.mjs')}`);
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
    assert.equal(esmStore.getExchangeRate(), 21.5, '全局设置 ESM 模块需要从旧利润计算器存储迁移汇率');
    esmStore.setExchangeRate(24.12567);
    assert.equal(esmStore.getExchangeRate(), 24.1257, '全局设置 ESM 模块需要按同样精度保存汇率');
    const saved = JSON.parse(localStorageState.get('tk.global-settings.v1') || 'null');
    assert.equal(saved.exchangeRate, 24.1257, '全局设置 ESM 模块需要写入独立存储');
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
