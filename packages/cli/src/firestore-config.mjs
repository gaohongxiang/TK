import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONFIG_PATH = 'data/tk-cli/firestore-config.json';

function toPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function runLooseObjectParser(text) {
  try {
    return Function(`"use strict"; return (${text});`)();
  } catch {
    return null;
  }
}

function sanitizeConfig(raw) {
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

function parseConfigInput(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return sanitizeConfig(raw);
  const text = String(raw || '').trim();
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  const body = text.slice(start, end + 1);
  try {
    return sanitizeConfig(JSON.parse(body));
  } catch {}
  return sanitizeConfig(runLooseObjectParser(body));
}

function configPath(root = process.cwd()) {
  return path.resolve(root, DEFAULT_CONFIG_PATH);
}

async function readConfigFile(root = process.cwd()) {
  try {
    return JSON.parse(await fs.readFile(configPath(root), 'utf8'));
  } catch {
    return null;
  }
}

async function loadConfig({ root = process.cwd(), configText = '' } = {}) {
  const fromInput = parseConfigInput(configText);
  if (fromInput) return fromInput;
  const fromEnv = parseConfigInput(process.env.TK_FIRESTORE_CONFIG || '');
  if (fromEnv) return fromEnv;
  const fromFile = parseConfigInput(await readConfigFile(root));
  if (fromFile) return fromFile;
  return null;
}

async function saveConfig(rawConfig, { root = process.cwd() } = {}) {
  const config = parseConfigInput(rawConfig);
  if (!config) throw new Error('请提供完整的 firebaseConfig，至少需要 apiKey、projectId 和 appId。');
  const file = configPath(root);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(config, null, 2)}\n`);
  return { config, file };
}

export {
  configPath,
  loadConfig,
  parseConfigInput,
  saveConfig
};
