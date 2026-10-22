import { SITE_URL } from '@/lib/constants';
import { continueRedirectPath } from '@/lib/auth/continue-redirect';
import { sameOriginLocation } from '@/lib/auth/navigate-after-auth';
import { customerContextForAccessToken, type ProfileExtras } from '@/lib/auth/current-customer';
import { applySignupIntent, openSignupIntent } from '@/lib/auth/signup-intent';
import { customerAccountConfig } from '@/lib/shopify/customer-account';
import { resolveCustomerAccountSession } from '@/lib/shopify/customer-account-flow';
import { updateAccountName } from '@/lib/shopify/customer-account-api';
import {
  CUSTOMER_ACCOUNT_RETURN_COOKIE,
  CUSTOMER_ACCOUNT_SIGNUP_COOKIE,
} from '@/lib/shopify/customer-account-cookie';
import { isShopifyAdminConfigured } from '@/lib/shopify/admin';
import { readCustomerJson, writeCustomerJson } from '@/lib/shopify/shop-records';
import { cookiesFromHeader } from '@/lib/shopify/request-cookies';
import { flowToResponse } from '../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('return');
  const requestCookies = cookiesFromHeader(request.headers.get('cookie'));
  const resolved = await resolveCustomerAccountSession({
    requestUrl: `${SITE_URL}/api/customer-account/session`,
    cookies: requestCookies,
    env: process.env,
  });
  const context = await customerContextForAccessToken(true, resolved.session?.accessToken || null);
  const clearSignup = await consumeSignupIntent(requestCookies, context);
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
      ...(clearSignup ? [{ name: CUSTOMER_ACCOUNT_SIGNUP_COOKIE, value: '', maxAge: 0 }] : []),
    ],
  });
}

async function consumeSignupIntent(
  requestCookies: { name: string; value: string }[],
  context: Awaited<ReturnType<typeof customerContextForAccessToken>>
): Promise<boolean> {
  const sealed = requestCookies.find((cookie) => cookie.name === CUSTOMER_ACCOUNT_SIGNUP_COOKIE)?.value || '';
  if (!sealed || !context.signedIn) return false;
  const gate = customerAccountConfig(process.env);
  if (!gate.ok) return false;
  const intent = openSignupIntent(sealed, gate.config.sessionSecret);
  if (!intent) return true;
  const outcome = await applySignupIntent({
    intent,
    verifiedEmail: context.customer.email,
    updateName: (firstName, lastName) => updateAccountName(context.accessToken, firstName, lastName),
    persistPhone: isShopifyAdminConfigured()
      ? async (phone) => {
          const extras = (await readCustomerJson<ProfileExtras>(context.customer.id, 'profile')) || {};
          await writeCustomerJson(context.customer.id, 'profile', { ...extras, phone });
        }
      : null,
  });
  return outcome !== 'name_failed';
}
