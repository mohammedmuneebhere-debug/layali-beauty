/**
 * Storefront catalog adapter.
 * Shopify is the authoritative product catalog when configured.
 * Regional filtering uses Supabase layali_product_regions (Shopify GIDs).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogProduct } from '@/lib/shopify/normalize';
import { getCatalogProductByHandle, getCatalogProducts, isShopifyConfigured } from '@/lib/shopify';
import { getRegionId } from '@/lib/products';

export type ShopProduct = CatalogProduct & {
  /** UI fields expected by existing product cards / PDP */
  benefits: string[];
  ingredients: string | null;
  stock_quantity: number;
  is_active: boolean;
  cost_price: null;
  gender: 'female' | 'male' | 'unisex';
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

function toShopProduct(p: CatalogProduct): ShopProduct {
  return {
    ...p,
    benefits: [],
    ingredients: null,
    stock_quantity: p.available ? 99 : 0,
    is_active: p.available,
    cost_price: null,
    gender: 'unisex',
    is_featured: false,
    created_at: '',
    updated_at: '',
  };
}

async function filterByRegion(
  supabase: SupabaseClient,
  products: ShopProduct[],
  country: string,
  city: string
): Promise<ShopProduct[]> {
  const regionId = await getRegionId(supabase, country, city);
  if (!regionId) return products;

  const { data, error } = await supabase
    .from('layali_product_regions')
    .select('shopify_product_id')
    .eq('region_id', regionId)
    .eq('is_available', true);

  if (error) {
    // Table may not exist yet — show full catalog during migration
    console.warn('layali_product_regions unavailable:', error.message);
    return products;
  }

  if (!data || data.length === 0) {
    // No regional rows configured yet — do not hide the catalog
    return products;
  }

  const allowed = new Set(data.map((r) => r.shopify_product_id));
  return products.filter((p) => allowed.has(p.shopifyProductId));
}

export async function loadShopCatalog(options: {
  supabase: SupabaseClient;
  category?: string;
  country?: string;
  city?: string;
  query?: string;
}): Promise<{ products: ShopProduct[]; source: 'shopify' | 'unconfigured' }> {
  if (!isShopifyConfigured()) {
    return { products: [], source: 'unconfigured' };
  }

  let products = (await getCatalogProducts({
    category: options.category,
    query: options.query,
    first: 50,
  })).map(toShopProduct);

  if (options.country && options.city) {
    products = await filterByRegion(
      options.supabase,
      products,
      options.country,
      options.city
    );
  }

  return { products, source: 'shopify' };
}

export async function loadShopProductByParam(
  param: string
): Promise<(ShopProduct & { shopifyVariants: { id: string; available: boolean }[] }) | null> {
  if (!isShopifyConfigured() || !param) return null;

  // Prefer handle (new URLs). Also accept raw GID for transitional links.
  const byHandle = await getCatalogProductByHandle(param);
  if (byHandle) {
    return {
      ...toShopProduct(byHandle),
      shopifyVariants: byHandle.shopify.variants.map((v) => ({
        id: v.id,
        available: v.availableForSale,
      })),
    };
  }

  if (param.startsWith('gid://')) {
    const { fetchShopifyProductById } = await import('@/lib/shopify/products');
    const product = await fetchShopifyProductById(param);
    if (!product) return null;
    const { toCatalogProduct } = await import('@/lib/shopify/normalize');
    const catalog = toCatalogProduct(product);
    return {
      ...toShopProduct(catalog),
      shopifyVariants: product.variants.map((v) => ({
        id: v.id,
        available: v.availableForSale,
      })),
    };
  }

  return null;
}
