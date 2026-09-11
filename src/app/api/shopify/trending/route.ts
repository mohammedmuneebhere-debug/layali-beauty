import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchTrendingProducts } from '@/lib/trending';
import { isShopifyConfigured } from '@/lib/shopify';

export async function GET() {
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json({ products: [], configured: false });
    }
    const supabase = await createClient();
    const products = await fetchTrendingProducts(supabase);
    return NextResponse.json({ products, configured: true });
  } catch (err) {
    console.error('Trending API error', err);
    return NextResponse.json({ products: [], error: 'Unable to load trending' }, { status: 502 });
  }
}
