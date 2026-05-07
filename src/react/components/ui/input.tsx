import type { InputHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  'flex h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-[13px] text-[var(--text)] outline-none transition-[border-color,box-shadow,background] placeholder:text-[var(--muted)] read-only:opacity-85 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(110,168,255,.2)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[var(--danger)] aria-[invalid=true]:shadow-[0_0_0_3px_rgba(255,107,138,.14)] [&.is-invalid]:border-[var(--danger)] [&.is-invalid]:shadow-[0_0_0_3px_rgba(255,107,138,.14)] max-[640px]:px-3 max-[640px]:py-2.5 max-[640px]:text-[16px]',
  {
    variants: {
      density: {
        default: '',
        skuInline: 'pl-sku-inline-input min-h-[34px] rounded-[9px] border-[color-mix(in_srgb,var(--border)_82%,white)] bg-[color-mix(in_srgb,var(--panel2)_38%,white)] px-2.5 py-[7px] text-center shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition-[border-color,box-shadow,background,transform] placeholder:text-[color-mix(in_srgb,var(--muted)_78%,transparent)] hover:border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] hover:bg-[color-mix(in_srgb,var(--panel2)_28%,white)] focus:border-[color-mix(in_srgb,var(--accent)_78%,white)] focus:bg-[var(--panel)] focus:shadow-[0_0_0_3px_rgba(110,168,255,.12)] disabled:border-dashed disabled:bg-[color-mix(in_srgb,var(--panel2)_16%,white)] disabled:text-[var(--muted)] disabled:shadow-none [&.is-invalid]:border-[color-mix(in_srgb,var(--expense)_88%,white)] [&.is-invalid]:bg-[color-mix(in_srgb,var(--expense)_10%,white)] [&.is-invalid]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--expense)_16%,transparent)]'
      },
      tone: {
        default: '',
        readonly: 'border-[rgba(138,255,207,.42)] bg-[linear-gradient(180deg,rgba(138,255,207,.18),rgba(138,255,207,.08))] text-[18px] font-bold tracking-[.5px] text-[var(--accent2)] focus:border-[var(--accent2)] focus:shadow-[0_0_0_3px_rgba(138,255,207,.18)] max-[640px]:text-[19px]',
        primary: 'border-[rgba(255,200,87,.55)] bg-[linear-gradient(180deg,rgba(255,200,87,.18),rgba(255,200,87,.08))] text-[18px] font-bold tracking-[.5px] text-[var(--warn)] focus:border-[var(--warn)] focus:shadow-[0_0_0_3px_rgba(255,200,87,.22)] max-[640px]:text-[19px]',
        expense: 'border-[rgba(240,138,134,.48)] bg-[linear-gradient(180deg,rgba(240,138,134,.18),rgba(240,138,134,.08))] text-[18px] font-bold tracking-[.5px] text-[var(--expense)] focus:border-[var(--expense)] focus:shadow-[0_0_0_3px_rgba(240,138,134,.18)] max-[640px]:text-[19px]',
        success: 'border-[rgba(138,255,207,.42)] bg-[linear-gradient(180deg,rgba(138,255,207,.18),rgba(138,255,207,.08))] text-[18px] font-bold tracking-[.5px] text-[var(--accent2)] focus:border-[var(--accent2)] focus:shadow-[0_0_0_3px_rgba(138,255,207,.18)] max-[640px]:text-[19px]'
      }
    },
    defaultVariants: {
      density: 'default',
      tone: 'default'
    }
  }
);

type InputProps = InputHTMLAttributes<HTMLInputElement> & VariantProps<typeof inputVariants>;

function Input({ className, density = 'default', type = 'text', tone = 'default', ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ density, tone }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
export type { InputProps };
