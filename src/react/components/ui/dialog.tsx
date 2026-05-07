import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DialogProps = HTMLAttributes<HTMLDivElement> & {
  open: boolean;
  titleId?: string;
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
};

function Dialog({ children, className, onOpenChange, open, titleId, ...props }: DialogProps) {
  return (
    <div
      data-slot="dialog"
      className={cn(
        'modal-mask fixed inset-0 z-[1000] hidden items-center justify-center bg-[rgba(5,8,24,.7)] p-4 backdrop-blur-[4px]',
        open ? 'show flex' : '',
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={event => {
        if (event.target === event.currentTarget) onOpenChange?.(false);
      }}
      {...props}
    >
      {children}
    </div>
  );
}

function DialogContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-content"
      className={cn(
        'modal w-full max-w-[720px] max-h-[92vh] overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)]',
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 data-slot="dialog-title" className={cn('m-0 mb-4 text-base font-semibold', className)} {...props} />;
}

export { Dialog, DialogContent, DialogTitle };
export type { DialogProps };
