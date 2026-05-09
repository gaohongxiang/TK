import { ORDER_TRACKER_FIRESTORE_RULES } from './orders/firestore-rules.ts';
import type { FirebaseConfig } from './types/firestore.ts';

const LS_KEY = 'tk.firestore.cfg.v1';
type LooseRecord = Record<string, unknown>;
type StoredFirestoreConfig = {
  configText: string;
  projectId: string;
  user: string;
};
type FirestoreConfigChangedDetail = Partial<StoredFirestoreConfig> & {
  connected?: boolean;
};
type FirestoreUiController = {
  showToast?: (message: string, type?: string) => void;
  open?: () => void;
  close?: () => void;
  closeRulesNotice?: () => void;
  notifyRulesUpdateNeeded?: (message?: string) => void;
  closeDisconnectConfirm?: () => void;
  requestDisconnect?: (options?: DisconnectOptions) => boolean;
};
type DisconnectOptions = {
  closeModal?: boolean;
};

function getWindowRef() {
  if (typeof window !== 'undefined') return window;
  return globalThis.window || globalThis;
}

function getDocumentRef() {
  const windowRef = getWindowRef();
  if (windowRef?.document) return windowRef.document;
  if (typeof document !== 'undefined') return document;
  return globalThis.document || null;
}

function getStorageRef() {
  const windowRef = getWindowRef();
  if (windowRef?.localStorage) return windowRef.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return globalThis.localStorage || null;
}

function createConfigChangedEvent(detail: FirestoreConfigChangedDetail): Event {
  const windowRef = getWindowRef();
  const EventCtor = windowRef?.CustomEvent || globalThis.CustomEvent;
  if (typeof EventCtor === 'function') {
    return new EventCtor('tk-firestore-config-changed', { detail });
  }
  return new Event('tk-firestore-config-changed');
}

function dispatchConfigChanged(detail: FirestoreConfigChangedDetail) {
  getWindowRef()?.dispatchEvent?.(createConfigChangedEvent(detail));
}

let uiController: FirestoreUiController | null = null;

function registerUI(controller: FirestoreUiController | null) {
  uiController = controller && typeof controller === 'object' ? controller : null;
  return uiController;
}

function toPlainObject(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as LooseRecord;
}

function runLooseObjectParser(text: string): unknown {
  try {
    return Function(`"use strict"; return (${text});`)();
  } catch (error) {
    return null;
  }
}

function sanitizeConfig(raw: unknown): FirebaseConfig | null {
  const cfg = toPlainObject(raw);
  if (!cfg) return null;
  const next: Partial<FirebaseConfig> = {};
  ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId', 'measurementId'].forEach(key => {
    const value = String(cfg[key] || '').trim();
    if (value) next[key as keyof FirebaseConfig] = value;
  });
  if (!next.apiKey || !next.projectId || !next.appId) return null;
  if (!next.authDomain) next.authDomain = `${next.projectId}.firebaseapp.com`;
  return next as FirebaseConfig;
}

function parseConfigInput(raw: unknown): FirebaseConfig | null {
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
  } catch (error) {}
  return sanitizeConfig(runLooseObjectParser(body));
}

function normalizeConfigText(raw: unknown): string {
  const parsed = parseConfigInput(raw);
  return parsed ? JSON.stringify(parsed, null, 2) : '';
}

function loadRaw(key: string): LooseRecord | null {
  try {
    return toPlainObject(JSON.parse(getStorageRef()?.getItem?.(key) || 'null'));
  } catch (error) {
    return null;
  }
}

function getConfig(): StoredFirestoreConfig | null {
  const saved = loadRaw(LS_KEY);
  if (!saved?.configText) return null;
  const configText = normalizeConfigText(saved.configText);
  if (!configText) return null;
  const parsed = parseConfigInput(configText);
  return {
    configText,
    projectId: String(saved.projectId || parsed?.projectId || ''),
    user: String(saved.user || '')
  };
}

