const fs = require('fs');
const path = require('path');
const assert = require('assert');

const esmSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders', 'firestore-rules.mjs'), 'utf8');
const rulesSource = fs.readFileSync(path.join(__dirname, '..', 'docs', 'public', 'firebase', 'order-tracker-firestore.rules'), 'utf8');

[esmSource, rulesSource].forEach((source, index) => {
  const label = index === 0 ? 'ESM 页面内置规则' : '文档规则';
  assert.match(source, /match \/orders\/\{orderId\}/, `${label} 需要开放 orders 集合规则`);
  assert.match(source, /match \/order_accounts\/\{accountId\}/, `${label} 需要开放 order_accounts 集合规则`);
  assert.match(source, /match \/sync_state\/\{scope\}/, `${label} 需要开放 sync_state 集合规则`);
  assert.match(source, /match \/products\/\{productId\}/, `${label} 需要开放 products 集合规则`);
  assert.match(source, /allow read, write: if true;/, `${label} 需要提供最省事的直连规则`);
});

(async () => {
  const module = await import(path.join(__dirname, '..', 'src', 'orders', 'firestore-rules.mjs'));
  assert.strictEqual(
    module.ORDER_TRACKER_FIRESTORE_RULES.trim(),
    rulesSource.trim(),
    'ESM 页面内置规则需要和文档规则保持一致'
  );
  assert.match(
    esmSource,
    /window\.ORDER_TRACKER_FIRESTORE_RULES = ORDER_TRACKER_FIRESTORE_RULES/,
    'ESM 页面内置规则需要挂回旧全局变量'
  );
  console.log('orders firestore rules contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
