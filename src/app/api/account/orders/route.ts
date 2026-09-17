import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isShopifyAdminConfigured } from '@/lib/shopify/admin';
import { listCustomerOrders } from '@/lib/account/customer-orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
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

    if (!isShopifyAdminConfigured()) {
      return NextResponse.json(
        { error: 'Orders are temporarily unavailable. Please try again later.' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    const orders = await listCustomerOrders(supabase, user.id);
    return NextResponse.json(
      { orders },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    const downstream =
      typeof err === 'object' && err && 'status' in err
        ? Number((err as { status?: number }).status)
        : NaN;
    const status = downstream === 503 ? 503 : 502;
    console.error('Account orders list failed', err);
    return NextResponse.json(
      { error: 'Orders are temporarily unavailable. Please try again later.' },
      { status, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
