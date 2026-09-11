'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Expand } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductImageGalleryProps {
  images: string[];
  alt: string;
}

export function ProductImageGallery({ images, alt }: ProductImageGalleryProps) {
  const photos = images.filter(Boolean);
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const hasMultiple = photos.length > 1;
  const current = photos[index] || null;

  const goPrev = useCallback(() => {
    if (!hasMultiple) return;
    setIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  }, [hasMultiple, photos.length]);

  const goNext = useCallback(() => {
    if (!hasMultiple) return;
    setIndex((i) => (i === photos.length - 1 ? 0 : i + 1));
  }, [hasMultiple, photos.length]);

  useEffect(() => {
    if (!lightboxOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [lightboxOpen, goPrev, goNext]);

  if (photos.length === 0) {
    return (
      <div className="aspect-square rounded-3xl bg-layali-surface flex items-center justify-center border border-white/10">
        <span className="text-6xl text-layali-pink/50">✦</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="relative aspect-square rounded-3xl overflow-hidden bg-layali-surface border border-white/10 group marble-rim">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 z-10"
            aria-label="View larger image"
          >
            <img
              src={current!}
              alt={`${alt} — photo ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </button>

          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute top-3 end-3 z-20 inline-flex items-center justify-center min-h-11 min-w-11 rounded-full bg-black/60 text-white border border-white/15 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur"
            aria-label="Open fullscreen"
          >
            <Expand className="w-4 h-4" />
          </button>

          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute start-3 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center min-h-11 min-w-11 rounded-full bg-black/60 text-white border border-white/15 shadow-md hover:border-layali-pink/50 backdrop-blur"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute end-3 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center min-h-11 min-w-11 rounded-full bg-black/60 text-white border border-white/15 shadow-md hover:border-layali-pink/50 backdrop-blur"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5 rtl:rotate-180" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-black/50 text-white text-xs">
                {index + 1} / {photos.length}
              </div>
            </>
          )}
        </div>

        {hasMultiple && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  'relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all',
                  i === index ? 'border-layali-black' : 'border-transparent opacity-70 hover:opacity-100'
                )}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
          <div className="flex items-center justify-between p-4 text-white">
            <p className="text-sm opacity-80">
              {alt} · {index + 1} / {photos.length}
            </p>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="p-2 rounded-full hover:bg-white/10"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center px-4 pb-6">
            {hasMultiple && (
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 sm:left-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 z-10"
                aria-label="Previous"
              >
                <ChevronLeft className="w-7 h-7" />
              </button>
            )}

            <img
              src={current!}
              alt={`${alt} — enlarged`}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            />

            {hasMultiple && (
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 sm:right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 z-10"
                aria-label="Next"
              >
                <ChevronRight className="w-7 h-7" />
              </button>
            )}
          </div>

          {hasMultiple && (
            <div className="flex justify-center gap-2 pb-6 px-4 overflow-x-auto">
              {photos.map((src, i) => (
                <button
                  key={`lb-${src}-${i}`}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    'w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2',
                    i === index ? 'border-white' : 'border-transparent opacity-60'
                  )}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
