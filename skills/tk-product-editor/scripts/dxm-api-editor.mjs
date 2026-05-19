#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HELP = `店小秘 TikTok 接口化编辑辅助

Usage:
  node dxm-api-editor.mjs read-chrome-page --edit-url <店小秘编辑链接> [--out-dir data/dxm-api/<id>]
  node dxm-api-editor.mjs import-browser-copy --input read-response.browser-copy.txt --edit-url <店小秘编辑链接> [--out-dir data/dxm-api/<id>]
  node dxm-api-editor.mjs read-api --edit-url <店小秘编辑链接> --curl-file data/dxm-api/session.curl [--out-dir data/dxm-api/<id>]
  node dxm-api-editor.mjs read-snippet --edit-url <店小秘编辑链接> [--out read.js]
  node dxm-api-editor.mjs import-read --input dxm-read-response.json --edit-url <店小秘编辑链接> [--out-dir data/dxm-api/<id>]
  node dxm-api-editor.mjs inspect --input original-product.json [--out inspect.json]
  node dxm-api-editor.mjs diff --input original-product.json --patch patch.json --edit-url <店小秘编辑链接> [--out-dir data/dxm-api/<id>-patched]
  node dxm-api-editor.mjs save-api --input tiktokSave.txt --edit-url <店小秘编辑链接> --curl-file data/dxm-api/session.curl --confirm-save-draft YES [--out save-response.json]
  node dxm-api-editor.mjs save-snippet --input tiktokSave.txt --edit-url <店小秘编辑链接> --confirm-save-draft YES [--out save-draft.js]
  node dxm-api-editor.mjs backwrite --account <账号> --product-url <TK链接> --product-name <商品名称> --edited-title <编辑标题> --confirm-saved YES

Patch JSON:
  {
    "set": {
      "title": "NOMA-...",
      "description": "...",
      "weight": 0.2,
      "length": 12,
      "width": 8,
      "height": 4,
      "categoryId": "..."
    }
  }

也支持显式路径：
  { "set": { "product.title": "...", "packageWeight": 0.2 } }

