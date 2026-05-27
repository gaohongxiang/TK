import { TKFirestoreConnection, parseConfigInput } from './firestore-connection.ts';
import { getFirebaseNamespace, initSharedFirebaseApp } from './firebase-app.ts';
import type {
  FirebaseCompatAuth,
  FirebaseCompatDocSnapshot,
  FirebaseCompatFirestore,
  FirebaseCompatUser
} from './types/firestore.ts';

type AuthRole = 'owner' | 'staff';

type ModulePermissionKey = 'products' | 'orders' | 'finance' | 'collection' | 'analytics';

type MemberProfile = {
  uid?: string;
  email: string;
  role: AuthRole;
  modules: ModulePermissionKey[];
  createdAt?: string;
  updatedAt?: string;
};

type AuthSessionState = {
  ready: boolean;
  connected: boolean;
  projectId: string;
  user: FirebaseCompatUser | null;
  member: MemberProfile | null;
  isOwner: boolean;
  error: string;
};

type AuthSessionListener = (state: AuthSessionState) => void;

type SignInMode = 'signin' | 'signup';

const AUTH_SESSION_CHANGED_EVENT = 'tk-auth-session-changed';
const ALL_PERMISSION_MODULES: ModulePermissionKey[] = ['products', 'orders', 'finance', 'collection', 'analytics'];
const OWNER_MODULES: ModulePermissionKey[] = [...ALL_PERMISSION_MODULES];
const DEFAULT_STAFF_MODULES: ModulePermissionKey[] = [];
const OWNER_EMAIL_KEY = 'tk.auth.owner-email.v1';
const MEMBER_CACHE_KEY = 'tk.auth.member.v1';
const PROJECT_CONFIG_DOC = 'project';
const OWNER_CONFIG_DOC = 'owner';

let auth: FirebaseCompatAuth | null = null;
let db: FirebaseCompatFirestore | null = null;
let unsubscribeAuth: (() => void) | null = null;
let activeProjectId = '';
let ownerBootstrapKey = '';
let ownerBootstrapPromise: Promise<MemberProfile | null> | null = null;
let currentState: AuthSessionState = {
  ready: false,
  connected: false,
  projectId: '',
  user: null,
  member: null,
  isOwner: false,
  error: ''
};
const listeners = new Set<AuthSessionListener>();

function getWindowRef() {
  if (typeof window !== 'undefined') return window;
  return globalThis.window || globalThis;
}

