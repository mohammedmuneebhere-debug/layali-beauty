import { SITE_URL } from '@/lib/constants';
import { continueRedirectPath } from '@/lib/auth/continue-redirect';
import { sameOriginLocation } from '@/lib/auth/navigate-after-auth';
import { customerContextForAccessToken } from '@/lib/auth/current-customer';
import { resolveCustomerAccountSession } from '@/lib/shopify/customer-account-flow';
import { CUSTOMER_ACCOUNT_RETURN_COOKIE } from '@/lib/shopify/customer-account-cookie';
import { cookiesFromHeader } from '@/lib/shopify/request-cookies';
import { flowToResponse } from '../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('return');
  const resolved = await resolveCustomerAccountSession({
    requestUrl: `${SITE_URL}/api/customer-account/session`,
    cookies: cookiesFromHeader(request.headers.get('cookie')),
    env: process.env,
  });
  const context = await customerContextForAccessToken(true, resolved.session?.accessToken || null);
  const destination = continueRedirectPath({
    signedIn: context.signedIn,
    staff: context.signedIn ? context.customer.staff : false,
    onboardingCompleted: context.signedIn ? context.customer.onboardingCompleted : false,
    requested,
  });
  const location = sameOriginLocation(destination, request.url, '/shop', {
    host: request.headers.get('host'),
    forwardedHost: request.headers.get('x-forwarded-host'),
  });
  return flowToResponse({
    status: 303,
    reason: 'continue',
    location,
    cookies: [
      ...resolved.result.cookies,
      { name: CUSTOMER_ACCOUNT_RETURN_COOKIE, value: '', maxAge: 0 },
    ],
  });
}
