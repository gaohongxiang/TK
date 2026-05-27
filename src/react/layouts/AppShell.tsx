import { cn } from '@/lib/utils';
import {
  BarChart3,
  BookOpen,
  Box,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  KeyRound,
  Menu,
  Package,
  Settings,
  UserCog,
  Users,
  X
} from 'lucide-react';

type ModuleItem = {
  key: string;
  label: string;
};

const fallbackModules: ModuleItem[] = [
  { key: 'calc', label: '利润计算器' },
  { key: 'products', label: '商品管理' },
  { key: 'orders', label: '订单管理' },
  { key: 'finance', label: '收支管理' },
  { key: 'collection', label: '商品采编' },
  { key: 'analytics', label: '数据分析' }
];

const moduleIconMap = {
  calc: Calculator,
  products: Package,
  orders: ClipboardList,
  finance: CreditCard,
  collection: Box,
  analytics: BarChart3,
  login: KeyRound,
  'project-settings': Settings,
  accounts: Users,
  permissions: UserCog
};

function getModuleIcon(key: string) {
  return moduleIconMap[key as keyof typeof moduleIconMap] || Package;
}

function AppShell({
  active = 'calc',
  authEmail = '',
  authIsOwner = false,
  authRoleLabel = '',
  collapsed = false,
  docsUrl = 'https://tk-evu-docs.pages.dev/',
  mobileOpen = false,
  modules = fallbackModules,
  onCollapsedChange,
  onMobileOpenChange
}: {
  active?: string;
  authEmail?: string;
  authIsOwner?: boolean;
  authRoleLabel?: string;
  collapsed?: boolean;
  docsUrl?: string;
  mobileOpen?: boolean;
  modules?: ModuleItem[];
  onCollapsedChange?: (next: boolean) => void;
  onMobileOpenChange?: (next: boolean) => void;
}) {
  const activeModule = modules.find(module => module.key === active);
  const roleText = authRoleLabel || (authIsOwner ? '管理员' : authEmail ? '成员' : '未登录');

  function renderNav() {
    return (
      <nav className="app-shell-nav" aria-label="模块导航">
        {modules.map(module => {
          const isActive = active === module.key;
          const Icon = getModuleIcon(module.key);
          return (
            <a
              href={`#${module.key}`}
              data-view={module.key}
              className={cn('app-shell-link', isActive ? 'active' : '')}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? module.label : undefined}
              key={module.key}
              onClick={() => onMobileOpenChange?.(false)}
            >
              <span className="app-shell-link-icon" aria-hidden="true"><Icon size={17} strokeWidth={2} /></span>
              <span className="app-shell-link-label">{module.label}</span>
            </a>
          );
        })}
      </nav>
    );
  }

  function renderSidebar({ mobile = false }: { mobile?: boolean } = {}) {
    return (
      <aside className="app-shell-sidebar" data-app-sidebar data-mobile-sidebar={mobile ? 'true' : undefined}>
        <div className="app-shell-sidebar-inner">
          <div className="app-shell-brand">
            <img src="logo.png" alt="TK 电商工具箱 Logo" className="app-shell-logo" />
            <div className="app-shell-brand-text">
              <h1 className="app-shell-title">TK 电商工具箱</h1>
            </div>
            {mobile ? (
              <button type="button" className="app-shell-icon-button" aria-label="关闭导航" onClick={() => onMobileOpenChange?.(false)}>
                <X size={16} strokeWidth={2} />
              </button>
            ) : (
              <button
                type="button"
                className="app-shell-icon-button"
                aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
                onClick={() => onCollapsedChange?.(!collapsed)}
              >
                {collapsed ? <ChevronRight size={16} strokeWidth={2} /> : <ChevronLeft size={16} strokeWidth={2} />}
              </button>
            )}
          </div>

          {renderNav()}

          <a className="app-shell-link" href={docsUrl} target="_blank" rel="noopener" title={collapsed ? '文档' : undefined}>
            <span className="app-shell-link-icon" aria-hidden="true"><BookOpen size={17} strokeWidth={2} /></span>
            <span className="app-shell-link-label">文档</span>
          </a>

        </div>
      </aside>
    );
  }

  return (
    <>
      <div className="app-shell-mobile-bar" data-react-app-shell-ready="true">
        <button type="button" className="app-shell-icon-button" aria-label="打开导航" onClick={() => onMobileOpenChange?.(true)}>
          <Menu size={18} strokeWidth={2} />
        </button>
        <div className="min-w-0">
          <div className="app-shell-mobile-title">{activeModule?.label || 'TK 电商工具箱'}</div>
          <div className="app-shell-mobile-meta">{authEmail ? roleText : '未登录'}</div>
        </div>
        <a className="app-shell-mobile-login" href={authEmail ? '#accounts' : '#login'} aria-label={authEmail ? '账号管理' : '项目登录'}>
          <KeyRound size={16} strokeWidth={2} />
        </a>
      </div>
      {renderSidebar()}
      {mobileOpen ? (
        <div className="app-shell-mobile-drawer" role="dialog" aria-modal="true" aria-label="模块导航">
          {renderSidebar({ mobile: true })}
          <button type="button" className="app-shell-mobile-scrim" aria-label="关闭导航" onClick={() => onMobileOpenChange?.(false)} />
        </div>
      ) : null}
    </>
  );
}

export { AppShell };
