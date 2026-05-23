import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const reactAppSource = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'App.tsx'), 'utf8');
const appShellSource = fs.readFileSync(path.join(root, 'src', 'react', 'layouts', 'AppShell.tsx'), 'utf8');

assert.doesNotMatch(
  appShellSource,
  /模块锁|data-module-lock-settings|lockedModuleKeys|LockKeyhole/,
  '顶部导航不应再显示本地模块锁入口或模块锁图标'
);

assert.doesNotMatch(
  reactAppSource,
  /ModuleLockGate|ModuleLockSettingsDialog|isLockedUntilUnlock|readModuleLockConfig|saveModuleLockConfig|verifyModuleLockPassword|clearModuleLockConfig|MODULE_LOCK_CHANGED_EVENT/,
  'React App 不应再使用本地模块锁门禁，模块访问只走账号权限'
);

assert.match(
  reactAppSource,
  /id="view-finance"[\s\S]*isBlockedByPermission\('finance'\)[\s\S]*<ModuleAccessGate[\s\S]*<FinancePage active=\{active === 'finance'\}/,
  '收支管理需要只通过账号权限控制访问'
);

assert.match(
  reactAppSource,
  /projectSettingsModule[\s\S]*accountModule[\s\S]*permissionModule[\s\S]*authSession\.isOwner \? \[\.\.\.allowedModules, projectSettingsModule, accountModule, permissionModule\] : allowedModules/,
  '管理员登录后需要通过项目设置、账号管理和权限管理模块管理项目访问权限'
);

console.log('module lock removal contract ok');
