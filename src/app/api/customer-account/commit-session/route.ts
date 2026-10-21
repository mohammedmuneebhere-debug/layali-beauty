import { SITE_URL } from '@/lib/constants';
import { sameOriginLocation } from '@/lib/auth/navigate-after-auth';
import { safeSessionCommitReturn } from '@/lib/auth/session-cookie-write';
import { resolveCustomerAccountSession } from '@/lib/shopify/customer-account-flow';
import { cookiesFromHeader } from '@/lib/shopify/request-cookies';
import { flowToResponse } from '../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Refreshes or clears the sealed session, then returns to a same-site path. */
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('return');
  const destination = safeSessionCommitReturn(requested);
  const resolved = await resolveCustomerAccountSession({
    requestUrl: `${SITE_URL}/api/customer-account/session`,
    cookies: cookiesFromHeader(request.headers.get('cookie')),
    env: process.env,
  });
  return flowToResponse({
    status: 303,
    reason: 'session_commit',
    location: sameOriginLocation(destination, request.url, '/account', {
      host: request.headers.get('host'),
      forwardedHost: request.headers.get('x-forwarded-host'),
    }),
    cookies: resolved.result.cookies,
  });
}