纯接口模式可以让已登录 Chrome 直接打开 edit.json 并复制页面 JSON，也可以使用用户从 DevTools 复制的 cURL 作为当前登录态输入；脚本不会读取 Chrome Profile Cookie。
Chrome 页面读取只打开接口 URL 和复制页面文本，不点店小秘表单。
保存接口固定 op=1 草稿保存；不会发布。
`;

const COMMON_FIELD_ALIASES = new Map([
  ['title', ['title', 'productTitle', 'productName', 'name', 'listingTitle']],
  ['description', ['description', 'productDescription', 'desc', 'detail', 'details', 'descriptionHtml']],
  ['categoryId', ['categoryId', 'cateId', 'category_id', 'categoryLeafId', 'leafCategoryId']],
  ['categoryName', ['categoryName', 'cateName', 'categoryPath', 'category_path']],
  ['brand', ['brand', 'brandName', 'brand_name']],
  ['weight', ['weight', 'packageWeight', 'parcelWeight', 'grossWeight']],
  ['length', ['length', 'packageLength', 'parcelLength']],
  ['width', ['width', 'packageWidth', 'parcelWidth']],
  ['height', ['height', 'packageHeight', 'parcelHeight']]
]);

const PROTECTED_RE = /(^|\.|_)(sku|skus|price|prices|stock|stocks|inventory|warehouse|storehouse|freight|template|tax|settle|settlement|payment|cost|profit|commission|shippingTemplate|logisticsTemplate)(\.|_|$)/i;
const SAFE_DIMENSION_RE = /(^|\.|_)(weight|length|width|height|packageWeight|packageLength|packageWidth|packageHeight|parcelWeight|parcelLength|parcelWidth|parcelHeight|grossWeight|grossLength|grossWidth|grossHeight)(\.|_|$)/i;
const ALLOWED_RE = /(^|\.|_)(title|name|productName|productTitle|listingTitle|desc|description|descriptionHtml|detail|details|category|categoryId|categoryName|cateId|cateName|leafCategoryId|brand|brandName|property|properties|attribute|attributes|attr|attrs|origin|country|manufacturer|material|materials|warranty|package|parcel|dimension|weight|length|width|height|packageWeight|packageLength|packageWidth|packageHeight|parcelWeight|parcelLength|parcelWidth|parcelHeight|grossWeight|grossLength|grossWidth|grossHeight)(\.|_|$)/i;
const ALLOWED_EXACT_PATHS = new Set([
  'brandId',
  'brandInfo',
  'isNewCategory',
  'productAttributes'
]);

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      positional.push(...argv.slice(index + 1));
      break;
    }
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const eqIndex = arg.indexOf('=');
    const key = eqIndex > 2 ? arg.slice(2, eqIndex) : arg.slice(2);
    const value = eqIndex > 2 ? arg.slice(eqIndex + 1) : argv[index + 1];
    if (eqIndex <= 2 && (!value || String(value).startsWith('--'))) {
      flags[key] = true;
      continue;
    }
    flags[key] = value;
    if (eqIndex <= 2) index += 1;
  }
  return { positional, flags };
}

function flag(flags, names, fallback = '') {
  const keys = Array.isArray(names) ? names : [names];
  for (const key of keys) {
    const value = flags[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  return error;
}

function unescapeCurlLineContinuations(text) {
  return String(text || '').replace(/\\\r?\n/g, ' ');
}

function tokenizeShellLike(input) {
  const text = unescapeCurlLineContinuations(input);
  const tokens = [];
  let current = '';
  let quote = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) {
        quote = '';
      } else if (quote === '"' && char === '\\') {
        index += 1;
        current += text[index] || '';
      } else {
        current += char;
      }
      continue;
    }
    if (char === '\'' || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    if (char === '\\') {
      index += 1;
      current += text[index] || '';
      continue;
    }
    current += char;
  }
  if (quote) throw fail('cURL 命令引号不完整。');
  if (current) tokens.push(current);
  return tokens;
}

function parseCurlCommand(text) {
  const tokens = tokenizeShellLike(text);
  if (!tokens.length || !/curl$/i.test(tokens[0])) throw fail('文件内容不是 cURL 命令。');
  const request = {
    url: '',
    method: '',
    headers: {},
    data: []
  };
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = () => {
      index += 1;
      if (index >= tokens.length) throw fail(`cURL 参数缺少值：${token}`);
      return tokens[index];
    };
    if (token === '--url') {
      request.url = next();
    } else if (token === '-X' || token === '--request') {
      request.method = next().toUpperCase();
    } else if (token === '-H' || token === '--header') {
      const header = next();
      const colon = header.indexOf(':');
      if (colon > 0) request.headers[header.slice(0, colon).trim().toLowerCase()] = header.slice(colon + 1).trim();
    } else if (token === '-b' || token === '--cookie') {
      request.headers.cookie = next();
    } else if (token === '--data' || token === '--data-raw' || token === '--data-binary' || token === '--data-urlencode' || token === '-d') {
      request.data.push(next());
      if (!request.method) request.method = 'POST';
    } else if (token === '--compressed' || token === '-s' || token === '-S' || token === '-L' || token === '-i') {
      continue;
    } else if (!token.startsWith('-') && !request.url) {
      request.url = token;
    } else if (token.startsWith('--url=')) {
      request.url = token.slice('--url='.length);
    } else if (token.startsWith('-H')) {
      const header = token.slice(2);
      const colon = header.indexOf(':');
      if (colon > 0) request.headers[header.slice(0, colon).trim().toLowerCase()] = header.slice(colon + 1).trim();
    }
  }
  if (!request.url) throw fail('cURL 命令里没有 URL。');
  return request;
}

async function readCurlSession(file) {
  const curlFile = path.resolve(process.cwd(), file);
  const text = await fs.readFile(curlFile, 'utf8');
  const session = parseCurlCommand(text);
  let url;
  try {
    url = new URL(session.url);
  } catch {
    throw fail('cURL URL 格式不正确。');
  }
  if (!/dianxiaomi\.com$/i.test(url.hostname)) throw fail(`cURL 不是店小秘域名：${url.hostname}`);
  return { ...session, curlFile, origin: url.origin };
}

function buildApiHeaders(session, { editUrl, method = 'GET', multipart = false } = {}) {
  const headers = {};
  const keep = [
    'accept',
    'accept-language',
    'cookie',
    'user-agent',
    'x-requested-with',
    'x-csrf-token',
    'x-xsrf-token',
    'authorization'
  ];
  for (const name of keep) {
    if (session.headers[name]) headers[name] = session.headers[name];
  }
  headers.accept = headers.accept || 'application/json, text/plain, */*';
  headers['x-requested-with'] = headers['x-requested-with'] || 'XMLHttpRequest';
  headers.referer = editUrl;
  headers.origin = new URL(editUrl).origin;
  if (!multipart && method !== 'GET') headers['content-type'] = 'application/json;charset=UTF-8';
  return headers;
}

async function fetchDxmJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let data = null;
  try {
    data = parseJsonPreserveIntegers(text);
  } catch (error) {
    data = { parseError: error.message, textPreview: text.slice(0, 2000) };
  }
  const payload = {
    ok: response.ok,
    status: response.status,
    url: response.url,
    contentType,
    data
  };
  if (!response.ok) throw fail(`店小秘接口 HTTP ${response.status}`, payload);
  if (data?.parseError) throw fail('店小秘接口未返回 JSON，可能是登录失效或验证页。', payload);
  if (data && typeof data === 'object' && data.code != null && ![0, 200].includes(Number(data.code))) {
    throw fail(`店小秘接口业务失败：${data.msg || data.message || data.code}`, payload);
  }
  return payload;
}

async function persistReadPayload({ payload, editUrl, productId, outDir, productPath = '' }) {
  const { product, productPath: detectedPath, rawResponse } = extractProductObject(payload, productPath);
  const inspect = inspectProduct(product);
  await fs.mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, 'original-response.json'), rawResponse);
  await writeJson(path.join(outDir, 'original-product.json'), product);
  await writeJson(path.join(outDir, 'inspect.json'), inspect);
  await writeJson(path.join(outDir, 'manifest.json'), {
    ok: true,
    productId,
    editUrl,
    productPath: detectedPath,
    files: {
      originalResponse: path.join(outDir, 'original-response.json'),
      originalProduct: path.join(outDir, 'original-product.json'),
      inspect: path.join(outDir, 'inspect.json')
    },
    importedAt: new Date().toISOString()
  });
  return { product, productPath: detectedPath, outDir };
}

function parseJsonPreserveIntegers(text, label = 'JSON') {
  try {
    return JSON.parse(text, (key, value, context) => {
      if (
        context &&
        typeof value === 'number' &&
        Number.isInteger(value) &&
        !Number.isSafeInteger(value) &&
        typeof JSON.rawJSON === 'function'
      ) {
        return JSON.rawJSON(context.source);
      }
      return value;
    });
  } catch (error) {
    throw fail(`${label} 解析失败。`, { cause: error.message });
  }
}

function isRawJsonValue(value) {
  return typeof JSON.isRawJSON === 'function' && JSON.isRawJSON(value);
}

function rawJsonText(value) {
  return JSON.stringify(value);
}

function extractFirstJsonDocument(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const start = source.search(/[\[{]/);
  if (start < 0) throw fail('复制内容里没有 JSON 起始符。');
  const opener = source[start];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === opener) {
      depth += 1;
    } else if (char === closer) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw fail('复制内容里的 JSON 不完整。');
}

function parseBrowserCopiedJson(text) {
  const jsonText = extractFirstJsonDocument(text);
  return { jsonText, payload: parseJsonPreserveIntegers(jsonText, '浏览器复制 JSON') };
}

function parseEditUrl(value) {
  if (!value) throw fail('缺少店小秘编辑链接：请传 --edit-url。');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw fail(`店小秘编辑链接格式不正确：${value}`);
  }
  if (!/dianxiaomi\.com$/i.test(url.hostname)) {
    throw fail(`不是 dianxiaomi.com 链接：${url.hostname}`);
  }
  const id = url.searchParams.get('id') || url.searchParams.get('productId') || '';
  if (!id) throw fail('编辑链接里没有商品 ID 参数。');
  return { id, editUrl: url.toString(), origin: url.origin };
}

async function readJson(file) {
  const text = await fs.readFile(file, 'utf8');
  return parseJsonPreserveIntegers(text, `JSON 文件 ${file}`);
}

async function writeText(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}

async function writeJson(file, value) {
  return writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

function defaultRunDir(productId, suffix = '') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(process.cwd(), 'data', 'dxm-api', `${productId}-${stamp}${suffix}`);
}

function getPath(object, dotPath) {
  const parts = String(dotPath).split('.').filter(Boolean);
  let cursor = object;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function setPath(object, dotPath, value) {
  const parts = String(dotPath).split('.').filter(Boolean);
  if (!parts.length) throw fail('补丁路径不能为空。');
  let cursor = object;
  for (const part of parts.slice(0, -1)) {
    if (cursor[part] == null || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
}

function hasAnyOwn(object, keys) {
  if (!object || typeof object !== 'object') return '';
  return keys.find(key => Object.prototype.hasOwnProperty.call(object, key)) || '';
}

function unwrapReadPayload(payload) {
  if (payload?.data && typeof payload.data === 'object' && payload.data.rawResponse) {
    return payload.data.rawResponse;
  }
  if (payload?.rawResponse) return payload.rawResponse;
  if (payload?.data && payload?.status && payload?.url) return payload.data;
  return payload;
}

function extractProductObject(payload, productPath = '') {
  const raw = unwrapReadPayload(payload);
  if (productPath) {
    const found = getPath(raw, productPath);
    if (!found || typeof found !== 'object') throw fail(`--product-path 没有指向对象：${productPath}`);
    return { product: found, productPath, rawResponse: raw };
  }

  const candidates = [
    ['data.product', raw?.data?.product],
    ['data.productInfo', raw?.data?.productInfo],
    ['data.tiktokProduct', raw?.data?.tiktokProduct],
    ['data', raw?.data],
    ['result.product', raw?.result?.product],
    ['result', raw?.result],
    ['', raw]
  ];
  for (const [candidatePath, value] of candidates) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value);
      const hasProductShape = keys.some(key => /(title|name|sku|brand|category|weight|description|desc|price|stock|id)/i.test(key));
      if (hasProductShape) return { product: value, productPath: candidatePath, rawResponse: raw };
    }
  }
  throw fail('无法从 edit.json 返回里识别商品对象，请用 --product-path 指定。');
}

function cloneJson(value) {
  return parseJsonPreserveIntegers(JSON.stringify(value), 'clone JSON');
}

function flattenPaths(value, prefix = '', out = []) {
  if (isRawJsonValue(value)) {
    out.push({ path: prefix, type: 'rawJSON', value: rawJsonText(value) });
    return out;
  }
  if (value == null || typeof value !== 'object') {
    out.push({ path: prefix, type: value === null ? 'null' : typeof value, value });
    return out;
  }
  if (Array.isArray(value)) {
    out.push({ path: prefix, type: 'array', length: value.length });
    const limit = Math.min(value.length, 3);
    for (let index = 0; index < limit; index += 1) flattenPaths(value[index], `${prefix}.${index}`.replace(/^\./, ''), out);
    return out;
  }
  const entries = Object.entries(value);
  if (!entries.length) out.push({ path: prefix, type: 'object', keys: 0 });
  for (const [key, child] of entries) {
    const nextPath = `${prefix}.${key}`.replace(/^\./, '');
    if (child != null && typeof child === 'object') {
      out.push({ path: nextPath, type: Array.isArray(child) ? 'array' : 'object', ...(Array.isArray(child) ? { length: child.length } : { keys: Object.keys(child).length }) });
      if (!PROTECTED_RE.test(nextPath) && Object.keys(child).length <= 80) flattenPaths(child, nextPath, out);
    } else {
      out.push({ path: nextPath, type: child === null ? 'null' : typeof child, value: child });
    }
  }
  return out;
}

function summarizeValue(value) {
  if (isRawJsonValue(value)) return rawJsonText(value);
  if (value == null) return value;
  if (typeof value === 'string') return value.length > 180 ? `${value.slice(0, 177)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return `[Array(${value.length})]`;
  if (typeof value === 'object') return `{Object(${Object.keys(value).length})}`;
  return String(value);
}

