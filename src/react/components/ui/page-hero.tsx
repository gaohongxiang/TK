import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeroVariant = 'analytics' | 'calc' | 'collection' | 'finance' | 'orders' | 'products';

type PageHeroProps = HTMLAttributes<HTMLDivElement> & {
  description: ReactNode;
  kicker: ReactNode;
  title: ReactNode;
  variant: PageHeroVariant;
};

function PageHero({ className, description, kicker, title, variant, ...props }: PageHeroProps) {
  return (
    <div
      className={cn(
        'module-hero page-hero mx-auto flex max-w-[700px] items-start justify-center gap-[18px] px-0.5 text-center',
        variant === 'calc' ? 'page-hero-calc mb-[15px] max-[768px]:mb-6' : `page-hero-${variant} mb-[15px] max-[768px]:mb-[22px]`,
        className
      )}
      {...props}
    >
      <div className="module-hero-copy w-full">
        <div className="module-hero-title-row inline-flex flex-wrap items-baseline justify-center gap-2 max-[768px]:gap-1.5">
          <h2 className="m-0 text-[22px] leading-[1.14] tracking-normal max-[768px]:text-xl">{title}</h2>
          <div className="module-kicker inline-flex items-center justify-center text-[10px] font-bold uppercase tracking-[.18em] text-[color-mix(in_srgb,var(--accent)_88%,var(--text))] max-[768px]:tracking-[.12em]">{kicker}</div>
        </div>
        <p className="mx-auto mb-0 mt-2 max-w-[620px] text-[13px] leading-[1.72] text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}

export { PageHero };
export type { PageHeroProps, PageHeroVariant };
