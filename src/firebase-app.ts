import { parseConfigInput } from './firestore-connection.ts';
import type {
  FirebaseCompatApp,
  FirebaseCompatAuth,
  FirebaseCompatFirestore,
  FirebaseCompatNamespace
} from './types/firestore.ts';

type FirebaseAppInitResult = {
  app: FirebaseCompatApp;
  auth: FirebaseCompatAuth | null;
  db: FirebaseCompatFirestore;
};

type FirebaseWindowRef = Partial<Window> & { firebase?: FirebaseCompatNamespace };

function getWindowRef(rootWindow: unknown = globalThis.window): FirebaseWindowRef {
  return (rootWindow || globalThis.window || globalThis) as FirebaseWindowRef;
}

function getFirebaseNamespace(rootWindow: unknown = globalThis.window): FirebaseCompatNamespace {
  const firebaseNs = getWindowRef(rootWindow).firebase || null;
  if (!firebaseNs?.initializeApp) throw new Error('Firebase SDK 尚未加载');
  return firebaseNs;
}

function getSharedFirebaseApp(rawConfig: unknown, rootWindow: unknown = globalThis.window): FirebaseCompatApp {
  const config = parseConfigInput(rawConfig);
  if (!config?.projectId) throw new Error('请先填写有效的 firebaseConfig');
  const firebaseNs = getFirebaseNamespace(rootWindow);
  const appName = `tk-shared-${config.projectId}`;
  return (firebaseNs.apps || []).find(item => item.name === appName) || firebaseNs.initializeApp(config, appName);
}

function configureFirestoreApp(app: FirebaseCompatApp, marker: keyof FirebaseCompatApp) {
  const db = app.firestore();
  if (app[marker]) return db;

  if (typeof db.settings === 'function') {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '');
      if (!/settings can no longer be changed|already been started/i.test(message)) throw error;
    }
  }

  if (typeof db.enablePersistence === 'function') {
    void db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  }

  (app as Record<string, unknown>)[marker] = true;
  return db;
}

function initSharedFirebaseApp(
  rawConfig: unknown,
  rootWindow: unknown = globalThis.window,
  marker: keyof FirebaseCompatApp = '__tkRulesCheckFirestoreConfigured'
): FirebaseAppInitResult {
  const app = getSharedFirebaseApp(rawConfig, rootWindow);
  const db = configureFirestoreApp(app, marker);
  return {
    app,
    auth: typeof app.auth === 'function' ? app.auth() : null,
    db
  };
}

export {
  configureFirestoreApp,
  getFirebaseNamespace,
  getSharedFirebaseApp,
  initSharedFirebaseApp
};
export type { FirebaseAppInitResult };
