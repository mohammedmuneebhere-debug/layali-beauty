import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/require-staff';
import {
  fetchTrendingConfig,
  replaceTrendingAssignments,
} from '@/lib/trending-data';
import { TRENDING_MAX } from '@/lib/trending';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  try {
    const rows = await fetchTrendingConfig();
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

export async function PUT(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  let body: { products?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    const result = await replaceTrendingAssignments(body.products);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to save trending' },
      { status: 502 }
    );
  }
}
