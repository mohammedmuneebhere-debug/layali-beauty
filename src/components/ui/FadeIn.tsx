'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export function FadeIn({ children, delay = 0, className, direction = 'up' }: FadeInProps) {
  const reduceMotion = useReducedMotion();
  const directions = {
    up: { y: 30, x: 0 },
    down: { y: -30, x: 0 },
    left: { x: 30, y: 0 },
    right: { x: -30, y: 0 },
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, ...directions[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: '0px 0px -10% 0px' }}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerContainer({
  children,
  className,
  remountKey,
}: {
  children: React.ReactNode;
  className?: string;
  /** Change this when content filters change so stagger re-animates cleanly */
  remountKey?: string | number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      key={remountKey}
      initial={reduceMotion ? false : 'hidden'}
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={{
        hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.5 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
