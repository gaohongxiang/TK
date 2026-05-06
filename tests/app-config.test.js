const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const srcConfigSource = fs.readFileSync(path.join(root, 'src', 'app-config.mjs'), 'utf8');
const srcMainSource = fs.readFileSync(path.join(root, 'src', 'main.mjs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  srcConfigSource,
  /const TKAppConfig = Object\.freeze\(/,
  '路线二主站 ESM 配置需要保留项目级配置对象'
);

assert.match(
  srcConfigSource,
  /officialDataSource:\s*'firestore'/,
  '正式数据源需要明确为 Firestore'
);

assert.match(
  srcConfigSource,
  /storesUserBusinessData:\s*false/,
  '项目配置需要明确本站不保存用户业务数据'
);

assert.match(
  srcConfigSource,
  /analytics:\s*'browser-memory-only'/,
  '数据分析配置需要明确只在浏览器内存处理'
);

assert.match(
  srcConfigSource,
  /key:\s*'calc'[\s\S]*key:\s*'products'[\s\S]*key:\s*'orders'[\s\S]*key:\s*'analytics'/,
  '项目配置需要列出主站模块'
);

assert.match(
  htmlSource,
  /<script type="module" src="\/src\/main\.mjs"><\/script>\s*<script type="module" src="\/src\/firestore-connection\.mjs"><\/script>/,
  'index.html 需要通过 Vite ESM 主入口加载主站壳层，再加载 Firestore 连接模块'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/app-config\.js" defer><\/script>|<script src="js\/app\.js" defer><\/script>/,
  'index.html 不应再加载旧 app-config.js 或 app.js 普通脚本'
);

assert.match(
  srcMainSource,
  /Object\.fromEntries[\s\S]*config\.modules/,
  'ESM 路由模块列表需要从项目配置生成'
);

assert.match(
  srcMainSource,
  /querySelector\?\.\('\.app-doc-link'\)[\s\S]*config\?\.docsUrl/,
  'ESM 文档链接需要接入项目配置'
);

assert.match(
  srcMainSource,
  /window\.switchView = key => switchView\(key\)/,
  'ESM 主入口需要暂时挂回 switchView 全局，兼容旧回退入口'
);

(async () => {
  const module = await import(`file://${path.join(root, 'src', 'app-config.mjs')}`);
  const mainModule = await import(`file://${path.join(root, 'src', 'main.mjs')}`);

  assert.strictEqual(module.TKAppConfig.docsUrl, 'https://tk-evu-docs.pages.dev/', '需要保留当前文档站地址');
  assert.strictEqual(module.TKAppConfig.officialDataSource, 'firestore', '正式数据源应为 Firestore');
  assert.strictEqual(module.TKAppConfig.storesUserBusinessData, false, '本站不应保存用户业务数据');
  assert.deepStrictEqual(
    Array.from(module.TKAppConfig.modules, item => item.key),
    ['calc', 'products', 'orders', 'analytics'],
    '模块顺序需要和导航一致'
  );
  assert.deepStrictEqual(
    Object.keys(mainModule.getModuleMap(module.TKAppConfig)),
    ['calc', 'products', 'orders', 'analytics'],
    'ESM 主入口需要按配置生成模块表'
  );
  assert.equal(typeof mainModule.switchView, 'function', 'ESM 主入口需要导出 switchView 供测试和后续迁移复用');

  console.log('app config contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
