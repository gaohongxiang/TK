import path from 'node:path';
import { requireAccount } from './accounts.mjs';
import {
  buildExcludedProductDoc,
  buildRecordDoc,
  extractProductId,
  getAccountName,
  normalizeProductUrl
} from './collection-docs.mjs';
import { isPermissionDenied } from './firestore-client.mjs';
import { fail } from './output.mjs';
import { readCsvIfExists } from './csv.mjs';

async function preflightCollection({ account, root = process.cwd(), configText = '' } = {}) {
  const state = await requireAccount(account, { root, configText });
  let collectionRead = false;
  let collectionWrite = false;
  try {
    await state.client.list('collection_records', { pageSize: 1 });
    await state.client.list('collection_excluded_products', { pageSize: 1 });
    collectionRead = true;
  } catch (error) {
    if (isPermissionDenied(error)) throw fail('当前数据库权限不足，无法读取数据采集记录。请更新 Firestore 规则后重试。');
    throw error;
  }
  try {
    collectionWrite = await state.client.probeWrite();
  } catch (error) {
    if (isPermissionDenied(error)) throw fail('当前数据库权限不足，无法保存数据采集记录。请更新 Firestore 规则后重试。');
    throw error;
  }
  return {
    ok: true,
    projectId: state.config.projectId,
    targetAccount: state.targetAccount,
    targetAccountExists: true,
    firstAccount: state.firstAccount,
    accounts: state.accounts,
    collectionRead,
    collectionWrite
  };
}

async function syncCollectionRun(runDir, { account, root = process.cwd(), configText = '' } = {}) {
  if (!runDir) throw fail('缺少运行目录：请传入 data/collection/fastmoss/runs/<run-id>。');
  const dir = path.resolve(root, runDir);
  const state = await requireAccount(account, { root, configText });
  const nowIso = new Date().toISOString();
  const recordsDataset = await readCsvIfExists(path.join(dir, 'collection_records.csv'));
  const rejectsDataset = await readCsvIfExists(path.join(dir, 'selection_rejects.csv'));
  const recordRows = recordsDataset.rows.map(row => ({ ...row, '账号': row['账号'] || state.targetAccount }));
  const rejectRows = rejectsDataset.rows.map(row => ({ ...row, '账号': row['账号'] || state.targetAccount }));

  let recordsSynced = 0;
  let rejectsSynced = 0;
  try {
    for (const row of recordRows) {
      const doc = buildRecordDoc({
        filename: 'collection_records.csv',
        headers: recordsDataset.headers,
        rows: recordRows
      }, row, nowIso);
      await state.client.patch(`collection_records/${doc.productKey}`, doc);
      recordsSynced += 1;
    }
    for (const row of rejectRows) {
      const doc = buildExcludedProductDoc({
        filename: 'selection_rejects.csv',
        headers: rejectsDataset.headers,
        rows: rejectRows
      }, row, nowIso);
      await state.client.patch(`collection_excluded_products/${doc.productKey}`, doc);
      rejectsSynced += 1;
    }
  } catch (error) {
    if (isPermissionDenied(error)) throw fail('当前数据库权限不足，无法同步数据采集结果。请更新 Firestore 规则后重试。');
    throw error;
  }

  return {
    ok: true,
    projectId: state.config.projectId,
    targetAccount: state.targetAccount,
    runDir: dir,
    recordsSynced,
    rejectsSynced
  };
}

function getRowValue(row, names) {
  for (const name of names) {
    const value = String(row?.[name] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function normalizeAccount(value) {
  return String(value ?? '').trim();
}

function docAccountName(doc) {
  const data = doc?.data || {};
  const rows = [
    data,
    data.datasets?.records?.row
  ];
  for (const row of rows) {
    const account = normalizeAccount(getAccountName(row));
    if (account) return account;
  }
  return normalizeAccount(data.accountName);
}

function docMatchesAccount(doc, targetAccount) {
  return docAccountName(doc) === targetAccount;
}

function docProductId(doc) {
  const data = doc?.data || {};
  const rows = [
    data,
    data.datasets?.records?.row
  ];
  for (const row of rows) {
    const fromField = getRowValue(row, ['商品ID', 'product_id', 'item_id', 'productId']);
    const id = extractProductId(fromField);
    if (id) return id;
    const fromUrl = getRowValue(row, ['核心 TK 链接', '商品链接', 'productUrl', 'product_url', 'tk_product_url', '链接', 'FastMoss 链接', 'fastmossUrl', 'fastmoss_url']);
    const urlId = extractProductId(fromUrl);
    if (urlId) return urlId;
  }
  return '';
}

function docProductUrl(doc) {
  const data = doc?.data || {};
  const rows = [
    data,
    data.datasets?.records?.row
  ];
  for (const row of rows) {
    const url = normalizeProductUrl(getRowValue(row, ['核心 TK 链接', '商品链接', 'productUrl', 'product_url', 'tk_product_url', '链接']));
    if (url) return url;
  }
  return '';
}

function docProductKey(doc) {
  return String(doc?.data?.productKey || doc?.id || '').trim();
}

function docTitle(doc) {
  const data = doc?.data || {};
  const rows = [
    data,
    data.datasets?.records?.row
  ];
  for (const row of rows) {
    const title = getRowValue(row, ['productName', '商品名称']);
    if (title) return title;
  }
  return '';
}

function mergeHeaders(current, next) {
  return Array.from(new Set([...current, ...next].map(value => String(value || '').trim()).filter(Boolean)));
}

const COLLECTION_RECORD_HEADER_ORDER = [
  '账号',
  '选品分',
  '商品名称',
  '店铺名',
  '商品价格',
  '商品近7天销量',
  '采集时间',
  '采集状态',
  '选品判断',
  '店小秘编辑状态',
  '编辑时间',
  '编辑标题',
  '编辑判断'
];

function orderKeys(keys, preferred = COLLECTION_RECORD_HEADER_ORDER) {
  const seen = new Set();
  const source = keys.map(value => String(value || '').trim()).filter(Boolean);
  const ordered = [];
  for (const key of preferred) {
    if (source.includes(key) && !seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }
  for (const key of source) {
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }
  return ordered;
}

function orderObjectKeys(row, preferred = COLLECTION_RECORD_HEADER_ORDER) {
  const ordered = {};
  for (const key of orderKeys(Object.keys(row || {}), preferred)) ordered[key] = row[key];
  return ordered;
}

function normalizeCsvRow(row) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, String(value ?? '')]));
}

