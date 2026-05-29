import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const staleRefreshSource = fs.readFileSync(path.join(root, 'src', 'react', 'lib', 'stale-auto-refresh.ts'), 'utf8');
const ordersSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'orders', 'OrdersPage.tsx'), 'utf8');
const productsSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'products', 'ProductsPage.tsx'), 'utf8');
const collectionSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'collection', 'CollectionPage.tsx'), 'utf8');
const financeSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'finance', 'FinancePage.tsx'), 'utf8');
const ordersProviderSource = fs.readFileSync(path.join(root, 'src', 'orders', 'provider-firestore.ts'), 'utf8');
const productsProviderSource = fs.readFileSync(path.join(root, 'src', 'products', 'provider-firestore.ts'), 'utf8');
const collectionProviderSource = fs.readFileSync(path.join(root, 'src', 'collection', 'provider-firestore.ts'), 'utf8');
const financeProviderSource = fs.readFileSync(path.join(root, 'src', 'finance', 'provider-firestore.ts'), 'utf8');

assert.match(
  staleRefreshSource,
  /REMOTE_STALE_AUTO_REFRESH_DELAY_MS = 60_000/,
  '远端变更自动刷新需要默认延迟 60 秒，合并短时间内多次改动'
);

assert.match(
  staleRefreshSource,
  /function useStaleAutoRefresh[\s\S]*canRefreshRef\.current[\s\S]*window\.setTimeout\([\s\S]*refreshNow\(\)[\s\S]*delayMs/,
  '远端变更自动刷新 hook 需要等待延迟，并在可刷新时才拉取数据'
);

assert.match(
  staleRefreshSource,
  /timerRef\.current[\s\S]*if \(timerRef\.current\) return[\s\S]*setStale\(true\)/,
  '远端变更自动刷新需要复用已有定时器，避免状态牌连续变化时重复刷新'
);

[
  ['订单管理', ordersSource, 'ot-refresh'],
  ['商品管理', productsSource, 'pl-refresh'],
  ['收支管理', financeSource, 'finance-refresh']
].forEach(([label, source, refreshId]) => {
  assert.match(
    source,
    /useStaleAutoRefresh[\s\S]*markRemoteStaleRef[\s\S]*subscribeSnapshot[\s\S]*buildFirestoreSyncStatus\('stale'\)[\s\S]*markRemoteStaleRef\.current\(\)/,
    `${label} 需要在 sync_state 提示有外部变更时标记需要自动刷新`
  );
  assert.match(
    source,
    new RegExp(`id="${refreshId}"[\\s\\S]*remoteStaleRefresh\\.refreshNow\\(\\)`),
    `${label} 手动刷新按钮需要和自动刷新走同一条刷新路径`
  );
});

assert.match(
  collectionSource,
  /useStaleAutoRefresh[\s\S]*markRemoteStaleRef[\s\S]*subscribeSnapshot[\s\S]*buildFirestoreSyncStatus\('stale'\)[\s\S]*markRemoteStaleRef\.current\(\)/,
  '商品采编需要在 sync_state 提示有外部变更时标记需要自动刷新'
);

assert.match(
  collectionSource,
  /async function refreshRemote\(\)[\s\S]*remoteStaleRefresh\.refreshNow\(\)/,
  '商品采编手动刷新按钮需要复用自动刷新路径'
);

[
  ['订单 provider', ordersProviderSource, "orders", 'orders'],
  ['商品 provider', productsProviderSource, "products", 'products'],
  ['采编 provider', collectionProviderSource, "collection", 'collection_records'],
  ['收支 provider', financeProviderSource, "finance", 'finance_records']
].forEach(([label, source, stateKey, collectionName]) => {
  assert.match(
    source,
    new RegExp(`function subscribeSnapshot[\\s\\S]*subscribeSyncState\\([\\s\\S]*currentDb,[\\s\\S]*'${stateKey}'`),
    `${label} 默认订阅需要只监听轻量 sync_state`
  );
  assert.doesNotMatch(
    source,
    new RegExp(`function subscribeSnapshot[\\s\\S]*collection\\('${collectionName}'\\)\\.orderBy`),
    `${label} 不能在默认订阅里监听业务大集合`
  );
});

console.log('firestore low read refresh contract ok');
