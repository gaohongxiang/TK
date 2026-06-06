#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_RELATIVE_PATH = ['private', 'tk-product-selection', 'credentials.json'];
const PROJECT_FIRESTORE_CONFIG = ['data', 'tk-cli', 'firestore-config.json'];

function nowIso() {
  return new Date().toISOString();
}

function codexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function credentialsPath() {
  return path.join(codexHome(), ...DEFAULT_RELATIVE_PATH);
}

function toPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function looseObject(text) {
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
  return sanitizeFirebaseConfig(looseObject(body));
}

function sanitizeFirebaseAuth(raw, previous = null) {
  const auth = toPlainObject(raw);
  if (!auth) return null;
  const email = String(auth.email || auth.username || '').trim();
  const password = auth.password === undefined ? '' : String(auth.password);
  if (!email || !password) return null;
  const next = {
    email,
    password,
    updatedAt: nowIso()
  };
  const previousAuth = toPlainObject(previous) || {};
  if (previousAuth.email === email && previousAuth.refreshToken) next.refreshToken = String(previousAuth.refreshToken);
  return next;
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

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function ensurePrivateFileDir(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (process.platform !== 'win32') {
    await fs.chmod(path.dirname(path.dirname(file)), 0o700).catch(() => {});
    await fs.chmod(path.dirname(file), 0o700).catch(() => {});
  }
}

async function readCredentials() {
  try {
    const parsed = JSON.parse(await fs.readFile(credentialsPath(), 'utf8'));
    return toPlainObject(parsed) || {};
  } catch {
    return {};
  }
}

async function writeCredentials(data) {
  const file = credentialsPath();
  await ensurePrivateFileDir(file);
  const next = {
    version: 1,
    updatedAt: nowIso(),
    ...data
  };
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`);
  if (process.platform !== 'win32') await fs.chmod(tmp, 0o600).catch(() => {});
  await fs.rename(tmp, file);
  if (process.platform !== 'win32') await fs.chmod(file, 0o600).catch(() => {});
  return file;
}

function redactStatus(data) {
  const dxm = toPlainObject(data.dianxiaomiByTkAccount) || {};
  const fastmossDefault = data.fastmoss?.default || {};
  const chuhaijiangDefault = data.chuhaijiang?.default || {};
  const firebaseAuth = toPlainObject(data.firebaseAuth) || {};
  return {
    hasFirebaseConfig: Boolean(parseFirebaseConfig(data.firebaseConfig)),
    hasFirebaseAuth: Boolean(firebaseAuth.email && firebaseAuth.password),
    firebaseAuthEmail: firebaseAuth.email || null,
    hasFastmossDefault: Boolean((fastmossDefault.phone || fastmossDefault.username) && fastmossDefault.password),
    fastmossStatus: fastmossDefault.status || null,
    hasChuhaijiangDefault: Boolean((chuhaijiangDefault.phone || chuhaijiangDefault.email || chuhaijiangDefault.username) && chuhaijiangDefault.password),
    chuhaijiangStatus: chuhaijiangDefault.status || null,
    dianxiaomiAccounts: Object.keys(dxm).sort(),
    updatedAt: data.updatedAt || null
  };
}

async function setFirebase(rawConfig) {
  const config = parseFirebaseConfig(rawConfig);
  if (!config) throw new Error('缺少完整数据库配置。');
  const data = await readCredentials();
  data.firebaseConfig = config;
  await writeCredentials(data);
  return { ok: true, saved: 'collectionSyncConfig' };
}

async function setFirebaseAuth(args) {
  const data = await readCredentials();
  const auth = sanitizeFirebaseAuth({
    email: args.email || args.username,
    password: args.password
  }, data.firebaseAuth);
  if (!auth) throw new Error('缺少 Firebase Auth 邮箱或密码。');
  data.firebaseAuth = auth;
  await writeCredentials(data);
  return { ok: true, saved: 'firebaseAuth', file: credentialsPath(), email: auth.email };
}

async function clearFirebaseAuth() {
  const data = await readCredentials();
  delete data.firebaseAuth;
  await writeCredentials(data);
  return { ok: true, cleared: 'firebaseAuth', file: credentialsPath() };
}

async function setFastmoss(args) {
  const phone = String(args.phone || args.username || '').trim();
  const password = String(args.password || '');
  if (!phone || !password) throw new Error('缺少 FastMoss 登录信息。');
  const data = await readCredentials();
  data.fastmoss = toPlainObject(data.fastmoss) || {};
  data.fastmoss.default = {
    loginMethod: 'phone',
    phone,
    password,
    label: String(args.label || 'default').trim() || 'default',
    status: 'active',
    updatedAt: nowIso()
  };
  await writeCredentials(data);
  return { ok: true, saved: 'fastmossDefault' };
}

async function setChuhaijiang(args) {
  const username = String(args.email || args.phone || args.username || '').trim();
  const password = String(args.password || '');
  if (!username || !password) throw new Error('缺少出海匠登录信息。');
  const data = await readCredentials();
  data.chuhaijiang = toPlainObject(data.chuhaijiang) || {};
  data.chuhaijiang.default = {
    loginMethod: args.email ? 'email' : 'account',
    username,
    password,
    label: String(args.label || 'default').trim() || 'default',
    status: 'active',
    updatedAt: nowIso()
  };
  await writeCredentials(data);
  return { ok: true, saved: 'chuhaijiangDefault', file: credentialsPath(), username };
}

async function markFastmossExpired(args) {
  const data = await readCredentials();
  data.fastmoss = toPlainObject(data.fastmoss) || {};
  data.fastmoss.default = toPlainObject(data.fastmoss.default) || {};
  data.fastmoss.default.status = 'expired';
  data.fastmoss.default.expiredAt = nowIso();
  data.fastmoss.default.lastFailureReason = String(args.reason || 'expired_or_login_failed').trim();
  await writeCredentials(data);
  return { ok: true, marked: 'fastmoss.default.expired', file: credentialsPath() };
}

async function markChuhaijiangExpired(args) {
  const data = await readCredentials();
  data.chuhaijiang = toPlainObject(data.chuhaijiang) || {};
  data.chuhaijiang.default = toPlainObject(data.chuhaijiang.default) || {};
  data.chuhaijiang.default.status = 'expired';
  data.chuhaijiang.default.expiredAt = nowIso();
  data.chuhaijiang.default.lastFailureReason = String(args.reason || 'expired_or_login_failed').trim();
  await writeCredentials(data);
  return { ok: true, marked: 'chuhaijiang.default.expired', file: credentialsPath() };
}

async function setDianxiaomi(args) {
  const account = String(args.account || '').trim();
  const username = String(args.username || '').trim();
  const password = String(args.password || '');
  const shopName = String(args['shop-name'] || args.shopName || account).trim();
  if (!account || !username || !password) throw new Error('缺少 TK account、店小秘 username 或 password。');
  const data = await readCredentials();
  data.dianxiaomiByTkAccount = toPlainObject(data.dianxiaomiByTkAccount) || {};
  data.dianxiaomiByTkAccount[account] = {
    username,
    password,
    shopName,
    updatedAt: nowIso()
  };
  await writeCredentials(data);
  return { ok: true, saved: `dianxiaomiByTkAccount.${account}`, file: credentialsPath() };
}

async function upsertJson(raw) {
  const input = toPlainObject(JSON.parse(raw));
  if (!input) throw new Error('stdin 必须是 JSON object。');
  const data = await readCredentials();
  if (input.firebaseConfig !== undefined) {
    const config = parseFirebaseConfig(input.firebaseConfig);
    if (!config) throw new Error('stdin.firebaseConfig 不完整。');
    data.firebaseConfig = config;
  }
  if (input.firebaseAuth !== undefined) {
    const auth = sanitizeFirebaseAuth(input.firebaseAuth, data.firebaseAuth);
    if (!auth) throw new Error('stdin.firebaseAuth 缺少 email/password。');
    data.firebaseAuth = auth;
  }
  if (input.fastmoss?.default) {
    const fm = input.fastmoss.default;
    const phone = String(fm.phone || fm.username || '').trim();
    if (!phone || !fm.password) throw new Error('stdin.fastmoss.default 缺少 phone/password。');
    data.fastmoss = toPlainObject(data.fastmoss) || {};
    data.fastmoss.default = {
      loginMethod: 'phone',
      phone,
      password: String(fm.password),
      label: String(fm.label || 'default').trim() || 'default',
      status: 'active',
      updatedAt: nowIso()
    };
  }
  if (input.chuhaijiang?.default) {
    const chj = input.chuhaijiang.default;
    const username = String(chj.email || chj.phone || chj.username || '').trim();
    if (!username || !chj.password) throw new Error('stdin.chuhaijiang.default 缺少 username/password。');
    data.chuhaijiang = toPlainObject(data.chuhaijiang) || {};
    data.chuhaijiang.default = {
      loginMethod: chj.email ? 'email' : 'account',
      username,
      password: String(chj.password),
      label: String(chj.label || 'default').trim() || 'default',
      status: 'active',
      updatedAt: nowIso()
    };
  }
  if (input.dianxiaomiByTkAccount) {
    data.dianxiaomiByTkAccount = toPlainObject(data.dianxiaomiByTkAccount) || {};
    for (const [account, value] of Object.entries(input.dianxiaomiByTkAccount)) {
      if (!value?.username || !value?.password) throw new Error(`stdin.dianxiaomiByTkAccount.${account} 缺少 username/password。`);
      data.dianxiaomiByTkAccount[account] = {
        username: String(value.username).trim(),
        password: String(value.password),
        shopName: String(value.shopName || account).trim(),
        updatedAt: nowIso()
      };
    }
  }
  await writeCredentials(data);
  return { ok: true, saved: 'upsert-json', status: redactStatus(await readCredentials()) };
}

async function syncFirebaseToProject(args) {
  const root = path.resolve(String(args.root || process.cwd()));
  const data = await readCredentials();
  const config = parseFirebaseConfig(data.firebaseConfig);
  if (!config) throw new Error('本地私密配置里没有 firebaseConfig。');
  const file = path.join(root, ...PROJECT_FIRESTORE_CONFIG);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(config, null, 2)}\n`);
  return { ok: true, synced: 'firebaseConfig', file };
}

