'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { TrendingCatalogProduct } from '@/lib/trending';

export function RitualCarousel() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<TrendingCatalogProduct[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    void fetch('/api/shopify/trending')
      .then((res) => res.json())
      .then((json: { products?: TrendingCatalogProduct[] }) => {
        setProducts(json.products || []);
      })
      .catch(() => setProducts([]));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    el.scrollLeft = drag.current.scrollLeft - dx;
  };

  const endDrag = () => {
    drag.current.active = false;
  };

  if (products.length === 0) return null;

  return (
    <section className="py-20 section-glide relative overflow-hidden border-t border-layali-pink/10">
      <div className="glow-orb w-[420px] h-[420px] -right-24 top-10 opacity-45" aria-hidden />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <p className="text-eyebrow tracking-[0.28em] uppercase text-layali-pink mb-3">
          {t.ritual.eyebrow}
        </p>
        <h2 className="font-serif text-heading-lg text-white mb-3">{t.ritual.title}</h2>
        <p className="text-body-lg text-white/60 max-w-xl">{t.ritual.subtitle}</p>
        <p className="mt-6 text-eyebrow tracking-[0.22em] uppercase text-white/40">
          III · {t.ritual.drag}
        </p>
      </div>

      <div
        ref={scrollerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex gap-4 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-4 cursor-grab active:cursor-grabbing scrollbar-hide select-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {products.map((product, i) => {
          const image = product.images?.[0] || product.image_url;
          const href = `/shop/${product.handle || product.id}`;
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}
              className="min-w-[240px] sm:min-w-[280px] max-w-[280px]"
            >
              <Link href={href} prefetch className="block group">
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
                <p className="text-eyebrow tracking-[0.2em] uppercase text-layali-pink mb-1">
                  {product.category}
                </p>
                <h3 className="font-serif text-heading-sm text-white line-clamp-2 group-hover:text-layali-pink-light transition-colors">
                  {product.name}
                </h3>
                <p className="font-serif text-heading-sm text-white/90 mt-1">
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
