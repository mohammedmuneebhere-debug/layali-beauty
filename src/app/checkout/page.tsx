'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, Package } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';

const schema = z.object({
  shipping_address: z.string().min(5, 'Please enter your full address'),
  phone: z.string().min(8, 'Please enter a valid phone number'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [profile, setProfile] = useState<{ city: string; country: string; phone: string; address: string } | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/signin?redirect=/checkout');
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('city, country, phone, address')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data);
    }
    if (items.length === 0 && !orderPlaced) {
      router.push('/cart');
      return;
    }
    loadProfile();
  }, [items, orderPlaced, router]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !profile) return;

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        total_amount: total(),
        payment_method: 'cod',
        shipping_address: data.shipping_address,
        shipping_city: profile.city,
        shipping_country: profile.country,
        phone: data.phone,
        notes: data.notes || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !order) {
      setLoading(false);
      return;
    }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.type === 'product' ? item.id : null,
      combo_id: item.type === 'combo' ? item.id : null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    await supabase.from('order_items').insert(orderItems);
    await supabase.from('order_tracking').insert({
      order_id: order.id,
      status: 'pending',
      message: 'Order placed successfully',
    });

    setOrderId(order.id.slice(0, 8).toUpperCase());
    clearCart();
    setOrderPlaced(true);
    setLoading(false);
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen gradient-pink flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-6" />
          <h1 className="font-serif text-3xl font-bold text-layali-black mb-2">Order Placed!</h1>
          <p className="font-script text-2xl text-layali-black/70 mb-4">thank you</p>
          <p className="text-layali-black/60 mb-2">Order ID: <strong>#{orderId}</strong></p>
          <p className="text-layali-black/60 mb-8">
            Your order will be delivered with Cash on Delivery payment.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => router.push('/account/orders')}>View Orders</Button>
            <Button variant="outline" onClick={() => router.push('/shop')}>Continue Shopping</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-layali-cream py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="font-serif text-4xl font-bold text-layali-black mb-8">Checkout</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-6 border border-layali-pink/20">
            <h2 className="font-serif text-xl font-bold text-layali-black mb-4">Shipping Details</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Shipping Address"
                defaultValue={profile?.address || ''}
                {...register('shipping_address')}
                error={errors.shipping_address?.message}
              />
              <Input
                label="Phone"
                defaultValue={profile?.phone || ''}
                {...register('phone')}
                error={errors.phone?.message}
              />
              <Input
                label="Order Notes (optional)"
                {...register('notes')}
              />
              {profile && (
                <p className="text-sm text-layali-black/50">
                  Delivering to: {profile.city}, {profile.country}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Place Order (COD)
              </Button>
            </form>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-layali-pink/20 h-fit">
            <h2 className="font-serif text-xl font-bold text-layali-black mb-4">Order Summary</h2>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-layali-black/70">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-layali-pink/20 pt-4 flex justify-between">
              <span className="font-bold text-layali-black">Total</span>
              <span className="font-bold text-xl text-layali-black">{formatPrice(total())}</span>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-layali-cream flex items-center gap-2">
              <Package className="w-5 h-5 text-layali-pink-dark" />
              <span className="text-sm text-layali-black/70">Cash on Delivery</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
