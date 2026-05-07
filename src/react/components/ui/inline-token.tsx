import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type InlineTokenProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: 'kbd' | 'var';
};

const inlineTokenVariants = {
  kbd: 'inline-flex whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--panel2)] px-1.5 py-[3px] font-mono text-[11px] leading-none text-[var(--muted)] tabular-nums',
  var: 'inline-block whitespace-nowrap rounded-md border border-[rgba(110,168,255,.28)] bg-[rgba(110,168,255,.16)] px-[7px] py-[3px] font-mono text-[11px] leading-none text-[var(--accent)] tabular-nums'
};

function InlineToken({ className, variant = 'kbd', ...props }: InlineTokenProps) {
  return <span data-slot="inline-token" className={cn(inlineTokenVariants[variant], className)} {...props} />;
}

export { InlineToken };
