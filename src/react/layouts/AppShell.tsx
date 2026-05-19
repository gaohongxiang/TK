import { cn } from '@/lib/utils';

type ModuleItem = {
  key: string;
  label: string;
};

const fallbackModules: ModuleItem[] = [
  { key: 'calc', label: '利润计算器' },
  { key: 'products', label: '商品管理' },
  { key: 'orders', label: '订单管理' },
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

function AppShell({
  active = 'calc',
  docsUrl = 'https://tk-evu-docs.pages.dev/',
  modules = fallbackModules
}: {
  active?: string;
  docsUrl?: string;
  modules?: ModuleItem[];
}) {
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
      </div>
    </header>
  );
}

export { AppShell };
