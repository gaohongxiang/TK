const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'global-settings.js'), 'utf8');
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

console.log('global settings module contract ok');