function getStorageRef() {
  const windowRef = getWindowRef();
  if (windowRef?.localStorage) return windowRef.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return globalThis.localStorage || null;
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function getErrorText(error: unknown) {
  if (error instanceof Error) return `${error.name || ''} ${error.message || ''}`.trim();
  if (error && typeof error === 'object') {
    const raw = error as { code?: unknown; message?: unknown };
    return `${String(raw.code || '')} ${String(raw.message || '')}`.trim();
  }
  return String(error || '');
}

function getAuthErrorMessage(error: unknown, fallback = '操作失败') {
  const message = getErrorText(error);
  if (/configuration-not-found|auth\/configuration-not-found/i.test(message)) {
    return 'Firebase Authentication 还没有启用。请在 Firebase Console 左侧打开“安全 > Authentication”，进入“登录方法”，启用“电子邮件地址/密码”。';
  }
  if (/operation-not-allowed|auth\/operation-not-allowed/i.test(message)) {
    return '请先在 Firebase Console 左侧打开“安全 > Authentication > 登录方法”，启用“电子邮件地址/密码”。';
  }
  if (/weak-password|auth\/weak-password/i.test(message)) return '密码至少需要 6 位。';
  if (/invalid-email|auth\/invalid-email/i.test(message)) return '请输入正确的邮箱。';
  if (/email-already-in-use|auth\/email-already-in-use/i.test(message)) return '这个邮箱已经创建过账号，请直接登录。';
  if (/requires-recent-login|auth\/requires-recent-login/i.test(message)) return '登录状态已过期，请退出后重新登录再修改密码。';
  if (/wrong-password|invalid-credential|user-not-found|auth\/wrong-password|auth\/invalid-credential|auth\/user-not-found/i.test(message)) {
    return '邮箱或密码不正确。';
  }
  if (/permission-denied|PERMISSION_DENIED|Missing or insufficient permissions/i.test(message)) {
    return 'Firestore 规则未允许写入管理员资料，请复制并发布最新 Firestore 规则后重试。';
  }
  return message || fallback;
}

function ownerStorageKey(projectId = activeProjectId) {
  return projectId ? `${OWNER_EMAIL_KEY}.${projectId}` : OWNER_EMAIL_KEY;
}

function readOwnerEmail(projectId = activeProjectId) {
  try {
    return normalizeEmail(getStorageRef()?.getItem?.(ownerStorageKey(projectId)) || '');
  } catch (error) {
    return '';
  }
}

function saveOwnerEmail(email: string, projectId = activeProjectId) {
  const normalized = normalizeEmail(email);
  if (!normalized || !projectId) return;
  try {
    getStorageRef()?.setItem?.(ownerStorageKey(projectId), normalized);
  } catch (error) {}
}

function memberCacheKey(email: string, projectId = activeProjectId) {
  const normalizedEmail = normalizeEmail(email);
  return projectId && normalizedEmail ? `${MEMBER_CACHE_KEY}.${projectId}.${normalizedEmail}` : '';
}

function readCachedMember(user: FirebaseCompatUser | null, projectId = activeProjectId) {
  const key = memberCacheKey(user?.email || '', projectId);
  if (!key) return null;
  try {
    const raw = getStorageRef()?.getItem?.(key);
    if (!raw) return null;
    return normalizeMember(user, JSON.parse(raw));
  } catch (error) {
    return null;
  }
}

function saveCachedMember(member: MemberProfile | null, projectId = activeProjectId) {
  const key = memberCacheKey(member?.email || '', projectId);
  if (!key) return;
  try {
    const storage = getStorageRef();
    if (!member) storage?.removeItem?.(key);
    else storage?.setItem?.(key, JSON.stringify(member));
  } catch (error) {}
}

function clearCachedMember(email: string, projectId = activeProjectId) {
  const key = memberCacheKey(email, projectId);
  if (!key) return;
  try {
    getStorageRef()?.removeItem?.(key);
  } catch (error) {}
}

async function markProjectInitialized(currentDb: FirebaseCompatFirestore, now = new Date().toISOString()) {
  try {
    await currentDb.collection('_tk_config').doc(PROJECT_CONFIG_DOC).set({
      initialized: true,
      projectId: activeProjectId,
      updatedAt: now
    }, { merge: true });
  } catch (error) {}
}

function toPlainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeModules(value: unknown): ModulePermissionKey[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(ALL_PERMISSION_MODULES);
  return Array.from(new Set(value.map(item => String(item || '').trim()).filter(item => allowed.has(item as ModulePermissionKey)))) as ModulePermissionKey[];
}

function normalizeMember(user: FirebaseCompatUser | null, raw: unknown): MemberProfile | null {
  const data = toPlainObject(raw);
  if (!Object.keys(data).length) return null;
  const role = data.role === 'owner' ? 'owner' : 'staff';
  const modules = normalizeModules(data.modules);
  return {
    uid: String(data.uid || user?.uid || ''),
    email: normalizeEmail(data.email || user?.email || ''),
    role,
    modules: role === 'owner' ? OWNER_MODULES : modules,
    createdAt: String(data.createdAt || ''),
    updatedAt: String(data.updatedAt || '')
  };
}

function createAuthChangedEvent(detail: AuthSessionState): Event {
  const windowRef = getWindowRef();
  const EventCtor = windowRef?.CustomEvent || globalThis.CustomEvent;
  if (typeof EventCtor === 'function') {
    return new EventCtor(AUTH_SESSION_CHANGED_EVENT, { detail });
  }
  return new Event(AUTH_SESSION_CHANGED_EVENT);
}

function emit(next: Partial<AuthSessionState>) {
  currentState = {
    ...currentState,
    ...next
  };
  listeners.forEach(listener => listener(currentState));
  getWindowRef()?.dispatchEvent?.(createAuthChangedEvent(currentState));
}

function subscribeAuthSession(listener: AuthSessionListener) {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

function getAuthSessionSnapshot() {
  return currentState;
}

async function getDocData(doc: FirebaseCompatDocSnapshot | null | undefined): Promise<Record<string, unknown> | null> {
  if (!doc?.exists) return null;
  return toPlainObject(doc.data?.() || {});
}

function requireAuth() {
  if (!auth) throw new Error('请先连接 Firebase');
  return auth;
}

function requireDb() {
  if (!db) throw new Error('请先连接 Firebase');
  return db;
}

async function ensureOwnerProfile(user: FirebaseCompatUser, currentDb: FirebaseCompatFirestore) {
  const ownerEmail = readOwnerEmail();
  const userEmail = normalizeEmail(user.email || '');
  if (!ownerEmail || ownerEmail !== userEmail) return null;
  const bootstrapKey = `${activeProjectId}:${user.uid}:${userEmail}`;
  if (ownerBootstrapPromise && ownerBootstrapKey === bootstrapKey) return ownerBootstrapPromise;

  ownerBootstrapKey = bootstrapKey;
  ownerBootstrapPromise = ensureOwnerProfileOnce(user, currentDb, userEmail).finally(() => {
    if (ownerBootstrapKey === bootstrapKey) {
      ownerBootstrapKey = '';
      ownerBootstrapPromise = null;
    }
  });
  return ownerBootstrapPromise;
}

async function ensureOwnerProfileOnce(user: FirebaseCompatUser, currentDb: FirebaseCompatFirestore, userEmail: string) {
  const ownerRef = currentDb.collection('_tk_config').doc(OWNER_CONFIG_DOC);
  const ownerSnapshot = await ownerRef.get();
  const now = new Date().toISOString();
  let existingOwner = await getDocData(ownerSnapshot);
  const existingOwnerEmail = normalizeEmail(existingOwner?.email);

  if (existingOwnerEmail && existingOwnerEmail !== userEmail) {
    throw new Error('这个项目已经有管理员账号，请使用管理员账号登录，或让管理员添加成员。');
  }

  if (!existingOwnerEmail) {
    const ownerProfile = {
      email: userEmail,
      uid: user.uid,
      createdAt: now,
      updatedAt: now
    };
    try {
      await ownerRef.set(ownerProfile, { merge: true });
      existingOwner = ownerProfile;
    } catch (error) {
      const latestOwner = await getDocData(await ownerRef.get()).catch(() => null);
      if (normalizeEmail(latestOwner?.email) !== userEmail) throw error;
      existingOwner = latestOwner;
    }
  }

  const ref = currentDb.collection('members').doc(userEmail);
  const snapshot = await ref.get();
  const existing = await getDocData(snapshot);
  if (existing?.role === 'owner') {
    await markProjectInitialized(currentDb, now);
    return normalizeMember(user, existing);
  }

  const profile = {
    uid: user.uid,
    email: userEmail,
    role: 'owner',
    modules: OWNER_MODULES,
    createdAt: String(existing?.createdAt || now),
    updatedAt: now
  };
  try {
    await ref.set(profile, { merge: true });
  } catch (error) {
    const latestMember = normalizeMember(user, await getDocData(await ref.get()).catch(() => null));
    if (latestMember?.role === 'owner') {
      await markProjectInitialized(currentDb, now);
      return latestMember;
    }
    throw error;
  }
  await markProjectInitialized(currentDb, now);
  return normalizeMember(user, profile);
}

async function loadMemberForUser(user: FirebaseCompatUser | null) {
  if (!user) {
    emit({ ready: true, user: null, member: null, isOwner: false, error: '' });
    return;
  }

  const currentDb = requireDb();
  const userEmail = normalizeEmail(user.email || '');
  const cachedMember = readCachedMember(user);
  emit({
    ready: false,
    user,
    member: cachedMember,
    isOwner: cachedMember?.role === 'owner',
    error: ''
  });
  try {
    const ownerProfile = await ensureOwnerProfile(user, currentDb);
    if (ownerProfile) {
      saveCachedMember(ownerProfile);
      emit({ ready: true, user, member: ownerProfile, isOwner: true, error: '' });
      return;
    }

    const snapshot = await currentDb.collection('members').doc(userEmail).get();
    const member = normalizeMember(user, await getDocData(snapshot));
    if (member) saveCachedMember(member);
    else clearCachedMember(userEmail);
    emit({
      ready: true,
      user,
      member,
      isOwner: member?.role === 'owner',
      error: member ? '' : '当前账号还没有加入这个项目'
    });
  } catch (error) {
    emit({
      ready: true,
      user,
      member: null,
      isOwner: false,
      error: error instanceof Error ? error.message : '账号权限读取失败'
    });
  }
}

function initializeAuthSession(rawConfig: unknown = TKFirestoreConnection.getConfig()?.configText || '') {
  const parsed = parseConfigInput(rawConfig);
  if (!parsed?.projectId) {
    if (unsubscribeAuth) unsubscribeAuth();
    unsubscribeAuth = null;
    auth = null;
    db = null;
    activeProjectId = '';
    emit({ ready: true, connected: false, projectId: '', user: null, member: null, isOwner: false, error: '' });
    return currentState;
  }

  if (activeProjectId === parsed.projectId && auth && db) return currentState;

  if (unsubscribeAuth) unsubscribeAuth();
  unsubscribeAuth = null;
  const app = initSharedFirebaseApp(parsed, getWindowRef(), '__tkRulesCheckFirestoreConfigured');
  auth = app.auth;
  db = app.db;
  activeProjectId = parsed.projectId;
  const initialUser = auth?.currentUser || null;
  const initialMember = initialUser ? readCachedMember(initialUser, parsed.projectId) : null;

  if (!auth) {
    emit({
      ready: true,
      connected: true,
      projectId: parsed.projectId,
      user: null,
      member: null,
      isOwner: false,
      error: 'Firebase Auth SDK 尚未加载'
    });
    return currentState;
  }

  emit({
    ready: false,
    connected: true,
    projectId: parsed.projectId,
    user: initialUser,
    member: initialMember,
    isOwner: initialMember?.role === 'owner',
    error: ''
  });
  unsubscribeAuth = auth.onAuthStateChanged(user => {
    void loadMemberForUser(user);
  });
  return currentState;
}

async function signInWithEmailPassword(email: string, password: string, mode: SignInMode = 'signin') {
  const currentAuth = requireAuth();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) throw new Error('请输入邮箱和密码');
  const action = mode === 'signup'
    ? currentAuth.createUserWithEmailAndPassword(normalizedEmail, password)
    : currentAuth.signInWithEmailAndPassword(normalizedEmail, password);
  const credential = await action as { user?: FirebaseCompatUser | null };
  const signedInUser = credential?.user || currentAuth.currentUser || null;
  if (signedInUser) {
    const cachedMember = readCachedMember(signedInUser);
    emit({
      ready: false,
      user: signedInUser,
      member: cachedMember,
      isOwner: cachedMember?.role === 'owner',
      error: ''
    });
  }
}

async function sendPasswordReset(email: string) {
  const currentAuth = requireAuth();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('请输入邮箱');
  await currentAuth.sendPasswordResetEmail(normalizedEmail);
}

async function readProjectInitialized() {
  const currentDb = requireDb();
  try {
    const snapshot = await currentDb.collection('_tk_config').doc(PROJECT_CONFIG_DOC).get();
    const data = await getDocData(snapshot);
    return data?.initialized === true;
  } catch (error) {
    return false;
  }
}

async function bootstrapOwner(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) throw new Error('请输入管理员邮箱和密码');
  saveOwnerEmail(normalizedEmail);
  try {
    await signInWithEmailPassword(normalizedEmail, password, 'signup');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!/email-already-in-use|already.*use/i.test(message)) throw error;
    await signInWithEmailPassword(normalizedEmail, password, 'signin');
  }
  if (auth?.currentUser) await loadMemberForUser(auth.currentUser);
}