function normalizeTitle(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function titleMatches(doc, title) {
  const target = normalizeTitle(title);
  if (!target) return false;
  const data = doc?.data || {};
  const rows = [
    data,
    data.datasets?.records?.row
  ];
  return rows.some(row => normalizeTitle(getRowValue(row, ['productName', '商品名称'])) === target);
}

function matchRecordDoc(doc, identity) {
  if (!docMatchesAccount(doc, identity.account)) return false;
  if (identity.productKey && docProductKey(doc) === identity.productKey) return true;
  const id = extractProductId(identity.productId || identity.productUrl);
  if (id && docProductId(doc) === id) return true;
  const url = normalizeProductUrl(identity.productUrl);
  if (url && docProductUrl(doc) === url) return true;
  return titleMatches(doc, identity.productName);
}

async function markDxmEdited({ account, productKey = '', productId = '', productUrl = '', productName = '', editedTitle = '', editedAt = '', root = process.cwd(), configText = '' } = {}) {
  const state = await requireAccount(account, { root, configText });
  const targetTitle = String(editedTitle || '').trim();
  if (!targetTitle) throw fail('缺少编辑标题：请使用 --edited-title <编辑后的标题>。');
  const identity = {
    account: state.targetAccount,
    productKey: String(productKey || '').trim(),
    productId: String(productId || '').trim(),
    productUrl: String(productUrl || '').trim(),
    productName: String(productName || '').trim()
  };
  if (!identity.productKey && !identity.productId && !identity.productUrl && !identity.productName) {
    throw fail('缺少商品定位信息：请传 --product-url、--product-id、--product-key 或 --product-name。');
  }
  let docs = [];
  try {
    docs = await state.client.listAll('collection_records', { pageSize: 300 });
  } catch (error) {
    if (isPermissionDenied(error)) throw fail('当前数据库权限不足，无法读取采集表记录。请更新 Firestore 规则后重试。');
    throw error;
  }
  const matches = docs.filter(doc => matchRecordDoc(doc, identity));
  if (!matches.length) throw fail('没有找到对应的采集表商品，已停止回写，避免把编辑记录写成新商品。', identity);
  if (matches.length > 1) {
    throw fail('找到多条可能对应的采集表商品，已停止回写，请补充商品链接或商品ID。', {
      matchedProductKeys: matches.map(docProductKey)
    });
  }
  const doc = matches[0];
  const data = doc.data || {};
  const recordsDataset = data.datasets?.records || {};
  const recordsRow = normalizeCsvRow(recordsDataset.row || {});
  const nowIso = editedAt || new Date().toISOString();
  const sourceTitle = identity.productName || docTitle(doc);
  const nextRow = { ...recordsRow };
  nextRow['店小秘编辑状态'] = '已编辑';
  nextRow['编辑时间'] = nowIso;
  nextRow['编辑标题'] = targetTitle;
  nextRow['编辑判断'] = '已完成店小秘商品编辑。';
  const orderedRow = orderObjectKeys(nextRow);
  await state.client.patch(`collection_records/${doc.id}`, {
    productName: sourceTitle || data.productName || null,
    editedTitle: targetTitle,
    editStatus: orderedRow['店小秘编辑状态'],
    editedAt: nowIso,
    editJudgement: orderedRow['编辑判断'],
    updatedAt: nowIso,
    datasets: {
      ...(data.datasets || {}),
      records: {
        filename: recordsDataset.filename || 'collection_records.csv',
        headers: mergeHeaders(recordsDataset.headers || [], Object.keys(orderedRow)),
        row: orderedRow,
        updatedAt: nowIso
      }
    }
  });
  return {
    ok: true,
    projectId: state.config.projectId,
    targetAccount: state.targetAccount,
    productKey: docProductKey(doc),
    productName: sourceTitle || '',
    editedTitle: targetTitle,
    editStatus: orderedRow['店小秘编辑状态'],
    editJudgement: orderedRow['编辑判断'],
    editedAt: nowIso
  };
}

export {
  markDxmEdited,
  preflightCollection,
  syncCollectionRun
};
