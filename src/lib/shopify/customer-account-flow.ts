/**
 * Customer Account OAuth start, callback, refresh, and logout.
 * Disabled responses stay 404 until production configuration is complete.
 * These handlers do not create a Supabase session and do not grant /admin.
 */
import { SITE_URL } from '@/lib/constants';
import {
  CUSTOMER_ACCOUNT_NONCE_COOKIE,
  CUSTOMER_ACCOUNT_START_PATH,
  CUSTOMER_ACCOUNT_STATE_COOKIE,
  CUSTOMER_ACCOUNT_VERIFIER_COOKIE,
  type CustomerAccountConfig,
  type OpenIdDiscovery,
  assertOpenIdDiscovery,
  buildAuthorizeUrl,
  customerAccountCallbackUrl,
  customerAccountConfig,
  customerAccountHostDecision,
  customerAccountLogoutReturnUrl,
  customerAccountTokenHeaders,
  createOAuthState,
  createPkceVerifier,
  endSessionUrl,
  oauthStateMatches,
  openIdDiscoveryUrl,
  pkceS256Challenge,
  refreshTokenRequestBody,
  tokenRequestBody,
} from '@/lib/shopify/customer-account';
import {
  type CustomerAccountSession,
  type SessionCookie,
  packSessionCookies,
  readPackedSession,
  sealCustomerAccountSession,
  sessionCookieNames,
  sessionNeedsRefresh,
  verifyShopifyIdToken,
} from '@/lib/shopify/customer-account-session';

const PKCE_MAX_AGE = 600;
const DISCOVERY_CACHE_MS = 60_000;

export type FlowCookie = SessionCookie;

export type FlowResult = {
  status: number;
  reason: string;
  location?: string;
  body?: Record<string, unknown>;
  cookies: FlowCookie[];
};

type FetchImpl = typeof fetch;

const discoveryCache = new Map<string, { at: number; doc: OpenIdDiscovery }>();

export function clearCustomerAccountDiscoveryCache(): void {
  discoveryCache.clear();
}

function notFound(reason: string): FlowResult {
  return { status: 404, reason, cookies: [] };
}

function badRequest(reason: string, cookies: FlowCookie[] = []): FlowResult {
  return { status: 400, reason, cookies };
}

function unavailable(reason: string, cookies: FlowCookie[] = []): FlowResult {
  return { status: 503, reason, cookies };
}

function redirect(status: number, location: string, cookies: FlowCookie[], reason: string): FlowResult {
  return { status, reason, location, cookies };
}

function clearPkceCookies(): FlowCookie[] {
  return [CUSTOMER_ACCOUNT_STATE_COOKIE, CUSTOMER_ACCOUNT_VERIFIER_COOKIE, CUSTOMER_ACCOUNT_NONCE_COOKIE].map(
    (name) => ({ name, value: '', maxAge: 0 })
  );
}

function clearSessionCookies(): FlowCookie[] {
  return sessionCookieNames().map((name) => ({ name, value: '', maxAge: 0 }));
}

function cookieValue(cookies: { name: string; value: string }[], name: string): string {
  return cookies.find((cookie) => cookie.name === name)?.value || '';
}

function configuredWww(requestUrl: string, env: NodeJS.ProcessEnv):
  | { ok: false; result: FlowResult }
  | { ok: true; config: CustomerAccountConfig } {
  const gate = customerAccountConfig(env);
  if (!gate.ok) return { ok: false, result: notFound('not_configured') };
  let host = '';
  try {
    host = new URL(requestUrl).host;
  } catch {
    return { ok: false, result: notFound('wrong_host') };
  }
  const decision = customerAccountHostDecision(host);
  if (decision === 'deny') return { ok: false, result: notFound('wrong_host') };
  if (decision === 'redirect-www') {
    return { ok: false, result: redirect(307, `${SITE_URL}${new URL(requestUrl).pathname}`, [], 'apex') };
  }
  return { ok: true, config: gate.config };
}