function inspectProduct(product) {
  const paths = flattenPaths(product);
  const candidates = {};
  for (const [name, aliases] of COMMON_FIELD_ALIASES) {
    candidates[name] = paths
      .filter(item => aliases.some(alias => item.path.split('.').at(-1)?.toLowerCase() === alias.toLowerCase()))
      .slice(0, 20)
      .map(item => ({ path: item.path, type: item.type, value: summarizeValue(item.value) }));
  }
  const allowedPaths = paths
    .filter(item => isAllowedPatchPath(item.path))
    .slice(0, 300)
    .map(item => ({ path: item.path, type: item.type, value: summarizeValue(item.value) }));
  const protectedPaths = paths
    .filter(item => PROTECTED_RE.test(item.path) && !SAFE_DIMENSION_RE.test(item.path))
    .slice(0, 120)
    .map(item => ({ path: item.path, type: item.type, value: summarizeValue(item.value) }));
  return { candidates, allowedPaths, protectedPaths };
}

function isAllowedPatchPath(dotPath) {
  const normalized = String(dotPath || '').trim();
  if (!normalized) return false;
  if (PROTECTED_RE.test(normalized) && !SAFE_DIMENSION_RE.test(normalized)) return false;
  if (ALLOWED_EXACT_PATHS.has(normalized)) return true;
  return ALLOWED_RE.test(normalized);
}

