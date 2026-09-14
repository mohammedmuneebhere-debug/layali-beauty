'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

/**
 * Compact connected journey. Only the first state is current —
 * later states are muted and do not imply shipment has started.
 */
export function OrderSuccessJourney() {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  const steps = [
    { id: 'confirmed', label: t.checkout.journeyConfirmed, current: true },
    { id: 'preparing', label: t.checkout.journeyPreparing, current: false },
    { id: 'out', label: t.checkout.journeyOutForDelivery, current: false },
    { id: 'delivered', label: t.checkout.journeyDelivered, current: false },
  ] as const;

  return (
    <nav aria-label={t.checkout.journeyLabel} className="w-full">
      <ol className="relative grid grid-cols-4">
        <span
          className="pointer-events-none absolute start-[12.5%] end-[12.5%] top-[9px] h-px bg-white/28"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute start-[12.5%] top-[9px] h-px w-[25%] bg-gradient-to-r from-layali-pink-light via-layali-pink/70 to-transparent shadow-[0_0_10px_rgba(212,46,124,0.45)] rtl:bg-gradient-to-l"
          aria-hidden
        />
        {steps.map((step) => (
          <li
            key={step.id}
            className="relative flex min-w-0 flex-col items-center text-center"
            aria-current={step.current ? 'step' : undefined}
          >
            <span className="relative z-[1] flex h-[18px] w-[18px] items-center justify-center">
              {step.current ? (
                <>
                  {!reduceMotion ? (
                    <motion.span
                      className="absolute inset-[-5px] rounded-full bg-layali-pink-glow/30"
                      animate={{ opacity: [0.28, 0.7, 0.28], scale: [1, 1.1, 1] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  ) : null}
                  <span className="absolute inset-0 rounded-full border-[1.5px] border-layali-pink-light shadow-[0_0_14px_rgba(212,46,124,0.75)]" />
                  <span className="h-2 w-2 rounded-full bg-layali-pink-light" />
                </>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full border border-white/40 bg-black/45" />
              )}
            </span>
            <span
              className={cn(
                'mt-2 max-w-full px-0.5 text-[0.65rem] leading-tight',
                step.current ? 'text-white' : 'text-white/52'
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
