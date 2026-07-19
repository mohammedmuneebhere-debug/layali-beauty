import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/database';

export async function getRegionId(
  supabase: SupabaseClient,
  country: string,
  city: string
): Promise<string | null> {
  if (!country || !city) return null;

  const { data } = await supabase
    .from('regions')
    .select('id')
    .eq('country', country)
    .eq('city', city)
    .eq('is_active', true)
    .single();

  return data?.id ?? null;
}

export async function getProductsForRegion(
  supabase: SupabaseClient,
  options: {
    gender: string;
    country: string;
    city: string;
    category?: string;
  }
): Promise<Product[]> {
  const regionId = await getRegionId(supabase, options.country, options.city);
  if (!regionId) return [];

  let query = supabase
    .from('products')
    .select('*, product_regions!inner(region_id, is_available)')
    .eq('is_active', true)
    .eq('gender', options.gender)
    .eq('product_regions.region_id', regionId)
    .eq('product_regions.is_available', true)
    .order('created_at', { ascending: false });

  if (options.category) {
    query = query.eq('category', options.category);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to load regional products:', error.message);
    return [];
  }

  return (data || []).map((row) => {
    const { product_regions: _ignored, ...product } = row as Product & {
      product_regions?: unknown;
    };
    void _ignored;
    return product as Product;
  });
}

/** Catalog for guests (and fallback) — all active products, optional category/gender */
export async function getPublicProducts(
  supabase: SupabaseClient,
  options?: {
    category?: string;
    gender?: string;
  }
): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (options?.category) {
    query = query.eq('category', options.category);
  }
  if (options?.gender) {
    query = query.eq('gender', options.gender);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to load products:', error.message);
    return [];
  }

  return (data || []) as Product[];
}

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
