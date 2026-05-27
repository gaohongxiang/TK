import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeroVariant = 'analytics' | 'calc' | 'collection' | 'finance' | 'orders' | 'products';

type PageHeroProps = HTMLAttributes<HTMLDivElement> & {
  description: ReactNode;
  title: ReactNode;
  variant: PageHeroVariant;
};

function PageHero({ className, description, title, variant, ...props }: PageHeroProps) {
  return (
    <div
      className={cn(
        'module-hero page-hero mx-auto grid max-w-none gap-1.5 px-0.5 text-left',
        variant === 'calc' ? 'page-hero-calc mb-[12px] max-[768px]:mb-4' : `page-hero-${variant} mb-[12px] max-[768px]:mb-4`,
        className
      )}
      {...props}
    >
      <div className="module-hero-copy min-w-0">
        <div className="module-hero-title-row inline-flex flex-wrap items-center gap-2 max-[768px]:gap-1.5">
          <h2 className="m-0 text-[20px] leading-[1.16] tracking-normal max-[768px]:text-[18px]">{title}</h2>
        </div>
        <p className="mb-0 mt-1.5 max-w-[900px] text-[13px] leading-[1.72] text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}

export { PageHero };
export type { PageHeroProps, PageHeroVariant };
