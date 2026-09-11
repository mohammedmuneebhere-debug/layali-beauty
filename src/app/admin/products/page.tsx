'use client';

/**
 * Admin products — commerce CRUD moved to Shopify Admin.
 * This page manages Layali regional availability keyed by Shopify product GIDs.
 */

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';
import type { ShopProduct } from '@/lib/catalog';
import type { Region } from '@/types/database';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionMap, setRegionMap] = useState<Record<string, string[]>>({});
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [catalogRes, regionsRes, linksRes] = await Promise.all([
      fetch('/api/shopify/products'),
      supabase.from('regions').select('*').eq('is_active', true).order('country').order('city'),
      supabase.from('layali_product_regions').select('shopify_product_id, region_id, is_available'),
    ]);

    const catalogJson = (await catalogRes.json()) as {
      products?: ShopProduct[];
      configured?: boolean;
      message?: string;
    };
    setConfigured(catalogJson.configured !== false);
    setProducts(catalogJson.products || []);
    setRegions(regionsRes.data || []);

    const map: Record<string, string[]> = {};
    (linksRes.data || []).forEach((row) => {
      if (!row.is_available) return;
      const key = row.shopify_product_id as string;
      if (!map[key]) map[key] = [];
      map[key].push(row.region_id as string);
    });
    setRegionMap(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openRegions = (product: ShopProduct) => {
    setSelectedProductId(product.shopifyProductId);
    setSelectedRegionIds(regionMap[product.shopifyProductId] || []);
    setMessage('');
  };

  const toggleRegion = (regionId: string) => {
    setSelectedRegionIds((prev) =>
      prev.includes(regionId) ? prev.filter((id) => id !== regionId) : [...prev, regionId]
    );
  };

  const saveRegions = async () => {
    if (!selectedProductId) return;
    setSaving(true);
    setMessage('');
    const supabase = createClient();

    await supabase.from('layali_product_regions').delete().eq('shopify_product_id', selectedProductId);

    if (selectedRegionIds.length > 0) {
      const { error } = await supabase.from('layali_product_regions').insert(
        selectedRegionIds.map((region_id) => ({
          shopify_product_id: selectedProductId,
          region_id,
          is_available: true,
        }))
      );
      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }
    }

    setRegionMap((prev) => ({ ...prev, [selectedProductId]: selectedRegionIds }));
    setMessage('Regional availability saved.');
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-white">Products</h1>
          <p className="text-white/50 text-sm mt-1 max-w-2xl">
            Catalog, pricing, inventory, and variants are managed in Shopify Admin. Use this page
            only for Layali regional availability (Shopify product GIDs).
          </p>
        </div>
        <a
          href="https://admin.shopify.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-layali-pink hover:underline"
        >
          Open Shopify Admin <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {!configured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Shopify Storefront is not configured. Set{' '}
          <code className="text-xs">SHOPIFY_STORE_DOMAIN</code> and{' '}
          <code className="text-xs">SHOPIFY_STOREFRONT_ACCESS_TOKEN</code>.
        </div>
      )}

      {loading ? (
        <div className="h-40 rounded-2xl bg-layali-surface animate-pulse border border-white/5" />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {products.length === 0 ? (
              <p className="text-white/45">No Shopify products found.</p>
            ) : (
              products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => openRegions(product)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    selectedProductId === product.shopifyProductId
                      ? 'border-layali-pink bg-layali-pink-glow/10'
                      : 'border-white/10 hover:border-layali-pink/40'
                  }`}
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{product.name}</p>
                      <p className="text-xs text-white/40 mt-1">{product.category}</p>
                      <p className="text-[10px] text-white/30 mt-1 break-all">
                        {product.shopifyProductId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-white">{formatPrice(product.price)}</p>
                      <p className="text-xs text-white/40 mt-1 inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {(regionMap[product.shopifyProductId] || []).length} regions
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="rounded-2xl border border-white/10 p-5 h-fit bg-layali-surface/40">
            <h2 className="font-serif text-xl text-white mb-2">Regional availability</h2>
            {!selectedProductId ? (
              <p className="text-sm text-white/45">Select a product to assign outlet regions.</p>
            ) : (
              <>
                <p className="text-xs text-white/40 mb-4 break-all">{selectedProductId}</p>
                <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
                  {regions.map((region) => (
                    <label
                      key={region.id}
                      className="flex items-center gap-2 text-sm text-white/80"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRegionIds.includes(region.id)}
                        onChange={() => toggleRegion(region.id)}
                      />
                      {region.city}, {region.country}
                    </label>
                  ))}
                </div>
                {regions.length === 0 && (
                  <p className="text-sm text-white/45 mb-4">
                    No active regions. Create them under Admin → Regions.
                  </p>
                )}
                <Button loading={saving} onClick={() => void saveRegions()}>
                  Save regions
                </Button>
                {message && <p className="text-sm text-white/60 mt-3">{message}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
