/**
 * Storefront catalog adapter.
 * Shopify is the authoritative product catalog when configured.
 * Regional filtering uses Supabase layali_product_regions (Shopify GIDs).
 *
 * Catalog fetches use shopifyFetch default revalidate (~60s). Omit `first`
 * for a full cursor-paginated catalog (shop brand filters need all vendors).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogProduct } from '@/lib/shopify/normalize';
import {
  fetchShopifyProductsByIds,
  getCatalogProductByHandle,
  getCatalogProducts,
  isShopifyConfigured,
} from '@/lib/shopify';
import { toCatalogProduct } from '@/lib/shopify/normalize';
import { getRegionId } from '@/lib/regions';
import type { RecommendationProduct } from '@/lib/recommendation';

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

function toShopProduct(p: CatalogProduct, extras?: { benefits?: string[]; is_featured?: boolean }): ShopProduct {
  return {
    ...p,
    benefits: extras?.benefits || [],
    ingredients: null,
    stock_quantity: p.available ? 99 : 0,
    is_active: p.available,
    cost_price: null,
    gender: 'unisex',
    is_featured: extras?.is_featured ?? false,
    created_at: '',
    updated_at: '',
  };
}

async function loadMetadataMap(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<Map<string, { benefits: string[]; is_featured: boolean }>> {
  const map = new Map<string, { benefits: string[]; is_featured: boolean }>();
  if (productIds.length === 0) return map;

  const { data, error } = await supabase
    .from('layali_product_metadata')
    .select('shopify_product_id, beauty_attributes, ai_tags, notes')
    .in('shopify_product_id', productIds);

  if (error) {
    console.warn('layali_product_metadata unavailable:', error.message);
    return map;
  }

  for (const row of data || []) {
    const benefits = [
      ...((row.beauty_attributes as string[] | null) || []),
      ...((row.ai_tags as string[] | null) || []),
    ];
    map.set(row.shopify_product_id as string, {
      benefits,
      is_featured: false,
    });
  }
  return map;
}

export async function filterByRegion(
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
  first?: number;
  enrichMetadata?: boolean;
}): Promise<{ products: ShopProduct[]; source: 'shopify' | 'unconfigured' }> {
  if (!isShopifyConfigured()) {
    return { products: [], source: 'unconfigured' };
  }

  const catalog = await getCatalogProducts({
    category: options.category,
    query: options.query,
    // Omit `first` for the full Storefront catalog (cursor-paginated).
    // Callers that need a bound (e.g. trending, AI) pass `first` explicitly.
    first: options.first,
  });

  let products = catalog.map((p) => toShopProduct(p));

  if (options.country && options.city) {
    products = await filterByRegion(
      options.supabase,
      products,
      options.country,
      options.city
    );
  }

  if (options.enrichMetadata !== false) {
    const meta = await loadMetadataMap(
      options.supabase,
      products.map((p) => p.shopifyProductId)
    );
    products = products.map((p) => {
      const m = meta.get(p.shopifyProductId);
      if (!m) return p;
      return {
        ...p,
        benefits: [...new Set([...p.benefits, ...m.benefits, ...p.tags])],
        is_featured: m.is_featured || p.is_featured,
      };
    });
  }

  return { products, source: 'shopify' };
}

/** Convert shop catalog rows into AI scoring candidates */
export function toRecommendationProducts(products: ShopProduct[]): RecommendationProduct[] {
  return products.map((p) => ({
    shopifyProductId: p.shopifyProductId,
    shopifyVariantId: p.defaultVariantId,
    handle: p.handle,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    image_url: p.image_url,
    category: p.category,
    benefits: [...new Set([...(p.benefits || []), ...(p.tags || [])])],
    tags: p.tags || [],
    available: p.available,
    is_featured: p.is_featured,
  }));
}

/**
 * Load products for survey/AI: Shopify catalog + regional filter + metadata.
 * Single list fetch (not N+1).
 */
export async function loadRecommendationCatalog(options: {
  supabase: SupabaseClient;
  country?: string;
  city?: string;
}): Promise<{
  products: RecommendationProduct[];
  source: 'shopify' | 'unconfigured';
  error?: string;
}> {
  if (!isShopifyConfigured()) {
    return {
      products: [],
      source: 'unconfigured',
      error: 'Shopify catalog is not configured',
    };
  }

  try {
    const { products, source } = await loadShopCatalog({
      supabase: options.supabase,
      country: options.country,
      city: options.city,
      first: 100,
      enrichMetadata: true,
    });

    // Prefer available products for recommendations
    const scored = toRecommendationProducts(products);
    return { products: scored, source };
  } catch (err) {
    console.error('loadRecommendationCatalog failed', err);
    return {
      products: [],
      source: 'shopify',
      error: 'Unable to load products for recommendations',
    };
  }
}

export async function loadShopProductByParam(
  param: string
): Promise<(ShopProduct & { shopifyVariants: { id: string; available: boolean }[] }) | null> {
  if (!isShopifyConfigured() || !param) return null;

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
    const product = (await fetchShopifyProductsByIds([param]))[0];
    if (!product) {
      const { fetchShopifyProductById } = await import('@/lib/shopify/products');
      const byId = await fetchShopifyProductById(param);
      if (!byId) return null;
      const catalog = toCatalogProduct(byId);
      return {
        ...toShopProduct(catalog),
        shopifyVariants: byId.variants.map((v) => ({
          id: v.id,
          available: v.availableForSale,
        })),
      };
    }
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
