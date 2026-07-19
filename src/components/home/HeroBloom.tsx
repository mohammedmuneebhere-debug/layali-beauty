'use client';

import { motion } from 'framer-motion';

const petals = [
  { rotate: 0, delay: 0 },
  { rotate: 45, delay: 0.08 },
  { rotate: 90, delay: 0.16 },
  { rotate: 135, delay: 0.24 },
  { rotate: 180, delay: 0.32 },
  { rotate: 225, delay: 0.4 },
  { rotate: 270, delay: 0.48 },
  { rotate: 315, delay: 0.56 },
];

const sparks = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x: 18 + ((i * 37) % 64),
  y: 12 + ((i * 53) % 76),
  size: 2 + (i % 4),
  delay: (i % 7) * 0.35,
  duration: 3.2 + (i % 5) * 0.4,
}));

export function HeroBloom() {
  return (
    <div className="relative aspect-square w-full max-w-lg mx-auto select-none" aria-hidden>
      {/* Outer magenta ring */}
      <motion.div
        className="absolute inset-[6%] rounded-full border border-layali-pink/30"
        style={{
          boxShadow:
            '0 0 40px rgba(212,46,124,0.25), inset 0 0 40px rgba(212,46,124,0.08)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
      />

      {/* Soft bloom core glow */}
      <motion.div
        className="absolute inset-[18%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(255,90,138,0.55) 0%, rgba(212,46,124,0.28) 35%, transparent 70%)',
          filter: 'blur(8px)',
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Petals blooming outward */}
      <div className="absolute inset-0 flex items-center justify-center">
        {petals.map((petal) => (
          <motion.div
            key={petal.rotate}
            className="absolute"
            style={{ rotate: petal.rotate }}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{
              scale: [0.55, 1, 0.85, 1],
              opacity: [0.35, 0.9, 0.7, 0.9],
            }}
            transition={{
              duration: 5.5,
              delay: petal.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <div
              className="w-16 h-28 sm:w-20 sm:h-36 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] origin-bottom"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,180,200,0.95) 0%, rgba(224,122,138,0.75) 40%, rgba(212,46,124,0.35) 75%, transparent 100%)',
                boxShadow: '0 0 24px rgba(212,46,124,0.35)',
                transform: 'translateY(-72px)',
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* Center bud */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 35% 30%, #fff5f8 0%, #ff5a8a 35%, #d42e7c 70%, #6b0f3a 100%)',
            boxShadow:
              '0 0 40px rgba(255,90,138,0.7), 0 0 80px rgba(212,46,124,0.4)',
          }}
        />
        <motion.span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90 text-xl sm:text-2xl"
          animate={{ opacity: [0.5, 1, 0.5], rotate: [0, 45, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        >
          ✦
        </motion.span>
      </motion.div>

      {/* Floating sparkles */}
      {sparks.map((s) => (
        <motion.span
          key={s.id}
          className="absolute rounded-full bg-layali-pink-light"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            boxShadow: '0 0 8px rgba(245,180,190,0.9)',
          }}
          animate={{
            y: [0, -18, 0],
            opacity: [0.15, 1, 0.15],
            scale: [0.6, 1.2, 0.6],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Orbiting ring dots */}
      <motion.div
        className="absolute inset-[12%]"
        animate={{ rotate: -360 }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
      >
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-layali-magenta shadow-[0_0_12px_rgba(255,45,111,0.8)]" />
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-layali-pink shadow-[0_0_12px_rgba(224,122,138,0.8)]" />
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-layali-pink-light shadow-[0_0_12px_rgba(245,180,190,0.8)]" />
        <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-layali-magenta shadow-[0_0_12px_rgba(255,45,111,0.8)]" />
      </motion.div>

      {/* Pedestal glow hint */}
      <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 w-[55%] h-3 rounded-full bg-layali-pink-glow/40 blur-md" />
      <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[40%] h-px bg-gradient-to-r from-transparent via-layali-pink to-transparent" />
    </div>
  );
}