async function discover(
  config: CustomerAccountConfig,
  fetchImpl: FetchImpl,
  now: number
): Promise<OpenIdDiscovery | null> {
  const cached = discoveryCache.get(config.storeDomain);
  if (cached && now - cached.at < DISCOVERY_CACHE_MS) return cached.doc;
  try {
    const response = await fetchImpl(openIdDiscoveryUrl(config.storeDomain), {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/json', 'User-Agent': customerAccountTokenHeaders(config.origin)['User-Agent'] },
    });
    if (!response.ok) return null;
    const doc = assertOpenIdDiscovery(await response.json(), config.storeDomain, config.shopId);
    discoveryCache.set(config.storeDomain, { at: now, doc });
    return doc;
  } catch {
    return null;
  }
}

async function fetchJwks(
  jwksUri: string,
  fetchImpl: FetchImpl
): Promise<{ keys?: Array<Record<string, unknown>> } | null> {
  try {
    const response = await fetchImpl(jwksUri, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/json', 'User-Agent': 'Layali-CustomerAccounts' },
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > 100_000) return null;
    const parsed = JSON.parse(text) as { keys?: Array<Record<string, unknown>> };
    if (!parsed || !Array.isArray(parsed.keys)) return null;
    return parsed;
  } catch {
    return null;
  }
}

type TokenJson = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
};

async function postToken(
  endpoint: string,
  body: URLSearchParams,
  origin: string,
  fetchImpl: FetchImpl
): Promise<TokenJson | null> {
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: customerAccountTokenHeaders(origin),
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status >= 300 && response.status < 400) return null;
    if (!response.ok) return null;
    return (await response.json()) as TokenJson;
  } catch {
    return null;
  }
}

function sessionCookies(session: CustomerAccountSession, secret: string, expiresIn: number): FlowCookie[] {
  const maxAge = Math.max(1, Math.floor(expiresIn));
  const sealed = sealCustomerAccountSession(session, secret);
  return packSessionCookies(sealed, maxAge);
}

export async function handleCustomerAccountStart(input: {
  requestUrl: string;
  env: NodeJS.ProcessEnv;
  fetchImpl?: FetchImpl;
  now?: number;
}): Promise<FlowResult> {
  const ready = configuredWww(input.requestUrl, input.env);
  if (!ready.ok) {
    if (ready.result.reason === 'apex') {
      return redirect(307, `${SITE_URL}${CUSTOMER_ACCOUNT_START_PATH}`, [], 'apex');
    }
    return ready.result;
  }
  const now = input.now ?? Date.now();
  const fetchImpl = input.fetchImpl ?? fetch;
  const discovered = await discover(ready.config, fetchImpl, now);
  if (!discovered) return unavailable('discovery_failed');

  const state = createOAuthState();
  const nonce = createOAuthState();
  const verifier = createPkceVerifier();
  let location: string;
  try {
    location = buildAuthorizeUrl({
      authorizationEndpoint: discovered.authorizationEndpoint,
      storeDomain: ready.config.storeDomain,
      clientId: ready.config.clientId,
      redirectUri: customerAccountCallbackUrl(ready.config.origin),
      state,
      nonce,
      codeChallenge: pkceS256Challenge(verifier),
    });
  } catch {
    return unavailable('authorize_url');
  }
  return redirect(
    302,
    location,
    [
      { name: CUSTOMER_ACCOUNT_STATE_COOKIE, value: state, maxAge: PKCE_MAX_AGE },
      { name: CUSTOMER_ACCOUNT_VERIFIER_COOKIE, value: verifier, maxAge: PKCE_MAX_AGE },
      { name: CUSTOMER_ACCOUNT_NONCE_COOKIE, value: nonce, maxAge: PKCE_MAX_AGE },
    ],
    'authorize'
  );
}

