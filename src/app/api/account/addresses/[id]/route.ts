import { NextResponse } from 'next/server';
import { getCustomerContext } from '@/lib/auth/current-customer';
import {
  listCustomerAddresses,
  makeDefaultAddress,
  removeCustomerAddress,
  updateCustomerAddressPin,
} from '@/lib/account/address-book';
import { publicAddressError } from '@/lib/shopify/customer-account-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Params) {
  const context = await getCustomerContext();
  if (!context.signedIn) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    latitude?: number;
    longitude?: number;
    is_default?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  try {
    const owned = await listCustomerAddresses(context.accessToken, context.customer.id);
    if (!owned.some((address) => address.id === id)) {
      return NextResponse.json({ error: 'Address not found.' }, { status: 404 });
    }
    if (body.is_default) await makeDefaultAddress(context.accessToken, id);
    if (typeof body.latitude === 'number' && typeof body.longitude === 'number') {
      await updateCustomerAddressPin(context.customer.id, id, body.latitude, body.longitude);
    }
  } catch (err) {
    console.error('Address update failed', err instanceof Error ? err.message : 'error');
    const failure = publicAddressError(err, 'Could not update address.');
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: Params) {
  const context = await getCustomerContext();
  if (!context.signedIn) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const owned = await listCustomerAddresses(context.accessToken, context.customer.id);
    if (!owned.some((address) => address.id === id)) {
      return NextResponse.json({ error: 'Address not found.' }, { status: 404 });
    }
    await removeCustomerAddress(context.accessToken, context.customer.id, id);
  } catch (err) {
    console.error('Address delete failed', err instanceof Error ? err.message : 'error');
    const failure = publicAddressError(err, 'Could not delete address.');
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}
