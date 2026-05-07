import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'rounded-[12px] border px-3.5 py-3 text-[13px] leading-relaxed',
  {
    variants: {
      variant: {
        default: 'border-[var(--border)] bg-[var(--panel2)] text-[var(--text)]',
        info: 'border-[color-mix(in_srgb,var(--accent)_34%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel))] text-[var(--text)]',
        success: 'border-[color-mix(in_srgb,var(--ok)_34%,var(--border))] bg-[color-mix(in_srgb,var(--ok)_10%,var(--panel))] text-[var(--text)]',
        warning: 'border-[color-mix(in_srgb,var(--warn)_40%,var(--border))] bg-[color-mix(in_srgb,var(--warn)_12%,var(--panel))] text-[var(--text)]',
        danger: 'border-[color-mix(in_srgb,var(--danger)_42%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--panel))] text-[var(--text)]'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

type AlertProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>;

function Alert({ className, variant, ...props }: AlertProps) {
  return <div data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="alert-title" className={cn('mb-1 font-semibold text-[var(--text)]', className)} {...props} />;
}

function AlertDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="alert-description" className={cn('text-[var(--muted)]', className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
export { alertVariants };
export type { AlertProps };
