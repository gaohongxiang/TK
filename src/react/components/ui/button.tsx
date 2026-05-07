import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva('', {
  variants: {
    variant: {
      default: 'border border-[var(--border)] bg-[var(--panel2)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
      primary: 'border border-transparent bg-[var(--accent)] font-semibold text-white hover:brightness-110',
      danger: 'border border-[var(--danger)] bg-transparent text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white',
      accentSoft: 'border border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_12%,var(--panel))] font-semibold text-[color-mix(in_srgb,var(--accent)_82%,var(--text))] hover:border-[color-mix(in_srgb,var(--accent)_42%,var(--border))] hover:bg-[color-mix(in_srgb,var(--accent)_20%,var(--panel))]',
      ghost: 'border border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--text)]',
      plain: 'appearance-none border-0 bg-transparent p-0 text-[inherit] shadow-none'
    },
    size: {
      none: '',
      default: 'min-h-9 px-3.5 py-2 text-[13px]',
      sm: 'min-h-[30px] px-[11px] py-[5px] text-[12.5px]',
      icon: 'h-8 w-8 p-0',
      smIcon: 'h-8 w-8 p-0'
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'default'
  }
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & {
  asChild?: boolean;
};

function Button({ asChild = false, className, size, type = 'button', variant, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  const resolvedSize = variant === 'plain' && !size ? 'none' : size;
  return (
    <Comp
      data-slot="button"
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] text-[inherit] leading-none transition-[background,border-color,color,filter,box-shadow] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(110,168,255,.22)] disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0',
        buttonVariants({ size: resolvedSize, variant }),
        className
      )}
      type={asChild ? undefined : type}
      {...props}
    />
  );
}

export { Button };
export { buttonVariants };
export type { ButtonProps };
