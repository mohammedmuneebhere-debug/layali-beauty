'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Package, Users, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/utils';
import { ORDER_STATUS_LABELS } from '@/lib/constants';

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  totalRevenue: number;
  catalogConfigured: boolean;
  recentOrders: {
    id: string;
    status: string;
    total_amount: number;
    created_at: string;
    profile?: { full_name: string };
  }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    pendingOrders: 0,
    totalProducts: 0,
    totalRevenue: 0,
    catalogConfigured: true,
    recentOrders: [],
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [ordersRes, countRes, recentRes] = await Promise.all([
        supabase.from('orders').select('id, status, total_amount'),
        fetch('/api/shopify/products/count'),
        supabase
          .from('orders')
          .select('id, status, total_amount, created_at, profile:profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const countJson = (await countRes.json()) as {
        count?: number;
        configured?: boolean;
      };

      const orders = ordersRes.data || [];
      const recent = (recentRes.data || []).map((order) => ({
        id: order.id,
        status: order.status,
        total_amount: Number(order.total_amount),
        created_at: order.created_at,
        profile: Array.isArray(order.profile) ? order.profile[0] : order.profile,
      }));

      setStats({
        totalOrders: orders.length,
        pendingOrders: orders.filter((o) => o.status === 'pending').length,
        totalProducts: countJson.count || 0,
        catalogConfigured: countJson.configured !== false,
        totalRevenue: orders.reduce((sum, o) => sum + Number(o.total_amount), 0),
        recentOrders: recent,
      });
    }
    void Promise.resolve().then(() => {
      void load();
    });
  }, []);

  const cards = [
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart, color: 'bg-blue-500' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: TrendingUp, color: 'bg-yellow-500' },
    {
      label: 'Products (Shopify)',
      value: stats.catalogConfigured ? stats.totalProducts : '—',
      icon: Package,
      color: 'bg-purple-500',
    },
    { label: 'Revenue', value: formatPrice(stats.totalRevenue), icon: Users, color: 'bg-green-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">
        Product count comes from Shopify. Order cards still reflect legacy Supabase COD orders
        until Shopify order links land in a later phase.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${card.color} text-white`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                <th className="p-4">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-4 text-sm font-mono">#{order.id.slice(0, 8)}</td>
                  <td className="p-4 text-sm">{order.profile?.full_name || 'N/A'}</td>
                  <td className="p-4 text-sm font-medium">{formatPrice(Number(order.total_amount))}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${ORDER_STATUS_LABELS[order.status]?.color || ''}`}
                    >
                      {ORDER_STATUS_LABELS[order.status]?.label || order.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {stats.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
