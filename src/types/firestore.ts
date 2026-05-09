type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  [key: string]: string | undefined;
};

type HydratedFirebaseConfig = {
  config: FirebaseConfig | null;
  configText: string;
  projectId: string;
  user: string;
};

type FirebaseCompatDocSnapshot<TData extends Record<string, unknown> = Record<string, unknown>> = {
  exists?: boolean;
  data: () => TData;
};

type FirebaseCompatQuerySnapshot<TData extends Record<string, unknown> = Record<string, unknown>> = {
  docs: Array<FirebaseCompatDocSnapshot<TData>>;
};

type FirebaseCompatDocRef = {
  get: (options?: unknown) => Promise<FirebaseCompatDocSnapshot>;
  set: (data: unknown, options?: unknown) => Promise<unknown>;
  delete: () => Promise<unknown>;
};

type FirebaseCompatCollectionRef = {
  orderBy: (field: string, direction?: string) => FirebaseCompatCollectionRef;
  get: (options?: unknown) => Promise<FirebaseCompatQuerySnapshot>;
  doc: (id: string) => FirebaseCompatDocRef;
};

type FirebaseCompatWriteBatch = {
  set: (docRef: FirebaseCompatDocRef, data: unknown, options?: unknown) => void;
  commit: () => Promise<unknown>;
};

type FirebaseCompatFirestore = {
  settings?: (options: unknown) => void;
  enablePersistence?: (options?: unknown) => Promise<unknown>;
  collection: (name: string) => FirebaseCompatCollectionRef;
  batch: () => FirebaseCompatWriteBatch;
};

type FirebaseCompatApp = {
  name: string;
  firestore: () => FirebaseCompatFirestore;
  __tkProductsFirestoreConfigured?: boolean;
  __tkOrdersFirestoreConfigured?: boolean;
};

type FirebaseCompatNamespace = {
  apps: FirebaseCompatApp[];
  initializeApp: (config: FirebaseConfig, name?: string) => FirebaseCompatApp;
};

type FirebaseWindow = Partial<Window> & {
  firebase?: FirebaseCompatNamespace;
};

export type {
  FirebaseCompatApp,
  FirebaseCompatCollectionRef,
  FirebaseCompatDocRef,
  FirebaseCompatDocSnapshot,
  FirebaseCompatFirestore,
  FirebaseCompatNamespace,
  FirebaseCompatQuerySnapshot,
  FirebaseCompatWriteBatch,
  FirebaseConfig,
  FirebaseWindow,
  HydratedFirebaseConfig
};