export async function handleCustomerAccountCallback(input: {
  requestUrl: string;
  cookies: { name: string; value: string }[];
  env: NodeJS.ProcessEnv;
  fetchImpl?: FetchImpl;
  now?: number;
}): Promise<FlowResult> {
  const ready = configuredWww(input.requestUrl, input.env);
  if (!ready.ok) return ready.result.reason === 'apex' ? notFound('wrong_host') : ready.result;

  const url = new URL(input.requestUrl);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const oauthError = url.searchParams.get('error') || '';
  const expectedState = cookieValue(input.cookies, CUSTOMER_ACCOUNT_STATE_COOKIE);
  const verifier = cookieValue(input.cookies, CUSTOMER_ACCOUNT_VERIFIER_COOKIE);
  const nonce = cookieValue(input.cookies, CUSTOMER_ACCOUNT_NONCE_COOKIE);
  const stateOk = oauthStateMatches(expectedState, state);

  if (oauthError) {
    if (!stateOk) return badRequest('state_mismatch');
    return redirect(
      303,
      `${SITE_URL}/auth/signin?shopify_error=cancelled`,
      clearPkceCookies(),
      'oauth_error'
    );
  }

  if (!stateOk) return badRequest('state_mismatch');
  if (!code || code.length > 2048 || /[\r\n]/.test(code) || !verifier || !nonce) {
    return badRequest('missing_code', clearPkceCookies());
  }

  const now = input.now ?? Date.now();
  const fetchImpl = input.fetchImpl ?? fetch;
  const discovered = await discover(ready.config, fetchImpl, now);
  if (!discovered) return unavailable('discovery_failed', clearPkceCookies());

  const tokenJson = await postToken(
    discovered.tokenEndpoint,
    tokenRequestBody({
      code,
      redirectUri: customerAccountCallbackUrl(ready.config.origin),
      codeVerifier: verifier,
      clientId: ready.config.clientId,
    }),
    ready.config.origin,
    fetchImpl
  );
  const accessToken = tokenJson?.access_token || '';
  const idToken = tokenJson?.id_token || '';
  const expiresIn = tokenJson?.expires_in || 0;
  const refreshToken = tokenJson?.refresh_token || '';
  if (!accessToken || !idToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return unavailable('token_failed', clearPkceCookies());
  }

  const jwks = await fetchJwks(discovered.jwksUri, fetchImpl);
  if (!jwks) return unavailable('jwks_failed', clearPkceCookies());
  const verified = verifyShopifyIdToken({
    idToken,
    jwks,
    issuer: discovered.issuer,
    audience: ready.config.clientId,
    nonce,
    now,
  });
  if (!verified.ok) return badRequest(verified.reason, clearPkceCookies());

  const session: CustomerAccountSession = {
    accessToken,
    refreshToken: refreshToken || null,
    idToken,
    expiresAtMs: now + expiresIn * 1000,
    idTokenExpiresAtMs: verified.expMs,
    sub: verified.sub,
  };
  let cookies: FlowCookie[];
  try {
    cookies = [
      ...clearPkceCookies(),
      ...sessionCookies(session, ready.config.sessionSecret, expiresIn),
    ];
  } catch {
    return unavailable('session_too_large', clearPkceCookies());
  }
  return redirect(303, `${SITE_URL}/auth/signin?shopify=connected`, cookies, 'signed_in');
}

async function refreshSession(
  config: CustomerAccountConfig,
  discovered: OpenIdDiscovery,
  session: CustomerAccountSession,
  fetchImpl: FetchImpl,
  now: number
): Promise<CustomerAccountSession | null> {
  if (!session.refreshToken) return null;
  const tokenJson = await postToken(
    discovered.tokenEndpoint,
    refreshTokenRequestBody({ clientId: config.clientId, refreshToken: session.refreshToken }),
    config.origin,
    fetchImpl
  );
  const accessToken = tokenJson?.access_token || '';
  const expiresIn = tokenJson?.expires_in || 0;
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) return null;

  let idToken = session.idToken;
  let idTokenExpiresAtMs = session.idTokenExpiresAtMs;
  let sub = session.sub;
  if (tokenJson?.id_token) {
    const jwks = await fetchJwks(discovered.jwksUri, fetchImpl);
    if (!jwks) return null;
    const verified = verifyShopifyIdToken({
      idToken: tokenJson.id_token,
      jwks,
      issuer: discovered.issuer,
      audience: config.clientId,
      nonce: null,
      now,
    });
    if (!verified.ok) return null;
    idToken = tokenJson.id_token;
    idTokenExpiresAtMs = verified.expMs;
    sub = verified.sub;
  }

  return {
    accessToken,
    refreshToken: tokenJson?.refresh_token || session.refreshToken,
    idToken,
    expiresAtMs: now + expiresIn * 1000,
    idTokenExpiresAtMs,
    sub,
  };
}

