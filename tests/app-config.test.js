const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js', 'app-config.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  configSource,
  /const TKAppConfig = Object\.freeze\(/,
  '需要项目级配置对象'
);

assert.match(
  configSource,
  /officialDataSource:\s*'firestore'/,
  '正式数据源需要明确为 Firestore'
);

assert.match(
  configSource,
  /storesUserBusinessData:\s*false/,
  '项目配置需要明确本站不保存用户业务数据'
);

assert.match(
  configSource,
  /analytics:\s*'browser-memory-only'/,
  '数据分析配置需要明确只在浏览器内存处理'
);

assert.match(
  configSource,
  /key:\s*'calc'[\s\S]*key:\s*'products'[\s\S]*key:\s*'orders'[\s\S]*key:\s*'analytics'/,
  '项目配置需要列出主站模块'
);

assert.match(
  htmlSource,
  /<script src="js\/app-config\.js" defer><\/script>\s*<script src="js\/app\.js" defer><\/script>/,
  'index.html 需要在 app.js 前加载 app-config.js'
);

assert.match(
  appSource,
  /Object\.fromEntries[\s\S]*TKAppConfig\.modules/,
  '路由模块列表需要从项目配置生成'
);

assert.match(
  appSource,
  /document\.querySelector\('\.app-doc-link'\)[\s\S]*TKAppConfig\.docsUrl/,
  '文档链接需要接入项目配置'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${configSource}\nthis.TKAppConfig = TKAppConfig;`, sandbox);

assert.strictEqual(sandbox.TKAppConfig.docsUrl, 'https://tk-evu-docs.pages.dev/', '需要保留当前文档站地址');
assert.strictEqual(sandbox.TKAppConfig.officialDataSource, 'firestore', '正式数据源应为 Firestore');
assert.strictEqual(sandbox.TKAppConfig.storesUserBusinessData, false, '本站不应保存用户业务数据');
assert.deepStrictEqual(
  Array.from(sandbox.TKAppConfig.modules, module => module.key),
  ['calc', 'products', 'orders', 'analytics'],
  '模块顺序需要和导航一致'
);

console.log('app config contract ok');
