'use client';

import { useEffect, useState } from 'react';
import { Eye, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, formatDate } from '@/lib/utils';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import type { Order, OrderStatus } from '@/types/database';

const STATUS_FLOW: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('*, profile:profiles(full_name, email, phone), items:order_items(*), tracking:order_tracking(*)')
      .order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadOrders(); }, []);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const supabase = createClient();
    await supabase.from('orders').update({ status }).eq('id', orderId);
    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status,
      message: statusMessage || `Order ${status}`,
    });
    setStatusMessage('');
    loadOrders();
    if (selectedOrder?.id === orderId) {
      const updated = orders.find((o) => o.id === orderId);
      if (updated) setSelectedOrder({ ...updated, status });
    }
  };

  const addTracking = async (orderId: string) => {
    if (!trackingNumber) return;
    const supabase = createClient();
    await supabase.from('orders').update({
      tracking_number: trackingNumber,
      status: 'shipped',
    }).eq('id', orderId);
    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status: 'shipped',
      message: `Tracking number: ${trackingNumber}`,
    });
    setTrackingNumber('');
    loadOrders();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Order Management</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="p-4">Order</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-4">
                    <p className="text-sm font-mono">#{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                  </td>
                  <td className="p-4 text-sm">{order.profile?.full_name}</td>
                  <td className="p-4 text-sm font-medium">{formatPrice(Number(order.total_amount))}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ORDER_STATUS_LABELS[order.status]?.color}`}>
                      {ORDER_STATUS_LABELS[order.status]?.label}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && orders.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedOrder && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-fit sticky top-6">
            <h3 className="font-bold text-gray-900 mb-4">Order #{selectedOrder.id.slice(0, 8)}</h3>

            <div className="space-y-3 mb-6 text-sm">
              <p><span className="text-gray-500">Customer:</span> {selectedOrder.profile?.full_name}</p>
              <p><span className="text-gray-500">Phone:</span> {selectedOrder.phone}</p>
              <p><span className="text-gray-500">Address:</span> {selectedOrder.shipping_address}</p>
              <p><span className="text-gray-500">City:</span> {selectedOrder.shipping_city}, {selectedOrder.shipping_country}</p>
              <p><span className="text-gray-500">Payment:</span> COD</p>
            </div>

            <h4 className="font-medium text-gray-900 mb-2">Items</h4>
            <div className="space-y-2 mb-6">
              {selectedOrder.items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.name} x{item.quantity}</span>
                  <span>{formatPrice(Number(item.price) * item.quantity)}</span>
                </div>
              ))}
            </div>

            <h4 className="font-medium text-gray-900 mb-2">Update Status</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {STATUS_FLOW.map((status) => (
                <button
                  key={status}
                  onClick={() => updateStatus(selectedOrder.id, status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedOrder.status === status
                      ? 'bg-layali-black text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {ORDER_STATUS_LABELS[status]?.label}
                </button>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Truck className="w-4 h-4" /> Tracking
              </h4>
              <div className="flex gap-2">
                <input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Tracking number"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <Button size="sm" onClick={() => addTracking(selectedOrder.id)}>Add</Button>
              </div>
              {selectedOrder.tracking_number && (
                <p className="text-sm text-gray-500 mt-2">Current: {selectedOrder.tracking_number}</p>
              )}
            </div>

            {selectedOrder.tracking && selectedOrder.tracking.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <h4 className="font-medium text-gray-900 mb-2">History</h4>
                <div className="space-y-2">
                  {selectedOrder.tracking.map((t) => (
                    <div key={t.id} className="text-xs text-gray-500">
                      <span className="font-medium text-gray-700">{ORDER_STATUS_LABELS[t.status]?.label}</span>
                      {t.message && ` — ${t.message}`}
                      <span className="block">{new Date(t.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
