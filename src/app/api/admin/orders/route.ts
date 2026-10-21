import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/require-staff';
import { isShopifyAdminConfigured } from '@/lib/shopify/admin';
import { loadAdminOrderBoard, recordAdminOrderUpdate } from '@/lib/shopify/admin-order-board';
import type { OrderStatus } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  if (!isShopifyAdminConfigured()) {
    return NextResponse.json({ orders: [], analytics: [], costs: [], configured: false });
  }
  try {
    const board = await loadAdminOrderBoard();
    return NextResponse.json({ ...board, configured: true });
  } catch (err) {
    console.error('Admin orders failed', err instanceof Error ? err.message : 'error');
    return NextResponse.json({ error: 'Orders are temporarily unavailable.' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: OrderStatus;
    trackingNumber?: string | null;
    message?: string | null;
  } | null;
  const id = body?.id;
  if (!id?.startsWith('gid://shopify/Order/')) {
    return NextResponse.json({ error: 'A Shopify order id is required.' }, { status: 400 });
  }
  await recordAdminOrderUpdate({ ...body, id });
  return NextResponse.json({ ok: true });
}
