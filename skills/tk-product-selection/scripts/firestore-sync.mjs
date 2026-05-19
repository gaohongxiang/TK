#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';
const PRIVATE_CREDENTIALS_PATH = ['private', 'tk-product-selection', 'credentials.json'];

function codexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function credentialsPath() {
  return path.join(codexHome(), ...PRIVATE_CREDENTIALS_PATH);
}

function fail(message, meta = {}) {
  const error = new Error(message);
  error.meta = meta;
  return error;
}

function toPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      out._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    index += 1;
  }
  return out;
}

function runLooseObjectParser(text) {
  try {
    return Function(`"use strict"; return (${text});`)();
  } catch {
    return null;
  }
}

function sanitizeFirebaseConfig(raw) {
  const cfg = toPlainObject(raw);
  if (!cfg) return null;
  const next = {};
  for (const key of ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId', 'measurementId']) {
    const value = String(cfg[key] || '').trim();
    if (value) next[key] = value;
  }
  if (!next.apiKey || !next.projectId || !next.appId) return null;
  if (!next.authDomain) next.authDomain = `${next.projectId}.firebaseapp.com`;
  return next;
}

function parseFirebaseConfig(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return sanitizeFirebaseConfig(raw);
  const text = String(raw || '').trim();
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  const body = text.slice(start, end + 1);
  try {
    return sanitizeFirebaseConfig(JSON.parse(body));
  } catch {}
  return sanitizeFirebaseConfig(runLooseObjectParser(body));
}

async function loadFirebaseConfig() {
  const fromEnv = parseFirebaseConfig(process.env.TK_FIRESTORE_CONFIG || '');
  if (fromEnv) return fromEnv;
  let privateConfig = null;
  try {
    privateConfig = JSON.parse(await fs.readFile(credentialsPath(), 'utf8'));
  } catch {}
  const fromPrivate = parseFirebaseConfig(privateConfig?.firebaseConfig);
  if (fromPrivate) return fromPrivate;
  throw fail('本地私密配置里没有 firebaseConfig。请先用 local-credentials.mjs set-firebase 保存。');
}

function dbBase(config) {
  return `${FIRESTORE_BASE}/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents`;
}

function documentUrl(config, docPath) {
  return `${dbBase(config)}/${docPath.split('/').map(encodeURIComponent).join('/')}?key=${encodeURIComponent(config.apiKey)}`;
}

function collectionUrl(config, collectionName, params = {}) {
  const url = new URL(`${dbBase(config)}/${encodeURIComponent(collectionName)}`);
  url.searchParams.set('key', config.apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)]))
      }
    };
  }
  return { stringValue: String(value) };
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('stringValue' in value) return String(value.stringValue);
  if ('timestampValue' in value) return String(value.timestampValue);
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return documentFieldsToObject(value.mapValue.fields || {});
  return null;
}

