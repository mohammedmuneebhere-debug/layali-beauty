'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/FadeIn';
import { useCartStore } from '@/store/cart';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/utils';
import { DELIVERY_FEE } from '@/lib/constants';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

export default function CartPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { items, updateQuantity, removeItem, total, itemCount } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);

  useEffect(() => setMounted(true), []);

  const subtotal = total();
  const grandTotal = subtotal + DELIVERY_FEE;

  const proceedToCheckout = async () => {
    setCheckingAuth(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth/signin?redirect=/checkout');
      setCheckingAuth(false);
      return;
    }

    router.push('/checkout');
    setCheckingAuth(false);
  };

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-20 pt-28 bg-transparent">
        <ShoppingBag className="w-14 h-14 text-layali-pink/60 mb-4" />
        <h2 className="font-serif text-3xl font-medium text-white mb-2">{t.cart.empty}</h2>
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
          <h1 className="font-serif text-4xl font-medium text-white mb-8">
            {t.cart.title} ({itemCount()})
          </h1>
        </FadeIn>

        <div className="space-y-4 mb-8">
          {items.map((item) => (
            <motion.div
              key={`${item.type}-${item.id}`}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-4 glass-panel rounded-2xl p-4"
            >
              <div className="w-20 h-20 rounded-xl bg-layali-surface flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/8">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-layali-pink/50">✦</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate">{item.name}</h3>
                <p className="text-layali-pink text-sm capitalize">{item.type}</p>
                <p className="font-serif text-lg text-white mt-1">{formatPrice(item.price)}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="p-1.5 rounded-full border border-white/15 text-white/70 hover:border-layali-pink/40 hover:text-white transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-medium text-white">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="p-1.5 rounded-full border border-white/15 text-white/70 hover:border-layali-pink/40 hover:text-white transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => removeItem(item.id)}
                className="p-2 text-red-400/70 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white/50">{t.cart.subtotal}</span>
            <span className="font-serif text-lg text-white">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-white/50">{t.cart.delivery}</span>
            <span className="font-serif text-lg text-white">{formatPrice(DELIVERY_FEE)}</span>
          </div>
          <div className="flex justify-between items-center mb-4 pt-3 border-t border-white/10">
            <span className="text-white font-medium">{t.cart.total}</span>
            <span className="font-serif text-xl text-white">{formatPrice(grandTotal)}</span>
          </div>
          <p className="text-xs text-white/40 mb-2">{t.cart.deliveryNote}</p>
          <p className="text-sm text-white/40 mb-2">{t.cart.payment}</p>
          <p className="text-xs text-white/30 mb-6">{t.cart.guestNote}</p>
          <Button className="w-full" size="lg" loading={checkingAuth} onClick={proceedToCheckout}>
            {t.cart.checkout} <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
