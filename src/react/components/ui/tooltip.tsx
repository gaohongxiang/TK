import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TooltipProps = HTMLAttributes<HTMLSpanElement> & {
  label: ReactNode;
};

function Tooltip({ children, className, label, ...props }: TooltipProps) {
  return (
    <span data-slot="tooltip" className={cn('group relative inline-flex', className)} {...props}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 hidden max-w-[220px] -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[12px] leading-none text-[var(--text)] shadow-[var(--shadow)] group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}

export { Tooltip };
export type { TooltipProps };
