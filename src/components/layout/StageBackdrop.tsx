'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const STAGES = [
  '/backgrounds/stage-arch.png',
  '/backgrounds/stage-velvet.png',
  '/backgrounds/stage-circle.png',
  '/backgrounds/stage-neon.png',
] as const;

const HIDDEN_PREFIXES = ['/admin', '/auth/admin'];

/**
 * Fixed luxury stage backdrops — content glides over them while scrolling.
 * Only the active stage image is mounted to cut bandwidth and paint cost.
 */
export function StageBackdrop() {
  const pathname = usePathname();
  const [index, setIndex] = useState(0);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (hidden) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const doc = document.documentElement;
        const max = Math.max(doc.scrollHeight - window.innerHeight, 1);
        const progress = window.scrollY / max;
        const next = Math.min(STAGES.length - 1, Math.floor(progress * STAGES.length));
        setIndex(next);
        ticking = false;
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hidden, pathname]);

  useEffect(() => {
    if (hidden) return;
    const id = window.setInterval(() => {
      if (window.scrollY < 120) {
        setIndex((i) => (i + 1) % STAGES.length);
      }
    }, 12000);
    return () => window.clearInterval(id);
  }, [hidden]);

  // Prefetch next stage lightly
  useEffect(() => {
    if (hidden || typeof window === 'undefined') return;
    const next = STAGES[(index + 1) % STAGES.length];
    const img = new window.Image();
    img.src = next;
  }, [index, hidden]);

  if (!mounted || hidden) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-black" />

      <AnimatePresence mode="sync">
        <motion.div
          key={STAGES[index]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={STAGES[index]}
            alt=""
            decoding="async"
            fetchPriority={index === 0 ? 'high' : 'low'}
            className="h-full w-full object-cover object-center scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
