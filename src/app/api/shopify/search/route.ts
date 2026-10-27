import { NextRequest, NextResponse } from 'next/server';
import { isShopifyConfigured } from '@/lib/shopify';
import { publicStorefrontFailure } from '@/lib/shopify/public-error';
import { suggestStorefrontProducts } from '@/lib/shop-search-index';

export async function GET(req: NextRequest) {
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json({ products: [], configured: false });
    }
    const q = req.nextUrl.searchParams.get('q') || '';
    const products = await suggestStorefrontProducts(q);
    return NextResponse.json({ products, configured: true, query: q.trim() });
  } catch (err) {
    const failure = publicStorefrontFailure(err);
    console.error('Shopify search API error', failure.code, failure.storefrontStatus);
    return NextResponse.json({ products: [], configured: true, ...failure }, { status: 502 });
  }
}
