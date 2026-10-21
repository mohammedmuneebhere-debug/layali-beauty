import { NextResponse } from 'next/server';
import { getCustomerContext, type ProfileExtras } from '@/lib/auth/current-customer';
import { customerPublic } from '@/lib/auth/current-customer';
import { splitPersonName, updateAccountName } from '@/lib/shopify/customer-account-api';
import { readCustomerJson, writeCustomerJson } from '@/lib/shopify/shop-records';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const context = await getCustomerContext();
  if (!context.signedIn) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    fullName?: string;
    phone?: string | null;
    city?: string | null;
    country?: string | null;
    gender?: 'female' | 'male' | null;
    onboardingCompleted?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const extras = (await readCustomerJson<ProfileExtras>(context.customer.id, 'profile')) || {};
  const next: ProfileExtras = {
    ...extras,
    phone: body.phone === undefined ? extras.phone : body.phone,
    city: body.city === undefined ? extras.city : body.city,
    country: body.country === undefined ? extras.country : body.country,
    gender: body.gender === undefined ? extras.gender : body.gender,
    onboardingCompleted:
      body.onboardingCompleted === undefined ? extras.onboardingCompleted : body.onboardingCompleted,
  };
  await writeCustomerJson(context.customer.id, 'profile', next);
  if (body.fullName?.trim()) {
    const person = splitPersonName(body.fullName);
    await updateAccountName(context.accessToken, person.firstName, person.lastName);
  }
  const refreshed = await getCustomerContext();
  if (!refreshed.signedIn) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  return NextResponse.json({ customer: customerPublic(refreshed.customer) });
}
