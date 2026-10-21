import { NextResponse } from 'next/server';
import { listCombos } from '@/lib/content/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const combos = (await listCombos()).filter((combo) => combo.is_active);
  return NextResponse.json({ combos });
}
