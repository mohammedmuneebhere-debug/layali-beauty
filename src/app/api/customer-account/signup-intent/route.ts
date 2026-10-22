import { NextResponse } from 'next/server';
import { customerAccountSignupStartPath } from '@/lib/auth/customer-account-start';
import { normalizeInternalPath } from '@/lib/auth/navigate-after-auth';
import { normalizeSignupDraft } from '@/lib/auth/signup-fields';
import { sealSignupIntent, SIGNUP_INTENT_MAX_AGE_SECONDS } from '@/lib/auth/signup-intent';
import { customerAccountConfig } from '@/lib/shopify/customer-account';
import { CUSTOMER_ACCOUNT_SIGNUP_COOKIE } from '@/lib/shopify/customer-account-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const gate = customerAccountConfig(process.env);
  if (!gate.ok) {
    return NextResponse.json({ error: 'Sign-in is temporarily unavailable' }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as {
    fullName?: unknown;
    phone?: unknown;
    email?: unknown;
    returnTo?: unknown;
  } | null;
  const parsed = normalizeSignupDraft({
    fullName: body?.fullName,
    phone: body?.phone,
    email: body?.email,
  });
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }
  const returnTo = normalizeInternalPath(typeof body?.returnTo === 'string' ? body.returnTo : null);
  const response = NextResponse.json({ nextPath: customerAccountSignupStartPath(returnTo) });
  response.headers.set('Cache-Control', 'private, no-store');
  response.cookies.set(CUSTOMER_ACCOUNT_SIGNUP_COOKIE, sealSignupIntent(parsed.draft, gate.config.sessionSecret), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SIGNUP_INTENT_MAX_AGE_SECONDS,
  });
  return response;
}
