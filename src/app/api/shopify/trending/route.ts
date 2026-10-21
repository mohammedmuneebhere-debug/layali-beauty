import { NextResponse } from 'next/server';
import { fetchTrendingProducts } from '@/lib/trending-data';
import { isShopifyConfigured } from '@/lib/shopify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Homepage Trending contract: { products: CatalogProduct[] }
 *
 * Selection is a Shopify shop metafield. Product payloads come from Storefront
 * `nodes(ids:)`. HTTP is private, no-store.
 */
export async function GET() {
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json(
        { products: [], configured: false },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }
    const products = await fetchTrendingProducts();
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
