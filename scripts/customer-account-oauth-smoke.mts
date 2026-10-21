/**
 * Customer Account OAuth checks. No live Shopify or Supabase calls.
 *
 * Usage: npm run test:customer-account
 */
import fs from 'node:fs';
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { authRedirectOrigin } from '@/lib/auth/navigate-after-auth';
import { applyCustomerGate } from '@/lib/auth/customer-route-gate';
import { staffAccessDecision } from '@/lib/auth/staff-access';
import {
  CUSTOMER_ACCOUNT_NONCE_COOKIE,
  CUSTOMER_ACCOUNT_STATE_COOKIE,
  CUSTOMER_ACCOUNT_VERIFIER_COOKIE,
  configuredStagingOrigin,
  customerAccountApiDiscoveryUrl,
  customerAccountCallbackUrl,
  customerAccountConfig,
  customerAccountHostDecision,
  customerAccountJavascriptOrigin,
  customerAccountLogoutReturnUrl,
  customerAccountTokenHeaders,
} from '@/lib/shopify/customer-account';
import {
  clearCustomerAccountDiscoveryCache,
  handleCustomerAccountCallback,
  handleCustomerAccountLogout,
  handleCustomerAccountSession,
  handleCustomerAccountStart,
  type FlowResult,
} from '@/lib/shopify/customer-account-flow';
import {
  openCustomerAccountSession,
  sealCustomerAccountSession,
} from '@/lib/shopify/customer-account-session';

const DOMAIN = 'new-store.myshopify.com';
const SHOP_ID = '123456';
const CLIENT_ID = 'public-client';
const SECRET = 's'.repeat(40);
const ORIGIN = 'https://www.layalibeautystore.com';
const ACCESS = 'plaintext-access-token-should-not-appear';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

function env(): NodeJS.ProcessEnv {
  return {
    SHOPIFY_STORE_DOMAIN: DOMAIN,
    SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: CLIENT_ID,
    SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: SHOP_ID,
    SHOPIFY_CUSTOMER_ACCOUNT_SESSION_SECRET: SECRET,
    VERCEL_ENV: 'production',
  };
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
jwk.kid = 'test-key';
jwk.alg = 'RS256';
jwk.use = 'sig';

function signJwt(payload: Record<string, unknown>, key: KeyObject = privateKey, kid = 'test-key'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${body}`;
  const signature = sign('RSA-SHA256', Buffer.from(data), key).toString('base64url');
  return `${data}.${signature}`;
}

function idToken(nonce: string, expSeconds = Math.floor(Date.now() / 1000) + 3600): string {
  return signJwt({
    iss: `https://shopify.com/authentication/${SHOP_ID}`,
    aud: CLIENT_ID,
    exp: expSeconds,
    iat: Math.floor(Date.now() / 1000),
    nonce,
    sub: 'shopify-customer-subject',
  });
}

type Call = { url: string; method: string; headers: Headers; body: string };

function installFetch(options?: { idToken?: string; refreshIdToken?: string; tokenStatus?: number }) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method || 'GET';
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : '';
    calls.push({ url, method, headers, body });
    if (url.endsWith('/.well-known/openid-configuration')) {
      return Response.json({
        issuer: `https://shopify.com/authentication/${SHOP_ID}`,
        authorization_endpoint: `https://${DOMAIN}/authentication/oauth/authorize`,
        token_endpoint: `https://${DOMAIN}/authentication/oauth/token`,
        end_session_endpoint: `https://${DOMAIN}/authentication/logout`,
        jwks_uri: `https://${DOMAIN}/authentication/.well-known/jwks.json`,
      });
    }
    if (url.endsWith('/jwks.json')) return Response.json({ keys: [jwk] });
    if (url.endsWith('/oauth/token')) {
      if (options?.tokenStatus) return new Response('no', { status: options.tokenStatus });
      const params = new URLSearchParams(body);
      if (params.get('grant_type') === 'refresh_token') {
        return Response.json({
          access_token: 'refreshed-access-token',
          refresh_token: 'refreshed-refresh-token',
          expires_in: 1800,
          id_token: options?.refreshIdToken,
        });
      }
      return Response.json({
        access_token: ACCESS,
        refresh_token: 'refresh-token',
        expires_in: 3600,
        id_token: options?.idToken || idToken('missing-nonce'),
      });
    }
    return new Response('missing', { status: 404 });
  };
  return { calls, fetchImpl };
}

