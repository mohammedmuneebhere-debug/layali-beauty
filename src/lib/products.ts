import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Legacy helpers retained temporarily for historical product_regions UUID rows.
 *
 * Region lookup: `@/lib/regions`
 * Storefront / AI catalog: `@/lib/catalog` + `@/lib/shopify`
 * Curated combo lines: `combos.shopify_items` (Shopify GIDs)
 * Regional availability: `layali_product_regions` (Shopify GIDs)
 *
 * Do NOT use this module as a commerce catalog.
 */

export { getRegionId } from '@/lib/regions';

/**
 * @deprecated Phase 3+ — historical `product_regions` UUID helper only.
 * Prefer `layali_product_regions` keyed by Shopify product GID.
 */
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

/**
 * @deprecated Phase 3+ — historical `product_regions` UUID helper only.
 */
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
