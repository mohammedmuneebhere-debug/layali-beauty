'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  OrderSuccessDistantDust,
  OrderSuccessPetals,
  OrderSuccessVisual,
} from '@/components/checkout/OrderSuccessVisual';
import { OrderSuccessJourney } from '@/components/checkout/OrderSuccessJourney';
import { cn, formatPrice } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { displayOrderNumber } from '@/lib/account/order-ref';
import { clearCheckoutOrderNavigating } from '@/lib/checkout/post-order-nav';
import { createClient } from '@/lib/supabase/client';

type LegacyConfirmedOrder = {
  name?: string;
  totalAmount?: number;
  currencyCode?: string;
  paymentLabel?: string;
  financialStatus?: string | null;
};

type OrderConfirmation = {
  name: string;
  totalAmount: number | null;
  currencyCode: string;
  paymentLabel: string | null;
  financialStatus: string | null;
};

/** Shopify order names only — rejects free-form / spoofed identity strings. */
function isPlausibleOrderName(raw: string): boolean {
  const value = raw.trim();
  if (!value || value.length > 32) return false;
  return /^#?[A-Za-z0-9][A-Za-z0-9_-]{0,30}$/.test(value);
}

function greetingName(fullName: string | null | undefined): string | null {
  const trimmed = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  // Prefer first given name for a warm, short greeting.
  const first = trimmed.split(' ')[0]?.trim() || '';
  if (!first || first.length > 40) return null;
  return first;
}

