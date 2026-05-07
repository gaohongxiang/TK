import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex min-h-[22px] items-center whitespace-nowrap rounded-full border px-2.5 text-[12px] leading-none',
  {
    variants: {
      variant: {
        default: 'border-[var(--border)] bg-[var(--panel2)] text-[var(--muted)]',
        success: 'border-[color-mix(in_srgb,var(--ok)_38%,var(--border))] bg-[color-mix(in_srgb,var(--ok)_12%,var(--panel))] text-[var(--ok)]',
        warning: 'border-[color-mix(in_srgb,var(--warn)_42%,var(--border))] bg-[color-mix(in_srgb,var(--warn)_12%,var(--panel))] text-[var(--warn)]',
        danger: 'border-[color-mix(in_srgb,var(--danger)_42%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--panel))] text-[var(--danger)]',
        accent: 'border-[color-mix(in_srgb,var(--accent)_36%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel))] text-[var(--accent)]',
        info: 'border-[color-mix(in_srgb,var(--accent)_36%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_12%,var(--panel))] text-[var(--accent)]'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

const badgeToneMap = {
  ok: 'success',
  success: 'success',
  warn: 'warning',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  muted: 'default'
} as const;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge };
export { badgeVariants };
export { badgeToneMap };
export type { BadgeProps };
