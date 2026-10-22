import { normalizeInternalPath } from '@/lib/auth/navigate-after-auth';
import { openSignupIntent } from '@/lib/auth/signup-intent';
import { customerAccountConfig } from '@/lib/shopify/customer-account';
import { handleCustomerAccountStart } from '@/lib/shopify/customer-account-flow';
import { CUSTOMER_ACCOUNT_RETURN_COOKIE, CUSTOMER_ACCOUNT_SIGNUP_COOKIE } from '@/lib/shopify/customer-account-cookie';
import { cookiesFromHeader } from '@/lib/shopify/request-cookies';
import { flowToResponse } from '../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  let loginHint: string | undefined;
  if (url.searchParams.get('signup') === '1') {
    const gate = customerAccountConfig(process.env);
    const sealed = cookiesFromHeader(request.headers.get('cookie')).find(
      (cookie) => cookie.name === CUSTOMER_ACCOUNT_SIGNUP_COOKIE
    )?.value;
    if (gate.ok && sealed) {
      loginHint = openSignupIntent(sealed, gate.config.sessionSecret)?.email;
    }
  }
  const result = await handleCustomerAccountStart({
    requestUrl: request.url,
    env: process.env,
    loginHint,
  });
  const returnTo = normalizeInternalPath(new URL(request.url).searchParams.get('return'));
  if (result.reason === 'authorize' && returnTo) {
    result.cookies.push({ name: CUSTOMER_ACCOUNT_RETURN_COOKIE, value: returnTo, maxAge: 600 });
  }
  return flowToResponse(result);
}