function presentGreetingName(name: string): string {
  if (/^[A-Za-z][A-Za-z'’\-]*$/.test(name)) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}

function ConfirmationContent() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [customerName, setCustomerName] = useState<string | null>(null);
  const tracked = locale !== 'ar';

  const confirmation = useMemo((): OrderConfirmation | null => {
    const nameParam = searchParams.get('name');
    const totalParam = searchParams.get('total');
    const currency = searchParams.get('currency') || 'SAR';
    const payment = searchParams.get('payment');
    const status = searchParams.get('status');

    if (nameParam && isPlausibleOrderName(nameParam)) {
      const total = totalParam ? Number(totalParam) : null;
      return {
        name: nameParam.trim(),
        totalAmount: total != null && Number.isFinite(total) ? total : null,
        currencyCode: currency,
        paymentLabel: payment,
        financialStatus: status,
      };
    }

    const raw = searchParams.get('order');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as LegacyConfirmedOrder;
      if (!parsed?.name || !isPlausibleOrderName(parsed.name)) return null;
      return {
        name: parsed.name.trim(),
        totalAmount: Number.isFinite(Number(parsed.totalAmount))
          ? Number(parsed.totalAmount)
          : null,
        currencyCode: parsed.currencyCode || 'SAR',
        paymentLabel: parsed.paymentLabel ?? null,
        financialStatus: parsed.financialStatus ?? null,
      };
    } catch {
      return null;
    }
  }, [searchParams]);

  const orderNumber = confirmation ? displayOrderNumber(confirmation.name) : '';

  useEffect(() => {
    clearCheckoutOrderNavigating();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomerName() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        if (cancelled) return;
        setCustomerName(greetingName(profile?.full_name));
      } catch {
        // Name is optional — keep anonymous congratulations.
      }
    }

    void loadCustomerName();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = customerName ? presentGreetingName(customerName) : null;

  const enter = (delay = 0) =>
    reduceMotion
      ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] as const },
        };

  if (!confirmation || !orderNumber) {
    return (
      <div className="relative isolate min-h-screen overflow-x-clip bg-transparent pt-24 pb-28 sm:pb-12">
        <SuccessAtmosphere reduceMotion={reduceMotion} />
        <div className="relative mx-auto max-w-lg px-5 text-center space-y-5">
          <h1 className="font-serif text-heading-md text-white">{t.checkout.confirmedTitle}</h1>
          <p className="text-white/60">{t.checkout.confirmationUnavailable}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button className="w-full sm:w-auto min-h-12" onClick={() => router.push('/shop')}>
              {t.checkout.exploreMore}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto min-h-12"
              onClick={() => router.push('/account/orders')}
            >
              {t.checkout.viewOrders}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen overflow-x-clip bg-transparent pt-24 pb-28 sm:pb-16">
      <SuccessAtmosphere reduceMotion={reduceMotion} />

      <p
        className={cn(
          'pointer-events-none absolute start-8 top-[30%] hidden max-w-[9.5rem] text-[0.65rem] leading-relaxed text-white/35 lg:block',
          tracked && 'uppercase tracking-[0.18em]'
        )}
      >
        {t.checkout.tomorrowAwaits}
      </p>
      <p
        className={cn(
          'pointer-events-none absolute end-8 top-[34%] hidden max-w-[9.5rem] text-end text-[0.65rem] leading-relaxed text-white/35 lg:block',
          tracked && 'uppercase tracking-[0.18em]'
        )}
      >
        {t.checkout.ritualsRadiant}
      </p>

      <div className="relative mx-auto w-full max-w-[26.5rem] lg:max-w-[36rem] px-5 min-w-0">
        <div className="flex flex-col items-center text-center gap-5 sm:gap-6">
          <motion.div className="w-full" {...enter(0)}>
            <OrderSuccessVisual />
          </motion.div>

          <motion.header className="w-full min-w-0 space-y-2 sm:space-y-2.5" {...enter(0.2)}>
            {displayName ? (
              <h1 className="space-y-1">
                <span
                  className={cn(
                    'block text-[0.68rem] text-layali-gold-light',
                    tracked && 'uppercase tracking-[0.32em]'
                  )}
                >
                  {t.checkout.congratulationsKicker}
                </span>
                <span
                  className={cn(
                    'block font-serif text-[2.35rem] sm:text-[2.85rem] lg:text-[3.35rem] leading-[1.05] text-white break-words',
                    locale !== 'ar' && 'italic'
                  )}
                >
                  {displayName}
                </span>
              </h1>
            ) : (
              <h1
                className={cn(
                  'font-serif text-[2.15rem] sm:text-[2.6rem] lg:text-[3rem] leading-[1.08] text-white',
                  locale !== 'ar' && 'italic'
                )}
              >
                {t.checkout.congratulationsKicker}
              </h1>
            )}
            <p className="text-[0.98rem] sm:text-lg text-white/90 font-medium">
              {t.checkout.orderOnTheWay}
            </p>
            <p className="text-sm text-white/50 max-w-sm mx-auto leading-relaxed">
              {t.checkout.ritualUnderway}
            </p>
          </motion.header>

          <motion.section
            className="w-full rounded-[1.35rem] border border-white/12 bg-white/[0.045] px-5 py-5 sm:px-8 sm:py-6 backdrop-blur-md"
            style={{
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.1), 0 18px 44px rgba(0,0,0,0.28)',
            }}
            aria-label={t.checkout.orderConfirmed}
            {...enter(0.32)}
          >
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden>
                {!reduceMotion ? (
                  <motion.span
                    className="absolute inset-[-4px] rounded-full bg-layali-pink-glow/35"
                    animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.18, 1] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ) : null}
                <span className="absolute inset-0 rounded-full border-[1.5px] border-layali-pink-light" />
                <span className="h-1.5 w-1.5 rounded-full bg-layali-pink-light" />
              </span>
              <p
                className={cn(
                  'text-[0.65rem] text-layali-gold-light',
                  tracked && 'uppercase tracking-[0.22em]'
                )}
              >
                {t.checkout.orderConfirmed}
              </p>
            </div>

            <div className="flex flex-col items-center sm:flex-row sm:justify-center sm:gap-5">
              <p className="font-serif text-[2rem] sm:text-[2.15rem] leading-none text-white break-words">
                {orderNumber}
              </p>
              {confirmation.totalAmount != null ? (
                <>
                  <span className="my-3 hidden h-8 w-px bg-white/15 sm:block" aria-hidden />
                  <p className="mt-2 sm:mt-0 text-lg text-layali-gold-light/95">
                    {formatPrice(confirmation.totalAmount, confirmation.currencyCode)}
                  </p>
                </>
              ) : null}
            </div>

            <div className="mt-4 flex justify-center">
              <p
                className={cn(
                  'inline-flex items-center gap-1.5 text-[0.7rem] text-white/50',
                  tracked && 'uppercase tracking-[0.14em]'
                )}
              >
                <Banknote className="h-3.5 w-3.5 text-layali-gold-light/80" aria-hidden />
                {t.checkout.cod}
              </p>
            </div>
          </motion.section>

          <div className="pointer-events-none relative h-0 w-full" aria-hidden>
            <div
              className="absolute left-1/2 top-0 h-16 w-40 -translate-x-1/2 -translate-y-1/2"
              style={{
                background:
                  'radial-gradient(ellipse, rgba(90,16,40,0.2) 0%, transparent 74%)',
                filter: 'blur(16px)',
              }}
            />
          </div>

          <motion.div className="w-full max-w-lg px-1" {...enter(0.4)}>
            <OrderSuccessJourney />
          </motion.div>

          <motion.div
            className="flex w-full max-w-lg flex-col gap-3 lg:flex-row lg:items-stretch pt-1"
            {...enter(0.48)}
          >
            <Button
              size="lg"
              className="group w-full min-h-12 lg:flex-1 whitespace-nowrap bg-gradient-to-r from-layali-pink-glow via-[#de3a86] to-layali-pink shadow-[0_8px_28px_rgba(212,46,124,0.38)] hover:shadow-[0_10px_36px_rgba(212,46,124,0.52)] hover:brightness-110 active:scale-[0.98]"
              onClick={() => router.push('/shop')}
            >
              <span>{t.checkout.exploreMore}</span>
              <ArrowRight
                className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                aria-hidden
              />
            </Button>
            <Button
              variant="outline"
              className="group w-full min-h-12 lg:w-auto lg:min-w-[11.5rem] whitespace-nowrap border-white/30 bg-black/20 text-white/80 hover:border-layali-pink/45 hover:text-white hover:shadow-[0_0_18px_rgba(212,46,124,0.16)] active:scale-[0.98]"
              onClick={() => router.push('/account/orders')}
            >
              <span>{t.checkout.viewOrders}</span>
              <ArrowRight
                className="h-3.5 w-3.5 opacity-80 transition-transform duration-300 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                aria-hidden
              />
            </Button>
          </motion.div>

          <motion.p
            className="font-serif italic text-sm text-white/40 max-w-xs"
            {...enter(0.55)}
          >
            {t.checkout.beautyFindsYou}
          </motion.p>
        </div>
      </div>
    </div>
  );
}

