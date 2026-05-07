import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type AccountTabItem = {
  key: string;
  label: ReactNode;
  count: number;
  dataAttrs?: Record<string, string>;
};

type AccountTabsBarProps = {
  actions?: ReactNode;
  activeKey: string;
  addAccountButton?: {
    id: string;
    label?: ReactNode;
    title: string;
    onClick: () => void;
  };
  allCount: number;
  allDataAttrs?: Record<string, string>;
  allTabsId: string;
  className?: string;
  emptyText?: ReactNode;
  id: string;
  items: AccountTabItem[];
  onChange: (key: string) => void;
  scrollId: string;
  actionsId: string;
};

const triggerClassName = 'relative inline-flex min-h-[30px] shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium leading-none transition-[background,border-color,color] whitespace-nowrap data-[state=active]:border-transparent data-[state=active]:bg-[var(--accent)] data-[state=active]:font-semibold data-[state=active]:text-white data-[state=inactive]:border-[var(--border)] data-[state=inactive]:bg-[var(--panel2)] data-[state=inactive]:text-[var(--muted)] data-[state=inactive]:hover:border-[var(--accent)] data-[state=inactive]:hover:text-[var(--accent)]';
const countClassName = 'ml-0.5 text-[10.5px] opacity-70';

function AccountCount({ count }: { count: number }) {
  return <span className={countClassName}>({count})</span>;
}

function AccountTabsBar({
  actions,
  activeKey,
  addAccountButton,
  allCount,
  allDataAttrs,
  allTabsId,
  className,
  emptyText,
  id,
  items,
  onChange,
  scrollId,
  actionsId
}: AccountTabsBarProps) {
  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border)] pb-3 max-[768px]:grid-cols-1',
        className
      )}
      data-slot="account-tabs-bar"
    >
      <Tabs className="flex min-w-0 items-center gap-2" id={id}>
        <div className="shrink-0" id={allTabsId}>
          <TabsTrigger
            active={activeKey === '__all__'}
            className={triggerClassName}
            onClick={() => onChange('__all__')}
            {...allDataAttrs}
          >
            全部<AccountCount count={allCount} />
          </TabsTrigger>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:thin]" id={scrollId}>
          <TabsList className="inline-flex min-w-max items-center gap-1.5 pr-1">
            {items.length ? items.map(item => (
              <TabsTrigger
                active={activeKey === item.key}
                className={triggerClassName}
                key={item.key}
                onClick={() => onChange(item.key)}
                {...item.dataAttrs}
              >
                {item.label}<AccountCount count={item.count} />
              </TabsTrigger>
            )) : (
              <span className="inline-flex min-h-[30px] items-center whitespace-nowrap text-[12.5px] text-[var(--muted)]">
                {emptyText}
              </span>
            )}
            {addAccountButton ? (
              <Button
                id={addAccountButton.id}
                title={addAccountButton.title}
                variant="plain"
                className="h-[30px] w-[30px] shrink-0 rounded-full border border-dashed border-[var(--border)] bg-transparent p-0 text-base text-[var(--muted)] hover:border-[var(--accent)] hover:bg-[rgba(110,168,255,.08)] hover:text-[var(--accent)]"
                onClick={addAccountButton.onClick}
              >
                {addAccountButton.label || '+'}
              </Button>
            ) : null}
          </TabsList>
        </div>
      </Tabs>
      <div className="inline-flex shrink-0 items-center justify-end gap-2 max-[768px]:w-full" id={actionsId}>
        {actions}
      </div>
    </div>
  );
}

export { AccountTabsBar };
export type { AccountTabItem, AccountTabsBarProps };
