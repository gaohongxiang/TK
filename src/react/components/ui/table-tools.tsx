import type { HTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TableToolbarProps = HTMLAttributes<HTMLDivElement> & {
  bottom?: boolean;
  innerClassName?: string;
  left?: ReactNode;
  right?: ReactNode;
};

function TableToolbar({ bottom = false, className, innerClassName, left, right, ...props }: TableToolbarProps) {
  return (
    <div
      className={cn(
        'px-0.5',
        bottom ? 'mt-3' : 'sticky top-3 z-[18] mb-3',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--panel)_92%,transparent)] px-3 py-2.5 shadow-[0_14px_30px_rgba(0,0,0,.12)] backdrop-blur-[10px] max-[768px]:items-stretch',
          innerClassName
        )}
      >
        {left ? <div className="inline-flex min-w-0 items-center max-[768px]:w-full">{left}</div> : <div />}
        {right ? (
          <div className="ml-auto inline-flex flex-wrap items-center justify-end max-[768px]:ml-0 max-[768px]:w-full max-[768px]:justify-start">
            {right}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TableSearchProps = {
  id: string;
  hint: string;
  value: string;
  className?: string;
  onChange: (value: string) => void;
};

function TableSearch({ className, hint, id, onChange, value }: TableSearchProps) {
  const [composing, setComposing] = useState(false);

  return (
    <label
      className={cn(
        'relative inline-flex h-8 w-80 max-w-full items-center overflow-hidden rounded-full border border-[var(--border)] bg-[rgba(255,255,255,.035)] transition-[border-color,box-shadow,background] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_rgba(110,168,255,.14)] max-[768px]:w-full',
        className
      )}
    >
      <span className="pointer-events-none absolute left-[11px] top-1/2 z-[3] inline-flex h-[15px] w-[15px] -translate-y-1/2 items-center justify-center text-[var(--muted)]" aria-hidden="true">
        <Search size={15} strokeWidth={2.1} />
      </span>
      <input
        id={id}
        className="peer relative z-[2] h-full w-full border-0 bg-transparent px-3 pl-[34px] text-[12.5px] text-[var(--text)] shadow-none outline-none focus:border-transparent focus:shadow-none"
        type="text"
        placeholder=" "
        value={value}
        autoComplete="off"
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={event => {
          setComposing(false);
          onChange(event.currentTarget.value);
        }}
        onChange={event => {
          if (!composing) onChange(event.currentTarget.value);
        }}
      />
      <span className="pointer-events-none absolute left-[34px] right-3 top-1/2 z-[1] -translate-y-1/2 truncate text-[12.5px] text-[var(--muted)] opacity-100 transition-opacity peer-focus:opacity-0 peer-[:not(:placeholder-shown)]:opacity-0">
        {hint}
      </span>
    </label>
  );
}

type TablePagerProps = {
  currentPage: number;
  pageSize: number;
  pageSizeOptions: number[];
  totalPages: number;
  className?: string;
  onPageChange: (delta: number) => void;
  onPageSizeChange: (value: number) => void;
};

function TablePager({
  className,
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSize,
  pageSizeOptions,
  totalPages
}: TablePagerProps) {
  return (
    <div className={cn('inline-flex flex-wrap items-center gap-2 max-[768px]:w-full', className)}>
      <label className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted)]">
        <span>每页</span>
        <select
          className="h-[30px] min-w-[54px] appearance-none rounded-full border border-[var(--border)] bg-[rgba(255,255,255,.035)] px-2.5 text-center text-[12px] leading-[30px] text-[var(--text)] shadow-none"
          value={pageSize}
          onChange={event => onPageSizeChange(Number(event.target.value))}
        >
          {pageSizeOptions.map(size => <option value={size} key={size}>{size}</option>)}
        </select>
      </label>
      <Button size="sm" disabled={currentPage <= 1} onClick={() => onPageChange(-1)}>上一页</Button>
      <span className="min-w-[52px] text-center text-[12.5px] text-[var(--muted)]">{currentPage} / {totalPages}</span>
      <Button size="sm" disabled={currentPage >= totalPages} onClick={() => onPageChange(1)}>下一页</Button>
    </div>
  );
}

function TableViewport({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('overflow-x-auto overflow-y-hidden px-0.5 [scroll-padding-inline:12px]', className)}
      {...props}
    />
  );
}

function TableFrame({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('inline-block box-border pl-0.5 pr-[18px]', className)} {...props} />;
}

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  description?: ReactNode;
};

function EmptyState({ className, description, title, ...props }: EmptyStateProps) {
  return (
    <div className={cn('px-5 py-[60px] text-center text-[var(--muted)]', className)} {...props}>
      <div className="mb-1.5 text-[15px]">{title}</div>
      {description ? <div className="text-[12.5px]">{description}</div> : null}
    </div>
  );
}

export {
  EmptyState,
  TableFrame,
  TablePager,
  TableSearch,
  TableToolbar,
  TableViewport
};
