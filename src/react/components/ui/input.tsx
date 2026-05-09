import type { InputHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  'flex min-h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--panel2)] px-3 py-2.5 text-[13px] text-[var(--text)] outline-none transition-[border-color,box-shadow,background] placeholder:text-[var(--muted)] read-only:opacity-90 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(110,168,255,.2)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[var(--danger)] aria-[invalid=true]:shadow-[0_0_0_3px_rgba(255,107,138,.14)] [&.is-invalid]:border-[var(--danger)] [&.is-invalid]:shadow-[0_0_0_3px_rgba(255,107,138,.14)] max-[640px]:px-3 max-[640px]:py-2.5 max-[640px]:text-[16px]',
  {
    variants: {
      density: {
        default: '',
        skuInline: 'pl-sku-inline-input min-h-[34px] rounded-[9px] border-[color-mix(in_srgb,var(--border)_82%,white)] bg-[color-mix(in_srgb,var(--panel2)_38%,white)] px-2.5 py-[7px] text-center shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition-[border-color,box-shadow,background,transform] placeholder:text-[color-mix(in_srgb,var(--muted)_78%,transparent)] hover:border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] hover:bg-[color-mix(in_srgb,var(--panel2)_28%,white)] focus:border-[color-mix(in_srgb,var(--accent)_78%,white)] focus:bg-[var(--panel)] focus:shadow-[0_0_0_3px_rgba(110,168,255,.12)] disabled:border-dashed disabled:bg-[color-mix(in_srgb,var(--panel2)_16%,white)] disabled:text-[var(--muted)] disabled:shadow-none [&.is-invalid]:border-[color-mix(in_srgb,var(--expense)_88%,white)] [&.is-invalid]:bg-[color-mix(in_srgb,var(--expense)_10%,white)] [&.is-invalid]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--expense)_16%,transparent)]'
      },
      tone: {
        default: '',
        readonly: 'min-h-[48px] border-[color-mix(in_srgb,var(--ok)_42%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--ok)_13%,white),color-mix(in_srgb,var(--ok)_4%,var(--panel)))] text-[18px] font-bold tracking-[.5px] text-[color-mix(in_srgb,var(--ok)_88%,#0b6f50)] shadow-[inset_0_1px_0_rgba(255,255,255,.75)] focus:border-[color-mix(in_srgb,var(--ok)_64%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ok)_18%,transparent)] max-[640px]:text-[18px]',
        primary: 'min-h-[48px] border-[color-mix(in_srgb,var(--warn)_44%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--warn)_15%,white),color-mix(in_srgb,var(--warn)_5%,var(--panel)))] text-[18px] font-bold tracking-[.5px] text-[color-mix(in_srgb,var(--warn)_86%,#7a5200)] shadow-[inset_0_1px_0_rgba(255,255,255,.75)] focus:border-[color-mix(in_srgb,var(--warn)_68%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--warn)_20%,transparent)] max-[640px]:text-[18px]',
        expense: 'min-h-[48px] border-[color-mix(in_srgb,var(--expense)_42%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--expense)_13%,white),color-mix(in_srgb,var(--expense)_4%,var(--panel)))] text-[18px] font-bold tracking-[.5px] text-[color-mix(in_srgb,var(--expense)_88%,#8a2434)] shadow-[inset_0_1px_0_rgba(255,255,255,.75)] focus:border-[color-mix(in_srgb,var(--expense)_62%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--expense)_18%,transparent)] max-[640px]:text-[18px]',
        success: 'min-h-[48px] border-[color-mix(in_srgb,var(--ok)_42%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--ok)_13%,white),color-mix(in_srgb,var(--ok)_4%,var(--panel)))] text-[18px] font-bold tracking-[.5px] text-[color-mix(in_srgb,var(--ok)_88%,#0b6f50)] shadow-[inset_0_1px_0_rgba(255,255,255,.75)] focus:border-[color-mix(in_srgb,var(--ok)_64%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ok)_18%,transparent)] max-[640px]:text-[18px]'
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
