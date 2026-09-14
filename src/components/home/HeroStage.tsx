'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import type { CatalogProduct } from '@/lib/shopify/normalize';
import { shopifyImageUrl } from '@/lib/shopify/image';

const PLACEMENTS = [
  { className: 'top-[8%] end-[4%] w-[38%] max-w-[240px] rotate-[-8deg]', delay: 0 },
  { className: 'bottom-[10%] end-[18%] w-[32%] max-w-[200px] rotate-[7deg]', delay: 0.12 },
  { className: 'top-[38%] end-[36%] w-[24%] max-w-[150px] rotate-[-3deg]', delay: 0.2 },
];

export function HeroStage({ products }: { products: CatalogProduct[] }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 80, damping: 20 });
  const sy = useSpring(y, { stiffness: 80, damping: 20 });
  const rotateX = useTransform(sy, [-40, 40], [6, -6]);
  const rotateY = useTransform(sx, [-40, 40], [-8, 8]);

  const shots = products.filter((p) => p.image_url).slice(0, 3);

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(((event.clientX - rect.left) / rect.width - 0.5) * 48);
    y.set(((event.clientY - rect.top) / rect.height - 0.5) * 48);
  };

  if (shots.length === 0) {
    return (
      <div className="relative mx-auto aspect-square w-full max-w-lg" aria-hidden>
        <div className="glow-orb inset-8 opacity-60" />
        <div className="absolute inset-[18%] rounded-full border border-layali-gold/20" />
        <div className="absolute inset-[30%] rounded-full bg-gradient-to-b from-layali-ivory/10 to-transparent" />
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={reduceMotion ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
      className="relative mx-auto aspect-square w-full max-w-lg"
      aria-hidden
    >
      <div className="glow-orb left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 opacity-50" />
      {shots.map((product, index) => {
        const src = shopifyImageUrl(product.image_url, 720);
        const place = PLACEMENTS[index] || PLACEMENTS[0];
        return (
          <motion.div
            key={product.id}
            className={`absolute ${place.className} overflow-hidden rounded-[1.6rem] product-frame shadow-[0_24px_60px_rgba(0,0,0,0.45)]`}
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: place.delay, duration: 0.7 }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="aspect-[4/5] w-full object-cover" />
            ) : null}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
