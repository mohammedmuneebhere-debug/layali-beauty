'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

type ConfirmedOrder = {
  id: string;
  name: string;
  totalAmount: number;
  currencyCode: string;
  paymentLabel: string;
  shippingAddress: {
    receiverName: string;
    phone: string;
    addressLine: string;
    city: string;
    country: string;
  };
};

function ConfirmationContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const order = useMemo(() => {
    const raw = searchParams.get('order');
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw)) as ConfirmedOrder;
    } catch {
      return null;
    }
  }, [searchParams]);

  if (!order) {
    return (
      <div className="min-h-screen bg-transparent pt-24 pb-12">
        <div className="max-w-lg mx-auto px-4 text-center space-y-4">
          <h1 className="font-serif text-3xl font-bold text-white">{t.checkout.confirmedTitle}</h1>
          <p className="text-white/60">We could not load this confirmation. Check your email or account orders.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/shop">
              <Button>{t.checkout.continueShopping}</Button>
            </Link>
            <Link href="/account/orders">
              <Button variant="outline">{t.checkout.viewOrders}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12">
      <div className="max-w-lg mx-auto px-4">
        <div className="bg-layali-surface rounded-2xl p-8 border border-layali-pink/20 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-300" />
          </div>
          <div>
            <p className="text-layali-pink text-sm tracking-wide uppercase mb-1">
              {t.checkout.confirmedThanks}
            </p>
            <h1 className="font-serif text-3xl font-bold text-white">Order Confirmed</h1>
          </div>

          <div className="text-left space-y-3 rounded-xl border border-white/10 p-4 bg-black/20">
            <div className="flex justify-between text-sm">
              <span className="text-white/55">{t.checkout.orderId}</span>
              <span className="text-white font-medium">{order.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/55">{t.checkout.total}</span>
              <span className="text-white font-medium">
                {formatPrice(order.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/55">Payment</span>
              <span className="text-white font-medium">{order.paymentLabel}</span>
            </div>
            <div className="pt-2 border-t border-white/10 text-sm">
              <p className="text-white/55 mb-1">Delivery address</p>
              <p className="text-white font-medium">{order.shippingAddress.receiverName}</p>
              <p className="text-white/70">{order.shippingAddress.phone}</p>
              <p className="text-white/70">{order.shippingAddress.addressLine}</p>
              <p className="text-white/60">
                {[order.shippingAddress.city, order.shippingAddress.country]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-left text-sm text-white/65 rounded-xl bg-black/30 p-3">
            <Package className="w-4 h-4 mt-0.5 text-layali-pink shrink-0" />
            <p>
              Pay with Cash on Delivery when your order arrives. Our team will prepare your package
              next.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/shop">
              <Button className="w-full sm:w-auto">{t.checkout.continueShopping}</Button>
            </Link>
            <Link href="/account/orders">
              <Button variant="outline" className="w-full sm:w-auto">
                {t.checkout.viewOrders}
              </Button>
            </Link>
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
