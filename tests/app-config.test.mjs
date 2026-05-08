import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const root = path.join(__dirname, '..');
const srcConfigSource = fs.readFileSync(path.join(root, 'src', 'app-config.ts'), 'utf8');
const reactMainSource = fs.readFileSync(path.join(root, 'src', 'react', 'main.tsx'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
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
  /<script type="module" src="\/src\/react\/main\.tsx"><\/script>/,
  'index.html 需要通过 React SPA 入口加载主站壳层和全局运行层'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/app-config\.js" defer><\/script>|<script src="js\/app\.js" defer><\/script>/,
  'index.html 不应再加载旧 app-config.js 或 app.js 普通脚本'
);

assert.match(
  reactAppSource,
  /function getModules\(config = TKAppConfig\)[\s\S]*config\.modules[\s\S]*function getModuleMap\(config = TKAppConfig\)[\s\S]*Object\.fromEntries\(getModules\(config\)/,
  'React SPA 路由模块列表需要从项目配置生成'
);

assert.match(
  reactAppSource,
  /<AppShell modules=\{modules\} active=\{active\} docsUrl=\{config\.docsUrl\}/,
  'React SPA 文档链接需要接入项目配置'
);

assert.doesNotMatch(
  htmlSource,
  /<script type="module" src="\/src\/main\.mjs"><\/script>/,
  '现代 React SPA 阶段不应再加载旧主站壳层入口'
);

(async () => {
  const module = await import(`file://${path.join(root, 'src', 'app-config.ts')}`);

  assert.strictEqual(module.TKAppConfig.docsUrl, 'https://tk-evu-docs.pages.dev/', '需要保留当前文档站地址');
  assert.strictEqual(module.TKAppConfig.officialDataSource, 'firestore', '正式数据源应为 Firestore');
  assert.strictEqual(module.TKAppConfig.storesUserBusinessData, false, '本站不应保存用户业务数据');
  assert.deepStrictEqual(
    Array.from(module.TKAppConfig.modules, item => item.key),
    ['calc', 'products', 'orders', 'analytics'],
    '模块顺序需要和导航一致'
  );
  assert.match(reactMainSource, /getElementById\('root'\)[\s\S]*<App \/>/, 'React 主入口需要只挂载单一 SPA root');
  assert.ok(!fs.existsSync(path.join(root, 'src', 'main.mjs')), '完整 React SPA 重建后旧 src/main.mjs 入口应删除');

  console.log('app config contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