function resolveAliasPath(product, name) {
  const aliases = COMMON_FIELD_ALIASES.get(name);
  if (!aliases) return name;
  const direct = hasAnyOwn(product, aliases);
  if (direct) return direct;
  const paths = flattenPaths(product)
    .filter(item => aliases.some(alias => item.path.split('.').at(-1)?.toLowerCase() === alias.toLowerCase()))
    .filter(item => isAllowedPatchPath(item.path));
  if (paths.length === 1) return paths[0].path;
  return aliases[0];
}

function normalizePatch(patch) {
  if (!patch || typeof patch !== 'object') throw fail('补丁文件必须是 JSON 对象。');
  const set = patch.set && typeof patch.set === 'object' ? patch.set : patch;
  const entries = Object.entries(set).filter(([key]) => key !== 'note' && key !== 'notes' && key !== 'metadata');
  if (!entries.length) throw fail('补丁里没有 set 字段。');
  return entries;
}

function validatePatchPath(pathName) {
  if (!isAllowedPatchPath(pathName)) {
    throw fail(`补丁路径不在允许范围内：${pathName}`, {
      allowed: '分类、品牌、属性、标题、描述、重量尺寸、产地/材质/保修等字段',
      protected: 'SKU、价格、库存、仓库、运费模板、税务、结算等字段'
    });
  }
}

