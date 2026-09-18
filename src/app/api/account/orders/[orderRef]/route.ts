import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isShopifyAdminConfigured } from '@/lib/shopify/admin';
import { getCustomerOrder } from '@/lib/account/customer-orders';
import { isForbiddenOrderRef } from '@/lib/account/order-ref';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ orderRef: string }> }
) {
  try {
    const { orderRef: rawRef } = await ctx.params;
    const orderRef = decodeURIComponent(rawRef || '').trim();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: 'Please sign in to view your orders.' },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    if (!orderRef || isForbiddenOrderRef(orderRef)) {
      return NextResponse.json(
        { error: 'Order not found.' },
        { status: 404, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    if (!isShopifyAdminConfigured()) {
      return NextResponse.json(
        { error: 'Orders are temporarily unavailable. Please try again later.' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    const order = await getCustomerOrder(supabase, user.id, orderRef);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found.' },
        { status: 404, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    return NextResponse.json(
      { order },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    console.error('Account order detail failed', err);
    return NextResponse.json(
      { error: 'Orders are temporarily unavailable. Please try again later.' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
