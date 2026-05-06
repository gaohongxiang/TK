import { TKAppConfig } from './app-config.mjs';
const FALLBACK_MODULES = Object.freeze([
  Object.freeze({ key: 'calc' }),
  Object.freeze({ key: 'orders' }),
  Object.freeze({ key: 'products' }),
  Object.freeze({ key: 'analytics' })
]);

function getModuleMap(config = TKAppConfig) {
  return Object.fromEntries(
    ((config && Array.isArray(config.modules)) ? config.modules : FALLBACK_MODULES)
      .map(module => [module.key, {}])
  );
}

function setDocLink(documentRef = globalThis.document, config = TKAppConfig) {
  const docLink = documentRef?.querySelector?.('.app-doc-link');
  if (docLink && config?.docsUrl) {
    docLink.href = config.docsUrl;
  }
}

function setCurrentYear(documentRef = globalThis.document, now = new Date()) {
  const year = documentRef?.getElementById?.('yr');
  if (year) year.textContent = String(now.getFullYear());
}

function switchView(key, options = {}) {
  const documentRef = options.document ?? globalThis.document;
  const windowRef = options.window ?? globalThis.window ?? globalThis;
  const moduleMap = options.moduleMap ?? getModuleMap(options.config ?? TKAppConfig);
  let resolvedKey = key;
  if (!moduleMap[resolvedKey]) resolvedKey = 'calc';

  documentRef?.querySelectorAll?.('.view')?.forEach(view => {
    view.classList.remove('active');
  });
  documentRef?.getElementById?.(`view-${resolvedKey}`)?.classList.add('active');
  if (resolvedKey === 'orders' && windowRef.OrderTracker?.onEnter) windowRef.OrderTracker.onEnter();
  if (resolvedKey === 'products' && windowRef.ProductLibrary?.onEnter) windowRef.ProductLibrary.onEnter();
  return resolvedKey;
}

function initMain(options = {}) {
  const documentRef = options.document ?? globalThis.document;
  const windowRef = options.window ?? globalThis.window ?? globalThis;
  const locationRef = options.location ?? windowRef.location ?? globalThis.location;
  const config = options.config ?? TKAppConfig;
  const moduleMap = getModuleMap(config);

  setCurrentYear(documentRef, options.now ?? new Date());
  setDocLink(documentRef, config);

  const route = () => {
    switchView((locationRef?.hash || '#calc').slice(1), {
      document: documentRef,
      window: windowRef,
      moduleMap,
      config
    });
  };

  documentRef?.addEventListener?.('DOMContentLoaded', () => {
    windowRef?.addEventListener?.('hashchange', route);
    route();
  });
}

export {
  TKAppConfig,
  getModuleMap,
  initMain,
  setCurrentYear,
  setDocLink,
  switchView
};
