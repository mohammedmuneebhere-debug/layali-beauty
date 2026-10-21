import { NextResponse, type NextRequest } from 'next/server';
import { authRedirectOrigin } from '@/lib/auth/navigate-after-auth';
import { CUSTOMER_ACCOUNT_SESSION_COOKIE } from '@/lib/shopify/customer-account-cookie';
import { applyCustomerGate } from '@/lib/auth/customer-route-gate';

export async function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(CUSTOMER_ACCOUNT_SESSION_COOKIE)?.value);
  const redirectUrl = request.nextUrl.clone();
  const gated = applyCustomerGate(
    redirectUrl,
    hasSession ? { id: 'shopify-customer' } : null,
    hasSession ? { staff: 'unknown', onboarding_completed: null } : null
  );
  if (gated) {
    const origin = authRedirectOrigin(request.url, {
      host: request.headers.get('host'),
      forwardedHost: request.headers.get('x-forwarded-host'),
    });
    return NextResponse.redirect(new URL(`${gated.pathname}${gated.search}`, origin));
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-layali-path', request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/customer-account|api/account/me|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
