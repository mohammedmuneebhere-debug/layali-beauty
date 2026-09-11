import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Legacy helpers retained temporarily for admin/analytics that still touch
 * deprecated Supabase commerce tables (Phase 3/4).
 *
 * Region lookup lives in `@/lib/regions`.
 * Storefront catalog lives in `@/lib/catalog` + `@/lib/shopify`.
 *
 * Do NOT use getProductsForRegion / getPublicProducts for survey or AI —
 * those paths must use loadRecommendationCatalog.
 */

export { getRegionId } from '@/lib/regions';

/** @deprecated Phase 3 — admin curated combo picker still uses UUID product rows */
export async function saveProductRegions(
  supabase: SupabaseClient,
  productId: string,
  regionIds: string[]
) {
  await supabase.from('product_regions').delete().eq('product_id', productId);

  if (regionIds.length === 0) return;

  await supabase.from('product_regions').insert(
    regionIds.map((regionId) => ({
      product_id: productId,
      region_id: regionId,
      is_available: true,
    }))
  );
}

/** @deprecated Phase 3 — prefer layali_product_regions by Shopify GID */
export async function getProductRegionIds(
  supabase: SupabaseClient,
  productId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('product_regions')
    .select('region_id')
    .eq('product_id', productId)
    .eq('is_available', true);

  return (data || []).map((row) => row.region_id);
}