function applyPatch(product, patch) {
  const next = cloneJson(product);
  const changes = [];
  for (const [name, value] of normalizePatch(patch)) {
    const targetPath = name.includes('.') ? name : resolveAliasPath(next, name);
    validatePatchPath(targetPath);
    const before = getPath(next, targetPath);
    setPath(next, targetPath, value);
    const after = getPath(next, targetPath);
    changes.push({ path: targetPath, before: summarizeValue(before), after: summarizeValue(after) });
  }
  return { product: next, changes };
}

function diffValues(before, after, prefix = '', out = []) {
  if (JSON.stringify(before) === JSON.stringify(after)) return out;
  if (before == null || after == null || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) || Array.isArray(after)) {
    out.push({ path: prefix, before: summarizeValue(before), after: summarizeValue(after) });
    return out;
  }
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  for (const key of keys) diffValues(before[key], after[key], `${prefix}.${key}`.replace(/^\./, ''), out);
  return out;
}

function appleScriptString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    ...options
  });
  if (result.error) throw fail(`${command} 执行失败：${result.error.message}`);
  if (result.status !== 0) {
    throw fail(`${command} 执行失败。`, {
      status: result.status,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim()
    });
  }
  return result.stdout || '';
}

function copyChromeApiPage(apiUrl, { waitSeconds = 5 } = {}) {
  const script = `tell application "Google Chrome"
  activate
  if (count of windows) = 0 then make new window
  tell front window
    set newTab to make new tab at end of tabs with properties {URL:"${appleScriptString(apiUrl)}"}
    set active tab index to (count of tabs)
  end tell
end tell
delay ${Number(waitSeconds) || 5}
tell application "System Events"
  keystroke "a" using command down
  delay 0.2
  keystroke "c" using command down
end tell`;
  runCommand('osascript', ['-e', script]);
  const copied = runCommand('pbpaste', []);
  if (!copied.trim()) throw fail('Chrome API 页面复制结果为空。');
  return copied;
}

async function persistBrowserCopiedRead({ text, editUrl, productId, outDir, productPath = '' }) {
  const { jsonText, payload } = parseBrowserCopiedJson(text);
  if (payload && typeof payload === 'object' && payload.code != null && ![0, 200].includes(Number(payload.code))) {
    throw fail(`店小秘接口业务失败：${payload.msg || payload.message || payload.code}`, { payload });
  }
  await fs.mkdir(outDir, { recursive: true });
  await writeText(path.join(outDir, 'read-response.browser-copy.txt'), text);
  await writeText(path.join(outDir, 'read-response.json'), `${jsonText}\n`);
  const persisted = await persistReadPayload({
    payload,
    editUrl,
    productId,
    outDir,
    productPath
  });
  return { ...persisted, jsonText };
}

function buildMarkdownReport({ editUrl, productId, productPath, changes, blocked = [] }) {
  const lines = [
    '# 店小秘接口化编辑差异报告',
    '',
    `- 编辑链接：${editUrl}`,
    `- 商品 ID：${productId}`,
    `- 商品对象路径：${productPath || '(root)'}`,
    `- 保存动作：未执行，仅生成 tiktokSave.txt`,
    '',
    '## 本次允许字段改动',
    ''
  ];
  if (!changes.length) {
    lines.push('- 无字段改动');
  } else {
    for (const change of changes) {
      lines.push(`- \`${change.path}\``);
      lines.push(`  - 原值：${JSON.stringify(change.before)}`);
      lines.push(`  - 新值：${JSON.stringify(change.after)}`);
    }
  }
  if (blocked.length) {
    lines.push('', '## 已阻止字段', '');
    for (const item of blocked) lines.push(`- \`${item}\``);
  }
  lines.push('', '## 下一步', '', '确认差异无误后，再执行店小秘 add.json 文件上传保存；保存动作固定使用 op=1 草稿。');
  return `${lines.join('\n')}\n`;
}

function buildReadSnippet({ editUrl, productId }) {
  return `(async () => {
  const editUrl = ${JSON.stringify(editUrl)};
  const productId = ${JSON.stringify(productId)};
  if (!/dianxiaomi\\.com$/i.test(location.hostname)) {
    throw new Error('请先打开任意 dianxiaomi.com 页面，再执行读取片段。');
  }
  const endpoint = '/api/tiktokProduct/edit.json?id=' + encodeURIComponent(productId);
  const response = await fetch(endpoint, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (error) {
    data = { parseError: error.message, textPreview: text.slice(0, 2000) };
  }
  const payload = {
    ok: response.ok,
    status: response.status,
    url: response.url,
    contentType,
    editUrl,
    productId,
    data
  };
  const output = JSON.stringify(payload, null, 2);
  console.log(output);
  try {
    await navigator.clipboard.writeText(output);
    console.log('已复制读取结果 JSON 到剪贴板。');
  } catch {
    console.log('剪贴板写入失败，请手动复制上面的 JSON。');
  }
})();\n`;
}

