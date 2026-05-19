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

function isCollectedToDxm(row) {
  return normalizeCollectStatus(row) === '已采集';
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

function removeCollectionRecordHiddenFields(row) {
  for (const key of ['店铺总销售额（日元）', '店铺总销售额', 'shop_revenue_jpy']) delete row[key];
}

function mergeHeaders(current, next) {
  return Array.from(new Set([...current, ...next].map(value => String(value || '').trim()).filter(Boolean)));
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
    throw new Error('采集表记录缺少有效采集状态：只能同步已采集或采集失败；未尝试采集的候选商品不能写入 collection_records。');
  }
  if (collectStatus === '采集失败' && !collectFailureReason) {
    throw new Error('采集失败记录缺少失败原因，已停止同步。');
  }
  normalizedRow['采集状态'] = collectStatus;
  const selectionJudgement = buildCollectSelectionJudgement(normalizedRow, collectStatus, collectFailureReason || '');
  if (selectionJudgement) normalizedRow['选品判断'] = selectionJudgement;
  removeCollectionEditFields(normalizedRow);
  removeCollectionRecordHiddenFields(normalizedRow);
  return {
    productKey: getScopedProductKey(normalizedRow),
    accountName: toNullableText(getAccountName(normalizedRow)),
    productId: toNullableText(productId),
    productUrl: toNullableText(productUrl),
    fastmossUrl: toNullableText(getRowValue(normalizedRow, ['FastMoss 链接', 'fastmoss_url', '店铺链接', 'shop_url'])),
    shopName: toNullableText(getRowValue(normalizedRow, ['店铺名', 'shop_name'])),
    productName: toNullableText(getRowValue(normalizedRow, ['商品名称'])),
    collectStatus,
    collectedToDxm: isCollectedToDxm(normalizedRow),
    collectedAt: toNullableText(getRowValue(normalizedRow, ['采集时间'])),
    collectFailureReason,
    note: toNullableText(getRowValue(normalizedRow, ['备注', 'note'])),
    lastDatasetKey: 'records',
    source: 'fastmoss',
    createdAt: nowIso,
    updatedAt: nowIso,
    datasets: {
      records: {
        filename: dataset.filename || 'collection_records.csv',
        headers: mergeHeaders(dataset.headers || [], Object.keys(normalizedRow)),
        row: normalizedRow,
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

export {
  buildExcludedProductDoc,
  buildRecordDoc,
  extractProductId,
  getAccountName,
  getProductKey,
  getScopedProductKey,
  normalizeProductUrl,
  stableHash
};
