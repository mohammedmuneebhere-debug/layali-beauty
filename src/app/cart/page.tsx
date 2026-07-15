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

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, total, itemCount } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);

  useEffect(() => setMounted(true), []);

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
      <div className="min-h-[60vh] flex flex-col items-center justify-center py-20">
        <ShoppingBag className="w-16 h-16 text-layali-pink mb-4" />
        <h2 className="font-serif text-2xl font-bold text-layali-black mb-2">Your cart is empty</h2>
        <p className="text-layali-black/60 mb-6">Discover our beautiful products</p>
        <Link href="/shop">
          <Button>Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-layali-cream py-12">
      <div className="max-w-4xl mx-auto px-4">
        <FadeIn>
          <h1 className="font-serif text-4xl font-bold text-layali-black mb-8">
            Your Cart ({itemCount()})
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
              className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-layali-pink/20"
            >
              <div className="w-20 h-20 rounded-xl bg-layali-pink-light/30 flex items-center justify-center flex-shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-2xl">✦</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-layali-black truncate">{item.name}</h3>
                <p className="text-layali-pink-dark text-sm capitalize">{item.type}</p>
                <p className="font-bold text-layali-black mt-1">{formatPrice(item.price)}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="p-1.5 rounded-full hover:bg-layali-pink-light/50"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="p-1.5 rounded-full hover:bg-layali-pink-light/50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => removeItem(item.id)}
                className="p-2 text-red-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-layali-pink/20">
          <div className="flex justify-between items-center mb-4">
            <span className="text-layali-black/60">Subtotal</span>
            <span className="font-bold text-xl text-layali-black">{formatPrice(total())}</span>
          </div>
          <p className="text-sm text-layali-black/50 mb-2">Payment: Cash on Delivery (COD)</p>
          <p className="text-xs text-layali-black/40 mb-6">
            You can shop as a guest. Sign in is required to place your order.
          </p>
          <Button className="w-full" size="lg" loading={checkingAuth} onClick={proceedToCheckout}>
            Proceed to Checkout <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
