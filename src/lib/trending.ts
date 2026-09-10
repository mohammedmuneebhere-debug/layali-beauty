import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product, TrendingProduct } from '@/types/database';

export const TRENDING_MAX = 8;

export async function fetchTrendingProducts(
  supabase: SupabaseClient
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('trending_products')
    .select('id, product_id, sort_order, is_active, products(*)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(TRENDING_MAX);

  if (!error && data && data.length > 0) {
    return data
      .map((row) => {
        const product = row.products as unknown as Product | Product[] | null;
        if (Array.isArray(product)) return product[0] || null;
        return product;
      })
      .filter((p): p is Product => Boolean(p && p.is_active));
  }

  // Fallback until admin curates trending list (or table not migrated yet)
  const { data: fallback } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('gender', 'female')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(TRENDING_MAX);

  return (fallback as Product[]) || [];
}

export async function fetchTrendingRows(
  supabase: SupabaseClient
): Promise<(TrendingProduct & { products: Product | null })[]> {
  const { data, error } = await supabase
    .from('trending_products')
    .select('*, products(*)')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to load trending rows:', error.message);
    return [];
  }

  return (data || []).map((row) => {
    const products = row.products as unknown as Product | Product[] | null;
    return {
      ...(row as TrendingProduct),
      products: Array.isArray(products) ? products[0] || null : products,
    };
  });
}
