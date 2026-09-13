'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Flame, Search, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';
import { TRENDING_MAX } from '@/lib/trending';
import type { CatalogProduct } from '@/lib/shopify/normalize';

type TrendingRow = {
  shopifyProductId: string;
  rank: number;
  catalog?: CatalogProduct | null;
};

function productGid(product: CatalogProduct): string {
  return product.shopifyProductId || product.id;
}

function ranksFromOrder(rows: TrendingRow[]): TrendingRow[] {
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export default function AdminTrendingPage() {
  const [rows, setRows] = useState<TrendingRow[]>([]);
  const [savedRows, setSavedRows] = useState<TrendingRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = useMemo(
    () =>
      JSON.stringify(rows.map((r) => ({ id: r.shopifyProductId, rank: r.rank }))) !==
      JSON.stringify(savedRows.map((r) => ({ id: r.shopifyProductId, rank: r.rank }))),
    [rows, savedRows]
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [trendingRes, catalogRes] = await Promise.all([
        fetch('/api/admin/trending'),
        fetch('/api/shopify/products'),
      ]);

      const trendingJson = (await trendingRes.json()) as {
        products?: { shopifyProductId: string; rank: number }[];
        error?: string;
      };

      if (!trendingRes.ok) {
        setError(trendingJson.error || 'Unable to load Trending');
        setRows([]);
        setSavedRows([]);
        setLoading(false);
        return;
      }

      const catalogJson = (await catalogRes.json()) as { products?: CatalogProduct[] };
      const products = catalogJson.products || [];
      setCatalog(products);

      const byId = new Map(products.map((p) => [productGid(p), p]));
      const next = ranksFromOrder(
        (trendingJson.products || [])
          .filter((row) => row.shopifyProductId)
          .sort((a, b) => a.rank - b.rank)
          .map((row) => ({
            shopifyProductId: row.shopifyProductId,
            rank: row.rank,
            catalog: byId.get(row.shopifyProductId) || null,
          }))
      );
      setRows(next);
      setSavedRows(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Trending');
    }
    setLoading(false);
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      void load();
    });
  }, []);

  const selectedIds = useMemo(
    () => new Set(rows.map((r) => r.shopifyProductId)),
    [rows]
  );

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((p) => {
      if (selectedIds.has(productGid(p))) return false;
      if (!q) return true;
      return `${p.name} ${p.category}`.toLowerCase().includes(q);
    });
  }, [catalog, selectedIds, search]);

  const addProduct = (product: CatalogProduct) => {
    if (rows.length >= TRENDING_MAX) {
      setError(`Maximum ${TRENDING_MAX} trending products. Remove one first.`);
      return;
    }
    const gid = productGid(product);
    if (!gid.startsWith('gid://shopify/Product/')) {
      setError('This catalog row is missing a Shopify product GID.');
      return;
    }
    setError('');
    setRows(
      ranksFromOrder([
        ...rows,
        {
          shopifyProductId: gid,
          rank: rows.length + 1,
          catalog: product,
        },
      ])
    );
  };

  const removeRow = (shopifyProductId: string) => {
    if (!confirm('Remove this product from trending?')) return;
    setError('');
    setRows(ranksFromOrder(rows.filter((row) => row.shopifyProductId !== shopifyProductId)));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setError('');
    setRows(ranksFromOrder(next));
  };

  const save = async () => {
    const ranks = rows.map((r) => r.rank);
    if (new Set(ranks).size !== ranks.length) {
      setError('Positions must be unique.');
      return;
    }
    if (rows.some((r) => r.rank < 1 || r.rank > TRENDING_MAX)) {
      setError(`Positions must be between 1 and ${TRENDING_MAX}.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/trending', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: rows.map((row) => ({
            shopifyProductId: row.shopifyProductId,
            rank: row.rank,
          })),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || 'Unable to save trending');
        setSaving(false);
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save trending');
    }
    setSaving(false);
  };

  const productCover = (product: CatalogProduct | null | undefined) =>
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
            Select up to {TRENDING_MAX} Shopify products and assign unique positions 1–
            {TRENDING_MAX}. This page stores only Shopify product IDs and order in
            Supabase. Title, price, images, and inventory stay in Shopify.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="rounded-full bg-layali-pink/10 text-layali-pink px-3 py-1 text-sm font-medium">
            {rows.length} / {TRENDING_MAX}
          </span>
          <Button
            size="sm"
            disabled={saving || loading || !dirty}
            onClick={() => void save()}
            className="text-white"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Trending on home page</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Position 1 appears first. Reorder, then save.
              </p>
            </div>
            {rows.length === 0 ? (
              <div className="p-10 text-center text-gray-500 text-sm">
                No trending products yet. Add from the Shopify catalog on the right,
                then save.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {rows.map((row, index) => {
                  const product = row.catalog;
                  const image = productCover(product);
                  return (
                    <li key={row.shopifyProductId} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-xs font-semibold text-layali-pink w-8">
                        #{row.rank}
                      </span>
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
                          {product?.name || row.shopifyProductId}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          Trending
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
                          onClick={() => removeRow(row.shopifyProductId)}
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

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 space-y-3">
              <h2 className="font-semibold text-gray-900">Shopify catalog</h2>
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
                    : 'No matching Shopify products.'}
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
                          Not trending · {formatPrice(Number(product.price))}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={saving || rows.length >= TRENDING_MAX}
                        onClick={() => addProduct(product)}
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