function buildSaveSnippet({ editUrl, productId, product, fileField = 'tiktokSave' }) {
  const productJson = JSON.stringify(product);
  return `(async () => {
  const editUrl = ${JSON.stringify(editUrl)};
  const productId = ${JSON.stringify(productId)};
  const op = '1';
  const fileField = ${JSON.stringify(fileField)};
  if (!/dianxiaomi\\.com$/i.test(location.hostname)) {
    throw new Error('请先打开任意 dianxiaomi.com 页面，再执行保存片段。');
  }
  const productObject = ${productJson};
  const formData = new FormData();
  formData.append('op', op);
  formData.append('id', productId);
  formData.append(fileField, new File([JSON.stringify(productObject)], 'tiktokSave.txt', { type: 'text/plain' }));
  const response = await fetch('/api/tiktokProduct/add.json', {
    method: 'POST',
    credentials: 'include',
    body: formData,
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (error) {
    data = { parseError: error.message, textPreview: text.slice(0, 2000) };
  }
  const payload = {
    ok: response.ok,
    status: response.status,
    url: response.url,
    contentType,
    editUrl,
    productId,
    op,
    data
  };
  const output = JSON.stringify(payload, null, 2);
  console.log(output);
  try {
    await navigator.clipboard.writeText(output);
    console.log('已复制保存结果 JSON 到剪贴板。确认成功后再回写数据库。');
  } catch {
    console.log('剪贴板写入失败，请手动复制上面的 JSON。');
  }
})();\n`;
}

async function commandReadSnippet(flags) {
  const { id, editUrl } = parseEditUrl(flag(flags, ['edit-url', 'editUrl']));
  const snippet = buildReadSnippet({ editUrl, productId: id });
  const out = flag(flags, 'out');
  if (out) {
    await writeText(path.resolve(process.cwd(), out), snippet);
    console.log(JSON.stringify({ ok: true, productId: id, outputPath: path.resolve(process.cwd(), out) }, null, 2));
    return;
  }
  process.stdout.write(snippet);
}

async function commandReadChromePage(flags) {
  const { id, editUrl, origin } = parseEditUrl(flag(flags, ['edit-url', 'editUrl']));
  const endpoint = new URL(`/api/tiktokProduct/edit.json?id=${encodeURIComponent(id)}`, origin).toString();
  const copied = copyChromeApiPage(endpoint, {
    waitSeconds: Number(flag(flags, ['wait-seconds', 'waitSeconds'], '5'))
  });
  const outDir = path.resolve(process.cwd(), flag(flags, ['out-dir', 'outDir'], defaultRunDir(id)));
  const persisted = await persistBrowserCopiedRead({
    text: copied,
    editUrl,
    productId: id,
    outDir,
    productPath: flag(flags, ['product-path', 'productPath'])
  });
  console.log(JSON.stringify({
    ok: true,
    productId: id,
    editUrl,
    productPath: persisted.productPath,
    outDir,
    originalProduct: path.join(outDir, 'original-product.json'),
    inspect: path.join(outDir, 'inspect.json'),
    note: '已通过 Chrome 打开店小秘 edit.json 并复制页面 JSON；未保存。'
  }, null, 2));
}

async function commandReadApi(flags) {
  const { id, editUrl, origin } = parseEditUrl(flag(flags, ['edit-url', 'editUrl']));
  const curlFile = flag(flags, ['curl-file', 'curlFile']);
  if (!curlFile) throw fail('缺少 --curl-file。');
  const session = await readCurlSession(curlFile);
  const endpoint = new URL(`/api/tiktokProduct/edit.json?id=${encodeURIComponent(id)}`, origin).toString();
  const payload = await fetchDxmJson(endpoint, {
    method: 'GET',
    headers: buildApiHeaders(session, { editUrl, method: 'GET' })
  });
  const outDir = path.resolve(process.cwd(), flag(flags, ['out-dir', 'outDir'], defaultRunDir(id)));
  const persisted = await persistReadPayload({
    payload: { ...payload, editUrl, productId: id },
    editUrl,
    productId: id,
    outDir,
    productPath: flag(flags, ['product-path', 'productPath'])
  });
  console.log(JSON.stringify({
    ok: true,
    productId: id,
    editUrl,
    status: payload.status,
    contentType: payload.contentType,
    productPath: persisted.productPath,
    outDir,
    originalProduct: path.join(outDir, 'original-product.json'),
    inspect: path.join(outDir, 'inspect.json')
  }, null, 2));
}

