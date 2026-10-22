/**
 * Session cookie writes stay on Route Handler responses.
 * Usage: npm run test:session-cookie
 */
import fs from 'node:fs';
import { continueRedirectPath } from '@/lib/auth/continue-redirect';
import { authRedirectOrigin, normalizeInternalPath, safeAuthRedirect, sameOriginLocation } from '@/lib/auth/navigate-after-auth';
import { safeSessionCommitReturn, sessionCookieWriteDecision } from '@/lib/auth/session-cookie-write';
import type { CustomerAccountSession } from '@/lib/shopify/customer-account-session';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

function session(expiresAtMs: number): CustomerAccountSession {
  return {
    accessToken: 'access',
    refreshToken: 'refresh',
    idToken: 'id',
    expiresAtMs,
    idTokenExpiresAtMs: expiresAtMs,
    sub: 'customer',
  };
}

const now = Date.now();
assert('a current session does not need a cookie write', sessionCookieWriteDecision(session(now + 10 * 60_000), now) === 'none');
assert('a token expiring in 60 seconds is outside the 30 second skew', sessionCookieWriteDecision(session(now + 60_000), now) === 'none');
assert('a token expiring in 10 seconds is inside the 30 second skew', sessionCookieWriteDecision(session(now + 10_000), now) === 'commit');
assert('an expired session must be committed by a route handler', sessionCookieWriteDecision(session(now - 120_000), now) === 'commit');
assert('a missing session does not need a cookie write', sessionCookieWriteDecision(null, now) === 'none');

const hostile = [
  '/\\evil.com',
  '\\\\evil.com',
  '/%5Cevil.com',
  '/%5cevil.com',
  '/%255Cevil.com',
  '/%25255Cevil.com',
  'https://evil.com',
  '//evil.com',
  '/\\\\evil.com',
];
const requestUrl = 'https://www.layalibeautystore.com/api/customer-account/continue';
for (const path of hostile) {
  assert(`internal path rejects ${path}`, normalizeInternalPath(path) === null);
  assert(`auth redirect rejects ${path}`, safeAuthRedirect(path) === '/shop');
  assert(`commit return rejects ${path}`, safeSessionCommitReturn(path) === '/account');
  assert(
    `continue stays on the shop for ${path}`,
    continueRedirectPath({ signedIn: true, staff: false, onboardingCompleted: true, requested: path }) === '/shop'
  );
  const location = sameOriginLocation(path, requestUrl, '/shop');
  assert(`absolute redirect stays on the request host for ${path}`, new URL(location).host === 'www.layalibeautystore.com' && new URL(location).pathname === '/shop');
}

assert('a checkout query string remains internal', safeAuthRedirect('/checkout?step=address') === '/checkout?step=address');
assert('an admin orders query remains a commit target', safeSessionCommitReturn('/admin/orders?tab=open') === '/admin/orders?tab=open');
assert('staff continue opens admin', continueRedirectPath({ signedIn: true, staff: true, onboardingCompleted: true, requested: '/admin/orders?tab=open' }) === '/admin');
assert('staff continue ignores a hostile return', continueRedirectPath({ signedIn: true, staff: true, onboardingCompleted: true, requested: '/%5Cevil.com' }) === '/shop');
assert('a new customer continues to the survey', continueRedirectPath({ signedIn: true, staff: false, onboardingCompleted: false, requested: '/%5Cevil.com' }) === '/survey');
assert('incomplete onboarding keeps a cart return', continueRedirectPath({ signedIn: true, staff: false, onboardingCompleted: false, requested: '/cart' }) === '/cart');
assert('incomplete onboarding keeps a checkout return', continueRedirectPath({ signedIn: true, staff: false, onboardingCompleted: false, requested: '/checkout' }) === '/checkout');
assert('incomplete onboarding without a return opens the survey', continueRedirectPath({ signedIn: true, staff: false, onboardingCompleted: false, requested: '' }) === '/survey');
assert('completed onboarding without a return opens the shop', continueRedirectPath({ signedIn: true, staff: false, onboardingCompleted: true, requested: '' }) === '/shop');
assert('staff without a return still opens admin before the survey', continueRedirectPath({ signedIn: true, staff: true, onboardingCompleted: false, requested: '' }) === '/admin');
assert('staff checkout return stays on checkout', continueRedirectPath({ signedIn: true, staff: true, onboardingCompleted: false, requested: '/checkout?step=address' }) === '/checkout?step=address');

const cartPage = fs.readFileSync('src/app/cart/page.tsx', 'utf8');
const checkoutPage = fs.readFileSync('src/app/checkout/page.tsx', 'utf8');
assert('cart sign-in returns to the cart', cartPage.includes("'/auth/signin?redirect=/cart'"));
assert('checkout sign-in keeps the checkout destination', checkoutPage.includes("'/auth/signin?redirect=/checkout'"));

