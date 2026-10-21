import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/require-staff';
import { deleteCombo, listCombos, saveCombo } from '@/lib/content/store';
import type { Combo } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  return NextResponse.json({ combos: await listCombos() });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => null)) as Partial<Combo> | null;
  if (!body?.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const combo = await saveCombo(body);
  return NextResponse.json({ combo });
}

export async function DELETE(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await deleteCombo(id);
  return NextResponse.json({ ok: true });
}
