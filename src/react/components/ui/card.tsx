import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      data-slot="card"
      className={cn(
        'card rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow)]',
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
  return <h2 className={cn('m-0 text-[14px] font-semibold text-[var(--muted)]', className)} {...props} />;
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...props} />;
}

export { Card, CardContent, CardHeader, CardTitle };
