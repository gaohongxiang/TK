import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva('', {
  variants: {
    variant: {
      default: 'btn',
      primary: 'btn primary',
      danger: 'btn danger',
      accentSoft: 'btn accent-soft',
      plain: ''
    },
    size: {
      default: '',
      sm: 'sm',
      icon: 'icon-btn',
      smIcon: 'sm icon-btn'
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
