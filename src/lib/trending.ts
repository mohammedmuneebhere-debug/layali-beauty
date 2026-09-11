import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogProduct } from '@/lib/shopify/normalize';
import { fetchShopifyProductsByIds, getCatalogProducts, isShopifyConfigured } from '@/lib/shopify';
import { toCatalogProduct } from '@/lib/shopify/normalize';
import type { TrendingProduct } from '@/types/database';

export const TRENDING_MAX = 8;

export type TrendingCatalogProduct = CatalogProduct;

/**
 * Resolve curated trending rows to Shopify catalog products.
 * Prefer shopify_product_id; legacy product_id UUID rows are skipped until remapped.
 */
export async function fetchTrendingProducts(
  supabase: SupabaseClient
): Promise<TrendingCatalogProduct[]> {
  const { data, error } = await supabase
    .from('trending_products')
    .select('id, product_id, shopify_product_id, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(TRENDING_MAX);

  if (!error && data && data.length > 0 && isShopifyConfigured()) {
    const gids = data
      .map((row) => row.shopify_product_id as string | null)
      .filter((id): id is string => Boolean(id));

    if (gids.length > 0) {
      const products = await fetchShopifyProductsByIds(gids);
      const byId = new Map(products.map((p) => [p.id, toCatalogProduct(p)]));
      return gids.map((id) => byId.get(id)).filter((p): p is CatalogProduct => Boolean(p));
    }
  }

  // Fallback: latest Shopify catalog until trending GIDs are curated
  if (isShopifyConfigured()) {
    return getCatalogProducts({ first: TRENDING_MAX });
  }

  return [];
}

export async function fetchTrendingRows(
  supabase: SupabaseClient
): Promise<(TrendingProduct & { shopify_product_id: string | null })[]> {
  const { data, error } = await supabase
    .from('trending_products')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to load trending rows:', error.message);
    return [];
  }

  return (data || []) as (TrendingProduct & { shopify_product_id: string | null })[];
}
