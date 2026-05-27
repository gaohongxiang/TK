import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const compatibilitySource = fs.readFileSync(path.join(root, 'src', 'firestore-rules-compatibility.ts'), 'utf8');
const appRuntimeSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'AppRuntime.tsx'), 'utf8');
const productsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const ordersSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const financeSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'finance', 'FinancePage.tsx'), 'utf8');
const collectionSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'collection', 'CollectionPage.tsx'), 'utf8');
const analyticsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'analytics', 'AnalyticsApp.tsx'), 'utf8');
const reactAppSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const databaseDoc = fs.readFileSync(path.join(root, 'docs', 'guide', 'database.md'), 'utf8');

assert.match(
  compatibilitySource,
  /type FirestoreRulesModuleKey = string[\s\S]*const moduleRegistry = new Map/,
  '规则提示模块需要用模块注册表支持后续动态新增模块'
);

assert.match(
  compatibilitySource,
  /getFirestoreRulesModule\(moduleKey\)\.issueSummary[\s\S]*当前数据库权限不足[\s\S]*复制最新 Firestore 规则发布后刷新页面/,
  '所有模块的权限不足提示需要使用统一短文案，避免长清单撑坏 UI'
);

assert.doesNotMatch(
  compatibilitySource,
  /缺少：/,
  '规则兼容检查不应把技术 key 作为用户提示前缀'
);

assert.doesNotMatch(
  compatibilitySource,
  /collection\('_tk_probe'\)[\s\S]*__tkProbe/,
  '进入模块时不应为了检查规则额外写入临时探针'
);

assert.match(
  compatibilitySource,
  /collectionRef\.limit\(1\)/,
  '规则兼容检查读取业务集合时最多取一条，避免把整张表拉下来'
);

assert.match(
  compatibilitySource,
  /ok: missingList\.length === 0[\s\S]*summary: missingList\.length \? getFirestoreRulesUpdateSummary\(moduleKey\) : '数据库规则可用'/,
  '当前模块读取权限检查通过时不应提示规则更新'
);

assert.match(
  compatibilitySource,
  /function registerFirestoreRulesModule\([\s\S]*function getFirestoreRulesModule\([\s\S]*definition\.targets/,
  '新增模块应通过注册自己的权限清单接入当前模块检查'
);

assert.match(
  productsSource,
  /formatFirestoreRulesUpdateMessage\('products'[\s\S]*setSyncText\(''\)[\s\S]*permissionBlocked[\s\S]*<ModuleListState[\s\S]*商品管理保存不可用/,
  '商品管理需要用真实读取失败触发列表区权限不足提示'
);

assert.match(
  ordersSource,
  /formatFirestoreRulesUpdateMessage\('orders'[\s\S]*setSyncText\(''\)[\s\S]*permissionBlocked[\s\S]*<ModuleListState[\s\S]*订单管理保存不可用/,
  '订单管理需要用真实读取失败触发列表区权限不足提示'
);

assert.match(
  collectionSource,
  /formatFirestoreRulesUpdateMessage\('collection'[\s\S]*setSyncText\(''\)[\s\S]*subscribeSnapshot\(snapshot =>[\s\S]*isPermissionDenied\(error\)[\s\S]*markPermissionBlocked\(\)[\s\S]*permissionBlocked[\s\S]*商品采编保存不可用/,
  '商品采编需要用真实读取失败触发列表区权限不足提示'
);

assert.match(
  compatibilitySource,
  /key:\s*'finance'[\s\S]*issueSummary:\s*'收支管理保存不可用'[\s\S]*finance_records[\s\S]*orders[\s\S]*order_accounts/,
  '收支管理需要注册自己的 Firestore 规则兼容检查目标'
);

assert.match(
  financeSource,
  /formatFirestoreRulesUpdateMessage\('finance'[\s\S]*setSyncText\(''\)[\s\S]*permissionBlocked[\s\S]*收支管理保存不可用/,
  '收支管理需要用真实读取失败触发列表区权限不足提示'
);

assert.match(
  compatibilitySource,
  /key:\s*'analytics'[\s\S]*issueSummary:\s*'数据分析保存不可用'[\s\S]*analytics_snapshots[\s\S]*analytics_records/,
  '数据分析需要注册自己的 Firestore 规则兼容检查目标'
);

assert.match(
  analyticsSource,
  /formatFirestoreRulesUpdateMessage\('analytics'[\s\S]*notifyRulesUpdateNeeded\(message\)[\s\S]*subscribeSnapshot\(snapshot =>[\s\S]*saveAnalysis\(next,\s*\{\s*accountName:\s*normalizedAccountName,\s*filename\s*\}\)/,
  '数据分析需要用真实读取和保存失败触发统一规则不足弹窗'
);

assert.match(
  productsSource + ordersSource + financeSource + collectionSource,
  /connected && !permissionBlocked \? <Badge id="pl-sync"[\s\S]*connected && !permissionBlocked \? <Badge id="ot-sync"[\s\S]*connected && !permissionBlocked \? <Badge id="finance-sync"[\s\S]*projectId && !permissionBlocked \? <Badge id="collection-sync"/,
  '权限不足时模块状态条只保留模块内同步状态，不应重复显示规则更新文案'
);

assert.doesNotMatch(
  productsSource + ordersSource + financeSource + collectionSource,
  /checkFirestoreRulesCompatibility|notifyRulesUpdateNeeded/,
  '页面进入模块不应跑额外预检查，也不应把模块权限错误弹成全局规则弹窗'
);

assert.match(
  productsSource + ordersSource + financeSource + collectionSource,
  /tone="connect"[\s\S]*tone="permission"[\s\S]*tone="empty"/,
  '商品、订单和采集列表区需要共用连接、权限不足、无数据三种状态组件，有数据时才显示表格'
);

assert.match(
  reactAppSource,
  /<CollectionPage active=\{active === 'collection'\} \/>/,
  '商品采编模块必须只在自己激活时同步，不能在商品或订单页面后台弹采集规则提示'
);

assert.match(
  collectionSource,
  /function CollectionPage\(\{ active = true \}[\s\S]*useEffect\(\(\) => \{[\s\S]*if \(!active\) return undefined;[\s\S]*loadRemoteDatasets/,
  '商品采编页面未激活时不能读取采编记录'
);

assert.match(
  appRuntimeSource,
  /id="app-firestore-rules-copy"[\s\S]*<AlertDescription>\{rulesMessage\}<\/AlertDescription>/,
  '规则更新弹层需要展示统一短提示'
);

assert.doesNotMatch(
  appRuntimeSource,
  /whitespace-pre-line/,
  '规则更新弹层不应按多行长清单展示'
);

assert.doesNotMatch(
  compatibilitySource,
  /当前受影响|处理方式：|labels\.map\(label => `- \$\{label\}`\)/,
  '权限不足提示不应列受影响权限清单'
);

assert.match(
  databaseDoc,
  /商品管理、订单管理、收支管理、数据采集和数据分析都依赖你自己的 `Firebase Firestore` 项目[\s\S]*网站如何判断规则是否最新[\s\S]*用户进入收支管理，就读取收支记录、订单和账号标签[\s\S]*用户进入数据分析，就读取最近一次分析快照[\s\S]*不会为了检查权限额外写入[\s\S]*新增模块[\s\S]*自己的真实读取和写入失败处接入/,
  '数据库文档需要说明数据分析使用用户自己的 Firestore，并说明真实读取、动态新增模块和探针边界'
);

console.log('firestore rules compatibility contract ok');
