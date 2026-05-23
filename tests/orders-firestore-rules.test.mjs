import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const esmSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders', 'firestore-rules.ts'), 'utf8');
const rulesSource = fs.readFileSync(path.join(__dirname, '..', 'docs', 'public', 'firebase', 'order-tracker-firestore.rules'), 'utf8');

[esmSource, rulesSource].forEach((source, index) => {
  const label = index === 0 ? 'ESM 页面内置规则' : '文档规则';
  assert.match(source, /match \/orders\/\{orderId\}/, `${label} 需要开放 orders 集合规则`);
  assert.match(source, /match \/order_accounts\/\{accountId\}/, `${label} 需要开放 order_accounts 集合规则`);
  assert.match(source, /match \/sync_state\/\{scope\}/, `${label} 需要开放 sync_state 集合规则`);
  assert.match(source, /match \/products\/\{productId\}/, `${label} 需要开放 products 集合规则`);
  assert.match(source, /match \/finance_records\/\{recordId\}/, `${label} 需要开放 finance_records 集合规则`);
  assert.match(source, /match \/collection_records\/\{productKey\}/, `${label} 需要开放 collection_records 集合规则`);
  assert.match(source, /match \/collection_excluded_products\/\{productKey\}/, `${label} 需要开放 collection_excluded_products 集合规则`);
  assert.match(source, /match \/analytics_snapshots\/\{snapshotId\}/, `${label} 需要开放 analytics_snapshots 集合规则`);
  assert.match(source, /match \/analytics_records\/\{recordId\}/, `${label} 需要开放 analytics_records 集合规则`);
  assert.match(source, /match \/_tk_probe\/\{probeId\}/, `${label} 需要开放规则检查探针集合`);
  assert.match(source, /match \/members\/\{email\}/, `${label} 需要提供成员权限集合`);
  assert.match(source, /function isOwner\(\)[\s\S]*function canUse\(moduleKey\)/, `${label} 需要通过成员角色判断模块权限`);
  assert.match(source, /match \/_tk_config\/\{docId\}[\s\S]*allow create: if signedIn\(\) && docId == 'owner' && request\.resource\.data\.email == request\.auth\.token\.email\.lower\(\)[\s\S]*allow update: if signedIn\(\)[\s\S]*request\.resource\.data\.email == resource\.data\.email/, `${label} 管理员初始化配置需要允许本人幂等创建和重试`);
  assert.match(source, /match \/_tk_config\/\{docId\}[\s\S]*allow read: if docId == 'project' \|\| signedIn\(\)[\s\S]*allow create, update: if docId == 'project' && isOwner\(\) && request\.resource\.data\.initialized == true/, `${label} 项目初始化标记需要允许公开读取，并只允许管理员写入`);
  assert.match(source, /match \/members\/\{email\}[\s\S]*allow update: if isOwner\(\) \|\| \([\s\S]*resource\.data\.role == 'owner'[\s\S]*request\.resource\.data\.role == 'owner'/, `${label} 管理员成员文档需要允许本人初始化重试`);
  assert.match(source, /match \/finance_records\/\{recordId\}[\s\S]*allow read, write: if canUse\('finance'\)/, `${label} 收支记录必须由 finance 权限控制`);
  assert.doesNotMatch(source, /allow read, write: if true;/, `${label} 不应再使用公开直连规则`);
});

(async () => {
  const module = await import(path.join(__dirname, '..', 'src', 'orders', 'firestore-rules.ts'));
  assert.strictEqual(
    module.ORDER_TRACKER_FIRESTORE_RULES.trim(),
    rulesSource.trim(),
    'ESM 页面内置规则需要和文档规则保持一致'
  );
  assert.doesNotMatch(
    esmSource,
    /window\.ORDER_TRACKER_FIRESTORE_RULES/,
    'ESM 页面内置规则应由 firestore-connection 直接 import，不应再挂旧全局变量'
  );
  console.log('orders firestore rules contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
