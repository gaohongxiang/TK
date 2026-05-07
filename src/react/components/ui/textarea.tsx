import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-24 w-full rounded-[10px] border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-[13px] text-[var(--text)] outline-none transition-[border-color,box-shadow,background] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(110,168,255,.2)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[var(--danger)] max-[640px]:text-[16px]',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
export type { TextareaProps };
