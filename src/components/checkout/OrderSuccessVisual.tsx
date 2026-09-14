'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type DustSpec = {
  left: string;
  top: string;
  size: number;
  burstX: number;
  burstY: number;
  delay: number;
  duration: number;
  tone: 'gold' | 'rose' | 'ivory';
};

const DUST: DustSpec[] = [
  { left: '10%', top: '20%', size: 1.5, burstX: -12, burstY: -14, delay: 0.42, duration: 8.6, tone: 'gold' },
  { left: '84%', top: '16%', size: 2, burstX: 14, burstY: -10, delay: 0.5, duration: 9.2, tone: 'rose' },
  { left: '20%', top: '78%', size: 1.5, burstX: -8, burstY: 10, delay: 0.56, duration: 8, tone: 'ivory' },
  { left: '76%', top: '72%', size: 1.5, burstX: 10, burstY: 10, delay: 0.46, duration: 8.8, tone: 'gold' },
  { left: '48%', top: '6%', size: 1.5, burstX: 3, burstY: -16, delay: 0.6, duration: 8.4, tone: 'rose' },
];

const TONE = {
  gold: 'rgba(224, 201, 160, 0.85)',
  rose: 'rgba(245, 180, 190, 0.8)',
  ivory: 'rgba(255, 255, 255, 0.7)',
} as const;

function RosePetal({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const fillId = useId();
  return (
    <svg viewBox="0 0 36 52" className={className} style={style} fill="none" aria-hidden>
      <path
        d="M18 1.6C12 12 5.2 21 6.6 33.4C7.8 44.2 18 51 18 51s10.2-6.8 11.4-17.6C31 21 24 12 18 1.6Z"
        fill={`url(#${fillId})`}
      />
      <path
        d="M18 8c-2.4 8-4 16-3.2 24"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id={fillId} x1="18" y1="0" x2="18" y2="52">
          <stop offset="0%" stopColor="#f7c8d0" />
          <stop offset="48%" stopColor="#e07a8a" />
          <stop offset="100%" stopColor="#8a1a44" stopOpacity="0.5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function OrbitRing({
  width,
  height,
  tilt,
  opacity,
  reduceMotion,
  sweep = false,
}: {
  width: string;
  height: string;
  tilt: string;
  opacity: number;
  reduceMotion: boolean | null;
  sweep?: boolean;
}) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{
        width,
        height,
        marginLeft: `calc(${width} / -2)`,
        marginTop: `calc(${height} / -2)`,
        transform: tilt,
        transformStyle: 'preserve-3d',
        opacity,
      }}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity }}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.24, ease: [0.25, 0.1, 0.25, 1] }
      }
    >
      <div
        className="h-full w-full rounded-[50%]"
        style={{
          border: '1px solid rgba(245,180,190,0.38)',
          boxShadow: '0 0 14px rgba(212,46,124,0.16), inset 0 0 8px rgba(255,255,255,0.08)',
        }}
      />
      {sweep && !reduceMotion ? (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[50%]"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0 76%, rgba(255,236,220,0) 82%, rgba(255,236,220,0.95) 88%, rgba(245,180,190,0.75) 91%, transparent 96%)',
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 2.4px), #000 calc(100% - 1.2px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.4px), #000 calc(100% - 1.2px))',
          }}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ rotate: 360, opacity: [0.08, 0.5, 0.08] }}
          transition={{
            rotate: { duration: 22, delay: 0.34, repeat: Infinity, ease: 'linear' },
            opacity: { duration: 7.5, delay: 0.34, repeat: Infinity, ease: 'easeInOut' },
          }}
        />
      ) : null}
    </motion.div>
  );
}

/**
 * Immersive glass-orb hero for order success.
 * CSS + Framer Motion only — no 3D / canvas dependency.
 */