export async function resolveCustomerAccountSession(input: {
  requestUrl: string;
  cookies: { name: string; value: string }[];
  env: NodeJS.ProcessEnv;
  fetchImpl?: FetchImpl;
  now?: number;
}): Promise<{ result: FlowResult; session: CustomerAccountSession | null }> {
  const ready = configuredWww(input.requestUrl, input.env);
  if (!ready.ok) {
    const result = ready.result.reason === 'apex' ? notFound('wrong_host') : ready.result;
    return { result, session: null };
  }
  const now = input.now ?? Date.now();
  const current = readPackedSession(input.cookies, ready.config.sessionSecret);
  if (!current) {
    return {
      result: { status: 200, reason: 'signed_out', body: { signedIn: false }, cookies: [] },
      session: null,
    };
  }
  if (!sessionNeedsRefresh(current, now)) {
    return {
      result: { status: 200, reason: 'signed_in', body: { signedIn: true }, cookies: [] },
      session: current,
    };
  }
  if (!current.refreshToken) {
    return {
      result: {
        status: 200,
        reason: 'expired',
        body: { signedIn: false },
        cookies: clearSessionCookies(),
      },
      session: null,
    };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const discovered = await discover(ready.config, fetchImpl, now);
  if (!discovered) {
    return {
      result: {
        status: 200,
        reason: 'expired',
        body: { signedIn: false },
        cookies: clearSessionCookies(),
      },
      session: null,
    };
  }
  const refreshed = await refreshSession(ready.config, discovered, current, fetchImpl, now);
  if (!refreshed) {
    return {
      result: {
        status: 200,
        reason: 'expired',
        body: { signedIn: false },
        cookies: clearSessionCookies(),
      },
      session: null,
    };
  }
  const expiresIn = Math.max(1, Math.round((refreshed.expiresAtMs - now) / 1000));
  try {
    return {
      result: {
        status: 200,
        reason: 'refreshed',
        body: { signedIn: true },
        cookies: sessionCookies(refreshed, ready.config.sessionSecret, expiresIn),
      },
      session: refreshed,
    };
  } catch {
    return {
      result: {
        status: 200,
        reason: 'expired',
        body: { signedIn: false },
        cookies: clearSessionCookies(),
      },
      session: null,
    };
  }
}

export async function handleCustomerAccountSession(input: {
  requestUrl: string;
  cookies: { name: string; value: string }[];
  env: NodeJS.ProcessEnv;
  fetchImpl?: FetchImpl;
  now?: number;
}): Promise<FlowResult> {
  const resolved = await resolveCustomerAccountSession(input);
  return resolved.result;
}

export async function handleCustomerAccountLogout(input: {
  method: string;
  requestUrl: string;
  cookies: { name: string; value: string }[];
  env: NodeJS.ProcessEnv;
  fetchImpl?: FetchImpl;
  now?: number;
}): Promise<FlowResult> {
  const ready = configuredWww(input.requestUrl, input.env);
  if (!ready.ok) {
    return ready.result.reason === 'apex' ? notFound('wrong_host') : ready.result;
  }
  if (input.method !== 'POST') {
    return { status: 405, reason: 'method', cookies: [] };
  }

  const now = input.now ?? Date.now();
  const fetchImpl = input.fetchImpl ?? fetch;
  let session = readPackedSession(input.cookies, ready.config.sessionSecret);
  if (session && sessionNeedsRefresh(session, now) && session.refreshToken) {
    const discoveredForRefresh = await discover(ready.config, fetchImpl, now);
    if (discoveredForRefresh) {
      session = (await refreshSession(ready.config, discoveredForRefresh, session, fetchImpl, now)) || session;
    }
  }
  const cookies = [...clearPkceCookies(), ...clearSessionCookies()];
  if (!session || session.idTokenExpiresAtMs <= now) {
    return redirect(303, customerAccountLogoutReturnUrl(ready.config.origin), cookies, 'logged_out');
  }

  const discovered = await discover(ready.config, fetchImpl, now);
  if (!discovered) {
    return redirect(303, customerAccountLogoutReturnUrl(ready.config.origin), cookies, 'logged_out');
  }
  let location: string;
  try {
    location = endSessionUrl({
      endSessionEndpoint: discovered.endSessionEndpoint,
      storeDomain: ready.config.storeDomain,
      idToken: session.idToken,
      postLogoutRedirectUri: customerAccountLogoutReturnUrl(ready.config.origin),
    });
  } catch {
    return redirect(303, customerAccountLogoutReturnUrl(ready.config.origin), cookies, 'logged_out');
  }
  return redirect(303, location, cookies, 'logged_out');
}
