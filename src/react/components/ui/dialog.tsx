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
        'fixed inset-0 z-[1000] items-center justify-center overflow-y-auto bg-[rgba(5,8,24,.7)] p-4 backdrop-blur-[4px] max-[768px]:items-start max-[768px]:px-2.5 max-[768px]:pb-7 max-[768px]:pt-3',
        open ? 'flex' : 'hidden',
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
        'w-full max-w-[720px] max-h-[92vh] overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)] max-[768px]:max-h-none max-[768px]:px-4 max-[768px]:pb-5 max-[768px]:pt-[18px]',
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 data-slot="dialog-title" className={cn('m-0 mb-4 text-base font-semibold', className)} {...props} />;
}

function DialogActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-actions"
      className={cn(
        'mt-5 flex justify-end gap-2 max-[768px]:sticky max-[768px]:bottom-0 max-[768px]:z-[2] max-[768px]:mx-[-16px] max-[768px]:mb-[-20px] max-[768px]:mt-[18px] max-[768px]:border-t max-[768px]:border-[var(--border)] max-[768px]:bg-[color-mix(in_srgb,var(--panel)_96%,transparent)] max-[768px]:px-4 max-[768px]:pb-3.5 max-[768px]:pt-3',
        className
      )}
      {...props}
    />
  );
}

export { Dialog, DialogActions, DialogContent, DialogTitle };
export type { DialogProps };