export function OrderSuccessVisual() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="relative mx-auto aspect-square w-[min(56vw,196px)] sm:w-[240px] lg:w-[300px] select-none"
      style={{ perspective: 700 }}
      aria-hidden
    >
      <div
        className="absolute left-1/2 top-[38%] h-[230%] w-[200%] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            'radial-gradient(ellipse at 50% 42%, rgba(212,46,124,0.24) 0%, rgba(160,30,72,0.1) 28%, rgba(72,10,32,0.04) 54%, transparent 74%)',
          filter: 'blur(34px)',
        }}
      />

      {DUST.map((spec, i) => (
        <motion.span
          key={`${spec.left}-${spec.top}-${i}`}
          className="absolute rounded-full"
          style={{
            left: spec.left,
            top: spec.top,
            width: spec.size,
            height: spec.size,
            background: TONE[spec.tone],
            boxShadow: `0 0 ${spec.size * 3}px ${TONE[spec.tone]}`,
          }}
          initial={reduceMotion ? false : { opacity: 0, x: 0, y: 0 }}
          animate={
            reduceMotion
              ? { opacity: 0.4 }
              : {
                  opacity: [0, 0.55, 0.22],
                  x: spec.burstX,
                  y: [spec.burstY, spec.burstY - 6, spec.burstY],
                }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  opacity: { duration: 1.1, delay: spec.delay },
                  x: { duration: 1.4, delay: spec.delay, ease: [0.22, 1, 0.36, 1] },
                  y: {
                    duration: spec.duration,
                    delay: spec.delay + 0.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }
          }
        />
      ))}

      <OrbitRing
        width="138%"
        height="40%"
        tilt="rotateX(68deg) rotateZ(-22deg)"
        opacity={0.92}
        reduceMotion={reduceMotion}
        sweep
      />
      <OrbitRing
        width="118%"
        height="32%"
        tilt="rotateX(64deg) rotateZ(16deg)"
        opacity={0.42}
        reduceMotion={reduceMotion}
      />

      <motion.div
        className="absolute inset-[10%] rounded-full"
        style={{
          background:
            'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, rgba(245,180,190,0.06) 40%, rgba(255,255,255,0.03) 100%)',
          border: '1px solid rgba(255,255,255,0.22)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -24px 40px rgba(212,46,124,0.18), 0 24px 56px rgba(0,0,0,0.35)',
        }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }
        }
      />

      {/* Translucent inner sphere + edge illumination */}
      <div
        className="absolute inset-[18%] rounded-full"
        style={{
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow:
            'inset 0 0 18px rgba(255,255,255,0.16), inset 0 -16px 28px rgba(212,46,124,0.22)',
        }}
      />

      {/* Internal luminous core — light originates inside the glass */}
      <motion.div
        className="absolute inset-[26%] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 48% 44%, rgba(255,236,240,0.96) 0%, rgba(255,176,196,0.72) 16%, rgba(212,46,124,0.78) 46%, rgba(92,12,40,0.72) 78%, rgba(18,6,12,0.45) 100%)',
          boxShadow:
            '0 0 36px rgba(212,46,124,0.4), inset 0 0 22px rgba(255,210,220,0.28)',
        }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.86 }}
        animate={
          reduceMotion
            ? { opacity: 1, scale: 1 }
            : { opacity: 1, scale: [1, 1.035, 1] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                opacity: { duration: 0.75, delay: 0.12 },
                scale: { duration: 6.8, delay: 0.12, repeat: Infinity, ease: 'easeInOut' },
              }
        }
      />

      <motion.div
        className="absolute inset-[38%] rounded-full mix-blend-screen"
        style={{
          background:
            'radial-gradient(circle, rgba(255,214,224,0.95) 0%, rgba(212,46,124,0.45) 42%, transparent 72%)',
          filter: 'blur(5px)',
        }}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={
          reduceMotion
            ? { opacity: 0.85 }
            : { opacity: [0.55, 0.95, 0.55] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 5.6, delay: 0.14, repeat: Infinity, ease: 'easeInOut' }
        }
      />

      <div
        className="absolute left-[30%] top-[24%] h-[14%] w-[22%] rounded-full"
        style={{
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.04) 100%)',
          filter: 'blur(1px)',
          opacity: 0.9,
        }}
      />

      <motion.div
        className="absolute right-[4%] top-[18%] h-[11%] w-[11%] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95) 0%, rgba(224,201,160,0.7) 46%, rgba(201,168,124,0.32) 100%)',
          boxShadow: '0 6px 16px rgba(201,168,124,0.3)',
        }}
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={
          reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, -7, 0] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                opacity: { duration: 0.6, delay: 0.28 },
                y: { duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
              }
        }
      />
    </div>
  );
}

export function OrderSuccessPetals({ reduceMotion }: { reduceMotion: boolean | null }) {
  const petals = [
    { left: '7%', top: '17%', size: 28, rotate: -26, delay: 0.5, duration: 14, blur: 1.8, opacity: 0.18, mobile: true },
    { left: '86%', top: '21%', size: 20, rotate: 20, delay: 0.7, duration: 16, blur: 2.6, opacity: 0.14, mobile: true },
    { left: '76%', top: '64%', size: 32, rotate: -14, delay: 0.6, duration: 15, blur: 2.2, opacity: 0.16, mobile: false },
    { left: '10%', top: '70%', size: 22, rotate: 28, delay: 0.85, duration: 17, blur: 2.8, opacity: 0.12, mobile: false },
  ] as const;

  return (
    <>
      {petals.map((petal) => (
        <motion.div
          key={`${petal.left}-${petal.top}`}
          className={petal.mobile ? 'absolute' : 'absolute hidden sm:block'}
          style={{
            left: petal.left,
            top: petal.top,
            width: petal.size,
            height: petal.size * 1.4,
            filter: `blur(${petal.blur}px)`,
          }}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={
            reduceMotion
              ? { opacity: petal.opacity, rotate: petal.rotate }
              : {
                  opacity: [petal.opacity * 0.7, petal.opacity, petal.opacity * 0.7],
                  y: [0, -11, 0],
                  x: [0, 6, 0],
                  rotate: [petal.rotate, petal.rotate + 6, petal.rotate],
                }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  duration: petal.duration,
                  delay: petal.delay,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
          }
        >
          <RosePetal className="h-full w-full" />
        </motion.div>
      ))}
    </>
  );
}

export function OrderSuccessDistantDust({ reduceMotion }: { reduceMotion: boolean | null }) {
  const motes = [
    { left: '18%', top: '28%', size: 1.5, delay: 0.8 },
    { left: '72%', top: '24%', size: 1, delay: 1.1 },
    { left: '42%', top: '58%', size: 1.5, delay: 0.9 },
    { left: '88%', top: '48%', size: 1, delay: 1.3 },
    { left: '12%', top: '52%', size: 1, delay: 1.0 },
    { left: '58%', top: '72%', size: 1.5, delay: 1.2 },
  ] as const;

  return (
    <>
      {motes.map((mote) => (
        <motion.span
          key={`${mote.left}-${mote.top}`}
          className="absolute rounded-full bg-layali-gold-light/50"
          style={{
            left: mote.left,
            top: mote.top,
            width: mote.size,
            height: mote.size,
            boxShadow: '0 0 6px rgba(224,201,160,0.35)',
          }}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={
            reduceMotion
              ? { opacity: 0.18 }
              : { opacity: [0.08, 0.22, 0.08], y: [0, -6, 0] }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 9, delay: mote.delay, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      ))}
    </>
  );
}