async function importFirebaseFromProject(args) {
  const root = path.resolve(String(args.root || process.cwd()));
  const file = path.join(root, ...PROJECT_FIRESTORE_CONFIG);
  const config = parseFirebaseConfig(JSON.parse(await fs.readFile(file, 'utf8')));
  if (!config) throw new Error(`没有在 ${file} 读取到完整 firebaseConfig。`);
  return setFirebase(config);
}

function reveal(data, args) {
  const key = String(args.key || '').trim();
  if (key === 'firebase') return parseFirebaseConfig(data.firebaseConfig);
  if (key === 'fastmoss') return data.fastmoss?.default || null;
  if (key === 'chuhaijiang') return data.chuhaijiang?.default || null;
  if (key === 'dianxiaomi') {
    const account = String(args.account || '').trim();
    if (!account) throw new Error('reveal dianxiaomi 需要 --account <TK账号>。');
    return data.dianxiaomiByTkAccount?.[account] || null;
  }
  throw new Error('reveal 需要 --key firebase|fastmoss|chuhaijiang|dianxiaomi。');
}

async function main() {
  const [command = 'status', ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  let result;
  if (command === 'path') result = { file: credentialsPath() };
  else if (command === 'status') result = redactStatus(await readCredentials());
  else if (command === 'set-firebase') result = await setFirebase(args.config || await readStdin());
  else if (command === 'set-firebase-auth' || command === 'set-auth') result = await setFirebaseAuth(args);
  else if (command === 'clear-firebase-auth') result = await clearFirebaseAuth();
  else if (command === 'set-fastmoss') result = await setFastmoss(args);
  else if (command === 'set-chuhaijiang') result = await setChuhaijiang(args);
  else if (command === 'mark-fastmoss-expired') result = await markFastmossExpired(args);
  else if (command === 'mark-chuhaijiang-expired') result = await markChuhaijiangExpired(args);
  else if (command === 'set-dianxiaomi') result = await setDianxiaomi(args);
  else if (command === 'upsert-json') result = await upsertJson(await readStdin());
  else if (command === 'sync-firebase') result = await syncFirebaseToProject(args);
  else if (command === 'import-firebase') result = await importFirebaseFromProject(args);
  else if (command === 'reveal') result = reveal(await readCredentials(), args);
  else throw new Error(`未知命令：${command}`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
