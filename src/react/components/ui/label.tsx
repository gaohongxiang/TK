import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

function Label({ className, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn('mb-1.5 block text-[12.5px] font-semibold text-[var(--muted)]', className)}
      {...props}
    />
  );
}

export { Label };
export type { LabelProps };
