import { NextResponse } from 'next/server';
import { countCatalogProducts, isShopifyConfigured } from '@/lib/shopify';
import { publicStorefrontFailure } from '@/lib/shopify/public-error';

export async function GET() {
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json({ count: 0, configured: false });
    }
    const count = await countCatalogProducts();
    return NextResponse.json({ count, configured: true });
  } catch (err) {
    const failure = publicStorefrontFailure(err);
    console.error('Shopify product count error', failure.code, failure.storefrontStatus);
    return NextResponse.json(
      { count: 0, error: 'Unable to count products', code: failure.code, storefrontStatus: failure.storefrontStatus },
      { status: 502 }
    );
  }
}
