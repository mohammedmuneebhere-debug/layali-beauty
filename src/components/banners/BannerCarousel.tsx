'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BannerSlide } from '@/lib/banners';
import { BANNER_SIZES } from '@/lib/banners';
import { isExternalHref, normalizeAppHref } from '@/lib/navigation';

type Props = {
  slides: BannerSlide[];
  className?: string;
  aspectClass?: string;
  autoPlayMs?: number;
  rounded?: string;
  showArrows?: boolean;
};

function BannerMedia({ slide, priority = false }: { slide: BannerSlide; priority?: boolean }) {
  const size = BANNER_SIZES[slide.src];
  const width = slide.width || size?.w || 2400;
  const height = slide.height || size?.h || 400;
  const img = (
    // Native img keeps true pixel aspect — Next/Image width/height was squashing banners
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={slide.src}
      alt={slide.alt}
      width={width}
      height={height}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      className="block w-full h-auto max-w-full"
      style={{ aspectRatio: `${width} / ${height}` }}
      draggable={false}
    />
  );

  const href = normalizeAppHref(slide.href);
  if (href) {
    if (isExternalHref(href)) {
      return (
        <a href={href} className="block w-full" aria-label={slide.alt} rel="noopener noreferrer">
          {img}
        </a>
      );
    }
    return (
      <Link href={href} prefetch className="block w-full" aria-label={slide.alt}>
        {img}
      </Link>
    );
  }
  return img;
}

export function BannerCarousel({
  slides,
  className,
  autoPlayMs = 5500,
  rounded = 'rounded-2xl',
  showArrows = true,
}: Props) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  const go = useCallback(
    (dir: 1 | -1) => {
      setIndex((i) => (i + dir + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (count <= 1 || autoPlayMs <= 0) return;
    const id = window.setInterval(() => go(1), autoPlayMs);
    return () => window.clearInterval(id);
  }, [count, autoPlayMs, go, index]);

  useEffect(() => {
    slides.forEach((s) => {
      const el = new window.Image();
      el.src = s.src;
    });
  }, [slides]);

  if (count === 0) return null;

  const slide = slides[index];

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden group bg-[#1a1014] border border-layali-pink/15',
        rounded,
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={slide.src}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          <BannerMedia slide={slide} priority={index === 0} />
        </motion.div>
      </AnimatePresence>

      {showArrows && count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            aria-label="Previous banner"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            aria-label="Next banner"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {count > 1 && (
        <div className="absolute bottom-2.5 inset-x-0 z-10 flex justify-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={`${s.src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-6 bg-layali-pink' : 'w-1.5 bg-white/40 hover:bg-white/70'
              )}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BannerImage({
  slide,
  className,
  rounded = 'rounded-2xl',
}: {
  slide: BannerSlide;
  className?: string;
  aspectClass?: string;
  rounded?: string;
}) {
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-[#1a1014] border border-layali-pink/15',
        rounded,
        className
      )}
    >
      <BannerMedia slide={slide} />
    </div>
  );
}
