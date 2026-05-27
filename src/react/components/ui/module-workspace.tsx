import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ModuleWorkspaceProps = HTMLAttributes<HTMLElement>;

function ModuleWorkspace({ className, ...props }: ModuleWorkspaceProps) {
  return <section className={cn('module-workspace', className)} {...props} />;
}

type ModuleHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

function ModuleHeader({ actions, className, description, title, ...props }: ModuleHeaderProps) {
  return (
    <div className={cn('module-workspace-header', className)} {...props}>
      <div className="module-workspace-header-copy">
        <div className="module-workspace-title-row">
          <h2 className="module-workspace-title">{title}</h2>
        </div>
        {description ? <p className="module-workspace-description">{description}</p> : null}
      </div>
      {actions ? <div className="module-workspace-actions">{actions}</div> : null}
    </div>
  );
}

function ModuleStatusBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('module-status-bar', className)} {...props} />;
}

function ModuleToolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('module-toolbar', className)} {...props} />;
}

function ModuleAccountTabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('module-account-tabs', className)} {...props} />;
}

function ModuleTableShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('module-table-shell', className)} {...props} />;
}

export {
  ModuleAccountTabs,
  ModuleHeader,
  ModuleStatusBar,
  ModuleTableShell,
  ModuleToolbar,
  ModuleWorkspace
};
