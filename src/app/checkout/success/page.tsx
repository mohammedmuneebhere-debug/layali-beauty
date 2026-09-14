'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { OrderSuccessVisual } from '@/components/checkout/OrderSuccessVisual';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { displayOrderNumber } from '@/lib/account/order-ref';
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

function ConfirmationContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [customerName, setCustomerName] = useState<string | null>(null);

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

  const headline = customerName
    ? t.checkout.congratulationsNamed.replace('{name}', customerName)
    : t.checkout.congratulations;

  const enter = (delay = 0) =>
    reduceMotion
      ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] as const },
        };

  if (!confirmation || !orderNumber) {
    return (
      <div className="min-h-screen bg-transparent pt-24 pb-28 sm:pb-12">
        <div className="mx-auto max-w-lg px-4 text-center space-y-5">
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
    <div className="min-h-screen bg-transparent pt-24 pb-28 sm:pb-16">
      <div className="mx-auto max-w-lg px-4 min-w-0">
        <div className="relative overflow-hidden rounded-3xl border border-layali-pink/20 bg-layali-surface/90 px-5 py-8 sm:px-10 sm:py-12 text-center">
          {/* Atmospheric wash — not a card stack */}
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                'radial-gradient(ellipse at 50% 0%, rgba(212,46,124,0.16) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(201,168,124,0.06) 0%, transparent 45%)',
            }}
          />

          <div className="relative space-y-7 sm:space-y-8">
            <motion.div {...enter(0)}>
              <OrderSuccessVisual />
            </motion.div>

            <motion.div className="space-y-2.5" {...enter(0.12)}>
              <h1 className="font-serif text-heading-md sm:text-[2.15rem] text-white leading-tight tracking-tight">
                {headline}
              </h1>
              <p className="text-base sm:text-lg text-layali-pink-light/90 font-medium">
                {t.checkout.orderPlacedSuccessfully}
              </p>
              <p className="text-sm sm:text-[0.95rem] text-white/60 max-w-sm mx-auto leading-relaxed">
                {t.checkout.thankYouShopping}
              </p>
            </motion.div>

            <motion.div
              className="mx-auto max-w-xs rounded-2xl border border-white/10 bg-black/30 px-4 py-4 space-y-1.5"
              {...enter(0.2)}
            >
              <p className="text-[0.65rem] uppercase tracking-[0.16em] text-layali-pink">
                {t.checkout.orderConfirmed}
              </p>
              <p className="text-white font-medium text-lg break-words">{orderNumber}</p>
              {confirmation.totalAmount != null ? (
                <p className="text-sm text-white/65">
                  {t.checkout.total}: {formatPrice(confirmation.totalAmount, confirmation.currencyCode)}
                </p>
              ) : null}
              <p className="text-xs text-white/45">{t.checkout.cod}</p>
            </motion.div>

            <motion.div className="flex flex-col gap-3 pt-1" {...enter(0.28)}>
              <Button className="w-full min-h-12" onClick={() => router.push('/shop')}>
                {t.checkout.exploreMore}
              </Button>
              <Button
                variant="outline"
                className="w-full min-h-12"
                onClick={() => router.push('/account/orders')}
              >
                {t.checkout.viewOrders}
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
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
