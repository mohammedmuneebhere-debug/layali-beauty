'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { displayOrderNumber } from '@/lib/account/order-ref';

type LegacyConfirmedOrder = {
  name?: string;
  totalAmount?: number;
  currencyCode?: string;
  paymentLabel?: string;
  financialStatus?: string | null;
};

function ConfirmationContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const confirmation = useMemo(() => {
    const nameParam = searchParams.get('name');
    const totalParam = searchParams.get('total');
    const currency = searchParams.get('currency') || 'SAR';
    const payment = searchParams.get('payment');
    const status = searchParams.get('status');

    if (nameParam) {
      return {
        name: nameParam,
        totalAmount: totalParam ? Number(totalParam) : null,
        currencyCode: currency,
        paymentLabel: payment,
        financialStatus: status,
      };
    }

    const raw = searchParams.get('order');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as LegacyConfirmedOrder;
      if (!parsed?.name) return null;
      return {
        name: parsed.name,
        totalAmount: Number.isFinite(Number(parsed.totalAmount))
          ? Number(parsed.totalAmount)
          : null,
        currencyCode: parsed.currencyCode || 'SAR',
        paymentLabel: parsed.paymentLabel,
        financialStatus: parsed.financialStatus,
      };
    } catch {
      return null;
    }
  }, [searchParams]);

  const orderNumber = confirmation ? displayOrderNumber(confirmation.name) : '';

  if (!confirmation || !orderNumber) {
    return (
      <div className="min-h-screen bg-transparent pt-24 pb-12">
        <div className="max-w-lg mx-auto px-4 text-center space-y-4">
          <h1 className="font-serif text-heading-md text-white">{t.checkout.confirmedTitle}</h1>
          <p className="text-white/60">{t.checkout.confirmationUnavailable}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button className="w-full sm:w-auto" onClick={() => router.push('/shop')}>
              {t.checkout.exploreMore}
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.push('/account/orders')}>
              {t.checkout.viewOrders}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12">
      <div className="max-w-lg mx-auto px-4 min-w-0">
        <div className="bg-layali-surface rounded-2xl p-6 sm:p-10 border border-layali-pink/20 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-layali-pink-glow/20 border border-layali-pink/30 flex items-center justify-center animate-[pulse_2.4s_ease-in-out_infinite]">
            <Sparkles className="w-7 h-7 text-layali-pink" />
          </div>
          <div className="space-y-2">
            <p className="text-meta uppercase tracking-[0.18em] text-layali-pink">
              {t.checkout.congratulations}
            </p>
            <h1 className="font-serif text-heading-md text-white leading-tight">
              {t.checkout.orderPlacedSuccessfully}
            </h1>
            <p className="text-white/75 pt-1">{t.checkout.thankYouShopping}</p>
            <p className="text-sm text-white/55">{t.checkout.orderReceived}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.14em] text-layali-pink">
              {t.checkout.orderConfirmed}
            </p>
            <p className="text-white font-medium break-words">{orderNumber}</p>
            {confirmation.totalAmount != null ? (
              <p className="text-sm text-white/70">
                {t.checkout.total}: {formatPrice(confirmation.totalAmount, confirmation.currencyCode)}
              </p>
            ) : null}
            <p className="text-xs text-white/50">{t.checkout.cod}</p>
          </div>

          <div className="flex flex-col gap-3 pt-1">
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
