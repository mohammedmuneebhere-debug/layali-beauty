'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { TimelineStepId, TimelineStepState } from '@/lib/account/order-types';

const STEP_IDS: TimelineStepId[] = ['placed', 'processing', 'shipped', 'delivered'];

export function OrderTimeline({
  steps,
  compact = false,
}: {
  steps: { id: TimelineStepId; state: TimelineStepState; at?: string | null }[];
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const byId = new Map(steps.map((s) => [s.id, s]));

  return (
    <ol className={cn('relative border-s border-white/15 ps-5', compact ? 'space-y-3' : 'space-y-4')}>
      {STEP_IDS.map((id) => {
        const step = byId.get(id);
        const state = step?.state || 'upcoming';
        const label = t.orders[id];
        return (
          <li key={id} className="relative min-w-0">
            <span
              className={cn(
                'absolute -start-[1.55rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border',
                state === 'complete' && 'border-layali-pink bg-layali-pink text-white',
                state === 'current' && 'border-layali-pink bg-layali-pink-glow/30 text-layali-pink',
                state === 'upcoming' && 'border-white/20 bg-black/40 text-white/30'
              )}
            >
              {state === 'complete' ? <Check className="h-3 w-3" /> : null}
              {state === 'current' ? (
                <span className="h-1.5 w-1.5 rounded-full bg-layali-pink" />
              ) : null}
            </span>
            <p
              className={cn(
                'text-sm font-medium',
                state === 'upcoming' ? 'text-white/40' : 'text-white'
              )}
            >
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
