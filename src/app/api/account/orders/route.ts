import { NextResponse } from 'next/server';
import { getCustomerContext } from '@/lib/auth/current-customer';
import { isShopifyAdminConfigured } from '@/lib/shopify/admin';
import { getCustomerOrder, listCustomerOrders } from '@/lib/account/customer-orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET() {
  try {
    const context = await getCustomerContext();
    if (!context.signedIn) return privateJson({ error: 'Please sign in to view your orders.' }, 401);
    if (!isShopifyAdminConfigured()) {
      return privateJson({ error: 'Orders are temporarily unavailable. Please try again later.' }, 503);
    }
    const orders = await listCustomerOrders(context.customer.id);
    return privateJson({ orders });
  } catch (err) {
    console.error('Account orders list failed', err instanceof Error ? err.message : 'error');
    return privateJson({ error: 'Orders are temporarily unavailable. Please try again later.' }, 502);
  }
}

export async function getOwnedOrder(orderRef: string) {
  const context = await getCustomerContext();
  if (!context.signedIn) return { error: privateJson({ error: 'Please sign in to view your orders.' }, 401) };
  if (!isShopifyAdminConfigured()) {
    return { error: privateJson({ error: 'Orders are temporarily unavailable. Please try again later.' }, 503) };
  }
  const order = await getCustomerOrder(context.customer.id, orderRef);
  if (!order) return { error: privateJson({ error: 'Order not found.' }, 404) };
  return { order };
}
