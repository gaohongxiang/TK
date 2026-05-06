import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva('', {
  variants: {
    variant: {
      default: 'btn border border-[var(--border)] bg-[var(--panel2)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
      primary: 'btn primary border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--text)]',
      danger: 'btn danger border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white',
      accentSoft: 'btn accent-soft border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_12%,var(--panel))]',
      plain: ''
    },
    size: {
      default: '',
      sm: 'sm text-[12.5px]',
      icon: 'icon-btn inline-flex items-center justify-center',
      smIcon: 'sm icon-btn inline-flex items-center justify-center'
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
  return <Comp className={cn(buttonVariants({ size, variant }), className)} type={asChild ? undefined : type} {...props} />;
}

export { Button };
export { buttonVariants };
export type { ButtonProps };
