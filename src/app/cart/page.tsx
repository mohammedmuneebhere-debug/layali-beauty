'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/FadeIn';
import { useCartStore } from '@/store/cart';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

export default function CartPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { items, updateQuantity, removeItem, total, itemCount, refresh } = useCartStore();
  const [checkingAuth, setCheckingAuth] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subtotal = total();

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

    router.push('/checkout');
    setCheckingAuth(false);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-20 pt-28 bg-transparent">
        <ShoppingBag className="w-14 h-14 text-layali-pink/60 mb-4" />
        <h2 className="font-serif text-heading-md font-medium text-white mb-2">{t.cart.empty}</h2>
        <p className="text-white/45 mb-6">{t.cart.emptyHint}</p>
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
          <h1 className="font-serif text-heading-lg font-medium text-white mb-8">
            {t.cart.title} ({itemCount()})
          </h1>
        </FadeIn>

        <div className="space-y-4 mb-8">
          {items.map((item) => (
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
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
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
                    onClick={() => void updateQuantity(item.id, item.quantity - 1)}
                    className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full border border-white/15 text-white/70 hover:border-layali-pink/40 hover:text-white transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium text-white">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                    className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full border border-white/15 text-white/70 hover:border-layali-pink/40 hover:text-white transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void removeItem(item.id)}
                  className="inline-flex items-center justify-center min-h-11 min-w-11 text-red-400/70 hover:text-red-400 transition-colors"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white/50">{t.cart.subtotal}</span>
            <span className="text-price text-white">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-white/50">{t.cart.delivery}</span>
            <span className="text-sm text-white/40">Calculated at checkout</span>
          </div>
          <div className="flex justify-between items-center mb-4 pt-3 border-t border-white/10">
            <span className="text-white font-medium">{t.cart.total}</span>
            <span className="text-price text-lg text-white">{formatPrice(subtotal)}</span>
          </div>
          <p className="text-xs text-white/40 mb-6">
            You will complete payment and shipping on Shopify Checkout.
          </p>
          <Button
            className="w-full"
            size="lg"
            loading={checkingAuth}
            onClick={() => void proceedToCheckout()}
          >
            {t.cart.checkout} <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
