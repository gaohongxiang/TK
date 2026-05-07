import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

function Select({ className, ...props }: SelectProps) {
  return (
    <select
      data-slot="select"
      className={cn(
        'h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--panel2)] px-3 text-[13px] text-[var(--text)] outline-none transition-[border-color,box-shadow,background] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(110,168,255,.2)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[var(--danger)]',
        className
      )}
      {...props}
    />
  );
}

export { Select };
export type { SelectProps };