async function signOutAuthSession() {
  if (!auth) return;
  await auth.signOut();
}

async function createStaffAuthUser(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!currentState.isOwner) throw new Error('只有管理员账号可以创建成员账号');
  if (!normalizedEmail || !password) throw new Error('请输入成员邮箱和初始密码');
  const config = parseConfigInput(TKFirestoreConnection.getConfig()?.configText || '');
  if (!config?.projectId) throw new Error('请先连接 Firebase');
  const firebaseNs = getFirebaseNamespace(getWindowRef());
  const appName = `tk-staff-create-${config.projectId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tempApp = firebaseNs.initializeApp(config, appName);
  const tempAuth = typeof tempApp.auth === 'function' ? tempApp.auth() : null;
  if (!tempAuth) throw new Error('Firebase Auth SDK 尚未加载');
  try {
    await tempAuth.createUserWithEmailAndPassword(normalizedEmail, password);
  } catch (error) {
    const message = getErrorText(error);
    if (!/email-already-in-use|auth\/email-already-in-use/i.test(message)) throw error;
  } finally {
    await tempAuth.signOut().catch(() => {});
    await tempApp.delete?.().catch(() => {});
  }
}

async function listMembers(): Promise<MemberProfile[]> {
  const currentDb = requireDb();
  const snapshot = await currentDb.collection('members').get();
  return snapshot.docs
    .map(doc => normalizeMember(null, { ...(doc.data() || {}), email: String(doc.data()?.email || doc.id || '') }))
    .filter((member): member is MemberProfile => !!member?.email)
    .sort((left, right) => (left.role === right.role ? left.email.localeCompare(right.email) : left.role === 'owner' ? -1 : 1));
}

async function saveMember(email: string, modules: ModulePermissionKey[] = DEFAULT_STAFF_MODULES, role: AuthRole = 'staff') {
  if (!currentState.isOwner) throw new Error('只有管理员账号可以管理成员');
  const currentDb = requireDb();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('请输入成员邮箱');
  const normalizedModules = role === 'owner' ? OWNER_MODULES : normalizeModules(modules);
  const now = new Date().toISOString();
  const ref = currentDb.collection('members').doc(normalizedEmail);
  const snapshot = await ref.get();
  const existing = await getDocData(snapshot);
  await ref.set({
    email: normalizedEmail,
    role,
    modules: normalizedModules,
    createdAt: String(existing?.createdAt || now),
    updatedAt: now
  }, { merge: true });
}

async function createStaffMember(email: string, password: string, modules: ModulePermissionKey[] = DEFAULT_STAFF_MODULES) {
  await createStaffAuthUser(email, password);
  await saveMember(email, modules, 'staff');
}

async function deleteMember(email: string) {
  if (!currentState.isOwner) throw new Error('只有管理员账号可以管理成员');
  const currentDb = requireDb();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('成员邮箱不能为空');
  if (normalizedEmail === normalizeEmail(currentState.user?.email || '')) throw new Error('不能删除当前管理员账号');
  await currentDb.collection('members').doc(normalizedEmail).delete();
}

function canAccessModule(moduleKey: string, state: AuthSessionState = currentState) {
  if (!state.connected) return true;
  if (!state.user || !state.member) return false;
  if (state.member.role === 'owner') return true;
  if (moduleKey === 'calc') return true;
  return state.member.modules.includes(moduleKey as ModulePermissionKey);
}

function getRestrictedModuleMessage(moduleLabel: string) {
  return `当前账号没有${moduleLabel}权限。`;
}

export {
  ALL_PERMISSION_MODULES,
  AUTH_SESSION_CHANGED_EVENT,
  DEFAULT_STAFF_MODULES,
  OWNER_MODULES,
  bootstrapOwner,
  canAccessModule,
  createStaffMember,
  deleteMember,
  getAuthErrorMessage,
  getAuthSessionSnapshot,
  getRestrictedModuleMessage,
  initializeAuthSession,
  listMembers,
  readProjectInitialized,
  readOwnerEmail,
  saveMember,
  sendPasswordReset,
  signInWithEmailPassword,
  signOutAuthSession,
  subscribeAuthSession
};
export type {
  AuthRole,
  AuthSessionState,
  MemberProfile,
  ModulePermissionKey,
  SignInMode
};
