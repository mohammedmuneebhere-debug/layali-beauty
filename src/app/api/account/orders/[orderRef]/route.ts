import { NextRequest } from 'next/server';
import { getOwnedOrder } from '../route';
import { isForbiddenOrderRef } from '@/lib/account/order-ref';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ orderRef: string }> }
) {
  const { orderRef: rawRef } = await ctx.params;
  const orderRef = decodeURIComponent(rawRef || '').trim();
  if (!orderRef || isForbiddenOrderRef(orderRef)) {
    return NextResponse.json(
      { error: 'Order not found.' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
  try {
    const result = await getOwnedOrder(orderRef);
    if ('error' in result && result.error) return result.error;
    return NextResponse.json(
      { order: result.order },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    console.error('Account order detail failed', err instanceof Error ? err.message : 'error');
    return NextResponse.json(
      { error: 'Orders are temporarily unavailable. Please try again later.' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