function documentFieldsToObject(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

function toFirestoreDocument(data) {
  return {
    fields: Object.fromEntries(Object.entries(data || {}).map(([key, value]) => [key, firestoreValue(value)]))
  };
}

function assignNestedField(target, pathValue, value) {
  const parts = String(pathValue || '').split('.').filter(Boolean);
  if (!parts.length) return;
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    cursor[part] = cursor[part] && typeof cursor[part] === 'object' && !Array.isArray(cursor[part]) ? cursor[part] : {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function toNestedFirestoreDocument(fields) {
  const nested = {};
  for (const [key, value] of Object.entries(fields || {})) assignNestedField(nested, key, value);
  return toFirestoreDocument(nested);
}

function updateMaskParams(data) {
  const params = new URLSearchParams();
  for (const key of Object.keys(data || {})) {
    if (key.includes('.')) params.append('updateMask.fieldPaths', `\`${key.replaceAll('`', '\\`')}\``);
    else params.append('updateMask.fieldPaths', key);
  }
  return params.toString();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    const message = body?.error?.message || body?.raw || response.statusText;
    const error = new Error(`Firestore 请求失败：${message}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function docId(name) {
  return String(name || '').split('/').pop();
}

function docFromApi(document) {
  return {
    id: docId(document.name),
    name: document.name,
    data: documentFieldsToObject(document.fields || {})
  };
}

function isPermissionDenied(error) {
  return error?.status === 403 || /permission|PERMISSION_DENIED|Missing or insufficient permissions/i.test(String(error?.message || ''));
}

function createFirestoreClient(config) {
  async function list(collectionName, params = {}) {
    const body = await requestJson(collectionUrl(config, collectionName, params));
    return (body?.documents || []).map(docFromApi);
  }

  async function listAll(collectionName, params = {}) {
    const all = [];
    let pageToken = '';
    do {
      const page = pageToken ? { ...params, pageToken } : params;
      const body = await requestJson(collectionUrl(config, collectionName, page));
      all.push(...(body?.documents || []).map(docFromApi));
      pageToken = body?.nextPageToken || '';
    } while (pageToken);
    return all;
  }

  async function patch(docPath, data) {
    const url = `${documentUrl(config, docPath)}&${updateMaskParams(data)}`;
    const body = await requestJson(url, {
      method: 'PATCH',
      body: JSON.stringify(toFirestoreDocument(data))
    });
    return docFromApi(body);
  }

  async function patchFields(docPath, fields) {
    const params = new URLSearchParams();
    for (const key of Object.keys(fields || {})) params.append('updateMask.fieldPaths', key);
    const url = `${documentUrl(config, docPath)}&${params.toString()}`;
    const body = await requestJson(url, {
      method: 'PATCH',
      body: JSON.stringify(toNestedFirestoreDocument(fields))
    });
    return docFromApi(body);
  }

  async function remove(docPath) {
    await requestJson(documentUrl(config, docPath), { method: 'DELETE' });
  }

  async function probeWrite() {
    const id = `skill_${Date.now().toString(36)}`;
    await patch(`_tk_probe/${id}`, {
      source: 'tk-product-selection-skill',
      createdAt: new Date().toISOString()
    });
    await remove(`_tk_probe/${id}`).catch(() => {});
    return true;
  }

  return { config, list, listAll, patch, patchFields, probeWrite, remove };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (char !== '\r') cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function readCsv(file) {
  const text = await fs.readFile(file, 'utf8');
  const rows = parseCsv(text);
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map(value => String(value || '').trim());
  return {
    headers,
    rows: rows.slice(1)
      .filter(values => values.some(value => String(value || '').trim()))
      .map(values => Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? '')])))
  };
}

async function readCsvIfExists(file) {
  try {
    return await readCsv(file);
  } catch {
    return { headers: [], rows: [] };
  }
}

function getRowValue(row, names) {
  for (const name of names) {
    const value = String(row?.[name] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function normalizeProductUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return text.replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

function normalizeTkProductUrl(value, productId = '') {
  const url = normalizeProductUrl(value);
  if (/tiktok\.com/i.test(url)) return url;
  const id = extractProductId(productId || url);
  return id ? `https://www.tiktok.com/view/product/${id}` : '';
}

function extractProductId(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const patterns = [
    /\/(?:view\/product|product)\/(\d{8,})/i,
    /\/e-commerce\/detail\/(\d{8,})/i,
    /(?:product_id|productId|item_id|itemId|id)[=:](\d{8,})/i,
    /\b(\d{16,22})\b/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

function getProductKey(row) {
  const productId = getRowValue(row, ['商品ID', 'product_id', 'item_id', 'productId']);
  const productUrl = normalizeTkProductUrl(getRowValue(row, ['核心 TK 链接', '商品链接', 'product_url', 'tk_product_url', '链接']), productId);
  const fallback = [
    getRowValue(row, ['商品名称']),
    getRowValue(row, ['店铺名', 'shop_name']),
    productUrl
  ].filter(Boolean).join('|');
  const source = productId || productUrl || fallback;
  return `tk_${stableHash(source || JSON.stringify(row))}`;
}

function getAccountName(row) {
  return getRowValue(row, ['账号', '所属账号', '目标账号', 'account', 'accountName', 'account_name']);
}

function getScopedProductKey(row) {
  const productKey = getProductKey(row);
  const accountName = getAccountName(row);
  return accountName ? `acc_${stableHash(accountName)}_${productKey}` : productKey;
}

function toNullableText(value) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function normalizeCollectStatus(row) {
  const status = getRowValue(row, ['采集状态']);
  if (status === '已采集') return '已采集';
  if (status === '采集失败') return '采集失败';
  return '';
}

function getCollectFailureReason(row, collectStatus = normalizeCollectStatus(row)) {
  if (collectStatus !== '采集失败') return '';
  return getRowValue(row, ['选品判断']);
}

function buildCollectSelectionJudgement(row, collectStatus, collectFailureReason) {
  if (collectStatus === '采集失败') return collectFailureReason || '';
  return getRowValue(row, ['选品判断']) || '符合当前选品规则，已采集到店小秘。';
}

function removeCollectionEditFields(row) {
  for (const key of ['店小秘编辑状态', '编辑时间', '编辑标题', '编辑判断']) {
    delete row[key];
  }
}

function normalizeEditStatus(row) {
  const editedTitle = getRowValue(row, ['编辑标题']);
  const status = getRowValue(row, ['店小秘编辑状态']);
  if (editedTitle) return '已编辑';
  if (status === '已编辑') return '已编辑';
  if (status === '编辑失败') return '编辑失败';
  return '未编辑';
}

function removeCollectionRecordHiddenFields(row) {
  for (const key of ['店铺总销售额（日元）', '店铺总销售额', 'shop_revenue_jpy']) delete row[key];
}

function isCollectedToDxm(row) {
  return normalizeCollectStatus(row) === '已采集';
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

function mergeRecordHeaders(current, next) {
  return orderKeys(mergeHeaders(current, next));
}

function normalizeCsvRow(row) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, String(value ?? '')]));
}

function buildRecordDoc(dataset, row, nowIso) {
  const normalizedRow = normalizeCsvRow(row);
  const productName = getRowValue(normalizedRow, ['商品名称']);
  const productId = getRowValue(normalizedRow, ['商品ID', 'product_id', 'item_id', 'productId']);
  const productUrl = normalizeTkProductUrl(getRowValue(normalizedRow, ['核心 TK 链接', '商品链接', 'product_url', 'tk_product_url', '链接']), productId);
  const collectStatus = normalizeCollectStatus(normalizedRow);
  const collectFailureReason = toNullableText(getCollectFailureReason(normalizedRow, collectStatus));
  if (!collectStatus) {
    throw fail('采集表记录缺少有效采集状态：只能同步已采集或采集失败；未尝试采集的候选商品不能写入 collection_records。', {
      productName,
      productUrl
    });
  }
  if (collectStatus === '采集失败' && !collectFailureReason) {
    throw fail('采集失败记录缺少失败原因，已停止同步。', {
      productName,
      productUrl
    });
  }
  normalizedRow['采集状态'] = collectStatus;
  const selectionJudgement = buildCollectSelectionJudgement(normalizedRow, collectStatus, collectFailureReason || '');
  if (selectionJudgement) normalizedRow['选品判断'] = selectionJudgement;
  removeCollectionEditFields(normalizedRow);
  removeCollectionRecordHiddenFields(normalizedRow);
  const orderedRow = orderObjectKeys(normalizedRow);
  return {
    productKey: getScopedProductKey(orderedRow),
    accountName: toNullableText(getAccountName(orderedRow)),
    productId: toNullableText(productId),
    productUrl: toNullableText(productUrl),
    fastmossUrl: toNullableText(getRowValue(orderedRow, ['FastMoss 链接', 'fastmoss_url', '店铺链接', 'shop_url'])),
    shopName: toNullableText(getRowValue(orderedRow, ['店铺名', 'shop_name'])),
    productName: toNullableText(getRowValue(orderedRow, ['商品名称'])),
    collectStatus,
    collectedToDxm: isCollectedToDxm(orderedRow),
    collectedAt: toNullableText(getRowValue(orderedRow, ['采集时间'])),
    collectFailureReason,
    note: toNullableText(getRowValue(orderedRow, ['备注', 'note'])),
    lastDatasetKey: 'records',
    source: 'fastmoss',
    createdAt: nowIso,
    updatedAt: nowIso,
    datasets: {
      records: {
        filename: dataset.filename || 'collection_records.csv',
        headers: mergeRecordHeaders(dataset.headers || [], Object.keys(orderedRow)),
        row: orderedRow,
        updatedAt: nowIso
      }
    }
  };
}

function buildExcludedProductDoc(dataset, row, nowIso) {
  const normalizedRow = normalizeCsvRow(row);
  const productId = getRowValue(normalizedRow, ['商品ID', 'product_id', 'item_id', 'productId']);
  const productUrl = normalizeTkProductUrl(getRowValue(normalizedRow, ['核心 TK 链接', '商品链接', 'product_url', 'tk_product_url', '链接']), productId);
  return {
    productKey: getScopedProductKey(normalizedRow),
    accountName: toNullableText(getAccountName(normalizedRow)),
    productId: toNullableText(productId),
    productUrl: toNullableText(productUrl),
    fastmossUrl: toNullableText(getRowValue(normalizedRow, ['FastMoss 链接', 'fastmoss_url', '店铺链接', 'shop_url'])),
    shopName: toNullableText(getRowValue(normalizedRow, ['店铺名', 'shop_name'])),
    productName: toNullableText(getRowValue(normalizedRow, ['商品名称'])),
    productCategory: toNullableText(getRowValue(normalizedRow, ['商品类目', 'category', 'product_category'])),
    productSales7d: toNullableText(getRowValue(normalizedRow, ['商品近7天销量', '商品近 7 天销量', 'day7_sales', 'day7_sold_count'])),
    shopRevenueJpy: toNullableText(getRowValue(normalizedRow, ['店铺总销售额（日元）', '店铺总销售额', 'shop_revenue_jpy'])),
    rejectReason: toNullableText(getRowValue(normalizedRow, ['拒绝原因'])),
    filename: dataset.filename || 'selection_rejects.csv',
    source: 'fastmoss',
    createdAt: nowIso,
    updatedAt: nowIso
  };
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
  const value = String(doc?.data?.productKey || doc?.id || '').trim();
  return value || '';
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
  const key = String(identity.productKey || '').trim();
  if (key && docProductKey(doc) === key) return true;
  const id = extractProductId(identity.productId || identity.productUrl);
  if (id && docProductId(doc) === id) return true;
  const url = normalizeProductUrl(identity.productUrl);
  if (url && docProductUrl(doc) === url) return true;
  return titleMatches(doc, identity.productName);
}

async function markDxmEdited(args) {
  const state = await requireAccount(args.account);
  const identity = {
    account: state.targetAccount,
    productKey: args['product-key'] || args.productKey || '',
    productId: args['product-id'] || args.productId || '',
    productUrl: args['product-url'] || args.productUrl || '',
    productName: args['product-name'] || args.productName || args.title || ''
  };
  const editedTitle = String(args['edited-title'] || args.editedTitle || '').trim();
  const editJudgement = String(args.judgement || args['edit-judgement'] || args.editJudgement || '').trim() || '已完成店小秘商品编辑。';
  const editedAt = String(args['edited-at'] || args.editedAt || '').trim() || new Date().toISOString();
  if (!editedTitle) throw fail('缺少编辑标题：请使用 --edited-title <编辑后的标题>。');
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
  if (!matches.length) {
    throw fail('没有找到对应的采集表商品，已停止回写，避免把编辑记录写成新商品。', identity);
  }
  if (matches.length > 1) {
    throw fail('找到多条可能对应的采集表商品，已停止回写，请补充商品链接或商品ID。', {
      matchedProductKeys: matches.map(docProductKey)
    });
  }

  const doc = matches[0];
  const data = doc.data || {};
  const recordsDataset = data.datasets?.records || {};
  const recordsRow = normalizeCsvRow(recordsDataset.row || {});
  const nextRow = { ...recordsRow };
  nextRow['店小秘编辑状态'] = '已编辑';
  nextRow['编辑时间'] = editedAt;
  nextRow['编辑标题'] = editedTitle;
  nextRow['编辑判断'] = editJudgement;
  removeCollectionRecordHiddenFields(nextRow);
  const orderedRow = orderObjectKeys(nextRow);
  const patch = {
    productName: data.productName || docTitle(doc) || null,
    editedTitle,
    editStatus: orderedRow['店小秘编辑状态'],
    editedAt,
    editJudgement: orderedRow['编辑判断'],
    updatedAt: editedAt,
    datasets: {
      ...(data.datasets || {}),
      records: {
        filename: recordsDataset.filename || 'collection_records.csv',
        headers: mergeRecordHeaders(recordsDataset.headers || [], Object.keys(orderedRow)),
        row: orderedRow,
        updatedAt: editedAt
      }
    }
  };
  try {
    await state.client.patchFields(`collection_records/${doc.id}`, {
      productName: patch.productName,
      editedTitle: patch.editedTitle,
      editStatus: patch.editStatus,
      editedAt: patch.editedAt,
      editJudgement: patch.editJudgement,
      updatedAt: patch.updatedAt,
      'datasets.records': patch.datasets.records
    });
  } catch (error) {
    if (isPermissionDenied(error)) throw fail('当前数据库权限不足，无法回写店小秘编辑状态。请更新 Firestore 规则后重试。');
    throw error;
  }
  return {
    ok: true,
    projectId: state.config.projectId,
    targetAccount: state.targetAccount,
    productKey: docProductKey(doc),
    editedTitle,
    editStatus: orderedRow['店小秘编辑状态'],
    editJudgement: orderedRow['编辑判断'],
    editedAt
  };
}

async function markDxmRejected(args) {
  const state = await requireAccount(args.account);
  const identity = {
    account: state.targetAccount,
    productKey: args['product-key'] || args.productKey || '',
    productId: args['product-id'] || args.productId || '',
    productUrl: args['product-url'] || args.productUrl || '',
    productName: args['product-name'] || args.productName || args.title || ''
  };
  const reason = String(args.reason || args['reject-reason'] || args.rejectReason || '').trim();
  const rejectedAt = String(args['rejected-at'] || args.rejectedAt || '').trim() || new Date().toISOString();
  if (!reason) throw fail('缺少不合格原因：请使用 --reason <决定性原因>。');
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
  if (!matches.length) {
    throw fail('没有找到对应的采集表商品，已停止回写，避免把编辑结果写成新采集记录。', identity);
  }
  if (matches.length > 1) {
    throw fail('找到多条可能对应的采集表商品，已停止回写，请补充商品链接或商品ID。', {
      matchedProductKeys: matches.map(docProductKey)
    });
  }

  const doc = matches[0];
  const data = doc.data || {};
  const recordsDataset = data.datasets?.records || {};
  const recordsRow = normalizeCsvRow(recordsDataset.row || {});
  const nextRow = { ...recordsRow };
  nextRow['店小秘编辑状态'] = '编辑失败';
  nextRow['编辑时间'] = rejectedAt;
  nextRow['编辑判断'] = reason;
  delete nextRow['编辑标题'];
  removeCollectionRecordHiddenFields(nextRow);
  const orderedRow = orderObjectKeys(nextRow);
  const patch = {
    productName: data.productName || docTitle(doc) || null,
    editStatus: orderedRow['店小秘编辑状态'],
    editedAt: rejectedAt,
    editJudgement: reason,
    updatedAt: rejectedAt,
    datasets: {
      ...(data.datasets || {}),
      records: {
        filename: recordsDataset.filename || 'collection_records.csv',
        headers: mergeRecordHeaders(recordsDataset.headers || [], Object.keys(orderedRow)),
        row: orderedRow,
        updatedAt: rejectedAt
      }
    }
  };
  try {
    await state.client.patchFields(`collection_records/${doc.id}`, {
      productName: patch.productName,
      editedTitle: null,
      editStatus: patch.editStatus,
      editedAt: patch.editedAt,
      editJudgement: patch.editJudgement,
      updatedAt: patch.updatedAt,
      'datasets.records': patch.datasets.records
    });
  } catch (error) {
    if (isPermissionDenied(error)) throw fail('当前数据库权限不足，无法回写不合格原因。请更新 Firestore 规则后重试。');
    throw error;
  }
  return {
    ok: true,
    projectId: state.config.projectId,
    targetAccount: state.targetAccount,
    productKey: docProductKey(doc),
    editStatus: orderedRow['店小秘编辑状态'],
    editJudgement: reason,
    editedAt: rejectedAt
  };
}

async function repairEditStatusFromTitle(args) {
  const state = await requireAccount(args.account);
  const nowIso = new Date().toISOString();
  let docs = [];
  try {
    docs = await state.client.listAll('collection_records', { pageSize: 300 });
  } catch (error) {
    if (isPermissionDenied(error)) throw fail('当前数据库权限不足，无法读取采集表记录。请更新 Firestore 规则后重试。');
    throw error;
  }

  let scanned = 0;
  let repaired = 0;
  const repairedProductKeys = [];
  for (const doc of docs.filter(item => docMatchesAccount(item, state.targetAccount))) {
    scanned += 1;
    const data = doc.data || {};
    const recordsDataset = data.datasets?.records || {};
    const recordsRow = normalizeCsvRow(recordsDataset.row || {});
    const normalizedStatus = normalizeEditStatus(recordsRow);
    const currentStatus = getRowValue(recordsRow, ['店小秘编辑状态']);
    const currentEditedAt = getRowValue(recordsRow, ['编辑时间']);
    const needsStatusRepair = normalizedStatus === '已编辑' && currentStatus !== '已编辑';
    const needsTimeRepair = ['已编辑', '编辑失败'].includes(normalizedStatus) && !currentEditedAt;
    if (!needsStatusRepair && !needsTimeRepair) continue;

    const editedAt = currentEditedAt || data.editedAt || data.updatedAt || nowIso;
    const nextRow = { ...recordsRow, '店小秘编辑状态': normalizedStatus, '编辑时间': editedAt };
    if (!nextRow['编辑判断']) nextRow['编辑判断'] = '已回填编辑标题，按编辑完成处理。';
    removeCollectionRecordHiddenFields(nextRow);
    const orderedRow = orderObjectKeys(nextRow);
    const editedTitle = getRowValue(orderedRow, ['编辑标题']);
    const records = {
      filename: recordsDataset.filename || 'collection_records.csv',
      headers: mergeRecordHeaders(recordsDataset.headers || [], Object.keys(orderedRow)),
      row: orderedRow,
      updatedAt: editedAt
    };
    try {
      await state.client.patchFields(`collection_records/${doc.id}`, {
        editedTitle,
        editStatus: '已编辑',
        editedAt,
        editJudgement: orderedRow['编辑判断'],
        updatedAt: nowIso,
        'datasets.records': records
      });
    } catch (error) {
      if (isPermissionDenied(error)) throw fail('当前数据库权限不足，无法修复店小秘编辑状态。请更新 Firestore 规则后重试。');
      throw error;
    }
    repaired += 1;
    repairedProductKeys.push(docProductKey(doc));
  }

  return {
    ok: true,
    projectId: state.config.projectId,
    targetAccount: state.targetAccount,
    scanned,
    repaired,
    repairedProductKeys
  };
}

async function buildFirestoreDedupe(runDir, account) {
  if (!runDir) throw fail('缺少运行目录：请传入 data/collection/fastmoss/runs/<run-id>。');
  const dir = path.resolve(process.cwd(), runDir);
  await fs.mkdir(dir, { recursive: true });
  const state = await requireAccount(account);
  let recordDocs = [];
  let excludedDocs = [];
  try {
    recordDocs = await state.client.listAll('collection_records', { pageSize: 300 });
    excludedDocs = await state.client.listAll('collection_excluded_products', { pageSize: 300 });
  } catch (error) {
    if (isPermissionDenied(error)) throw fail('当前数据库权限不足，无法读取数据采集去重记录。请更新 Firestore 规则后重试。');
    throw error;
  }

  const scopedRecords = recordDocs.filter(doc => docMatchesAccount(doc, state.targetAccount));
  const scopedExcluded = excludedDocs.filter(doc => docMatchesAccount(doc, state.targetAccount));
  const scopedDocs = [...scopedRecords, ...scopedExcluded];
  const oldProductIds = Array.from(new Set(scopedDocs.map(docProductId).filter(Boolean))).sort();
  const oldProductUrls = Array.from(new Set(scopedDocs.map(docProductUrl).filter(Boolean))).sort();
  const oldProductKeys = Array.from(new Set(scopedDocs.map(docProductKey).filter(Boolean))).sort();
  const manifest = {
    source: 'firestore',
    account: state.targetAccount,
    oldProductIds,
    oldProductUrls,
    oldProductKeys,
    oldProductCount: oldProductIds.length,
    collectionRecordsDocs: scopedRecords.length,
    excludedDocs: scopedExcluded.length,
    runDir: dir,
    updatedAt: new Date().toISOString()
  };
  const outputPath = path.join(dir, 'dedupe_manifest.json');
  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    ok: true,
    projectId: state.config.projectId,
    targetAccount: state.targetAccount,
    runDir: dir,
    outputPath,
    oldProductCount: oldProductIds.length,
    collectionRecordsDocs: scopedRecords.length,
    excludedDocs: scopedExcluded.length
  };
}

function formatList(values) {
  return values.length ? values.join('、') : '无';
}

async function loadAccounts() {
  const config = await loadFirebaseConfig();
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

async function requireAccount(account) {
  const targetAccount = normalizeAccount(account);
  if (!targetAccount) throw fail('缺少目标账号：请使用 --account <账号名>。');
  const state = await loadAccounts();
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

async function preflightCollection(account) {
  const state = await requireAccount(account);
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

async function syncCollectionRun(runDir, account) {
  if (!runDir) throw fail('缺少运行目录：请传入 data/collection/fastmoss/runs/<run-id>。');
  const dir = path.resolve(process.cwd(), runDir);
  const state = await requireAccount(account);
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

function printHelp() {
  process.stdout.write(`TK product selection Firestore sync

Usage:
  node firestore-sync.mjs accounts
  node firestore-sync.mjs preflight --account NOMA
  node firestore-sync.mjs dedupe data/collection/fastmoss/runs/<run-id> --account NOMA
  node firestore-sync.mjs sync data/collection/fastmoss/runs/<run-id> --account NOMA
  node firestore-sync.mjs mark-dxm-edited --account NOMA --product-url <商品链接> --product-name <商品名称> --edited-title <编辑标题> --judgement <成功判断>
  node firestore-sync.mjs mark-dxm-rejected --account NOMA --product-url <商品链接> --product-name <商品名称> --reason <不合格原因>
  node firestore-sync.mjs repair-edit-status --account NOMA

Reads local private collection settings.
`);
}

async function main() {
  const [command = 'help', ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  let result;
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  if (command === 'accounts') {
    const state = await loadAccounts();
    result = { ok: true, projectId: state.config.projectId, accounts: state.accounts };
  } else if (command === 'preflight') {
    result = await preflightCollection(args.account);
  } else if (command === 'dedupe') {
    result = await buildFirestoreDedupe(args._[0], args.account);
  } else if (command === 'sync') {
    result = await syncCollectionRun(args._[0], args.account);
  } else if (command === 'mark-dxm-edited') {
    result = await markDxmEdited(args);
  } else if (command === 'mark-dxm-rejected') {
    result = await markDxmRejected(args);
  } else if (command === 'repair-edit-status') {
    result = await repairEditStatusFromTitle(args);
  } else {
    throw fail(`未知命令：${command}`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const output = {
    ok: false,
    error: error.message,
    ...(error.meta ? { meta: error.meta } : {})
  };
  process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = 1;
});
