'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Flame, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';
import { fetchTrendingRows, TRENDING_MAX } from '@/lib/trending';
import type { Product, TrendingProduct } from '@/types/database';

type TrendingRow = TrendingProduct & { products: Product | null };

export default function AdminTrendingPage() {
  const [rows, setRows] = useState<TrendingRow[]>([]);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const [trending, productsRes] = await Promise.all([
      fetchTrendingRows(supabase),
      supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ]);
    setRows(trending);
    setCatalog((productsRes.data as Product[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedIds = useMemo(() => new Set(rows.map((r) => r.product_id)), [rows]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((p) => {
      if (selectedIds.has(p.id)) return false;
      if (!q) return true;
      return `${p.name} ${p.category}`.toLowerCase().includes(q);
    });
  }, [catalog, selectedIds, search]);

  const addProduct = async (productId: string) => {
    if (rows.length >= TRENDING_MAX) {
      alert(`Maximum ${TRENDING_MAX} trending products. Remove one first.`);
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const nextOrder = rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.sort_order)) + 1;
    const { error } = await supabase.from('trending_products').insert({
      product_id: productId,
      sort_order: nextOrder,
      is_active: true,
    });
    if (error) {
      alert(error.message.includes('relation') || error.message.includes('does not exist')
        ? 'Run supabase/trending.sql in Supabase SQL Editor first.'
        : error.message);
      setSaving(false);
      return;
    }
    await load();
    setSaving(false);
  };

  const removeRow = async (id: string) => {
    if (!confirm('Remove this product from trending?')) return;
    const supabase = createClient();
    await supabase.from('trending_products').delete().eq('id', id);
    await load();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    const a = rows[index];
    const b = rows[target];
    setSaving(true);
    const supabase = createClient();
    await Promise.all([
      supabase.from('trending_products').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('trending_products').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    // Also normalize to 0..n after swap for stability
    const reordered = [...rows];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await Promise.all(
      reordered.map((row, i) =>
        supabase.from('trending_products').update({ sort_order: i }).eq('id', row.id)
      )
    );
    await load();
    setSaving(false);
  };

  const productCover = (product: Product | null) =>
    product?.images?.[0] || product?.image_url || null;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Flame className="w-6 h-6 text-layali-pink" />
            Trending Products
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Curate up to {TRENDING_MAX} products for the home page carousel. Order here is the
            display order on the site.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-layali-pink/10 text-layali-pink px-3 py-1 text-sm font-medium">
          {rows.length} / {TRENDING_MAX}
        </span>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Current trending */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">On home page</h2>
              <p className="text-xs text-gray-500 mt-0.5">Drag order with up/down arrows</p>
            </div>
            {rows.length === 0 ? (
              <div className="p-10 text-center text-gray-500 text-sm">
                No trending products yet. Add from the catalog on the right.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {rows.map((row, index) => {
                  const product = row.products;
                  const image = productCover(product);
                  return (
                    <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-xs font-medium text-gray-400 w-5">{index + 1}</span>
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt=""
                          className="w-12 h-14 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-12 h-14 rounded-lg bg-gray-100" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {product?.name || 'Deleted product'}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {product?.category}
                          {product ? ` · ${formatPrice(Number(product.price))}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={saving || index === 0}
                          onClick={() => move(index, -1)}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={saving || index === rows.length - 1}
                          onClick={() => move(index, 1)}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                          aria-label="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Catalog picker */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 space-y-3">
              <h2 className="font-semibold text-gray-900">Add from catalog</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-layali-pink"
                />
              </div>
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
              {available.length === 0 ? (
                <p className="p-8 text-center text-sm text-gray-500">
                  {rows.length >= TRENDING_MAX
                    ? `Limit reached (${TRENDING_MAX}). Remove a product to add another.`
                    : 'No matching products.'}
                </p>
              ) : (
                available.map((product) => {
                  const image = productCover(product);
                  return (
                    <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt=""
                          className="w-12 h-14 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-12 h-14 rounded-lg bg-gray-100" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-gray-500 capitalize">
                          {product.category} · {formatPrice(Number(product.price))}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={saving || rows.length >= TRENDING_MAX}
                        onClick={() => addProduct(product.id)}
                      >
                        <Plus className="w-4 h-4" /> Add
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
