import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

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

const appHeaderClass = 'app-header sticky top-0 z-[60] mb-3.5 flex flex-nowrap items-center justify-start gap-2.5 border-b border-[color-mix(in_srgb,var(--border)_72%,transparent)] px-0.5 pb-[7px] pt-3.5 before:absolute before:inset-y-0 before:left-1/2 before:z-[-1] before:w-screen before:-translate-x-1/2 before:bg-[color-mix(in_srgb,var(--bg)_98%,transparent)] before:backdrop-blur-xl max-[640px]:mb-[18px] max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-3 max-[640px]:pt-2.5';
const appBrandClass = 'app-brand flex-none text-left max-[640px]:text-center';
const appBrandTitleClass = 'm-0 inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-[.02em] max-[640px]:text-base';
const appLogoClass = 'app-logo h-[38px] w-[38px] flex-none rounded-[10px] object-cover';
const appHeaderSideClass = 'app-header-side ml-14 flex flex-1 flex-wrap items-center justify-start gap-2.5 max-[640px]:ml-0 max-[640px]:w-full max-[640px]:justify-center';
const modulesNavClass = 'modules flex flex-wrap justify-start gap-1.5 max-[640px]:w-full max-[640px]:flex-nowrap max-[640px]:overflow-x-auto max-[640px]:pb-0.5 [-webkit-overflow-scrolling:touch]';
const moduleLinkClass = 'rounded-full border border-transparent bg-transparent px-2 py-1 text-[11.5px] font-medium text-[var(--muted)] transition-[background,color,border-color] hover:bg-[color-mix(in_srgb,var(--panel2)_56%,transparent)] hover:text-[var(--text)] max-[640px]:flex-none max-[640px]:px-[11px] max-[640px]:py-1.5 max-[640px]:text-xs';
const activeModuleLinkClass = 'active border-[color-mix(in_srgb,var(--border)_86%,transparent)] bg-[color-mix(in_srgb,var(--panel2)_70%,transparent)] text-[var(--text)]';
const appDocLinkClass = 'app-doc-link inline-flex flex-none items-center px-0 py-1.5 text-[12.5px] font-semibold leading-none text-[var(--muted)] transition-[color,opacity] hover:text-[var(--accent)]';
const appHeaderAuthClass = 'app-header-auth relative ml-auto inline-block max-w-[260px] flex-none max-[760px]:ml-0';
const appHeaderAuthSummaryClass = 'inline-flex min-h-[32px] max-w-[260px] cursor-pointer items-center rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--panel2)_72%,transparent)] px-3 text-[11.5px] font-semibold text-[var(--muted)] transition-[border-color,color] hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] hover:text-[var(--text)] focus:outline-none focus-visible:outline-none';
const appHeaderAuthTextClass = 'min-w-0 truncate';
const appHeaderAuthMenuClass = 'absolute left-0 right-0 top-[calc(100%+6px)] z-[70] grid w-full min-w-0 gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--panel)] p-2.5 text-[11.5px] text-[var(--muted)] shadow-[var(--shadow)]';
const appHeaderAuthRoleClass = 'w-full rounded-[10px] bg-[var(--panel2)] px-2.5 py-2 text-left font-medium text-[var(--text)] focus:outline-none focus-visible:outline-none';
const appHeaderAuthButtonClass = 'inline-flex min-h-[30px] w-full items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--panel2)] px-2.5 text-[11.5px] font-semibold text-[var(--text)] transition-[border-color,color] hover:border-[color-mix(in_srgb,var(--accent)_42%,var(--border))] hover:text-[var(--accent)]';

function AppShell({
  active = 'calc',
  authEmail = '',
  authIsOwner = false,
  authRoleLabel = '',
  docsUrl = 'https://tk-evu-docs.pages.dev/',
  modules = fallbackModules,
  onSignOut
}: {
  active?: string;
  authEmail?: string;
  authIsOwner?: boolean;
  authRoleLabel?: string;
  docsUrl?: string;
  modules?: ModuleItem[];
  onSignOut?: () => void;
}) {
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const authMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!authMenuOpen) return undefined;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && authMenuRef.current?.contains(target)) return;
      setAuthMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAuthMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [authMenuOpen]);

  useEffect(() => {
    setAuthMenuOpen(false);
  }, [active, authEmail]);

  return (
    <header className={appHeaderClass} data-react-app-shell-ready="true">
      <div className={appBrandClass}>
        <h1 className={appBrandTitleClass}>
          <img src="logo.png" alt="TK 电商工具箱 Logo" className={appLogoClass} />
          <span>TK 电商工具箱</span>
        </h1>
      </div>
      <div className={appHeaderSideClass}>
        <nav className={modulesNavClass} aria-label="模块导航">
          {modules.map(module => {
            const isActive = active === module.key;
            return (
              <a
                href={`#${module.key}`}
                data-view={module.key}
                className={cn(moduleLinkClass, isActive ? activeModuleLinkClass : '')}
                aria-current={isActive ? 'page' : undefined}
                key={module.key}
              >
                {module.label}
              </a>
            );
          })}
        </nav>
        <a href={docsUrl} target="_blank" rel="noopener" className={appDocLinkClass}>文档</a>
        {authEmail ? (
          <div className={appHeaderAuthClass} data-app-header-auth ref={authMenuRef}>
            <button
              type="button"
              className={appHeaderAuthSummaryClass}
              aria-expanded={authMenuOpen}
              aria-haspopup="menu"
              onClick={() => setAuthMenuOpen(open => !open)}
            >
              <span className={appHeaderAuthTextClass}>{authEmail}</span>
            </button>
            {authMenuOpen ? (
              <div className={appHeaderAuthMenuClass} role="menu" onClick={() => setAuthMenuOpen(false)}>
                <button type="button" className={appHeaderAuthRoleClass} onClick={() => setAuthMenuOpen(false)}>{authRoleLabel || (authIsOwner ? '管理员' : '成员')}</button>
                {onSignOut ? (
                  <button
                    type="button"
                    className={appHeaderAuthButtonClass}
                    onClick={() => {
                      setAuthMenuOpen(false);
                      onSignOut();
                    }}
                  >
                    退出登录
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export { AppShell };
