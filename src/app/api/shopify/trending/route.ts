import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchTrendingProducts } from '@/lib/trending';
import { isShopifyConfigured } from '@/lib/shopify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Homepage Trending contract: { products: CatalogProduct[] }
 *
 * Selection comes from Supabase (cheap). Product payloads come from Storefront
 * `nodes(ids:)` (existing ~60s fetch cache). GID list is not cached so an
 * admin save is visible on the next homepage request. HTTP is private,
 * no-store so the browser does not keep a stale copy.
 */
export async function GET() {
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json(
        { products: [], configured: false },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }
    const supabase = await createClient();
    const products = await fetchTrendingProducts(supabase);
    return NextResponse.json(
      { products, configured: true },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    console.error('Trending API error', err);
    return NextResponse.json(
      { products: [], error: 'Unable to load trending' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
