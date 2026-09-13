import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fetchTrendingConfig,
  replaceTrendingAssignments,
  TRENDING_MAX,
} from '@/lib/trending';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { supabase, user };
}

/**
 * GET — current Trending selection (GIDs + ranks). Admin session required.
 * Product details are loaded by the admin UI from /api/shopify/products.
 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const rows = await fetchTrendingConfig(auth.supabase);
    return NextResponse.json({
      products: rows.map((row) => ({
        id: row.id,
        shopifyProductId: row.shopifyProductId,
        rank: row.rank,
        isActive: row.isActive,
      })),
      max: TRENDING_MAX,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to load trending' },
      { status: 500 }
    );
  }
}

/**
 * PUT — replace Trending selection.
 * Body: { products: { shopifyProductId: string, rank: number }[] }
 *
 * Writes only shopify_product_id + sort_order to Supabase. Does not touch
 * Shopify inventory, prices, variants, or publications.
 */
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  let body: { products?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = await replaceTrendingAssignments(auth.supabase, body.products);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    products: (result.rows || []).map((row) => ({
      id: row.id,
      shopifyProductId: row.shopifyProductId,
      rank: row.rank,
      isActive: row.isActive,
    })),
    max: TRENDING_MAX,
  });
}
