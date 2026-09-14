'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/FadeIn';
import { RitualRail } from '@/components/commerce/RitualRail';
import { toast } from '@/components/ui/Toast';
import { useCartStore } from '@/store/cart';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { pickRitualProducts } from '@/lib/ritual';
import { track } from '@/lib/track';
import type { ShopProduct } from '@/lib/catalog';

export default function CartPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const items = useCartStore((s) => s.items);
  const totalQuantity = useCartStore((s) => s.totalQuantity);
  const subtotal = useCartStore((s) => s.subtotal);
  const totalAmount = useCartStore((s) => s.totalAmount);
  const discounts = useCartStore((s) => s.discounts) ?? [];
  const error = useCartStore((s) => s.error);
  const updatingLineId = useCartStore((s) => s.updatingLineId);
  const loading = useCartStore((s) => s.loading);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const refresh = useCartStore((s) => s.refresh);
  const setError = useCartStore((s) => s.setError);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const [ritual, setRitual] = useState<ShopProduct[]>([]);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    const finish = () => setCartReady(true);
    const unsub = useCartStore.persist.onFinishHydration(finish);
    if (useCartStore.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    void refresh();
    track({ event: 'cart_view' });
  }, [cartReady, refresh]);

  useEffect(() => {
    if (!cartReady || items.length === 0) {
      void Promise.resolve().then(() => setRitual([]));
      return;
    }
    let cancelled = false;
    void fetch('/api/shopify/products?first=48')
      .then((res) => res.json())
      .then((json: { products?: ShopProduct[] }) => {
        if (cancelled) return;
        const catalog = json.products || [];
        const current =
          catalog.find((p) => items.some((item) => item.name.includes(p.name) || p.name.includes(item.name.split(' — ')[0]))) ||
          catalog[0];
        if (!current) {
          setRitual([]);
          return;
        }
        setRitual(pickRitualProducts(current, catalog));
      })
      .catch(() => {
        if (!cancelled) setRitual([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cartReady, items]);

  const proceedToCheckout = async () => {
    setCheckingAuth(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth/signin?redirect=/checkout');
      setCheckingAuth(false);
      return;
    }

    track({ event: 'checkout_start' });
    router.push('/checkout');
    setCheckingAuth(false);
  };

  if (!cartReady) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-20 pt-28 bg-transparent">
        <p className="text-white/45">Loading cart…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-20 pt-28 bg-transparent">
        <ShoppingBag className="w-14 h-14 text-layali-pink/60 mb-4" />
        <h2 className="font-serif text-heading-md text-white mb-2">{t.cart.empty}</h2>
        <p className="text-white/45 mb-6">{t.cart.emptyHint}</p>
        {error ? (
          <p className="text-sm text-red-300/90 mb-4 max-w-md text-center px-4">{error}</p>
        ) : null}
        <Link href="/shop">
          <Button>{t.cart.continue}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <FadeIn>
          <h1 className="font-serif text-heading-lg text-white mb-8">
            {t.cart.title} ({totalQuantity})
          </h1>
        </FadeIn>

        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start justify-between gap-3"
          >
            <span>{error}</span>
            <button
              type="button"
              className="text-red-200/80 hover:text-white shrink-0"
              onClick={() => setError(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ) : null}

        <div className="space-y-4 mb-8">
          {items.map((item) => {
            const busy = updatingLineId === item.id || loading;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 glass-panel rounded-2xl p-4"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-20 h-20 rounded-xl bg-layali-surface flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/8">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl text-layali-pink/50">✦</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white break-words">{item.name}</h3>
                    <p className="text-price text-white mt-1">{formatPrice(item.price)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 ps-0 sm:ps-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateQuantity(item.id, item.quantity - 1)}
                      className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full border border-white/15 text-white/70 hover:border-layali-pink/40 hover:text-white transition-colors disabled:opacity-40"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium text-white" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                      className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full border border-white/15 text-white/70 hover:border-layali-pink/40 hover:text-white transition-colors disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeItem(item.id)}
                    className="inline-flex items-center justify-center min-h-11 min-w-11 text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-40"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white/50">{t.cart.subtotal}</span>
            <span className="text-price text-white">{formatPrice(subtotal)}</span>
          </div>
          {discounts.map((d) => (
            <div key={d.title} className="flex justify-between items-center mb-2">
              <span className="text-white/50">{d.title}</span>
              <span className="text-sm text-emerald-300/90">−{formatPrice(d.amount.amount)}</span>
            </div>
          ))}
          {/* Shipping is confirmed on the Layali COD checkout — do not invent a cart shipping total. */}
          <div className="flex justify-between items-center mb-2 gap-3 min-w-0">
            <span className="text-white/50 shrink-0">{t.cart.delivery}</span>
            <span className="text-sm text-white/40 text-end min-w-0">Calculated at checkout</span>
          </div>
          <div className="flex justify-between items-center mb-4 pt-3 border-t border-white/10">
            <span className="text-white font-medium">{t.cart.total}</span>
            <span className="text-price text-lg text-white">{formatPrice(totalAmount || subtotal)}</span>
          </div>
          <p className="text-xs text-white/45 mb-3">{t.cart.codAvailable}</p>
          <p className="text-xs text-white/40 mb-6">
            {t.cart.shippingAtCheckout}. {t.cart.secureCheckout}.
          </p>
          <Button
            className="w-full"
            size="lg"
            loading={checkingAuth}
            disabled={totalQuantity <= 0}
            onClick={() => void proceedToCheckout()}
          >
            {t.cart.checkout} <ArrowRight className="w-5 h-5" />
          </Button>
        </div>

        <RitualRail
          products={ritual}
          title={t.completeRitual.title}
          subtitle={t.completeRitual.subtitle}
          addLabel={t.shop.add}
          saleLabel={t.shop.sale}
          soldOutLabel={t.shop.soldOut}
          onAdd={(e, product) => {
            e.preventDefault();
            if (!product.defaultVariantId) return;
            void addItem({
              id: product.id,
              type: 'product',
              name: product.name,
              price: Number(product.price),
              image_url: product.image_url,
              merchandiseId: product.defaultVariantId,
            }).then((ok) => {
              if (ok) toast(t.pdp.added);
            });
          }}
        />
      </div>
    </div>
  );
}
