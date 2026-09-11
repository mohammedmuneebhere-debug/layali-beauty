import { NextResponse } from 'next/server';
import { countCatalogProducts, isShopifyConfigured } from '@/lib/shopify';

export async function GET() {
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json({ count: 0, configured: false });
    }
    const count = await countCatalogProducts();
    return NextResponse.json({ count, configured: true });
  } catch (err) {
    console.error('Shopify product count error', err);
    return NextResponse.json({ count: 0, error: 'Unable to count products' }, { status: 502 });
  }
}
