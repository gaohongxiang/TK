import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-[13px] text-[var(--text)] outline-none transition-[border-color,box-shadow,background] placeholder:text-[var(--muted)] read-only:opacity-85 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(110,168,255,.2)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[var(--danger)] aria-[invalid=true]:shadow-[0_0_0_3px_rgba(255,107,138,.14)] [&.is-invalid]:border-[var(--danger)] [&.is-invalid]:shadow-[0_0_0_3px_rgba(255,107,138,.14)]',
        className
      )}
      {...props}
    />
  );
}

export { Input };
export type { InputProps };
