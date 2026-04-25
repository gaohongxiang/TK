const TKFirestoreConnection = (function () {
  const LS_KEY = 'tk.firestore.cfg.v1';
  const LEGACY_ORDER_KEY = 'tk.orders.cfg.v1';

  const $ = selector => document.querySelector(selector);

  function toPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value;
  }

  function runLooseObjectParser(text) {
    try {
      return Function(`"use strict"; return (${text});`)();
    } catch (error) {
      return null;
    }
  }

  function sanitizeConfig(raw) {
    const cfg = toPlainObject(raw);
    if (!cfg) return null;
    const next = {};
    ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId', 'measurementId'].forEach(key => {
      const value = String(cfg[key] || '').trim();
      if (value) next[key] = value;
    });
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
    } catch (error) {}
    return sanitizeConfig(runLooseObjectParser(body));
  }

  function normalizeConfigText(raw) {
    const parsed = parseConfigInput(raw);
    return parsed ? JSON.stringify(parsed, null, 2) : '';
  }

  function loadRaw(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (error) {
      return null;
    }
  }

  function migrateLegacyConfig() {
    const legacy = loadRaw(LEGACY_ORDER_KEY);
    if (!legacy?.firestoreConfigText) return null;
    const configText = normalizeConfigText(legacy.firestoreConfigText);
    if (!configText) return null;
    const next = {
      configText,
      projectId: legacy.firestoreProjectId || parseConfigInput(configText)?.projectId || '',
      user: legacy.user || ''
    };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    return next;
  }

  function getConfig() {
    const saved = loadRaw(LS_KEY) || migrateLegacyConfig();
    if (!saved?.configText) return null;
    const configText = normalizeConfigText(saved.configText);
    if (!configText) return null;
    const parsed = parseConfigInput(configText);
    return {
      configText,
      projectId: saved.projectId || parsed?.projectId || '',
      user: saved.user || ''
    };
  }

  function saveConfig(raw) {
    const parsed = parseConfigInput(raw);
    if (!parsed?.projectId) throw new Error('请粘贴完整的 firebaseConfig');
    const next = {
      configText: JSON.stringify(parsed, null, 2),
      projectId: parsed.projectId,
      user: ''
    };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    return next;
  }

  function clearLegacyConfigs() {
    try {
      const legacy = loadRaw(LEGACY_ORDER_KEY);
      if (!legacy) return;
      delete legacy.mode;
      delete legacy.token;
      delete legacy.gistId;
      delete legacy.firestoreConfigText;
      delete legacy.firestoreProjectId;
      delete legacy.user;
      localStorage.setItem(LEGACY_ORDER_KEY, JSON.stringify(legacy));
    } catch (error) {}
  }

  function clearConfig() {
    localStorage.removeItem(LS_KEY);
    clearLegacyConfigs();
    updateStatus();
    window.dispatchEvent(new CustomEvent('tk-firestore-config-changed', {
      detail: { connected: false, configText: '', projectId: '' }
    }));
  }

  function getRulesSource() {
    const embedded = String(window.ORDER_TRACKER_FIRESTORE_RULES || '').trim();
    if (embedded) return embedded;
    const rulesUrl = $('#app-copy-firestore-rules')?.dataset.rulesUrl || '';
    throw new Error(rulesUrl
      ? `页面内置 Firestore 规则未加载，请刷新页面后重试；如仍失败，可手动打开 ${rulesUrl}`
      : '页面内置 Firestore 规则未加载，请刷新页面后重试');
  }

  function copyText(text) {
    if (!text) return Promise.reject(new Error('没有可复制的内容'));

    function legacyCopy() {
      return new Promise((resolve, reject) => {
        const input = document.createElement('textarea');
        input.value = text;
        input.setAttribute('readonly', 'readonly');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.focus();
        input.select();
        try {
          const ok = document.execCommand('copy');
          document.body.removeChild(input);
          if (!ok) throw new Error('浏览器未允许复制');
          resolve();
        } catch (error) {
          document.body.removeChild(input);
          reject(error);
        }
      });
    }

    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).catch(() => legacyCopy());
    }
    return legacyCopy();
  }

  function updateStatus() {
    const cfg = getConfig();
    const textarea = $('#app-firestore-config');
    if (textarea && document.activeElement !== textarea) {
      textarea.value = cfg?.configText || '';
    }
    const clearBtn = $('#app-clear-firestore-config');
    if (clearBtn) clearBtn.style.display = cfg?.projectId ? 'inline-flex' : 'none';
  }

  function open() {
    const modal = $('#app-firestore-modal');
    if (!modal) return;
    bind();
    updateStatus();
    modal.classList.add('show');
    $('#app-firestore-config')?.focus();
  }

  function close() {
    $('#app-firestore-modal')?.classList.remove('show');
  }

  function closeRulesNotice() {
    $('#app-firestore-rules-modal')?.classList.remove('show');
  }

  function notifyRulesUpdateNeeded(message = '') {
    bind();
    const modal = $('#app-firestore-rules-modal');
    const copy = $('#app-firestore-rules-copy');
    if (copy) {
      copy.textContent = String(message || '').trim() || '当前 Firebase 项目的 Firestore 规则较旧，请重新复制并发布最新规则。';
    }
    modal?.classList.add('show');
  }

  function openConsole() {
    window.open('https://console.firebase.google.com/', '_blank', 'noopener,noreferrer');
  }

  function copyRules() {
    return copyText(getRulesSource());
  }

  function bind() {
    const trigger = $('#app-firestore-connection');
    const modal = $('#app-firestore-modal');
    const rulesModal = $('#app-firestore-rules-modal');
    const closeBtn = $('#app-close-firestore-modal');
    const rulesCloseBtn = $('#app-close-firestore-rules-modal');
    const consoleBtn = $('#app-open-firebase-console');
    const rulesConsoleBtn = $('#app-rules-open-firebase-console');
    const copyBtn = $('#app-copy-firestore-rules');
    const rulesCopyBtn = $('#app-rules-copy-firestore-rules');
    const saveBtn = $('#app-save-firestore-config');
    const clearBtn = $('#app-clear-firestore-config');
    const textarea = $('#app-firestore-config');
    if (!modal || modal.dataset.bound === 'true') return;

    trigger?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    modal.addEventListener('click', event => {
      if (event.target.id === 'app-firestore-modal') close();
    });
    rulesModal?.addEventListener('click', event => {
      if (event.target.id === 'app-firestore-rules-modal') closeRulesNotice();
    });
    consoleBtn?.addEventListener('click', openConsole);
    rulesConsoleBtn?.addEventListener('click', openConsole);
    copyBtn?.addEventListener('click', async () => {
      const originalText = copyBtn.textContent;
      copyBtn.disabled = true;
      copyBtn.textContent = '复制中…';
      try {
        await copyRules();
      } finally {
        copyBtn.disabled = false;
        copyBtn.textContent = originalText;
      }
    });
    rulesCopyBtn?.addEventListener('click', async () => {
      const originalText = rulesCopyBtn.textContent;
      rulesCopyBtn.disabled = true;
      rulesCopyBtn.textContent = '复制中…';
      try {
        await copyRules();
      } finally {
        rulesCopyBtn.disabled = false;
        rulesCopyBtn.textContent = originalText;
      }
    });
    saveBtn?.addEventListener('click', () => {
      try {
        const next = saveConfig(textarea?.value || '');
        clearLegacyConfigs();
        updateStatus();
        close();
        window.dispatchEvent(new CustomEvent('tk-firestore-config-changed', {
          detail: { connected: true, ...next }
        }));
      } catch (error) {
        const toast = $('#toast');
        if (toast) {
          toast.textContent = error.message || '连接失败';
          toast.className = 'toast show error';
          clearTimeout(bind._toastTimer);
          bind._toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
        }
      }
    });
    clearBtn?.addEventListener('click', () => {
      clearConfig();
      close();
    });
    rulesCloseBtn?.addEventListener('click', closeRulesNotice);

    if (trigger) trigger.dataset.bound = 'true';
    modal.dataset.bound = 'true';
    updateStatus();
  }

  document.addEventListener('DOMContentLoaded', bind);

  return {
    parseConfigInput,
    normalizeConfigText,
    getConfig,
    clearConfig,
    open,
    openConsole,
    copyText,
    copyRules,
    notifyRulesUpdateNeeded,
    closeRulesNotice,
    bind,
    updateStatus
  };
})();

window.TKFirestoreConnection = TKFirestoreConnection;