async function commandImportBrowserCopy(flags) {
  const input = flag(flags, 'input');
  if (!input) throw fail('缺少 --input。');
  const { id, editUrl } = parseEditUrl(flag(flags, ['edit-url', 'editUrl']));
  const text = await fs.readFile(path.resolve(process.cwd(), input), 'utf8');
  const outDir = path.resolve(process.cwd(), flag(flags, ['out-dir', 'outDir'], defaultRunDir(id)));
  const persisted = await persistBrowserCopiedRead({
    text,
    editUrl,
    productId: id,
    outDir,
    productPath: flag(flags, ['product-path', 'productPath'])
  });
  console.log(JSON.stringify({
    ok: true,
    productId: id,
    editUrl,
    productPath: persisted.productPath,
    outDir,
    originalProduct: path.join(outDir, 'original-product.json'),
    inspect: path.join(outDir, 'inspect.json')
  }, null, 2));
}

async function commandImportRead(flags) {
  const input = flag(flags, 'input');
  if (!input) throw fail('缺少 --input。');
  const { id, editUrl } = parseEditUrl(flag(flags, ['edit-url', 'editUrl']));
  const payload = await readJson(path.resolve(process.cwd(), input));
  const outDir = path.resolve(process.cwd(), flag(flags, ['out-dir', 'outDir'], defaultRunDir(id)));
  const persisted = await persistReadPayload({
    payload,
    editUrl,
    productId: id,
    outDir,
    productPath: flag(flags, ['product-path', 'productPath'])
  });
  console.log(JSON.stringify({ ok: true, productId: id, editUrl, productPath: persisted.productPath, outDir }, null, 2));
}

async function commandInspect(flags) {
  const input = flag(flags, 'input');
  if (!input) throw fail('缺少 --input。');
  const payload = await readJson(path.resolve(process.cwd(), input));
  const { product, productPath } = extractProductObject(payload, flag(flags, ['product-path', 'productPath']));
  const inspect = { productPath, ...inspectProduct(product) };
  const out = flag(flags, 'out');
  if (out) {
    await writeJson(path.resolve(process.cwd(), out), inspect);
    console.log(JSON.stringify({ ok: true, outputPath: path.resolve(process.cwd(), out) }, null, 2));
    return;
  }
  process.stdout.write(`${JSON.stringify(inspect, null, 2)}\n`);
}

async function commandDiff(flags) {
  const input = flag(flags, 'input');
  const patchFile = flag(flags, 'patch');
  if (!input) throw fail('缺少 --input。');
  if (!patchFile) throw fail('缺少 --patch。');
  const { id, editUrl } = parseEditUrl(flag(flags, ['edit-url', 'editUrl']));
  const sourcePayload = await readJson(path.resolve(process.cwd(), input));
  const patch = await readJson(path.resolve(process.cwd(), patchFile));
  const { product, productPath } = extractProductObject(sourcePayload, flag(flags, ['product-path', 'productPath']));
  const patched = applyPatch(product, patch);
  const allChanges = diffValues(product, patched.product);
  const protectedChanges = allChanges.filter(change => PROTECTED_RE.test(change.path) && !SAFE_DIMENSION_RE.test(change.path));
  if (protectedChanges.length) {
    throw fail('补丁会改到受保护字段，已停止。', { protectedChanges });
  }
  const outDir = path.resolve(process.cwd(), flag(flags, ['out-dir', 'outDir'], defaultRunDir(id, '-patched')));
  await fs.mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, 'patched-product.json'), patched.product);
  await writeText(path.join(outDir, 'tiktokSave.txt'), JSON.stringify(patched.product));
  await writeText(path.join(outDir, 'diff-report.md'), buildMarkdownReport({
    editUrl,
    productId: id,
    productPath,
    changes: allChanges
  }));
  await writeJson(path.join(outDir, 'manifest.json'), {
    ok: true,
    productId: id,
    editUrl,
    productPath,
    changeCount: allChanges.length,
    files: {
      patchedProduct: path.join(outDir, 'patched-product.json'),
      tiktokSave: path.join(outDir, 'tiktokSave.txt'),
      diffReport: path.join(outDir, 'diff-report.md')
    },
    generatedAt: new Date().toISOString()
  });
  console.log(JSON.stringify({
    ok: true,
    productId: id,
    editUrl,
    productPath,
    changeCount: allChanges.length,
    outDir,
    diffReport: path.join(outDir, 'diff-report.md'),
    tiktokSave: path.join(outDir, 'tiktokSave.txt')
  }, null, 2));
}

async function commandSaveSnippet(flags) {
  const input = flag(flags, 'input');
  if (!input) throw fail('缺少 --input。');
  if (flag(flags, ['confirm-save-draft', 'confirmSaveDraft']) !== 'YES') {
    throw fail('生成保存草稿片段需要显式确认：--confirm-save-draft YES。');
  }
  const { id, editUrl } = parseEditUrl(flag(flags, ['edit-url', 'editUrl']));
  const text = await fs.readFile(path.resolve(process.cwd(), input), 'utf8');
  let product;
  try {
    product = JSON.parse(text);
  } catch {
    throw fail('保存输入必须是完整商品对象 JSON 或 tiktokSave.txt。');
  }
  const snippet = buildSaveSnippet({
    editUrl,
    productId: id,
    product,
    fileField: flag(flags, ['file-field', 'fileField'], 'tiktokSave')
  });
  const out = path.resolve(process.cwd(), flag(flags, 'out', path.join(path.dirname(path.resolve(process.cwd(), input)), 'save-draft-snippet.js')));
  await writeText(out, snippet);
  console.log(JSON.stringify({
    ok: true,
    productId: id,
    editUrl,
    op: 1,
    outputPath: out,
    note: '仅生成保存草稿片段，尚未提交。'
  }, null, 2));
}

