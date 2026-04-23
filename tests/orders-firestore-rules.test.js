const fs = require('fs');
const path = require('path');
const assert = require('assert');

const embeddedSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'firestore-rules.js'), 'utf8');
const rulesSource = fs.readFileSync(path.join(__dirname, '..', 'docs', 'firebase', 'order-tracker-firestore.rules'), 'utf8');

[embeddedSource, rulesSource].forEach((source, index) => {
  const label = index === 0 ? '页面内置规则' : '文档规则';
  assert.match(source, /match \/orders\/\{orderId\}/, `${label} 需要开放 orders 集合规则`);
  assert.match(source, /match \/order_accounts\/\{accountId\}/, `${label} 需要开放 order_accounts 集合规则`);
  assert.match(source, /match \/sync_state\/\{scope\}/, `${label} 需要开放 sync_state 集合规则`);
  assert.match(source, /allow read, write: if true;/, `${label} 需要提供最省事的直连规则`);
});

console.log('orders firestore rules contract ok');
