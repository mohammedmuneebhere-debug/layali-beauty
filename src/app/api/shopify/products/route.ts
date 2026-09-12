import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadShopCatalog, loadShopProductByParam } from '@/lib/catalog';
import { isShopifyConfigured } from '@/lib/shopify';

export async function GET(req: NextRequest) {
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json(
        {
          products: [],
          configured: false,
          message:
            'Shopify Storefront is not configured. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_ACCESS_TOKEN.',
        },
        { status: 200 }
      );
    }

    const { searchParams } = req.nextUrl;
    const handle = searchParams.get('handle');
    const id = searchParams.get('id');
    const category = searchParams.get('category') || undefined;
    const q = searchParams.get('q') || undefined;
    const country = searchParams.get('country') || undefined;
    const city = searchParams.get('city') || undefined;
    // Optional bound for lightweight callers (e.g. PDP similar). Omit for full catalog.
    const firstRaw = searchParams.get('first');
    const firstParsed = firstRaw ? Number(firstRaw) : undefined;
    const first =
      typeof firstParsed === 'number' && !Number.isNaN(firstParsed) && firstParsed > 0
        ? Math.min(Math.floor(firstParsed), 250)
        : undefined;

    if (handle || id) {
      const product = await loadShopProductByParam(handle || id || '');
      if (!product) {
        return NextResponse.json({ product: null, configured: true }, { status: 404 });
      }
      return NextResponse.json({ product, configured: true });
    }

    const supabase = await createClient();
    const { products, source } = await loadShopCatalog({
      supabase,
      category,
      query: q,
      country,
      city,
      first,
    });
    return NextResponse.json({ products, configured: true, source });
  } catch (err) {
    console.error('Shopify products API error', err);
    return NextResponse.json(
      { products: [], configured: true, error: 'Unable to load products' },
      { status: 502 }
    );
  }
}
