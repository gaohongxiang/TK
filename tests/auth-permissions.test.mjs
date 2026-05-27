import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const authSource = fs.readFileSync(path.join(root, 'src', 'auth-permissions.ts'), 'utf8');
const appRuntimeSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'AppRuntime.tsx'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const adminPagesSource = fs.readFileSync(path.join(root, 'src', 'react', 'features', 'admin', 'AdminPages.tsx'), 'utf8');
const appShellSource = fs.readFileSync(path.join(root, 'src', 'react', 'layouts', 'AppShell.tsx'), 'utf8');
const firebaseAppSource = fs.readFileSync(path.join(root, 'src', 'firebase-app.ts'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  indexSource,
  /firebase-auth-compat\.js[\s\S]*firebase-firestore-compat\.js/,
  '真正权限需要加载 Firebase Auth compat SDK'
);

assert.match(
  firebaseAppSource,
  /tk-shared-\$\{config\.projectId\}/,
  '各模块需要复用同一个 Firebase app，避免 Auth 状态分散'
);

assert.match(
  authSource,
  /collection\('members'\)\.doc\(userEmail\)[\s\S]*role:\s*'owner'[\s\S]*DEFAULT_STAFF_MODULES[\s\S]*canAccessModule/,
  '权限层需要用 members/{email} 读取管理员/成员角色并判断模块权限'
);

assert.match(
  authSource,
  /signInWithEmailPassword[\s\S]*createUserWithEmailAndPassword[\s\S]*sendPasswordReset[\s\S]*sendPasswordResetEmail[\s\S]*bootstrapOwner[\s\S]*createStaffAuthUser[\s\S]*createStaffMember[\s\S]*saveMember[\s\S]*deleteMember/,
  '权限层需要支持管理员账号设置、成员登录、重置密码邮件，以及管理员创建员工账号和管理成员'
);

assert.match(
  authSource,
  /getAuthErrorMessage[\s\S]*configuration-not-found[\s\S]*安全 > Authentication[\s\S]*登录方法[\s\S]*电子邮件地址\/密码[\s\S]*operation-not-allowed[\s\S]*permission-denied[\s\S]*最新 Firestore 规则/,
  '权限层需要把 Firebase Auth 和 Firestore 权限错误转换成可操作的中文提示'
);

assert.match(
  authSource,
  /PROJECT_CONFIG_DOC[\s\S]*markProjectInitialized[\s\S]*ensureOwnerProfileOnce[\s\S]*catch \(error\)[\s\S]*latestOwner[\s\S]*latestMember[\s\S]*readProjectInitialized/,
  '管理员初始化需要写入项目级初始化标记，并处理 Auth 状态回调和按钮提交同时写入导致的幂等重试'
);

assert.match(
  authSource,
  /MEMBER_CACHE_KEY[\s\S]*readCachedMember[\s\S]*saveCachedMember[\s\S]*loadMemberForUser\(user[\s\S]*emit\(\{\s*ready:\s*false,[\s\S]*member:\s*cachedMember[\s\S]*signInWithEmailPassword[\s\S]*signedInUser[\s\S]*emit\(\{\s*ready:\s*false,[\s\S]*member:\s*cachedMember/,
  '登录成功后需要先广播已登录和缓存权限，不能等 members 权限读取完成才切出项目登录'
);

assert.match(
  appRuntimeSource,
  /app-firestore-modal[\s\S]*生成项目连接链接/,
  '全局运行层需要保留管理员初始化用的项目连接链接生成'
);

assert.match(
  appRuntimeSource,
  /openMembers:\s*\(\) => \{[\s\S]*window\.location\.hash = '#permissions'/,
  '权限入口需要跳转到权限管理页面'
);

assert.doesNotMatch(
  appRuntimeSource,
  /app-members-modal|showAuthStatus|fixed bottom-4 right-4|收支管理权限/,
  '员工账号和权限不能再放在全局弹窗或右下角状态条里'
);

assert.match(
  adminPagesSource,
  /function AccountManagementPage[\s\S]*createStaffMember\(email, password, \[\]\)[\s\S]*deleteMember\(emailToRemove\)[\s\S]*title="账号管理"[\s\S]*复制项目连接链接[\s\S]*新增员工账号[\s\S]*回到项目登录页点击“忘记密码”处理[\s\S]*账号列表/,
  '账号管理需要作为独立模块创建和移除员工账号，密码找回统一回到项目登录页'
);

assert.doesNotMatch(
  adminPagesSource,
  /sendResetEmail|sendPasswordReset\(emailToReset\)|发送重置邮件|已发送重置密码邮件|resettingEmail/,
  '账号管理不能再提供单独的密码重置入口'
);

assert.match(
  adminPagesSource,
  /applyBulkPermissionMode[\s\S]*function PermissionManagementPage[\s\S]*draftModules[\s\S]*permissionsDirty[\s\S]*applyBulkPermissions[\s\S]*Promise\.all\(updates\)[\s\S]*function savePermissions\([\s\S]*saveMember\(selectedMember\.email, nextModules, 'staff'\)[\s\S]*title="权限管理"[\s\S]*批量修改权限[\s\S]*应用到所选员工[\s\S]*模块权限[\s\S]*ALL_PERMISSION_MODULES[\s\S]*保存权限/,
  '权限管理需要支持单人草稿保存和批量修改员工模块权限'
);

assert.match(
  appSource,
  /function TopbarGlobalStatus[\s\S]*data-app-topbar-auth[\s\S]*\{authEmail\}[\s\S]*\{roleText\}[\s\S]*账号管理[\s\S]*权限管理[\s\S]*退出登录/,
  '统一壳层需要把账号状态放在顶部右侧菜单，按钮显示邮箱，角色和退出登录放进下拉菜单'
);

assert.doesNotMatch(
  appShellSource + fs.readFileSync(path.join(root, 'src', 'react', 'styles.css'), 'utf8'),
  /data-app-header-auth|app-shell-user-menu|app-shell-global/,
  '账号和数据库状态不能继续留在左侧栏底部，避免与顶部全局入口重复'
);

assert.match(
  appSource,
  /loginModule[\s\S]*projectSettingsModule[\s\S]*accountModule[\s\S]*permissionModule[\s\S]*ProjectSetupGuide[\s\S]*项目管理员初始化[\s\S]*loginSetupBodyClass[\s\S]*创建 Firestore 数据库[\s\S]*开启 Firebase Auth[\s\S]*保存项目连接[\s\S]*发布数据库规则[\s\S]*创建管理员账号[\s\S]*管理员后台/,
  '项目登录需要作为页面视图显示，管理员设置入口才展示初始化向导'
);

assert.match(
  appSource,
  /readProjectInitialized[\s\S]*projectInitializedRemote[\s\S]*projectInitialized = !!initializedOwnerEmail \|\| projectInitializedRemote \|\| authSession\.isOwner[\s\S]*showAdminSetup = isSetup && !projectInitialized[\s\S]*showInitialized = isSetup && projectInitialized[\s\S]*showInitialized \? \([\s\S]*<ProjectInitializedCard[\s\S]*showAdminSetup \? \([\s\S]*<ProjectSetupGuide[\s\S]*项目管理员设置[\s\S]*displayedError/,
  '公开登录页不能默认展示管理员初始化流程；项目已初始化后需要跨浏览器读取项目标记并只显示状态和管理入口'
);

assert.match(
  appSource,
  /loginSingleLayoutClass = 'mx-auto mt-12 grid max-w-\[600px\][\s\S]*loginPageInlineClass = 'grid grid-cols-\[minmax\(0,1fr\)_auto\][\s\S]*loginPageInlineCopyClass = 'min-w-0 truncate whitespace-nowrap[\s\S]*loginSubmitActionsClass = 'flex justify-center[\s\S]*loginSubmitButtonClass = 'min-w-\[180px\][\s\S]*无账号或未导入连接，请联系管理员[\s\S]*className=\{loginSubmitButtonClass\}/,
  '项目登录卡片需要整体下移并加宽，说明文案需要精简且不换行，登录按钮需要居中加宽'
);

assert.match(
  appSource,
  /resetSentOnce[\s\S]*resetCooldown[\s\S]*requestPasswordReset[\s\S]*请输入邮箱后再发送重置密码邮件[\s\S]*请先打开管理员发来的连接链接[\s\S]*sendPasswordReset\(email\)[\s\S]*setResetCooldown\(60\)[\s\S]*disabled=\{resetBusy \|\| resetCooldown > 0\}[\s\S]*后重试[\s\S]*重新发送[\s\S]*忘记密码/,
  '项目登录页需要提供可点击的忘记密码入口，通过 Firebase 发送重置密码邮件，并展示倒计时和重新发送状态'
);

assert.doesNotMatch(
  authSource,
  /updateCurrentUserPassword|reauthenticateWithCredential|updatePassword|EmailAuthProvider/,
  '密码修改不能走站内本地改密路径，统一使用 Firebase Auth 重置邮件'
);

assert.doesNotMatch(
  appSource,
  /<div className=\{loginPageActionsClass\}>[\s\S]*连接设置[\s\S]*<\/div>/,
  '公开登录表单不能显示连接设置入口，连接配置只属于管理员初始化流程'
);

assert.match(
  appSource,
  /安全[\s\S]*Authentication[\s\S]*登录方法[\s\S]*电子邮件地址\/密码/,
  '管理员初始化向导需要把 Auth、规则发布和员工权限配置路径说清楚'
);

assert.match(
  appSource,
  /保存项目连接[\s\S]*复制最新规则[\s\S]*TKFirestoreConnection\.openConsole\('rules'\)/,
  '管理员初始化操作面板需要提供保存项目连接、复制规则和打开 Rules'
);

assert.doesNotMatch(
  appSource,
  /退出连接|更新连接/,
  '管理员初始化页不应提供退出连接或更换连接入口'
);

assert.match(
  appSource,
  /setupStepFormGridClass = 'grid grid-cols-3[\s\S]*confirmPassword[\s\S]*确认密码[\s\S]*两次输入的密码不一致/,
  '管理员账号创建表单需要邮箱、密码、确认密码同排展示，并校验两次密码一致'
);

assert.match(
  appSource,
  /管理员后台[\s\S]*账号管理[\s\S]*权限管理/,
  '管理员初始化向导需要提示后续到账号管理和权限管理处理员工账号'
);

assert.match(
  appSource,
  /ProjectInitializedCard[\s\S]*已初始化[\s\S]*项目管理员已设置[\s\S]*项目连接链接[\s\S]*复制项目连接链接[\s\S]*返回登录[\s\S]*#project-settings[\s\S]*打开数据库管理[\s\S]*#accounts[\s\S]*打开账号管理[\s\S]*#permissions[\s\S]*打开权限管理/,
  '管理员初始化完成后，项目管理员设置页需要隐藏初始化步骤并显示项目连接链接、数据库管理、账号管理和权限管理入口'
);

assert.doesNotMatch(
  appRuntimeSource,
  /app-auth-modal|authDialogOpen|员工登录|老板初始化/,
  '登录不能再由弹窗承载，也不能把员工登录和老板初始化做成主入口'
);

assert.match(
  appSource,
  /const calculatorModule = modules\.find\(module => module\.key === 'calc'\)[\s\S]*if \(!authSession\.user\) \{[\s\S]*return \[calculatorModule, loginModule\][\s\S]*shouldShowLoginPage = active === 'login' \|\| \(!authSession\.user && \(protectedModuleKeys\.has\(active as ModulePermissionKey\) \|\| ownerOnlyModuleKeys\.has\(active\)\)\)[\s\S]*renderedActive = shouldShowLoginPage \? 'login' : active/,
  '主 App 需要未登录时只显示利润计算器和项目登录，访问业务模块时切到项目登录页'
);

assert.match(
  appSource,
  /if \(!authSession\.ready && !authSession\.member\) return modules[\s\S]*isResolvingPermissions[\s\S]*isBlockedByPermission = \(moduleKey: string\) => isResolvingPermissions/,
  '主 App 在已登录但权限读取中时需要先展示业务模块，并用权限读取中状态挡住受控页面'
);

assert.match(
  appSource,
  /id="view-finance"[\s\S]*isBlockedByPermission\('finance'\)[\s\S]*<ModuleAccessGate[\s\S]*<FinancePage active=\{active === 'finance'\}/,
  '收支管理需要按账号权限渲染'
);

assert.match(
  appSource,
  /id="view-project-settings"[\s\S]*<ProjectSettingsPage active=\{active === 'project-settings'\}[\s\S]*id="view-accounts"[\s\S]*<AccountManagementPage active=\{active === 'accounts'\}[\s\S]*id="view-permissions"[\s\S]*<PermissionManagementPage active=\{active === 'permissions'\}/,
  '管理员登录后需要渲染项目设置、账号管理和权限管理模块'
);

assert.match(
  adminPagesSource,
  /function ProjectSettingsPage[\s\S]*getRulesSource\(\)[\s\S]*title="数据库管理"[\s\S]*项目状态[\s\S]*项目 ID[\s\S]*Auth 域名[\s\S]*当前管理员[\s\S]*权限模式[\s\S]*项目连接链接[\s\S]*复制项目连接链接[\s\S]*打开 Firebase[\s\S]*Firestore 最新规则[\s\S]*复制最新规则[\s\S]*打开 Rules/,
  '管理员数据库管理页需要展示初始化状态、项目连接链接和最新规则，并提供复制项目连接链接和规则操作'
);

assert.doesNotMatch(
  adminPagesSource,
  /更换连接|断开本机连接|退出数据库/,
  '管理员数据库管理页不应暴露更换连接、断开本机连接或退出数据库入口'
);

console.log('auth permissions contract ok');
