'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { OrderTimeline } from '@/components/account/OrderTimeline';
import { formatPrice, formatDate } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { displayOrderNumber, toCustomerOrderRef } from '@/lib/account/order-ref';

type LegacyConfirmedOrder = {
  name?: string;
  totalAmount?: number;
  currencyCode?: string;
  paymentLabel?: string;
  financialStatus?: string | null;
};

function ConfirmationContent() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const confirmation = useMemo(() => {
    const nameParam = searchParams.get('name');
    const totalParam = searchParams.get('total');
    const currency = searchParams.get('currency') || 'SAR';
    const payment = searchParams.get('payment');
    const status = searchParams.get('status');
    const date = searchParams.get('date');

    if (nameParam) {
      return {
        name: nameParam,
        totalAmount: totalParam ? Number(totalParam) : null,
        currencyCode: currency,
        paymentLabel: payment,
        financialStatus: status,
        createdAt: date,
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
        createdAt: null as string | null,
      };
    } catch {
      return null;
    }
  }, [searchParams]);

  const orderRef = confirmation ? toCustomerOrderRef(confirmation.name) : '';
  const orderNumber = confirmation ? displayOrderNumber(confirmation.name) : '';
  const financial = (confirmation?.financialStatus || '').toUpperCase();
  const paymentDue = !['PAID', 'PARTIALLY_PAID', 'REFUNDED'].includes(financial);

  if (!confirmation || !orderNumber) {
    return (
      <div className="min-h-screen bg-transparent pt-24 pb-12">
        <div className="max-w-lg mx-auto px-4 text-center space-y-4">
          <h1 className="font-serif text-heading-md text-white">{t.checkout.confirmedTitle}</h1>
          <p className="text-white/60">{t.checkout.confirmationUnavailable}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button className="w-full sm:w-auto" onClick={() => router.push('/account/orders')}>
              {t.checkout.viewOrders}
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.push('/shop')}>
              {t.checkout.continueShopping}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12">
      <div className="max-w-lg mx-auto px-4 min-w-0">
        <div className="bg-layali-surface rounded-2xl p-6 sm:p-8 border border-layali-pink/20 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-300" />
          </div>
          <div>
            <p className="text-meta uppercase tracking-[0.16em] text-layali-pink mb-1">
              {t.checkout.confirmedThanks}
            </p>
            <h1 className="font-serif text-heading-md text-white">{t.checkout.confirmedTitle}</h1>
            <p className="text-white font-medium mt-2 break-words">{orderNumber}</p>
          </div>

          <p className="text-sm text-white/65">{t.checkout.confirmedBody}</p>

          <div className="text-start space-y-3 rounded-xl border border-white/10 p-4 bg-black/20">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-white/55">{t.checkout.orderId}</span>
              <span className="text-white font-medium break-all">{orderNumber}</span>
            </div>
            {confirmation.createdAt ? (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-white/55">{t.checkout.orderDate}</span>
                <span className="text-white font-medium">
                  {formatDate(confirmation.createdAt, locale)}
                </span>
              </div>
            ) : null}
            {confirmation.totalAmount != null ? (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-white/55">{t.checkout.total}</span>
                <span className="text-white font-medium">
                  {formatPrice(confirmation.totalAmount, confirmation.currencyCode)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-white/55">{t.checkout.payment}</span>
              <span className="text-white font-medium text-end">
                {t.checkout.cod}
                {paymentDue ? (
                  <span className="block text-xs text-white/50 font-normal mt-0.5">
                    {t.checkout.paymentDue}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-white/55">{t.checkout.currentStatus}</span>
              <span className="text-white font-medium">{t.orders.processing}</span>
            </div>
          </div>

          <div className="text-start rounded-xl border border-white/10 p-4 bg-black/20">
            <OrderTimeline
              compact
              steps={[
                { id: 'placed', state: 'complete' },
                { id: 'processing', state: 'current' },
                { id: 'shipped', state: 'upcoming' },
                { id: 'delivered', state: 'upcoming' },
              ]}
            />
          </div>

          {paymentDue ? (
            <div className="flex items-start gap-2 text-start text-sm text-white/65 rounded-xl bg-black/30 p-3">
              <Package className="w-4 h-4 mt-0.5 text-layali-pink shrink-0" />
              <p>{t.checkout.paymentDue}</p>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {orderRef ? (
              <Button
                className="w-full sm:flex-1"
                onClick={() => router.push(`/account/orders/${encodeURIComponent(orderRef)}`)}
              >
                {t.checkout.viewOrder}
              </Button>
            ) : (
              <Button className="w-full sm:flex-1" onClick={() => router.push('/account/orders')}>
                {t.checkout.viewOrders}
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full sm:flex-1"
              onClick={() => router.push('/account/orders')}
            >
              {t.checkout.viewOrders}
            </Button>
            <Button
              variant="ghost"
              className="w-full sm:flex-1"
              onClick={() => router.push('/shop')}
            >
              {t.checkout.continueShopping}
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
