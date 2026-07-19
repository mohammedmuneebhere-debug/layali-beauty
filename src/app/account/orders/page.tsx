'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, formatDate } from '@/lib/utils';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import { FadeIn } from '@/components/ui/FadeIn';
import type { Order } from '@/types/database';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/signin');
        return;
      }

      const { data } = await supabase
        .from('orders')
        .select('*, items:order_items(*), tracking:order_tracking(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setOrders((data as Order[]) || []);
      setLoading(false);
    }
    load();
  }, [router]);

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-4">
        <FadeIn>
          <Link href="/account" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Account
          </Link>

          <h1 className="font-serif text-4xl font-bold text-white mb-8">My Orders</h1>

          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-layali-pink-glow/15 rounded-2xl" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-12 h-12 mx-auto text-layali-pink mb-4" />
              <p className="text-white/60">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-layali-surface rounded-2xl p-6 border border-layali-pink/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-mono text-sm text-white/60">#{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-white/40">{formatDate(order.created_at)}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${ORDER_STATUS_LABELS[order.status]?.color}`}>
                      {ORDER_STATUS_LABELS[order.status]?.label}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.items?.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-white/70">{item.name} x{item.quantity}</span>
                        <span>{formatPrice(Number(item.price) * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-layali-pink/10 pt-4">
                    <span className="font-bold">{formatPrice(Number(order.total_amount))}</span>
                    {order.tracking_number && (
                      <span className="text-xs text-white/50">Tracking: {order.tracking_number}</span>
                    )}
                  </div>

                  {order.tracking && order.tracking.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-layali-pink/10">
                      <p className="text-xs font-medium text-white mb-2">Tracking History</p>
                      {order.tracking.map((t) => (
                        <div key={t.id} className="text-xs text-white/50 mb-1">
                          {ORDER_STATUS_LABELS[t.status]?.label}
                          {t.message && ` — ${t.message}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </FadeIn>
      </div>
    </div>
  );
}
