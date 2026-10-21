import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/require-staff';
import { uploadShopifyImage } from '@/lib/shopify/files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const form = await request.formData();
  const file = form.get('file');
  const folder = String(form.get('folder') || 'catalog');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
  try {
    const url = await uploadShopifyImage(file, `Layali ${folder}`);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