function SuccessAtmosphere({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 90% 48% at 50% -4%, rgba(92,12,40,0.48) 0%, transparent 58%)',
            'radial-gradient(ellipse 62% 40% at 50% 18%, rgba(212,46,124,0.11) 0%, transparent 64%)',
            'linear-gradient(180deg, rgba(42,8,20,0.12) 0%, rgba(48,10,24,0.2) 42%, rgba(32,8,18,0.28) 68%, rgba(16,5,12,0.38) 100%)',
            'radial-gradient(ellipse 55% 32% at 50% 92%, rgba(78,14,36,0.22) 0%, transparent 72%)',
            'radial-gradient(ellipse 36% 26% at 82% 40%, rgba(201,168,124,0.05) 0%, transparent 70%)',
          ].join(', '),
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.07]"
        viewBox="0 0 400 800"
        preserveAspectRatio="none"
        style={{ filter: 'blur(10px)' }}
      >
        <defs>
          <linearGradient id="layali-success-ribbon" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(212,46,124,0)" />
            <stop offset="40%" stopColor="rgba(224,122,138,0.85)" />
            <stop offset="100%" stopColor="rgba(201,168,124,0)" />
          </linearGradient>
        </defs>
        <path
          d="M-30 180 C 70 120, 190 250, 310 160 S 430 90, 470 170"
          fill="none"
          stroke="url(#layali-success-ribbon)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M-50 470 C 40 410, 170 560, 280 430 S 410 390, 480 480"
          fill="none"
          stroke="url(#layali-success-ribbon)"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.65"
        />
      </svg>
      <OrderSuccessDistantDust reduceMotion={reduceMotion} />
      <OrderSuccessPetals reduceMotion={reduceMotion} />
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent pt-24" />}>
      <ConfirmationContent />
    </Suspense>
  );
}
