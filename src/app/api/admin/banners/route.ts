import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/require-staff';
import { deleteBanner, listBanners, saveBanner } from '@/lib/content/store';
import type { SiteBanner } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  return NextResponse.json({ banners: await listBanners() });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => null)) as Partial<SiteBanner> | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const banners = await saveBanner(body);
  return NextResponse.json({ banners });
}

export async function DELETE(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await deleteBanner(id);
  return NextResponse.json({ ok: true });
}