async function commandSaveApi(flags) {
  const input = flag(flags, 'input');
  if (!input) throw fail('缺少 --input。');
  if (flag(flags, ['confirm-save-draft', 'confirmSaveDraft']) !== 'YES') {
    throw fail('保存草稿需要显式确认：--confirm-save-draft YES。');
  }
  const curlFile = flag(flags, ['curl-file', 'curlFile']);
  if (!curlFile) throw fail('缺少 --curl-file。');
  const { id, editUrl, origin } = parseEditUrl(flag(flags, ['edit-url', 'editUrl']));
  const session = await readCurlSession(curlFile);
  const text = await fs.readFile(path.resolve(process.cwd(), input), 'utf8');
  let product;
  try {
    product = JSON.parse(text);
  } catch {
    throw fail('保存输入必须是完整商品对象 JSON 或 tiktokSave.txt。');
  }
  const formData = new FormData();
  formData.append('op', '1');
  formData.append('id', id);
  formData.append(flag(flags, ['file-field', 'fileField'], 'tiktokSave'), new Blob([JSON.stringify(product)], { type: 'text/plain' }), 'tiktokSave.txt');
  const endpoint = new URL('/api/tiktokProduct/add.json', origin).toString();
  const payload = await fetchDxmJson(endpoint, {
    method: 'POST',
    headers: buildApiHeaders(session, { editUrl, method: 'POST', multipart: true }),
    body: formData
  });
  const out = path.resolve(process.cwd(), flag(flags, 'out', path.join(path.dirname(path.resolve(process.cwd(), input)), 'save-response.json')));
  await writeJson(out, {
    ...payload,
    editUrl,
    productId: id,
    op: 1,
    savedAt: new Date().toISOString()
  });
  console.log(JSON.stringify({
    ok: true,
    productId: id,
    editUrl,
    op: 1,
    status: payload.status,
    outputPath: out
  }, null, 2));
}

async function commandBackwrite(flags) {
  if (flag(flags, ['confirm-saved', 'confirmSaved']) !== 'YES') {
    throw fail('回写数据库前必须确认店小秘保存成功：--confirm-saved YES。');
  }
  const account = flag(flags, 'account');
  const productUrl = flag(flags, ['product-url', 'productUrl']);
  const productId = flag(flags, ['product-id', 'productId']);
  const productKey = flag(flags, ['product-key', 'productKey']);
  const productName = flag(flags, ['product-name', 'productName', 'title']);
  const editedTitle = flag(flags, ['edited-title', 'editedTitle']);
  if (!account || !editedTitle) throw fail('回写缺少 --account 或 --edited-title。');
  const selectionScript = path.resolve(__dirname, '..', '..', 'tk-product-selection', 'scripts', 'firestore-sync.mjs');
  const args = [selectionScript, 'mark-dxm-edited', '--account', account, '--edited-title', editedTitle];
  if (productUrl) args.push('--product-url', productUrl);
  if (productId) args.push('--product-id', productId);
  if (productKey) args.push('--product-key', productKey);
  if (productName) args.push('--product-name', productName);
  const result = spawnSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..', '..', '..'),
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw fail('数据库回写失败。', { stderr: result.stderr.trim(), stdout: result.stdout.trim() });
  }
  process.stdout.write(result.stdout);
}

async function main(argv) {
  const { positional, flags } = parseArgs(argv);
  const command = positional[0] || 'help';
  if (command === 'help' || flags.help) {
    process.stdout.write(HELP);
    return;
  }
  if (command === 'read-chrome-page') return commandReadChromePage(flags);
  if (command === 'import-browser-copy') return commandImportBrowserCopy(flags);
  if (command === 'read-api') return commandReadApi(flags);
  if (command === 'read-snippet') return commandReadSnippet(flags);
  if (command === 'import-read') return commandImportRead(flags);
  if (command === 'inspect') return commandInspect(flags);
  if (command === 'diff') return commandDiff(flags);
  if (command === 'save-api') return commandSaveApi(flags);
  if (command === 'save-snippet') return commandSaveSnippet(flags);
  if (command === 'backwrite') return commandBackwrite(flags);
  throw fail(`未知命令：${command}\n\n${HELP}`);
}

main(process.argv.slice(2)).catch(error => {
  const output = {
    ok: false,
    error: error.message,
    ...(error.details ? { details: error.details } : {})
  };
  process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = 1;
});
