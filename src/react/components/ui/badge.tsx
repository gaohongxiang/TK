import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex min-h-[22px] items-center rounded-full border border-[var(--border)] bg-[var(--panel2)] px-2.5 text-[12px] leading-none text-[var(--muted)]',
        className
      )}
      {...props}
    />
  );
}

export { Badge };
