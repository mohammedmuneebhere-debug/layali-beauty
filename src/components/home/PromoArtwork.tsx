'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

type PromoArtworkProps = {
  src: string;
  alt: string;
  href: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
};

/**
 * Clickable campaign artwork only — no overlays, no CTA HTML on the creative.
 * Preserves intrinsic aspect ratio; soft rounded corners match Layali merch tiles.
 */
export function PromoArtwork({
  src,
  alt,
  href,
  width,
  height,
  priority = false,
  className,
}: PromoArtworkProps) {
  return (
    <Link
      href={href}
      prefetch
      className={cn(
        'group block w-full overflow-hidden rounded-md focus-ring transition-opacity duration-300 hover:opacity-[0.96]',
        className
      )}
      aria-label={alt}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        draggable={false}
        className="block h-auto w-full max-w-full object-contain"
        style={{ aspectRatio: `${width} / ${height}` }}
      />
    </Link>
  );
}
