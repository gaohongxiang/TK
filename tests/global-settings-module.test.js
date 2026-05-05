const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'global-settings.js'), 'utf8');
const srcSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'global-settings.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const TKGlobalSettings = \(function \(\) \{/,
  '需要独立的全局设置模块'
);

assert.match(
  source,
  /function create\(/,
  '全局设置模块需要暴露 create 工厂'
);

assert.match(
  source,
  /tk\.global-settings\.v1/,
  '全局设置模块需要使用独立的存储 key'
);

assert.match(
  source,
  /tk\.profit\.v1/,
  '全局设置模块需要兼容从旧利润计算器存储迁移汇率'
);

assert.match(
  srcSource,
  /export\s+\{[\s\S]*TKGlobalSettings[\s\S]*create[\s\S]*ensureGlobalSettingsStore[\s\S]*\}/,
  '路线二 M3 需要提供全局设置 ESM 导出'
);

const localStorageState = new Map([
  ['tk.profit.v1', JSON.stringify({ rateNew: 21.5 })]
]);

const sandbox = {
  window: {},
  localStorage: {
    getItem(key) {
      return localStorageState.has(key) ? localStorageState.get(key) : null;
    },
    setItem(key, value) {
      localStorageState.set(key, String(value));
    }
  }
};

vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.TKGlobalSettings = TKGlobalSettings;`, sandbox);

const store = sandbox.TKGlobalSettings.create();

assert.equal(store.getExchangeRate(), 21.5, '全局设置模块需要从旧利润计算器存储迁移汇率');
store.setExchangeRate(23.5);
assert.equal(store.getExchangeRate(), 23.5, '全局设置模块需要读写统一汇率');

const savedGlobal = JSON.parse(localStorageState.get('tk.global-settings.v1') || 'null');
assert.equal(savedGlobal.exchangeRate, 23.5, '全局设置模块需要把汇率保存到独立存储');

assert.match(
  htmlSource,
  /<script src="js\/app-config\.js" defer><\/script>\s*<script src="js\/app\.js" defer><\/script>\s*<script src="js\/global-settings\.js" defer><\/script>/,
  'index.html 需要在业务模块前先加载全局设置模块'
);

(async () => {
  const module = await import(`file://${path.join(__dirname, '..', 'src', 'global-settings.mjs')}`);
  const esmLocalStorageState = new Map([
    ['tk.profit.v1', JSON.stringify({ rateNew: 22.75 })]
  ]);
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      return esmLocalStorageState.has(key) ? esmLocalStorageState.get(key) : null;
    },
    setItem(key, value) {
      esmLocalStorageState.set(key, String(value));
    }
  };

  try {
    const esmStore = module.TKGlobalSettings.create();
    assert.equal(esmStore.getExchangeRate(), 22.75, '全局设置 ESM 模块需要从旧利润计算器存储迁移汇率');
    esmStore.setExchangeRate(24.12567);
    assert.equal(esmStore.getExchangeRate(), 24.1257, '全局设置 ESM 模块需要按同样精度保存汇率');
    const saved = JSON.parse(esmLocalStorageState.get('tk.global-settings.v1') || 'null');
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
