import { useState, type ReactNode } from 'react';
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
  onDeleteAccount?: (key: string) => void;
  onEditAccount?: (key: string) => void;
  onReorder?: (keys: string[]) => void;
  scrollId: string;
  actionsId: string;
};

const triggerClassName = 'relative inline-flex min-h-[30px] shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium leading-none transition-[background,border-color,color] whitespace-nowrap data-[state=active]:border-transparent data-[state=active]:bg-[var(--accent)] data-[state=active]:font-semibold data-[state=active]:text-white data-[state=inactive]:border-[var(--border)] data-[state=inactive]:bg-[var(--panel2)] data-[state=inactive]:text-[var(--muted)] data-[state=inactive]:hover:border-[var(--accent)] data-[state=inactive]:hover:text-[var(--accent)]';
const countClassName = 'ml-0.5 text-[10.5px] opacity-70';

function AccountCount({ count }: { count: number }) {
  return <span className={countClassName}>({count})</span>;
}

function AccountTabActions({
  account,
  onDeleteAccount,
  onEditAccount
}: {
  account: string;
  onDeleteAccount?: (key: string) => void;
  onEditAccount?: (key: string) => void;
}) {
  if (!onDeleteAccount && !onEditAccount) return null;

  return (
    <span
      className="pointer-events-none absolute bottom-0 right-0 top-0 flex translate-x-[5px] items-center gap-0.5 bg-[var(--panel2)] pl-2.5 pr-2 opacity-0 transition-all duration-150 [mask-image:linear-gradient(to_right,transparent,black_10px)] group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-100 group-data-[state=active]:bg-[var(--accent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_10px)]"
    >
      {onEditAccount ? (
        <button
          type="button"
          className="m-0 inline-flex h-[18px] w-[18px] appearance-none items-center justify-center rounded border-0 bg-transparent p-0 text-[11px] leading-none text-[var(--muted)] shadow-none outline-none transition hover:bg-[rgba(110,168,255,.15)] hover:text-[var(--accent)] group-data-[state=active]:text-white/70 group-data-[state=active]:hover:bg-white/25 group-data-[state=active]:hover:text-white"
          aria-label={`编辑账号 ${account}`}
          title="编辑账号名"
          onClick={event => {
            event.stopPropagation();
            onEditAccount(account);
          }}
        >
          <span aria-hidden="true">✎</span>
        </button>
      ) : null}
      {onDeleteAccount ? (
        <button
          type="button"
          className="m-0 inline-flex h-[18px] w-[18px] appearance-none items-center justify-center rounded border-0 bg-transparent p-0 text-[12px] leading-none text-[var(--muted)] shadow-none outline-none transition hover:bg-[rgba(255,107,138,.15)] hover:text-[var(--danger)] group-data-[state=active]:text-white/70 group-data-[state=active]:hover:bg-white/25 group-data-[state=active]:hover:text-white"
          aria-label={`删除账号 ${account}`}
          title="删除账号名"
          onClick={event => {
            event.stopPropagation();
            onDeleteAccount(account);
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </span>
  );
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
  onDeleteAccount,
  onEditAccount,
  onReorder,
  scrollId,
  actionsId
}: AccountTabsBarProps) {
  const [dragKey, setDragKey] = useState('');

  function reorderAccountTabs(sourceKey: string, targetKey: string) {
    if (!onReorder || !sourceKey || !targetKey || sourceKey === targetKey) return;
    const keys = items.map(item => item.key);
    const sourceIndex = keys.indexOf(sourceKey);
    const targetIndex = keys.indexOf(targetKey);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const next = [...keys];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    onReorder(next);
  }

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
        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:thin]" id={scrollId}>
          <TabsList className="inline-flex min-w-max items-center gap-1.5 pr-1">
            {items.length ? items.map(item => {
              const draggable = !!onReorder && items.length > 1;
              return (
              <span key={item.key} className="group relative inline-flex shrink-0 overflow-hidden rounded-full" data-state={activeKey === item.key ? 'active' : 'inactive'}>
                <TabsTrigger
                  active={activeKey === item.key}
                  className={cn(triggerClassName, dragKey === item.key && 'opacity-60')}
                  draggable={draggable}
                  onClick={() => onChange(item.key)}
                  onDragStart={event => {
                    if (!draggable) return;
                    setDragKey(item.key);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', item.key);
                  }}
                  onDragOver={event => {
                    if (!draggable || !dragKey || dragKey === item.key) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={event => {
                    if (!draggable) return;
                    event.preventDefault();
                    reorderAccountTabs(dragKey || event.dataTransfer.getData('text/plain'), item.key);
                    setDragKey('');
                  }}
                  onDragEnd={() => setDragKey('')}
                  {...item.dataAttrs}
                >
                  {item.label}<AccountCount count={item.count} />
                </TabsTrigger>
                <AccountTabActions
                  account={item.key}
                  onEditAccount={onEditAccount}
                  onDeleteAccount={onDeleteAccount}
                />
              </span>
            );
            }) : (
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
