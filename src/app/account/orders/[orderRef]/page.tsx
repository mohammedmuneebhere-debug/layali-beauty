'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, ExternalLink } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { Button } from '@/components/ui/Button';
import { OrderTimeline } from '@/components/account/OrderTimeline';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { formatDate, formatPrice } from '@/lib/utils';
import { shopifyImageUrl } from '@/lib/shopify/image';
import { customerOrderFetchTimeoutSignal } from '@/lib/account/order-load';
import { isForbiddenOrderRef } from '@/lib/account/order-ref';
import type { CustomerOrderDetail } from '@/lib/account/order-types';

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderRef = String(params.orderRef || '');
  const { t, locale } = useLanguage();
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrder = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (!orderRef || isForbiddenOrderRef(orderRef)) {
        setError(t.orders.notFound);
        setLoading(false);
        return;
      }
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const res = await fetch(`/api/account/orders/${encodeURIComponent(orderRef)}`, {
          cache: 'no-store',
          signal: customerOrderFetchTimeoutSignal(),
        });
        if (res.status === 401) {
          router.push(`/auth/signin?redirect=/account/orders/${encodeURIComponent(orderRef)}`);
          return;
        }
        const json = (await res.json()) as { order?: CustomerOrderDetail; error?: string };
        if (res.status === 404) {
          setError(t.orders.notFound);
          setOrder(null);
          return;
        }
        if (!res.ok || !json.order) {
          if (!silent) {
            setError(json.error || t.orders.unavailable);
            setOrder(null);
          }
          return;
        }
        setOrder(json.order);
        setError('');
      } catch {
        if (!silent) setError(t.orders.unavailable);
      } finally {
        setLoading(false);
      }
    },
    [orderRef, router, t.orders.notFound, t.orders.unavailable]
  );

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!order?.ref || error) return;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void loadOrder({ silent: true });
    };
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [order?.ref, error, loadOrder]);

  const statusLabel = order
    ? order.statusKey === 'cancelled'
      ? t.orders.cancelled
      : t.orders[order.currentStep]
    : '';

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-4 min-w-0">
        <FadeIn>
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {t.orders.backToOrders}
          </Link>

          {loading ? (
            <div className="animate-pulse h-64 rounded-2xl bg-layali-pink-glow/15" />
          ) : error || !order ? (
            <div className="rounded-2xl border border-white/10 bg-layali-surface p-8 text-center">
              <p className="text-white mb-4">{error || t.orders.notFound}</p>
              <div className="flex flex-wrap justify-center gap-3">
                {error && error !== t.orders.notFound ? (
                  <Button onClick={() => void loadOrder()}>{t.orders.retry}</Button>
                ) : null}
                <Button variant="outline" onClick={() => router.push('/account/orders')}>
                  {t.orders.backToOrders}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-layali-surface rounded-2xl p-5 sm:p-6 border border-layali-pink/20">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h1 className="font-serif text-heading-md text-white break-words">
                      {order.number}
                    </h1>
                    {order.createdAt ? (
                      <p className="text-sm text-white/50 mt-1">
                        {formatDate(order.createdAt, locale)}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-layali-pink-glow/20 text-layali-pink border border-layali-pink/30">
                    {statusLabel}
                  </span>
                </div>
                <OrderTimeline steps={order.timeline} />
              </div>

              <div className="bg-layali-surface rounded-2xl p-5 sm:p-6 border border-layali-pink/20">
                <h2 className="font-serif text-lg text-white mb-4">{t.orders.tracking}</h2>
                {(() => {
                  const hasTrackingNumber = order.tracking.some((track) =>
                    Boolean(track.number || track.url)
                  );
                  const shippedOrLater =
                    order.currentStep === 'shipped' ||
                    order.currentStep === 'out_for_delivery' ||
                    order.currentStep === 'delivered';
                  if (order.tracking.length === 0) {
                    return (
                      <p className="text-sm text-white/55">
                        {shippedOrLater
                          ? t.orders.trackingShippedUnavailable
                          : t.orders.trackingPending}
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      {!hasTrackingNumber && shippedOrLater ? (
                        <p className="text-sm text-white/55">
                          {t.orders.trackingShippedUnavailable}
                        </p>
                      ) : null}
                      {order.tracking.map((track, index) => {
                        const shipmentLabel = track.shipmentStatusKey
                          ? t.orders.shipStatus[track.shipmentStatusKey]
                          : null;
                        const fulfillmentLabel = track.fulfillmentStatusKey
                          ? t.orders.fulfillmentStatus[track.fulfillmentStatusKey]
                          : null;
                        return (
                          <div
                            key={`${track.number || track.url || track.shipmentStatusKey || index}`}
                            className="rounded-xl border border-white/10 bg-black/20 p-4 min-w-0 space-y-2"
                          >
                            {track.company ? (
                              <p className="text-white font-medium">
                                <span className="text-white/50 text-xs uppercase tracking-[0.12em] block mb-1">
                                  {t.orders.carrier}
                                </span>
                                {track.company}
                              </p>
                            ) : null}
                            {track.number ? (
                              <p className="text-sm text-white/70 break-all">
                                {t.orders.trackingNumber}: {track.number}
                              </p>
                            ) : null}
                            {fulfillmentLabel ? (
                              <p className="text-sm text-white/60">
                                {t.orders.fulfillmentLabel}: {fulfillmentLabel}
                              </p>
                            ) : null}
                            {shipmentLabel ? (
                              <p className="text-sm text-white/60">
                                {t.orders.shipmentLabel}: {shipmentLabel}
                              </p>
                            ) : null}
                            {track.estimatedDeliveryAt ? (
                              <p className="text-sm text-white/60">
                                {t.orders.estimatedDelivery}:{' '}
                                {formatDate(track.estimatedDeliveryAt, locale)}
                              </p>
                            ) : null}
                            {track.deliveredAt ? (
                              <p className="text-sm text-white/60">
                                {t.orders.deliveredOn}: {formatDate(track.deliveredAt, locale)}
                              </p>
                            ) : null}
                            {track.url ? (
                              <a
                                href={track.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-layali-pink mt-1 hover:underline"
                              >
                                {t.orders.trackShipment}
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="bg-layali-surface rounded-2xl p-5 sm:p-6 border border-layali-pink/20">
                <h2 className="font-serif text-lg text-white mb-4">{t.checkout.summary}</h2>
                <div className="space-y-3 mb-4">
                  {order.items.map((item, index) => {
                    const thumb = shopifyImageUrl(item.imageUrl, 120);
                    return (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex gap-3 min-w-0"
                      >
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt={item.imageAlt || item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-4 h-4 text-layali-pink/60" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white leading-snug break-words">{item.name}</p>
                          {item.variantTitle ? (
                            <p className="text-xs text-white/45">{item.variantTitle}</p>
                          ) : null}
                          <p className="text-xs text-white/50 mt-0.5">×{item.quantity}</p>
                        </div>
                        <p className="text-sm text-white shrink-0">
                          {formatPrice(item.lineTotal, order.currencyCode)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-white/10 pt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/55">{t.orders.subtotal}</span>
                    <span className="text-white">
                      {formatPrice(order.subtotalAmount, order.currencyCode)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-white/55">{t.orders.shipping}</span>
                    <span className="text-white">
                      {formatPrice(order.shippingAmount, order.currencyCode)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 pt-1">
                    <span className="font-semibold text-white">{t.orders.total}</span>
                    <span className="font-semibold text-white">
                      {formatPrice(order.totalAmount, order.currencyCode)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-layali-surface rounded-2xl p-5 sm:p-6 border border-layali-pink/20 space-y-3">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-white/55">{t.orders.payment}</span>
                  <span className="text-white text-end">
                    {t.orders.cod}
                    {order.paymentDue ? (
                      <span className="block text-xs text-white/50 mt-0.5">
                        {t.orders.paymentDue}
                      </span>
                    ) : null}
                  </span>
                </div>
                {order.shippingAddress ? (
                  <div className="pt-3 border-t border-white/10 text-sm">
                    <p className="text-white/55 mb-1">{t.orders.deliveryAddress}</p>
                    <p className="text-white font-medium">
                      {order.shippingAddress.name || t.orders.receiver}
                    </p>
                    {order.shippingAddress.phone ? (
                      <p className="text-white/70">{order.shippingAddress.phone}</p>
                    ) : null}
                    <p className="text-white/70 break-words">
                      {[
                        order.shippingAddress.address1,
                        order.shippingAddress.address2,
                        order.shippingAddress.city,
                        order.shippingAddress.province,
                        order.shippingAddress.zip,
                        order.shippingAddress.country,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </FadeIn>
      </div>
    </div>
  );
}
