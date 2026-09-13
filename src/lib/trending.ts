/**
 * Homepage Trending — hybrid ownership
 *
 * Supabase `trending_products` stores only which Shopify products are Trending
 * and in what order (`shopify_product_id` + `sort_order` 1–8).
 *
 * Shopify Storefront hydrates those GIDs into CatalogProduct (title, images,
 * price, variants, inventory). Product commerce data is never copied into
 * Supabase.
 *
 * Empty selection → empty list. No silent first-N catalog fallback.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchShopifyProductsByIds, isShopifyConfigured } from '@/lib/shopify';
import { toCatalogProduct, type CatalogProduct } from '@/lib/shopify/normalize';

export const TRENDING_MAX = 8;

export type TrendingCatalogProduct = CatalogProduct;

export type TrendingAssignment = {
  shopifyProductId: string;
  rank: number;
};

const SHOPIFY_PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;

export type TrendingValidationResult =
  | { ok: true; products: TrendingAssignment[] }
  | { ok: false; error: string };

export function validateTrendingAssignments(input: unknown): TrendingValidationResult {
  if (!Array.isArray(input)) {
    return { ok: false, error: 'products must be an array' };
  }
  if (input.length > TRENDING_MAX) {
    return { ok: false, error: `Maximum ${TRENDING_MAX} trending products` };
  }

  const products: TrendingAssignment[] = [];
  const ranks = new Set<number>();
  const ids = new Set<string>();

  for (const row of input) {
    if (!row || typeof row !== 'object') {
      return { ok: false, error: 'Each trending product must be an object' };
    }
    const shopifyProductId =
      typeof (row as { shopifyProductId?: unknown }).shopifyProductId === 'string'
        ? (row as { shopifyProductId: string }).shopifyProductId.trim()
        : '';
    const rankRaw = (row as { rank?: unknown }).rank;
    const rank = typeof rankRaw === 'number' ? rankRaw : Number(rankRaw);

    if (!SHOPIFY_PRODUCT_GID.test(shopifyProductId)) {
      return { ok: false, error: 'shopifyProductId must be a Shopify product GID' };
    }
    if (!Number.isInteger(rank)) {
      return { ok: false, error: 'rank must be an integer' };
    }
    if (rank < 1 || rank > TRENDING_MAX) {
      return { ok: false, error: `rank must be between 1 and ${TRENDING_MAX}` };
    }
    if (ranks.has(rank)) {
      return { ok: false, error: `Duplicate rank ${rank}` };
    }
    if (ids.has(shopifyProductId)) {
      return { ok: false, error: 'Duplicate Shopify product in trending list' };
    }

    ranks.add(rank);
    ids.add(shopifyProductId);
    products.push({ shopifyProductId, rank });
  }

  return { ok: true, products };
}

export type TrendingConfigRow = {
  id: string;
  shopifyProductId: string;
  rank: number;
  isActive: boolean;
};

export async function fetchTrendingConfig(
  supabase: SupabaseClient
): Promise<TrendingConfigRow[]> {
  const { data, error } = await supabase
    .from('trending_products')
    .select('id, shopify_product_id, sort_order, is_active')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to load trending config:', error.message);
    throw new Error(error.message);
  }

  return (data || [])
    .map((row) => ({
      id: row.id as string,
      shopifyProductId: (row.shopify_product_id as string | null) || '',
      rank: Number(row.sort_order),
      isActive: row.is_active !== false,
    }))
    .filter((row) => Boolean(row.shopifyProductId));
}

/**
 * Resolve curated Supabase rows to Shopify CatalogProduct via Storefront
 * `nodes(ids:)`. GID order from sort_order is preserved. Zero-stock products
 * remain eligible. Empty config → [].
 */
export async function fetchTrendingProducts(
  supabase: SupabaseClient
): Promise<TrendingCatalogProduct[]> {
  if (!isShopifyConfigured()) return [];

  const { data, error } = await supabase
    .from('trending_products')
    .select('shopify_product_id, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(TRENDING_MAX);

  if (error) {
    console.error('Failed to load trending rows:', error.message);
    return [];
  }

  const gids = (data || [])
    .map((row) => row.shopify_product_id as string | null)
    .filter((id): id is string => Boolean(id));

  if (gids.length === 0) return [];

  const products = await fetchShopifyProductsByIds(gids);
  const byId = new Map(products.map((p) => [p.id, toCatalogProduct(p)]));

  return gids
    .map((id) => byId.get(id))
    .filter((p): p is CatalogProduct => Boolean(p?.handle));
}

/** Replace the Trending set. Caller must already be an authorized admin. */
export async function replaceTrendingAssignments(
  supabase: SupabaseClient,
  input: unknown
): Promise<TrendingValidationResult & { rows?: TrendingConfigRow[] }> {
  const parsed = validateTrendingAssignments(input);
  if (!parsed.ok) return parsed;

  const { error: deleteError } = await supabase
    .from('trending_products')
    .delete()
    .not('id', 'is', null);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  if (parsed.products.length === 0) {
    return { ok: true, products: [], rows: [] };
  }

  const { error: insertError } = await supabase.from('trending_products').insert(
    parsed.products.map((item) => ({
      shopify_product_id: item.shopifyProductId,
      product_id: null,
      sort_order: item.rank,
      is_active: true,
    }))
  );

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  const rows = await fetchTrendingConfig(supabase);
  return { ok: true, products: parsed.products, rows };
}
