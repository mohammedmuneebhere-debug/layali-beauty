'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  Percent,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatPrice } from '@/lib/utils';
import {
  type AnalyticsOrderRow,
  computeDateSeries,
  computeProductBreakdown,
  computeStatusBreakdown,
  computeSummary,
  defaultDateRange,
  filterOrders,
} from '@/lib/analytics';
import type { Product } from '@/types/database';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'profit' | 'loss';
}) {
  const toneClass =
    tone === 'profit'
      ? 'text-green-600'
      : tone === 'loss'
        ? 'text-red-600'
        : 'text-gray-900';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-layali-pink/10 text-layali-pink">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function BarChart({
  data,
  valueKey,
  label,
  color = 'bg-layali-pink',
}: {
  data: { date: string; [key: string]: string | number }[];
  valueKey: string;
  label: string;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  if (data.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No data for this period.</p>;
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-4 uppercase tracking-wider">{label}</p>
      <div className="flex items-end gap-1 sm:gap-2 h-40 overflow-x-auto pb-2">
        {data.map((point) => {
          const value = Number(point[valueKey]) || 0;
          const height = Math.max((value / max) * 100, value > 0 ? 4 : 0);
          return (
            <div
              key={point.date}
              className="flex flex-col items-center min-w-[28px] flex-1"
              title={`${point.date}: ${value.toFixed(2)}`}
            >
              <div
                className={`w-full max-w-[40px] rounded-t-md ${color} transition-all`}
                style={{ height: `${height}%` }}
              />
              <span className="text-[9px] text-gray-400 mt-1 rotate-0 truncate w-full text-center">
                {point.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const defaults = defaultDateRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [includePending, setIncludePending] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AnalyticsOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'overview' | 'sales' | 'profit' | 'products'>('overview');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const [productsRes, ordersRes] = await Promise.all([
        supabase.from('products').select('id, name, price, cost_price, category').order('name'),
        supabase
          .from('orders')
          .select(
            'id, status, total_amount, delivery_fee, created_at, items:order_items(product_id, combo_id, name, price, cost_price, quantity)'
          )
          .order('created_at', { ascending: false }),
      ]);

      setProducts((productsRes.data as Product[]) || []);
      setOrders((ordersRes.data as AnalyticsOrderRow[]) || []);
      setLoading(false);
    };

    void load();
  }, []);

  const filtered = useMemo(
    () =>
      filterOrders(orders, {
        from,
        to,
        productIds: selectedProductIds.length ? selectedProductIds : undefined,
        includePending,
      }),
    [orders, from, to, selectedProductIds, includePending]
  );

  const summary = useMemo(() => computeSummary(filtered), [filtered]);
  const dateSeries = useMemo(() => computeDateSeries(filtered), [filtered]);
  const productRows = useMemo(() => computeProductBreakdown(filtered), [filtered]);
  const statusRows = useMemo(() => computeStatusBreakdown(filtered), [filtered]);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const profitTone = summary.profit >= 0 ? 'profit' : 'loss';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Financial and sales insights — filter by date range and products. Set cost prices on products for profit tracking.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-900">Filters</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            tone="light"
            label="From date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            tone="light"
            label="To date"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includePending}
                onChange={(e) => setIncludePending(e.target.checked)}
                className="rounded border-gray-300"
              />
              Include pending orders
            </label>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const d = defaultDateRange();
                setFrom(d.from);
                setTo(d.to);
                setSelectedProductIds([]);
              }}
            >
              Reset filters
            </Button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Products (optional — leave empty for all)</p>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {products.map((product) => {
              const selected = selectedProductIds.includes(product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggleProduct(product.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-layali-pink text-white border-layali-pink'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-layali-pink/50'
                  }`}
                >
                  {product.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading analytics...</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              label="Revenue"
              value={formatPrice(summary.revenue)}
              sub={`+ ${formatPrice(summary.deliveryRevenue)} delivery`}
              icon={TrendingUp}
            />
            <StatCard
              label="Cost (COGS)"
              value={formatPrice(summary.cost)}
              icon={Package}
            />
            <StatCard
              label="Gross Profit"
              value={formatPrice(summary.profit)}
              tone={profitTone}
              icon={summary.profit >= 0 ? TrendingUp : TrendingDown}
            />
            <StatCard
              label="Margin"
              value={`${summary.marginPercent.toFixed(1)}%`}
              icon={Percent}
              tone={profitTone}
            />
            <StatCard
              label="Orders"
              value={String(summary.orders)}
              icon={ShoppingCart}
            />
            <StatCard
              label="Units sold"
              value={String(summary.units)}
              sub={`AOV ${formatPrice(summary.avgOrderValue)}`}
              icon={BarChart3}
            />
          </div>

          {/* View tabs */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['overview', 'Overview'],
                ['sales', 'Sales by date'],
                ['profit', 'Profit by date'],
                ['products', 'By product'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  view === key
                    ? 'bg-layali-black text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {(view === 'overview' || view === 'sales') && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
                <BarChart data={dateSeries} valueKey="revenue" label="Daily sales (SAR)" />
              </div>
            )}

            {(view === 'overview' || view === 'profit') && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
                <BarChart
                  data={dateSeries}
                  valueKey="profit"
                  label="Daily gross profit (SAR)"
                  color="bg-green-500"
                />
              </div>
            )}

            {view === 'overview' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-sm font-semibold text-gray-900 mb-4">Order status breakdown</p>
                <div className="space-y-2">
                  {statusRows.map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-gray-600">{status}</span>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                  {statusRows.length === 0 && (
                    <p className="text-sm text-gray-500">No orders in range.</p>
                  )}
                </div>
              </div>
            )}

            {view === 'overview' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-sm font-semibold text-gray-900 mb-2">Profit note</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Profit is calculated as selling price minus cost price (COGS) per line item.
                  Add cost prices in Products or Combos admin. Historical orders snapshot cost at checkout time.
                  Delivery fees are shown separately and not deducted from profit.
                </p>
              </div>
            )}

            {(view === 'overview' || view === 'products') && (
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden lg:col-span-2">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">Product performance</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Units</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Revenue</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Cost</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Profit</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                            No product sales in this period.
                          </td>
                        </tr>
                      ) : (
                        productRows.map((row) => {
                          const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
                          return (
                            <tr key={row.key} className="border-t border-gray-100">
                              <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{row.units}</td>
                              <td className="px-4 py-3 text-right">{formatPrice(row.revenue)}</td>
                              <td className="px-4 py-3 text-right text-gray-600">
                                {formatPrice(row.cost)}
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-medium ${
                                  row.profit >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {formatPrice(row.profit)}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600">
                                {margin.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

