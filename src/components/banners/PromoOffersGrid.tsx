'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { BannerSlide } from '@/lib/banners';
import { BANNER_SIZES } from '@/lib/banners';
import { isExternalHref, normalizeAppHref } from '@/lib/navigation';

type GridItem = BannerSlide & {
  /** full = one row; half = side-by-side tile */
  span: 'full' | 'half';
};

function Tile({
  item,
  className,
}: {
  item: GridItem;
  className?: string;
}) {
  const size = BANNER_SIZES[item.src];
  const width = item.width || size?.w || 1600;
  const height = item.height || size?.h || 900;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.src}
      alt={item.alt}
      width={width}
      height={height}
      decoding="async"
      loading="lazy"
      className="block w-full h-auto max-w-full"
      style={{ aspectRatio: `${width} / ${height}` }}
      draggable={false}
    />
  );

  const shell = (
    <div
      className={cn(
        'overflow-hidden rounded-2xl bg-white/95 shadow-[0_8px_28px_rgba(0,0,0,0.28)] border border-white/20',
        className
      )}
    >
      {img}
    </div>
  );

  const href = normalizeAppHref(item.href);
  if (href) {
    if (isExternalHref(href)) {
      return (
        <a href={href} className="block" aria-label={item.alt} rel="noopener noreferrer">
          {shell}
        </a>
      );
    }
    return (
      <Link href={href} prefetch className="block" aria-label={item.alt}>
        {shell}
      </Link>
    );
  }
  return shell;
}

/** Marketplace-style promo grid: wide / 2-up / 2-up / wide / 2-up — no cropping */
export function PromoOffersGrid({
  items,
  className,
}: {
  items: GridItem[];
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', className)}>
      {items.map((item, index) => (
        <div
          key={`${item.src}-${index}`}
          className={item.span === 'full' ? 'col-span-2' : 'col-span-1'}
        >
          <Tile item={item} />
        </div>
      ))}
    </div>
  );
}