function saveConfig(raw: unknown): StoredFirestoreConfig {
  const parsed = parseConfigInput(raw);
  if (!parsed?.projectId) throw new Error('请粘贴完整的 firebaseConfig');
  const next = {
    configText: JSON.stringify(parsed, null, 2),
    projectId: parsed.projectId,
    user: ''
  };
  getStorageRef()?.setItem?.(LS_KEY, JSON.stringify(next));
  return next;
}

function clearConfig() {
  getStorageRef()?.removeItem?.(LS_KEY);
  dispatchConfigChanged({ connected: false, configText: '', projectId: '' });
}

function getRulesSource() {
  const embedded = String(ORDER_TRACKER_FIRESTORE_RULES || '').trim();
  if (embedded) return embedded;
  const rulesUrl = 'docs/firebase/order-tracker-firestore.rules';
  throw new Error(rulesUrl
    ? `页面内置 Firestore 规则未加载，请刷新页面后重试；如仍失败，可手动打开 ${rulesUrl}`
    : '页面内置 Firestore 规则未加载，请刷新页面后重试');
}

function copyText(text: string): Promise<unknown> {
  if (!text) return Promise.reject(new Error('没有可复制的内容'));

  function legacyCopy() {
    return new Promise<void>((resolve, reject) => {
      const documentRef = getDocumentRef();
      if (!documentRef?.createElement || !documentRef?.body || !documentRef?.execCommand) {
        reject(new Error('浏览器未允许复制'));
        return;
      }
      const input = documentRef.createElement('textarea');
      input.value = text;
      input.setAttribute('readonly', 'readonly');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      documentRef.body.appendChild(input);
      input.focus();
      input.select();
      try {
        const ok = documentRef.execCommand('copy');
        documentRef.body.removeChild(input);
        if (!ok) throw new Error('浏览器未允许复制');
        resolve();
      } catch (error) {
        documentRef.body.removeChild(input);
        reject(error);
      }
    });
  }

  const navigatorRef = getWindowRef()?.navigator || globalThis.navigator;
  if (navigatorRef?.clipboard?.writeText) {
    return navigatorRef.clipboard.writeText(text).catch(() => legacyCopy());
  }
  return legacyCopy();
}

function showToast(message: string, type = 'ok') {
  uiController?.showToast?.(message, type);
}

function open() {
  uiController?.open?.();
}

function close() {
  uiController?.close?.();
}

function closeRulesNotice() {
  uiController?.closeRulesNotice?.();
}

function notifyRulesUpdateNeeded(message = '') {
  uiController?.notifyRulesUpdateNeeded?.(message);
}

function openConsole() {
  getWindowRef()?.open?.('https://console.firebase.google.com/', '_blank', 'noopener,noreferrer');
}

function copyRules() {
  return copyText(getRulesSource());
}

function closeDisconnectConfirm() {
  uiController?.closeDisconnectConfirm?.();
}

function requestDisconnect(options: DisconnectOptions = {}) {
  const cfg = getConfig();
  if (!cfg?.projectId) return false;
  const handled = uiController?.requestDisconnect?.(options);
  if (handled) return true;
  clearConfig();
  if (options.closeModal) close();
  return true;
}

function bind() {
  return uiController;
}

const TKFirestoreConnection = {
  parseConfigInput,
  normalizeConfigText,
  getConfig,
  saveConfig,
  clearConfig,
  dispatchConfigChanged,
  registerUI,
  open,
  openConsole,
  copyText,
  copyRules,
  showToast,
  notifyRulesUpdateNeeded,
  closeRulesNotice,
  closeDisconnectConfirm,
  requestDisconnect,
  bind
};

export {
  TKFirestoreConnection,
  parseConfigInput,
  normalizeConfigText,
  getConfig,
  saveConfig,
  clearConfig,
  dispatchConfigChanged,
  registerUI,
  open,
  openConsole,
  copyText,
  copyRules,
  showToast,
  notifyRulesUpdateNeeded,
  closeRulesNotice,
  closeDisconnectConfirm,
  requestDisconnect,
  bind
};
