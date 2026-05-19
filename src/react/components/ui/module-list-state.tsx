import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/table-tools';
import { Database, Inbox, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';

type ModuleListStateAction = {
  id?: string;
  label: ReactNode;
  variant?: 'default' | 'primary' | 'danger' | 'accentSoft' | 'ghost';
  disabled?: boolean;
  onClick: () => void;
};

type ModuleListStateProps = {
  tone: 'connect' | 'permission' | 'empty';
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  actions?: ModuleListStateAction[];
};

const iconMap = {
  connect: Database,
  permission: ShieldAlert,
  empty: Inbox
};

function ModuleListState({ actions = [], className, description, title, tone }: ModuleListStateProps) {
  const Icon = iconMap[tone];
  return (
    <EmptyState
      className={className || 'py-[58px]'}
      title={(
        <span className="inline-flex items-center justify-center gap-1.5 text-[var(--text)]">
          <Icon size={15} strokeWidth={2} aria-hidden="true" />
          {title}
        </span>
      )}
      description={description}
    >
      {actions.length ? (
        <div className="inline-flex flex-wrap items-center justify-center gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              id={action.id}
              size="sm"
              variant={action.variant}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </EmptyState>
  );
}

export { ModuleListState };
export type { ModuleListStateAction, ModuleListStateProps };
