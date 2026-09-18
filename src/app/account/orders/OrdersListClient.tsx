'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { formatDate, formatPrice } from '@/lib/utils';
import { shopifyImageUrl } from '@/lib/shopify/image';
import { customerOrderFetchTimeoutSignal } from '@/lib/account/order-load';
import type { CustomerOrderSummary } from '@/lib/account/order-types';

export function OrdersListClient() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      try {
        const res = await fetch('/api/account/orders', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          signal: customerOrderFetchTimeoutSignal(),
        });
        if (res.status === 401) {
          router.push('/auth/signin?redirect=/account/orders');
          return;
        }
        const json = (await res.json()) as { orders?: CustomerOrderSummary[]; error?: string };
        if (!res.ok) {
          if (!silent) {
            setError(json.error || t.orders.unavailable);
            setOrders([]);
          }
          return;
        }
        setOrders(json.orders || []);
        setError('');
      } catch {
        if (!silent) {
          setError(t.orders.unavailable);
          setOrders([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [router, t.orders.unavailable]
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadOrders();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadOrders]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void loadOrders({ silent: true });
    };
    const onPageShow = () => refresh();
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadOrders]);

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-4 min-w-0">
        <FadeIn>
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {t.account.back}
          </Link>

          <h1 className="font-serif text-heading-lg text-white mb-8">{t.orders.title}</h1>

          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-layali-pink-glow/15 rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-white/10 bg-layali-surface p-8 text-center">
              <p className="text-sm text-red-300/90 mb-4">{error}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setError('');
                  setLoading(true);
                  void loadOrders();
                }}
              >
                {t.orders.retry}
              </Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border border-layali-pink/20 bg-layali-surface">
              <Package className="w-12 h-12 mx-auto text-layali-pink mb-4" />
              <p className="font-serif text-xl text-white mb-2">{t.orders.emptyTitle}</p>
              <p className="text-white/60 mb-6 max-w-sm mx-auto">{t.orders.emptyBody}</p>
              <Button onClick={() => router.push('/shop')}>{t.orders.shopNow}</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const thumb = shopifyImageUrl(order.previewImageUrl, 160);
                const statusLabel =
                  order.statusKey === 'cancelled'
                    ? t.orders.cancelled
                    : t.orders[order.currentStep];
                return (
                  <div
                    key={order.ref}
                    className="bg-layali-surface rounded-2xl p-4 sm:p-6 border border-layali-pink/20 min-w-0"
                  >
                    <div className="flex gap-4 min-w-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt={order.previewAlt || order.number}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 text-layali-pink/70" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{order.number}</p>
                            {order.createdAt ? (
                              <p className="text-xs text-white/45">
                                {formatDate(order.createdAt, locale)}
                              </p>
                            ) : null}
                          </div>
                          <span className="text-xs px-2.5 py-1 rounded-full bg-layali-pink-glow/20 text-layali-pink border border-layali-pink/30 shrink-0">
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-sm text-white/60">
                          {order.itemCount}{' '}
                          {order.itemCount === 1 ? t.orders.item : t.orders.items}
                          {' · '}
                          {t.orders.cod}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                          <span className="font-semibold text-white">
                            {formatPrice(order.totalAmount, order.currencyCode)}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              router.push(`/account/orders/${encodeURIComponent(order.ref)}`)
                            }
                          >
                            {t.orders.viewOrder}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </FadeIn>
      </div>
    </div>
  );
}
