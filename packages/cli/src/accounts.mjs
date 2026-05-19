import { createFirestoreClient, isPermissionDenied } from './firestore-client.mjs';
import { loadConfig } from './firestore-config.mjs';
import { fail, formatList } from './output.mjs';

function normalizeAccount(value) {
  return String(value ?? '').trim();
}

async function loadAccounts({ root = process.cwd(), configText = '' } = {}) {
  const config = await loadConfig({ root, configText });
  if (!config) throw fail('还没有配置 Firebase。请先运行 npm run tk -- db setup --config \'<firebaseConfig>\'。');
  const client = createFirestoreClient(config);
  let docs;
  try {
    docs = await client.list('order_accounts', { orderBy: 'name' });
  } catch (error) {
    if (isPermissionDenied(error)) throw fail('当前数据库权限不足，无法读取账号列表。请更新 Firestore 规则后重试。');
    throw error;
  }
  const accounts = docs
    .map(doc => doc.data || {})
    .filter(row => !row.deletedAt)
    .map(row => normalizeAccount(row.name))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  return { config, client, accounts };
}

async function requireAccount(account, options = {}) {
  const targetAccount = normalizeAccount(account);
  if (!targetAccount) throw fail('缺少目标账号：请使用 --account <账号名>。');
  const state = await loadAccounts(options);
  if (!state.accounts.includes(targetAccount)) {
    throw fail(
      `账号「${targetAccount}」不在当前数据库账号列表里。请检查输入，或先在商品管理/订单管理新增账号。当前账号：${formatList(state.accounts)}`,
      { accounts: state.accounts, targetAccount }
    );
  }
  return {
    ...state,
    targetAccount,
    firstAccount: state.accounts[0] || ''
  };
}

export {
  loadAccounts,
  normalizeAccount,
  requireAccount
};
