import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadShopCatalog } from '@/lib/catalog';
import { answerCatalogQuery } from '@/lib/assistant';
import { isShopifyConfigured } from '@/lib/shopify';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { query?: string };
    const query = typeof body.query === 'string' ? body.query.slice(0, 280) : '';

    if (!isShopifyConfigured()) {
      return NextResponse.json({
        message: 'The catalog is not configured yet.',
        products: [],
      });
    }

    const supabase = await createClient();
    const { products, source } = await loadShopCatalog({
      supabase,
      first: 80,
      enrichMetadata: false,
    });

    if (source === 'unconfigured' || products.length === 0) {
      return NextResponse.json({
        message: 'No products are available in the catalog right now.',
        products: [],
      });
    }

    return NextResponse.json(answerCatalogQuery(query, products));
  } catch (err) {
    console.error('Assistant ask error', err);
    return NextResponse.json(
      { message: 'Unable to search the catalog right now.', products: [] },
      { status: 502 }
    );
  }
}
