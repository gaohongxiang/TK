import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

type FormFieldProps = HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  full?: boolean;
};

function FormField({ className, label, htmlFor, hint, full = false, children, style, ...props }: FormFieldProps) {
  return (
    <div
      data-slot="form-field"
      className={cn('field flex min-w-0 flex-col gap-2', full && 'full col-span-full', className)}
      style={style}
      {...props}
    >
      {label ? (
        <Label htmlFor={htmlFor} className="mb-0 flex min-h-[18px] flex-wrap items-center gap-1.5 leading-[1.3] text-[12.5px] font-normal text-[var(--muted)]">
          {label}
        </Label>
      ) : null}
      {children}
      {hint ? <div data-slot="form-field-hint" className="hint text-[11.5px] leading-[1.4] text-[var(--muted)] opacity-85">{hint}</div> : null}
    </div>
  );
}

export { FormField };
export type { FormFieldProps };
