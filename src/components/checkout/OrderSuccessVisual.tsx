'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Premium glass orb centerpiece for order success.
 * CSS + framer-motion only — no 3D framework dependency.
 */
export function OrderSuccessVisual() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="relative mx-auto aspect-square w-[min(72vw,220px)] sm:w-[240px] select-none"
      aria-hidden
    >
      {/* Soft ambient glow */}
      <div
        className="absolute inset-[-12%] rounded-full opacity-80"
        style={{
          background:
            'radial-gradient(circle, rgba(212,46,124,0.28) 0%, rgba(224,122,138,0.12) 42%, transparent 70%)',
          filter: 'blur(18px)',
        }}
      />

      {/* Outer glass ring */}
      <motion.div
        className="absolute inset-[4%] rounded-full border border-white/15"
        style={{
          background:
            'linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(245,180,190,0.06) 40%, rgba(255,255,255,0.02) 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -20px 40px rgba(212,46,124,0.08), 0 20px 50px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(10px)',
        }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.88 }}
        animate={
          reduceMotion
            ? { opacity: 1, scale: 1 }
            : { opacity: 1, scale: 1, rotate: [0, 2.5, -1.5, 0] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                opacity: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] },
                scale: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] },
                rotate: { duration: 14, repeat: Infinity, ease: 'easeInOut' },
              }
        }
      />

      {/* Inner luminous core */}
      <motion.div
        className="absolute inset-[22%] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55) 0%, rgba(245,180,190,0.35) 28%, rgba(212,46,124,0.45) 58%, rgba(10,10,10,0.4) 100%)',
          boxShadow:
            '0 0 40px rgba(212,46,124,0.35), inset 0 0 24px rgba(255,255,255,0.15)',
        }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.75 }}
        animate={
          reduceMotion
            ? { opacity: 1, scale: 1 }
            : { opacity: 1, scale: [1, 1.04, 1], y: [0, -6, 0] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                opacity: { duration: 0.8, delay: 0.08 },
                scale: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' },
                y: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' },
              }
        }
      />

      {/* Specular highlight */}
      <div
        className="absolute left-[28%] top-[24%] h-[18%] w-[28%] rounded-full"
        style={{
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.05) 100%)',
          filter: 'blur(1px)',
          opacity: 0.85,
        }}
      />

      {/* Floating beauty ribbon — left */}
      <motion.div
        className="absolute left-[2%] top-[38%] h-[42%] w-[18%] rounded-[60%_40%_55%_45%/50%_55%_45%_50%]"
        style={{
          background:
            'linear-gradient(180deg, rgba(245,180,190,0.55) 0%, rgba(224,122,138,0.28) 55%, transparent 100%)',
          boxShadow: '0 8px 24px rgba(212,46,124,0.18)',
          transform: 'rotate(-18deg)',
        }}
        initial={reduceMotion ? false : { opacity: 0, x: -12 }}
        animate={
          reduceMotion
            ? { opacity: 0.9, x: 0 }
            : { opacity: 0.9, x: 0, y: [0, -8, 0] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                opacity: { duration: 0.7, delay: 0.15 },
                x: { duration: 0.7, delay: 0.15 },
                y: { duration: 6.5, repeat: Infinity, ease: 'easeInOut' },
              }
        }
      />

      {/* Floating pearl — right */}
      <motion.div
        className="absolute right-[6%] top-[22%] h-[14%] w-[14%] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0%, rgba(224,201,160,0.65) 45%, rgba(201,168,124,0.35) 100%)',
          boxShadow: '0 6px 18px rgba(201,168,124,0.28)',
        }}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={
          reduceMotion
            ? { opacity: 1, y: 0 }
            : { opacity: 1, y: [0, -10, 0] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                opacity: { duration: 0.65, delay: 0.22 },
                y: { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.4 },
              }
        }
      />

      {/* Soft petal shard — bottom */}
      <motion.div
        className="absolute bottom-[8%] left-1/2 h-[20%] w-[36%] -translate-x-1/2 rounded-[50%_50%_45%_45%/70%_70%_30%_30%]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,90,138,0.35) 0%, rgba(212,46,124,0.12) 70%, transparent 100%)',
          filter: 'blur(0.5px)',
        }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
        animate={
          reduceMotion
            ? { opacity: 0.85, scale: 1 }
            : { opacity: 0.85, scale: [1, 1.06, 1] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                opacity: { duration: 0.7, delay: 0.28 },
                scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
              }
        }
      />
    </div>
  );
}
