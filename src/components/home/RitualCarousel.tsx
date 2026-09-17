'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { TrendingCatalogProduct } from '@/lib/trending';

const DRAG_THRESHOLD_PX = 8;
const INTERACTIVE_SELECTOR = 'button, input, select, textarea, [data-no-nav]';

type DragState = {
  tracking: boolean;
  dragging: boolean;
  ignoreClick: boolean;
  startX: number;
  scrollLeft: number;
};

function createDragState(): DragState {
  return {
    tracking: false,
    dragging: false,
    ignoreClick: false,
    startX: 0,
    scrollLeft: 0,
  };
}

export function RitualCarousel({
  initialProducts = [],
}: {
  initialProducts?: TrendingCatalogProduct[];
}) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<TrendingCatalogProduct[]>(() =>
    initialProducts.filter((p) => Boolean(p.handle))
  );
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState>(createDragState());
  const ignoreClickTimer = useRef<number | null>(null);

  useEffect(() => {
    void fetch('/api/shopify/trending')
      .then((res) => res.json())
      .then((json: { products?: TrendingCatalogProduct[] }) => {
        setProducts((json.products || []).filter((p) => Boolean(p.handle)));
      })
      .catch(() => {
        /* keep SSR products if the client refresh fails */
      });

    return () => {
      if (ignoreClickTimer.current != null) {
        window.clearTimeout(ignoreClickTimer.current);
      }
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Touch keeps native overflow pan-x so a tap still reaches the product Link.
    if (e.pointerType === 'touch') return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest(INTERACTIVE_SELECTOR)) return;

    const el = scrollerRef.current;
    if (!el) return;
    drag.current = {
      tracking: true,
      dragging: false,
      ignoreClick: false,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = scrollerRef.current;
    const state = drag.current;
    if (!el || !state.tracking) return;

    const dx = e.clientX - state.startX;
    if (!state.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      state.dragging = true;
      el.setPointerCapture(e.pointerId);
    }

    el.scrollLeft = state.scrollLeft - dx;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (el && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }

    const state = drag.current;
    if (state.dragging) {
      state.ignoreClick = true;
      if (ignoreClickTimer.current != null) {
        window.clearTimeout(ignoreClickTimer.current);
      }
      ignoreClickTimer.current = window.setTimeout(() => {
        drag.current.ignoreClick = false;
        ignoreClickTimer.current = null;
      }, 400);
    }

    state.tracking = false;
    state.dragging = false;
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag.current.ignoreClick) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current.ignoreClick = false;
    if (ignoreClickTimer.current != null) {
      window.clearTimeout(ignoreClickTimer.current);
      ignoreClickTimer.current = null;
    }
  };

  if (products.length === 0) return null;

  return (
    <section className="relative overflow-x-clip pt-4 pb-8 sm:pt-6 sm:pb-10">
      <div className="glow-orb w-[420px] h-[420px] -right-24 top-10 opacity-45" aria-hidden />
      <div className="mx-auto mb-6 flex max-w-7xl items-end justify-between gap-6 px-4 sm:mb-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-meta tracking-[0.18em] uppercase text-layali-pink mb-3">
            {t.ritual.eyebrow}
          </p>
          <h2 className="font-serif text-heading-lg text-white mb-2">{t.ritual.title}</h2>
          <p className="text-body-lg text-white/60 max-w-xl">{t.ritual.subtitle}</p>
        </div>
        <Link
          href="/shop"
          prefetch
          className="hidden shrink-0 text-nav uppercase tracking-[0.12em] text-white/70 transition-colors hover:text-layali-pink-light sm:inline-flex"
        >
          {t.footer.allProducts}
        </Link>
      </div>

      <div
        ref={scrollerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
        className="flex max-w-full gap-4 overflow-x-auto overflow-y-clip px-4 sm:px-6 lg:px-8 pb-4 cursor-grab active:cursor-grabbing scrollbar-hide select-none [touch-action:pan-x_pan-y]"
        style={{ scrollbarWidth: 'none' }}
      >
        {products.map((product, i) => {
          const image = product.images?.[0] || product.image_url;
          const href = `/shop/${product.handle}`;
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}
              className="min-w-[240px] sm:min-w-[280px] max-w-[280px]"
            >
              <Link href={href} prefetch={false} className="block group">
                <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-layali-surface border border-white/8 mb-3">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      draggable={false}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-layali-pink/40 text-3xl">
                      ✦
                    </div>
                  )}
                </div>
                <p className="text-meta tracking-[0.14em] uppercase text-layali-pink mb-1">
                  {product.category}
                </p>
                <h3 className="text-product-name text-white line-clamp-2 group-hover:text-layali-pink-light transition-colors">
                  {product.name}
                </h3>
                <p className="text-price text-white/90 mt-1">
                  {formatPrice(Number(product.price))}
                </p>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
