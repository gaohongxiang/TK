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
      className={cn('modal-mask', open ? 'show' : '', className)}
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
  return <div className={cn('modal', className)} {...props} />;
}

function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn(className)} {...props} />;
}

export { Dialog, DialogContent, DialogTitle };
export type { DialogProps };
