import type { HTMLAttributes, ReactNode } from 'react';
import { Alert, AlertDescription, type AlertProps } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type HelpStackProps = AlertProps;

function HelpStack({ className, children, variant = 'info', ...props }: HelpStackProps) {
  return (
    <Alert variant={variant} className={cn('grid gap-3', className)} {...props}>
      <AlertDescription className="grid gap-3">
        {children}
      </AlertDescription>
    </Alert>
  );
}

type HelpItemProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  children: ReactNode;
};

function HelpItem({ className, label, children, ...props }: HelpItemProps) {
  return (
    <div className={cn('rounded-xl border border-[var(--border)] bg-[var(--panel2)] px-4 py-3.5', className)} {...props}>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[1px] text-[var(--muted)]">{label}</div>
      <div className="text-[13.5px] leading-[1.7] text-[var(--text)]">{children}</div>
    </div>
  );
}

export { HelpItem, HelpStack };