function cookieMap(result: FlowResult): Record<string, string> {
  return Object.fromEntries(result.cookies.filter((cookie) => cookie.maxAge > 0).map((cookie) => [cookie.name, cookie.value]));
}

function cookiesOf(result: FlowResult): { name: string; value: string }[] {
  return result.cookies.filter((cookie) => cookie.maxAge > 0).map((cookie) => ({ name: cookie.name, value: cookie.value }));
}

async function main() {
  clearCustomerAccountDiscoveryCache();
  assert('routes stay disabled without customer-account env', customerAccountConfig({}).ok === false);
  assert(
    'production vercel env does not by itself disable a complete config',
    customerAccountConfig(env()).ok === true
  );
  assert(
    'customer api discovery is not pinned to 2025-01',
    customerAccountApiDiscoveryUrl(DOMAIN) === `https://${DOMAIN}/.well-known/customer-account-api` &&
      !customerAccountApiDiscoveryUrl(DOMAIN).includes('2025-01')
  );
  const headers = customerAccountTokenHeaders(ORIGIN);
  assert('token requests send Origin and User-Agent', headers.Origin === ORIGIN && Boolean(headers['User-Agent']));
  assert(
    'customer tokens are not sent as Storefront tokens',
    !('X-Shopify-Storefront-Access-Token' in headers)
  );
  assert(
    'registered callback is the production route',
    customerAccountCallbackUrl() === `${ORIGIN}/api/customer-account/callback`
  );
  assert('registered javascript origin is the live origin', customerAccountJavascriptOrigin() === ORIGIN);
  assert('registered logout return is the live origin root', customerAccountLogoutReturnUrl() === `${ORIGIN}/`);

  const sealed = sealCustomerAccountSession(
    {
      accessToken: ACCESS,
      refreshToken: null,
      idToken: 'id',
      expiresAtMs: Date.now() + 60_000,
      idTokenExpiresAtMs: Date.now() + 60_000,
      sub: 'subject',
    },
    SECRET
  );
  const opened = openCustomerAccountSession(sealed, SECRET);
  assert('session cookie round-trips without storing the token in clear text', opened?.accessToken === ACCESS && !sealed.includes(ACCESS));

  const missing = await handleCustomerAccountStart({
    requestUrl: `${ORIGIN}/api/customer-account/start`,
    env: {},
    fetchImpl: installFetch().fetchImpl,
  });
  assert('start without config is 404', missing.status === 404 && missing.reason === 'not_configured');

  const wrongHost = await handleCustomerAccountStart({
    requestUrl: 'https://preview.example.com/api/customer-account/start',
    env: env(),
    fetchImpl: installFetch().fetchImpl,
  });
  assert('start on a non-production host is 404', wrongHost.status === 404 && wrongHost.reason === 'wrong_host');

  clearCustomerAccountDiscoveryCache();
  const startedFetch = installFetch();
  const started = await handleCustomerAccountStart({
    requestUrl: `${ORIGIN}/api/customer-account/start`,
    env: env(),
    fetchImpl: startedFetch.fetchImpl,
  });
  const startedCookies = cookieMap(started);
  assert('start redirects to Shopify with PKCE cookies', started.status === 302 && started.reason === 'authorize');
  assert('authorize url uses the production callback', (started.location || '').includes(encodeURIComponent(customerAccountCallbackUrl())));
  assert('authorize url does not carry the verifier', !(started.location || '').includes(startedCookies[CUSTOMER_ACCOUNT_VERIFIER_COOKIE] || 'missing-verifier'));
  assert('start does not call the token endpoint', startedFetch.calls.every((call) => !call.url.endsWith('/oauth/token')));

  const stateMismatch = await handleCustomerAccountCallback({
    requestUrl: `${ORIGIN}/api/customer-account/callback?code=auth-code&state=wrong-state`,
    cookies: cookiesOf(started),
    env: env(),
    fetchImpl: startedFetch.fetchImpl,
  });
  assert('state mismatch is rejected before token exchange', stateMismatch.status === 400 && stateMismatch.reason === 'state_mismatch');
  assert('state mismatch does not call the token endpoint', startedFetch.calls.every((call) => !call.url.endsWith('/oauth/token')));

  const cancelled = await handleCustomerAccountCallback({
    requestUrl: `${ORIGIN}/api/customer-account/callback?error=access_denied&state=${encodeURIComponent(startedCookies[CUSTOMER_ACCOUNT_STATE_COOKIE])}`,
    cookies: cookiesOf(started),
    env: env(),
    fetchImpl: startedFetch.fetchImpl,
  });
  assert('an OAuth error callback does not exchange a code', cancelled.reason === 'oauth_error' && cancelled.status === 303);
  assert('cancel still has not called the token endpoint', startedFetch.calls.every((call) => !call.url.endsWith('/oauth/token')));

  clearCustomerAccountDiscoveryCache();
  const nonce = startedCookies[CUSTOMER_ACCOUNT_NONCE_COOKIE];
  const badNonceFetch = installFetch({ idToken: idToken('different-nonce-value') });
  const badNonce = await handleCustomerAccountCallback({
    requestUrl: `${ORIGIN}/api/customer-account/callback?code=auth-code&state=${encodeURIComponent(startedCookies[CUSTOMER_ACCOUNT_STATE_COOKIE])}`,
    cookies: cookiesOf(started),
    env: env(),
    fetchImpl: badNonceFetch.fetchImpl,
  });
  assert('nonce mismatch is rejected', badNonce.status === 400 && badNonce.reason === 'nonce_mismatch');
  assert('nonce mismatch does not set a session', !badNonce.cookies.some((cookie) => cookie.name === 'layali_ca_session' && cookie.maxAge > 0));

  clearCustomerAccountDiscoveryCache();
  const badKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const badSigFetch = installFetch({ idToken: signJwt({
    iss: `https://shopify.com/authentication/${SHOP_ID}`,
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    nonce,
    sub: 'shopify-customer-subject',
  }, badKey) });
  const badSig = await handleCustomerAccountCallback({
    requestUrl: `${ORIGIN}/api/customer-account/callback?code=auth-code&state=${encodeURIComponent(startedCookies[CUSTOMER_ACCOUNT_STATE_COOKIE])}`,
    cookies: cookiesOf(started),
    env: env(),
    fetchImpl: badSigFetch.fetchImpl,
  });
  assert('an ID token signed by the wrong key is rejected', badSig.status === 400 && badSig.reason === 'invalid_id_token');

  clearCustomerAccountDiscoveryCache();
  const goodFetch = installFetch({ idToken: idToken(nonce) });
  const good = await handleCustomerAccountCallback({
    requestUrl: `${ORIGIN}/api/customer-account/callback?code=auth-code&state=${encodeURIComponent(startedCookies[CUSTOMER_ACCOUNT_STATE_COOKIE])}`,
    cookies: cookiesOf(started),
    env: env(),
    fetchImpl: goodFetch.fetchImpl,
  });
  const tokenCall = goodFetch.calls.find((call) => call.url.endsWith('/oauth/token'));
  assert('a valid callback signs the customer in', good.status === 303 && good.reason === 'signed_in');
  assert('success continues into the Shopify account flow', (good.location || '').startsWith(`${ORIGIN}/auth/continue`));
  assert('token exchange sends Origin, User-Agent, and the verifier', Boolean(
    tokenCall &&
      tokenCall.headers.get('origin') === ORIGIN &&
      tokenCall.headers.get('user-agent') &&
      tokenCall.body.includes('code_verifier=') &&
      !tokenCall.headers.has('x-shopify-storefront-access-token')
  ));
  const sessionCookie = good.cookies.find((cookie) => cookie.name === 'layali_ca_session' && cookie.maxAge > 0);
  assert('the access token is not readable in the session cookie', Boolean(sessionCookie && !sessionCookie.value.includes(ACCESS)));
  assert('PKCE cookies are cleared after callback', good.cookies.some((cookie) => cookie.name === CUSTOMER_ACCOUNT_VERIFIER_COOKIE && cookie.maxAge === 0));

  const expiredFetch = installFetch();
  const expiredSealed = sealCustomerAccountSession(
    {
      accessToken: ACCESS,
      refreshToken: null,
      idToken: idToken(nonce),
      expiresAtMs: Date.now() - 120_000,
      idTokenExpiresAtMs: Date.now() + 60_000,
      sub: 'shopify-customer-subject',
    },
    SECRET
  );
  const expired = await handleCustomerAccountSession({
    requestUrl: `${ORIGIN}/api/customer-account/session`,
    cookies: [{ name: 'layali_ca_session', value: expiredSealed }],
    env: env(),
    fetchImpl: expiredFetch.fetchImpl,
    now: Date.now(),
  });
  assert('an expired session without a refresh token signs out', expired.reason === 'expired' && expired.body?.signedIn === false);
  assert('expired session cookies are cleared', expired.cookies.some((cookie) => cookie.name === 'layali_ca_session' && cookie.maxAge === 0));

  clearCustomerAccountDiscoveryCache();
  const refreshFetch = installFetch({ refreshIdToken: idToken('refresh-nonce') });
  const refreshSealed = sealCustomerAccountSession(
    {
      accessToken: ACCESS,
      refreshToken: 'old-refresh-token',
      idToken: idToken(nonce),
      expiresAtMs: Date.now() - 120_000,
      idTokenExpiresAtMs: Date.now() + 60_000,
      sub: 'shopify-customer-subject',
    },
    SECRET
  );
  const refreshed = await handleCustomerAccountSession({
    requestUrl: `${ORIGIN}/api/customer-account/session`,
    cookies: [{ name: 'layali_ca_session', value: refreshSealed }],
    env: env(),
    fetchImpl: refreshFetch.fetchImpl,
    now: Date.now(),
  });
  const refreshCall = refreshFetch.calls.find((call) => call.body.includes('grant_type=refresh_token'));
  assert('an expired session with a refresh token is renewed', refreshed.reason === 'refreshed' && refreshed.body?.signedIn === true);
  assert('refresh uses the token endpoint and not the Storefront API', Boolean(refreshCall && refreshCall.url.endsWith('/oauth/token')));
  assert('the session response does not reveal tokens', !JSON.stringify(refreshed.body).includes('accessToken') && !JSON.stringify(refreshed.body).includes(ACCESS));

  clearCustomerAccountDiscoveryCache();
  const logoutFetch = installFetch();
  const liveSealed = sealCustomerAccountSession(
    {
      accessToken: 'live-access',
      refreshToken: 'live-refresh',
      idToken: idToken(nonce),
      expiresAtMs: Date.now() + 300_000,
      idTokenExpiresAtMs: Date.now() + 300_000,
      sub: 'shopify-customer-subject',
    },
    SECRET
  );
  const loggedOut = await handleCustomerAccountLogout({
    method: 'POST',
    requestUrl: `${ORIGIN}/api/customer-account/logout`,
    cookies: [{ name: 'layali_ca_session', value: liveSealed }],
    env: env(),
    fetchImpl: logoutFetch.fetchImpl,
  });
  assert('logout redirects to the discovered end-session endpoint', (loggedOut.location || '').startsWith(`https://${DOMAIN}/authentication/logout`));
  assert('logout sends id_token_hint and the registered return url', Boolean(
    loggedOut.location?.includes('id_token_hint=') &&
      loggedOut.location.includes(encodeURIComponent(customerAccountLogoutReturnUrl()))
  ));
  assert('logout clears the session cookie', loggedOut.cookies.some((cookie) => cookie.name === 'layali_ca_session' && cookie.maxAge === 0));

  const getLogout = await handleCustomerAccountLogout({
    method: 'GET',
    requestUrl: `${ORIGIN}/api/customer-account/logout`,
    cookies: [],
    env: env(),
    fetchImpl: logoutFetch.fetchImpl,
  });
  assert('GET logout is not allowed once the route is configured', getLogout.status === 405);
  const hiddenLogout = await handleCustomerAccountLogout({
    method: 'GET',
    requestUrl: `${ORIGIN}/api/customer-account/logout`,
    cookies: [],
    env: {},
    fetchImpl: logoutFetch.fetchImpl,
  });
  assert('logout stays 404 until customer accounts are configured', hiddenLogout.status === 404);

  function gate(path: string, user: { id: string } | null, role: string | null, onboarding = true) {
    const url = new URL(`${ORIGIN}${path}`);
    const staff = role === 'admin' ? true : role === 'unknown' ? 'unknown' : false;
    const redirected = applyCustomerGate(
      url,
      user,
      user ? { staff, onboarding_completed: onboarding } : null
    );
    return redirected ? `${redirected.pathname}${redirected.search}` : 'next';
  }
  assert('account requires a Shopify customer session', gate('/account', null, null).startsWith('/auth/signin?redirect='));
  assert('checkout requires a Shopify customer session', gate('/checkout', null, null).includes('redirect=%2Fcheckout') || gate('/checkout', null, null).includes('redirect=/checkout'));
  assert('a signed-in customer can open account', gate('/account', { id: 'user' }, 'user') === 'next');
  assert('admin requires a session', gate('/admin', null, null) === '/auth/admin/signin');
  assert('a customer cannot open admin', gate('/admin', { id: 'user' }, 'user') === '/');
  assert('allowlisted staff can open admin', gate('/admin', { id: 'admin' }, 'admin') === 'next');
  assert('Shopify customer id is not a staff role', staffAccessDecision(true, 'customer') === 'forbidden');

  const middleware = fs.readFileSync('src/middleware.ts', 'utf8');
  const placeOrder = fs.readFileSync('src/app/api/shopify/checkout/place-order/route.ts', 'utf8');
  const orders = fs.readFileSync('src/app/api/account/orders/route.ts', 'utf8');
  const cookie = fs.readFileSync('src/lib/shopify/customer-account-cookie.ts', 'utf8');
  assert(
    'middleware reads the Shopify customer cookie',
    middleware.includes('CUSTOMER_ACCOUNT_SESSION_COOKIE') &&
      middleware.includes('request.cookies.get') &&
      cookie.includes("CUSTOMER_ACCOUNT_SESSION_COOKIE = 'layali_ca_session'")
  );
  assert('checkout identifies the Shopify customer', placeOrder.includes('getCustomerContext') && !placeOrder.includes('lib/supabase'));
  assert('order history identifies the Shopify customer', orders.includes('getCustomerContext') && !orders.includes('lib/supabase'));

  const respond = fs.readFileSync('src/app/api/customer-account/respond.ts', 'utf8');
  assert(
    'session cookies stay HttpOnly, Secure, SameSite=Lax, Path=/ without a Domain',
    respond.includes('httpOnly: true') &&
      respond.includes('secure: true') &&
      respond.includes("sameSite: 'lax'") &&
      respond.includes("path: '/'") &&
      !respond.includes('domain:')
  );

  const stagingOrigin = 'https://layali-preview.vercel.app';
  const otherPreview = 'https://other-preview.vercel.app';
  const stagingEnv = { ...env(), LAYALI_STAGING_ORIGIN: stagingOrigin };
  const invalidValues = [
    '',
    'http://layali-preview.vercel.app',
    'https://layali-preview.vercel.app/callback',
    'https://layali-preview.vercel.app?next=/shop',
    'https://layali-preview.vercel.app#shop',
    'https://user:pass@layali-preview.vercel.app',
    'https://layali-preview.vercel.app:8443',
    'https://*.vercel.app',
    'https://layali-preview.vercel.app,https://other-preview.vercel.app',
    'https://www.layalibeautystore.com',
    'https://layalibeautystore.com',
    'https://localhost',
    'https://127.0.0.1',
  ];
  assert('staging is disabled when the origin is absent', configuredStagingOrigin(env()) === null);
  assert(
    'wildcards and malformed staging origins are rejected',
    invalidValues.every((value) => configuredStagingOrigin({ ...env(), LAYALI_STAGING_ORIGIN: value }) === null)
  );
  assert('the exact staging origin is accepted', configuredStagingOrigin(stagingEnv) === stagingOrigin);

  const stagingDisabled = await handleCustomerAccountStart({
    requestUrl: `${stagingOrigin}/api/customer-account/start`,
    env: env(),
    fetchImpl: installFetch().fetchImpl,
  });
  assert('staging sign-in stays disabled without the origin', stagingDisabled.status === 404 && stagingDisabled.reason === 'wrong_host');

  const otherHost = await handleCustomerAccountStart({
    requestUrl: `${otherPreview}/api/customer-account/start`,
    env: stagingEnv,
    fetchImpl: installFetch().fetchImpl,
  });
  assert('a different Vercel hostname is rejected', otherHost.status === 404 && otherHost.reason === 'wrong_host');

  const apex = await handleCustomerAccountStart({
    requestUrl: 'https://layalibeautystore.com/api/customer-account/start?return=/checkout',
    env: stagingEnv,
    fetchImpl: installFetch().fetchImpl,
  });
  assert(
    'apex still redirects to www while staging is configured',
    apex.status === 307 && apex.location === 'https://www.layalibeautystore.com/api/customer-account/start'
  );
  assert('www remains the production customer-account host', customerAccountHostDecision('www.layalibeautystore.com', stagingEnv) === 'allow');

  clearCustomerAccountDiscoveryCache();
  const stagingFetch = installFetch();
  const stagingStart = await handleCustomerAccountStart({
    requestUrl: `${stagingOrigin}/api/customer-account/start`,
    env: stagingEnv,
    fetchImpl: stagingFetch.fetchImpl,
  });
  const stagingCookies = cookieMap(stagingStart);
  assert('the exact staging hostname can start sign-in', stagingStart.status === 302 && stagingStart.reason === 'authorize');
  assert(
    'staging authorization uses the staging callback',
    (stagingStart.location || '').includes(encodeURIComponent(`${stagingOrigin}/api/customer-account/callback`))
  );

  clearCustomerAccountDiscoveryCache();
  const productionDespiteStaging = await handleCustomerAccountStart({
    requestUrl: `${ORIGIN}/api/customer-account/start`,
    env: stagingEnv,
    fetchImpl: installFetch().fetchImpl,
  });
  assert(
    'production authorization stays on www when staging is configured',
    (productionDespiteStaging.location || '').includes(encodeURIComponent(`${ORIGIN}/api/customer-account/callback`))
  );
  assert(
    'a forged Host and X-Forwarded-Host cannot move production OAuth onto staging',
    authRedirectOrigin(`${ORIGIN}/api/customer-account/continue`, {
      host: 'layali-preview.vercel.app',
      forwardedHost: 'layali-preview.vercel.app',
    }, stagingEnv) === ORIGIN
  );

  const stagingNonce = stagingCookies[CUSTOMER_ACCOUNT_NONCE_COOKIE];
  clearCustomerAccountDiscoveryCache();
  const stagingCancel = await handleCustomerAccountCallback({
    requestUrl: `${stagingOrigin}/api/customer-account/callback?error=access_denied&state=${encodeURIComponent(stagingCookies[CUSTOMER_ACCOUNT_STATE_COOKIE])}`,
    cookies: cookiesOf(stagingStart),
    env: stagingEnv,
    fetchImpl: installFetch().fetchImpl,
  });
  assert(
    'a cancelled staging login returns to the staging sign-in page',
    stagingCancel.status === 303 && stagingCancel.location === `${stagingOrigin}/auth/signin?shopify_error=cancelled`
  );

  clearCustomerAccountDiscoveryCache();
  const stagingGoodFetch = installFetch({ idToken: idToken(stagingNonce) });
  const stagingGood = await handleCustomerAccountCallback({
    requestUrl: `${stagingOrigin}/api/customer-account/callback?code=auth-code&state=${encodeURIComponent(stagingCookies[CUSTOMER_ACCOUNT_STATE_COOKIE])}`,
    cookies: cookiesOf(stagingStart),
    env: stagingEnv,
    fetchImpl: stagingGoodFetch.fetchImpl,
  });
  const stagingToken = stagingGoodFetch.calls.find((call) => call.url.endsWith('/oauth/token'));
  assert('staging callback continues on the staging origin', stagingGood.location === `${stagingOrigin}/auth/continue`);
  assert(
    'staging token exchange uses the staging origin and callback',
    Boolean(
      stagingToken &&
        stagingToken.headers.get('origin') === stagingOrigin &&
        stagingToken.body.includes(encodeURIComponent(`${stagingOrigin}/api/customer-account/callback`))
    )
  );

  clearCustomerAccountDiscoveryCache();
  const stagingLogoutFetch = installFetch();
  const stagingSession = sealCustomerAccountSession(
    {
      accessToken: ACCESS,
      refreshToken: null,
      idToken: idToken(stagingNonce),
      expiresAtMs: Date.now() + 60_000,
      idTokenExpiresAtMs: Date.now() + 3_600_000,
      sub: 'shopify-customer-subject',
    },
    SECRET
  );
  const stagingLogout = await handleCustomerAccountLogout({
    method: 'POST',
    requestUrl: `${stagingOrigin}/api/customer-account/logout`,
    cookies: [{ name: 'layali_ca_session', value: stagingSession }],
    env: stagingEnv,
    fetchImpl: stagingLogoutFetch.fetchImpl,
  });
  assert(
    'staging logout returns to the staging origin',
    Boolean(stagingLogout.location?.includes(encodeURIComponent(`${stagingOrigin}/`)))
  );

  if (failed > 0) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log('customer account oauth checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
