import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      data-slot="card"
      className={cn(
        'card min-w-0 max-w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow)] max-[768px]:rounded-xl max-[768px]:p-4',
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex items-center justify-between gap-3', className)} {...props} />;
}

function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('mb-4 mt-0 flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[.3px] text-[var(--muted)] max-[768px]:mb-3.5 max-[768px]:text-[13px]', className)} {...props} />;
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...props} />;
}

export { Card, CardContent, CardHeader, CardTitle };
