import { NextRequest, NextResponse } from 'next/server';
import { loadPlacementSlides } from '@/lib/content/banners';
import type { BannerPlacement } from '@/types/database';

export const dynamic = 'force-dynamic';

const PLACEMENTS = new Set(['landing_hero', 'shop_hero', 'promo_grid']);

export async function GET(request: NextRequest) {
  const placement = request.nextUrl.searchParams.get('placement') || '';
  if (!PLACEMENTS.has(placement)) {
    return NextResponse.json({ error: 'Unknown placement' }, { status: 400 });
  }
  const slides = await loadPlacementSlides(placement as BannerPlacement);
  return NextResponse.json({ slides });
}
