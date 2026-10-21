import { NextResponse } from 'next/server';
import { getCustomerContext } from '@/lib/auth/current-customer';
import { createCustomerAddress, listCustomerAddresses } from '@/lib/account/address-book';
import { publicAddressError } from '@/lib/shopify/customer-account-api';
import type { AddressLabel } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
}

export async function GET() {
  const context = await getCustomerContext();
  if (!context.signedIn) return unauthorized();
  try {
    const addresses = await listCustomerAddresses(context.accessToken, context.customer.id);
    return NextResponse.json({ addresses }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('Address list failed', err instanceof Error ? err.message : 'error');
    return NextResponse.json({ error: 'Addresses are temporarily unavailable.' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const context = await getCustomerContext();
  if (!context.signedIn) return unauthorized();
  const body = (await request.json().catch(() => null)) as {
    label?: AddressLabel;
    custom_label?: string | null;
    receiver_name?: string;
    receiver_phone?: string;
    address_line?: string;
    city?: string;
    country?: string;
    latitude?: number | null;
    longitude?: number | null;
    is_default?: boolean;
  } | null;
  if (!body?.receiver_name || !body.receiver_phone || !body.address_line || !body.city) {
    return NextResponse.json({ error: 'Name, phone, address, and city are required.' }, { status: 400 });
  }
  try {
    const address = await createCustomerAddress(context.accessToken, context.customer.id, {
      label: body.label || 'home',
      customLabel: body.custom_label,
      receiverName: body.receiver_name,
      receiverPhone: body.receiver_phone,
      addressLine: body.address_line,
      city: body.city,
      country: body.country?.trim() || '',
      latitude: body.latitude,
      longitude: body.longitude,
      isDefault: Boolean(body.is_default),
    });
    return NextResponse.json({ address });
  } catch (err) {
    console.error('Address save failed', err instanceof Error ? err.message : 'error');
    const failure = publicAddressError(err);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
