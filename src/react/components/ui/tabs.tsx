import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="tabs" className={cn('flex min-w-0 items-center gap-2', className)} {...props} />;
}

function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="tabs-list" className={cn('flex min-w-0 items-center gap-2', className)} {...props} />;
}

const tabTriggerVariants = cva(
  'inline-flex min-h-[30px] items-center justify-center gap-1 rounded-full border px-3 text-[12.5px] leading-none transition-[background,border-color,color] disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      active: {
        true: 'border-[color-mix(in_srgb,var(--accent)_62%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_14%,var(--panel))] text-[var(--text)]',
        false: 'border-[var(--border)] bg-transparent text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
      }
    },
    defaultVariants: {
      active: false
    }
  }
);

type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof tabTriggerVariants>;

function TabsTrigger({ active, className, type = 'button', ...props }: TabsTriggerProps) {
  return (
    <button
      type={type}
      data-slot="tabs-trigger"
      data-state={active ? 'active' : 'inactive'}
      className={cn(tabTriggerVariants({ active }), className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger };
export { tabTriggerVariants };
export type { TabsTriggerProps };
