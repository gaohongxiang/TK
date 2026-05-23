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
  id?: string;
  exists?: boolean;
  data: () => TData;
};

type FirebaseCompatQuerySnapshot<TData extends Record<string, unknown> = Record<string, unknown>> = {
  docs: Array<FirebaseCompatDocSnapshot<TData>>;
  metadata?: {
    hasPendingWrites?: boolean;
    fromCache?: boolean;
  };
};

type FirebaseCompatSnapshotOptions = {
  includeMetadataChanges?: boolean;
};

type FirebaseCompatSnapshotErrorHandler = (error: unknown) => void;

type FirebaseCompatDocRef = {
  get: (options?: unknown) => Promise<FirebaseCompatDocSnapshot>;
  set: (data: unknown, options?: unknown) => Promise<unknown>;
  delete: () => Promise<unknown>;
};

type FirebaseCompatCollectionRef = {
  orderBy: (field: string, direction?: string) => FirebaseCompatCollectionRef;
  limit?: (count: number) => FirebaseCompatCollectionRef;
  get: (options?: unknown) => Promise<FirebaseCompatQuerySnapshot>;
  doc: (id: string) => FirebaseCompatDocRef;
  onSnapshot?: (
    optionsOrObserver: FirebaseCompatSnapshotOptions | ((snapshot: FirebaseCompatQuerySnapshot) => void),
    observerOrError?: ((snapshot: FirebaseCompatQuerySnapshot) => void) | FirebaseCompatSnapshotErrorHandler,
    errorHandler?: FirebaseCompatSnapshotErrorHandler
  ) => () => void;
};

type FirebaseCompatWriteBatch = {
  set: (docRef: FirebaseCompatDocRef, data: unknown, options?: unknown) => void;
  delete: (docRef: FirebaseCompatDocRef) => void;
  commit: () => Promise<unknown>;
};

type FirebaseCompatFirestore = {
  settings?: (options: unknown) => void;
  enablePersistence?: (options?: unknown) => Promise<unknown>;
  collection: (name: string) => FirebaseCompatCollectionRef;
  batch: () => FirebaseCompatWriteBatch;
};

type FirebaseCompatUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
};

type FirebaseCompatAuth = {
  currentUser: FirebaseCompatUser | null;
  onAuthStateChanged: (callback: (user: FirebaseCompatUser | null) => void) => () => void;
  signInWithEmailAndPassword: (email: string, password: string) => Promise<unknown>;
  createUserWithEmailAndPassword: (email: string, password: string) => Promise<unknown>;
  sendPasswordResetEmail: (email: string) => Promise<unknown>;
  signOut: () => Promise<unknown>;
};

type FirebaseCompatApp = {
  name: string;
  firestore: () => FirebaseCompatFirestore;
  auth?: () => FirebaseCompatAuth;
  delete?: () => Promise<unknown>;
  __tkProductsFirestoreConfigured?: boolean;
  __tkOrdersFirestoreConfigured?: boolean;
  __tkFinanceFirestoreConfigured?: boolean;
  __tkCollectionFirestoreConfigured?: boolean;
  __tkAnalyticsFirestoreConfigured?: boolean;
  __tkRulesCheckFirestoreConfigured?: boolean;
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
  FirebaseCompatSnapshotErrorHandler,
  FirebaseCompatSnapshotOptions,
  FirebaseCompatAuth,
  FirebaseCompatUser,
  FirebaseCompatWriteBatch,
  FirebaseConfig,
  FirebaseWindow,
  HydratedFirebaseConfig
};