assert('commit return does not loop through itself', safeSessionCommitReturn('/api/customer-account/commit-session') === '/account');
assert('commit return does not loop through continue', safeSessionCommitReturn('/auth/continue') === '/account');
assert('a signed-out continue goes to sign-in', continueRedirectPath({ signedIn: false, staff: false, onboardingCompleted: false, requested: '/checkout' }) === '/auth/signin');
assert('an empty staff continue opens admin', continueRedirectPath({ signedIn: true, staff: true, onboardingCompleted: true, requested: '' }) === '/admin');
assert('a customer continues to the requested shop path', continueRedirectPath({ signedIn: true, staff: false, onboardingCompleted: true, requested: '/checkout' }) === '/checkout');

const evilRequest = 'https://evil.example/api/customer-account/continue?return=/checkout';
const evilHeaders = { host: 'evil.example', forwardedHost: 'attacker.example' };
assert(
  'a malicious Host and X-Forwarded-Host do not leave the production site',
  sameOriginLocation('/checkout?step=address', evilRequest, '/shop', evilHeaders) === 'https://www.layalibeautystore.com/checkout?step=address'
);
assert(
  'a malicious request URL alone stays on the production site',
  sameOriginLocation('/admin/orders', 'https://evil.example/api/customer-account/commit-session', '/account') === 'https://www.layalibeautystore.com/admin/orders'
);
assert(
  'X-Forwarded-Host cannot override the production Host',
  authRedirectOrigin('https://www.layalibeautystore.com/api/customer-account/continue', {
    host: 'www.layalibeautystore.com',
    forwardedHost: 'evil.example',
  }) === 'https://www.layalibeautystore.com'
);
assert(
  'loopback development keeps its port and ignores X-Forwarded-Host',
  authRedirectOrigin('http://localhost:3000/api/customer-account/continue', {
    host: 'localhost:3000',
    forwardedHost: 'evil.example',
  }) === 'http://localhost:3000'
);
assert(
  'a hostile path on a malicious host falls back to the production shop',
  new URL(sameOriginLocation('/\\evil.com', evilRequest, '/shop', evilHeaders)).href === 'https://www.layalibeautystore.com/shop'
);
const stagingEnv = { LAYALI_STAGING_ORIGIN: 'https://layali-preview.vercel.app' };
assert(
  'a forged Host and X-Forwarded-Host cannot move a production redirect onto staging',
  authRedirectOrigin('https://www.layalibeautystore.com/api/customer-account/continue', {
    host: 'layali-preview.vercel.app',
    forwardedHost: 'other-preview.vercel.app',
  }, stagingEnv) === 'https://www.layalibeautystore.com'
);
assert(
  'the exact staging request URL keeps its origin and ignores a forged Host',
  authRedirectOrigin('https://layali-preview.vercel.app/api/customer-account/continue', {
    host: 'evil.example',
    forwardedHost: 'www.layalibeautystore.com',
  }, stagingEnv) === 'https://layali-preview.vercel.app'
);
assert(
  'a different Vercel request URL does not become the staging origin',
  authRedirectOrigin('https://other-preview.vercel.app/api/customer-account/continue', {
    host: 'layali-preview.vercel.app',
    forwardedHost: 'layali-preview.vercel.app',
  }, stagingEnv) === 'https://www.layalibeautystore.com'
);

const page = fs.readFileSync('src/app/auth/continue/page.tsx', 'utf8');
assert('continue page does not set cookies', !page.includes('jar.set') && !page.includes('cookies().set'));
assert('continue page delegates to the route handler', page.includes('/api/customer-account/continue'));
assert('continue page does not load the customer during render', !page.includes('getCustomerContext'));

const layout = fs.readFileSync('src/app/admin/layout.tsx', 'utf8');
const body = layout.slice(layout.indexOf('export default'));
const peek = body.indexOf('sealedSessionNeedsCookieWrite');
const context = body.indexOf('getCustomerContext');
assert('admin layout commits a stale session before reading the customer', peek !== -1 && context !== -1 && peek < context);

const current = fs.readFileSync('src/lib/auth/current-customer.ts', 'utf8');
assert('session refresh cookies are written only when a route handler calls persist', current.includes('if (session.cookiesToSet.length)') && current.includes('persistSessionCookies(session.cookiesToSet)'));

const respond = fs.readFileSync('src/app/api/customer-account/respond.ts', 'utf8');
const continueRoute = fs.readFileSync('src/app/api/customer-account/continue/route.ts', 'utf8');
const commitRoute = fs.readFileSync('src/app/api/customer-account/commit-session/route.ts', 'utf8');
assert('cookie writes go through the route response', respond.includes('response.cookies.set') && respond.includes('httpOnly: true'));
assert('continue handler commits cookies on the redirect response', continueRoute.includes('flowToResponse') && !continueRoute.includes('next/headers'));
assert('continue handler clears the return cookie', continueRoute.includes('CUSTOMER_ACCOUNT_RETURN_COOKIE') && continueRoute.includes('maxAge: 0'));
assert('commit handler writes session cookies on the redirect response', commitRoute.includes('flowToResponse') && !commitRoute.includes('cookies()'));

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('session cookie checks passed');
