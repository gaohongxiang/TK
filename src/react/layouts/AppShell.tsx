import { useEffect, useState } from 'react';

type ModuleItem = {
  key: string;
  label: string;
};

const modules: ModuleItem[] = [
  { key: 'calc', label: '利润计算器' },
  { key: 'products', label: '商品管理' },
  { key: 'orders', label: '订单管理' },
  { key: 'analytics', label: '数据分析' }
];

function getCurrentRoute() {
  const hash = globalThis.location?.hash?.replace(/^#/, '') || '';
  return modules.some(module => module.key === hash) ? hash : 'calc';
}

function AppShell() {
  const [active, setActive] = useState(getCurrentRoute);

  useEffect(() => {
    const syncRoute = () => setActive(getCurrentRoute());
    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  return (
    <header className="app-header" data-react-app-shell-ready="true">
      <div className="app-brand">
        <h1>
          <img src="logo.png" alt="TK 电商工具箱 Logo" className="app-logo" />
          <span>TK 电商工具箱</span>
        </h1>
      </div>
      <div className="app-header-side">
        <nav className="modules" aria-label="模块导航">
          {modules.map(module => {
            const isActive = active === module.key;
            return (
              <a
                href={`#${module.key}`}
                data-view={module.key}
                className={isActive ? 'active' : undefined}
                aria-current={isActive ? 'page' : undefined}
                key={module.key}
              >
                {module.label}
              </a>
            );
          })}
        </nav>
        <a href="https://tk-evu-docs.pages.dev/" target="_blank" rel="noopener" className="app-doc-link">文档</a>
      </div>
    </header>
  );
}

export { AppShell };
