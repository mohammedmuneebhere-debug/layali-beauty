/**
 * Production Customer Account OAuth configuration.
 * Routes stay disabled until every required server variable is present.
 * The public origin is the live site. A Shopify session never grants staff access.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { configuredStagingOrigin } from '@/lib/auth/staging-origin';
import { SITE_URL } from '@/lib/constants';
import { isMyshopifyHost, normalizeShopHost } from '@/lib/shopify/staging-catalog';

export { configuredStagingOrigin };

export const CUSTOMER_ACCOUNT_START_PATH = '/api/customer-account/start';
export const CUSTOMER_ACCOUNT_CALLBACK_PATH = '/api/customer-account/callback';
export const CUSTOMER_ACCOUNT_LOGOUT_PATH = '/api/customer-account/logout';
export const CUSTOMER_ACCOUNT_SESSION_PATH = '/api/customer-account/session';
export const CUSTOMER_ACCOUNT_SCOPE = 'openid email customer-account-api:full';
export const CUSTOMER_ACCOUNT_USER_AGENT = 'Layali-CustomerAccounts';

export const CUSTOMER_ACCOUNT_STATE_COOKIE = 'layali_ca_state';
export const CUSTOMER_ACCOUNT_VERIFIER_COOKIE = 'layali_ca_verifier';
export const CUSTOMER_ACCOUNT_NONCE_COOKIE = 'layali_ca_nonce';
export { CUSTOMER_ACCOUNT_SESSION_COOKIE } from './customer-account-cookie';
export const CUSTOMER_ACCOUNT_SESSION_CHUNK_COOKIES = [
  'layali_ca_session_2',
  'layali_ca_session_3',
  'layali_ca_session_4',
] as const;

const WWW_HOST = 'www.layalibeautystore.com';
const APEX_HOST = 'layalibeautystore.com';

export type CustomerAccountConfig = {
  clientId: string;
  shopId: string;
  origin: string;
  sessionSecret: string;
  storeDomain: string;
};

export type CustomerAccountGate =
  | { ok: false; reason: 'not_configured' }
  | { ok: true; config: CustomerAccountConfig };

export type CustomerAccountHostDecision = 'allow' | 'redirect-www' | 'deny';

export function expectedCustomerAccountIssuer(shopId: string): string {
  return `https://shopify.com/authentication/${shopId}`;
}

/** GraphQL discovery. The version is chosen by Shopify, not pinned here. */
export function customerAccountApiDiscoveryUrl(storeDomain: string): string {
  return `https://${storeDomain}/.well-known/customer-account-api`;
}

export function openIdDiscoveryUrl(storeDomain: string): string {
  return `https://${storeDomain}/.well-known/openid-configuration`;
}

export function customerAccountCallbackUrl(origin = SITE_URL): string {
  return `${origin.replace(/\/$/, '')}${CUSTOMER_ACCOUNT_CALLBACK_PATH}`;
}

export function customerAccountLogoutReturnUrl(origin = SITE_URL): string {
  return `${origin.replace(/\/$/, '')}/`;
}

export function customerAccountJavascriptOrigin(origin = SITE_URL): string {
  return origin.replace(/\/$/, '');
}

export function customerAccountHostDecision(
  hostHeader: string,
  env: NodeJS.ProcessEnv = process.env
): CustomerAccountHostDecision {
  const token = hostHeader.split(',')[0]?.trim().toLowerCase() || '';
  const hasPort = /:\d+$/.test(token);
  const host = token.replace(/:\d+$/, '');
  if (host === WWW_HOST) return 'allow';
  if (host === APEX_HOST) return 'redirect-www';
  const staging = configuredStagingOrigin(env);
  if (!hasPort && staging && host === new URL(staging).hostname) return 'allow';
  return 'deny';
}

export function customerAccountsOfferedOnHost(hostHeader: string): boolean {
  const decision = customerAccountHostDecision(hostHeader);
  return decision === 'allow' || decision === 'redirect-www';
}

/**
 * Enabled only when the production server has a public client id, numeric shop id,
 * myshopify domain, and a session secret of at least 32 characters.
 * Values are read from the process environment. The staging file is not consulted.
 */
export function customerAccountConfig(env: NodeJS.ProcessEnv): CustomerAccountGate {
  const storeDomain = normalizeShopHost(env.SHOPIFY_STORE_DOMAIN || '');
  const clientId = (env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID || '').trim();
  const shopId = (env.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID || '').trim();
  const sessionSecret = env.SHOPIFY_CUSTOMER_ACCOUNT_SESSION_SECRET || '';
  if (!isMyshopifyHost(storeDomain) || !clientId || !/^\d+$/.test(shopId) || sessionSecret.length < 32) {
    return { ok: false, reason: 'not_configured' };
  }
  return {
    ok: true,
    config: {
      clientId,
      shopId,
      origin: SITE_URL,
      sessionSecret,
      storeDomain,
    },
  };
}

export function callbackUrl(origin: string): string {
  return customerAccountCallbackUrl(origin);
}

export function createPkceVerifier(): string {
  return randomBytes(32).toString('base64url');
}

export function pkceS256Challenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function createOAuthState(): string {
  return randomBytes(32).toString('base64url');
}

export function oauthStateMatches(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function safeEqualText(expected: string, received: string): boolean {
  return oauthStateMatches(expected, received);
}

export function accessTokenExpired(expiresAtMs: number, now: number, skewMs = 30_000): boolean {
  return now + skewMs >= expiresAtMs;
}

/** Browser-supplied customer ids are ignored. Only equal server-side ids match. */
export function customerCanAccessOrder(
  sessionCustomerId: string | null | undefined,
  orderCustomerId: string | null | undefined,
  browserCustomerId?: string | null
): boolean {
  void browserCustomerId;
  if (!sessionCustomerId || !orderCustomerId) return false;
  return sessionCustomerId === orderCustomerId;
}

export function assertAuthorizationEndpoint(endpoint: string, storeDomain: string): URL {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') {
    throw new Error('Customer Account authorization endpoint must be HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('Customer Account authorization endpoint must not include credentials');
  }
  const host = url.hostname.toLowerCase();
  const shop = storeDomain.toLowerCase();
  const allowed = host === shop || host === 'shopify.com' || host.endsWith('.shopify.com');
  if (!allowed) {
    throw new Error('Customer Account authorization endpoint host is not Shopify');
  }
  return url;
}

export type OpenIdDiscovery = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  endSessionEndpoint: string;
  jwksUri: string;
};

export function assertOpenIdDiscovery(
  doc: unknown,
  storeDomain: string,
  shopId: string
): OpenIdDiscovery {
  if (!doc || typeof doc !== 'object') {
    throw new Error('Customer Account discovery document is missing');
  }
  const row = doc as Record<string, unknown>;
  const issuer = String(row.issuer || '').replace(/\/$/, '');
  if (!safeEqualText(expectedCustomerAccountIssuer(shopId), issuer)) {
    throw new Error('Customer Account issuer does not match the shop id');
  }
  const authorizationEndpoint = assertAuthorizationEndpoint(
    String(row.authorization_endpoint || ''),
    storeDomain
  ).toString();
  const tokenEndpoint = assertAuthorizationEndpoint(String(row.token_endpoint || ''), storeDomain).toString();
  const endSessionEndpoint = assertAuthorizationEndpoint(
    String(row.end_session_endpoint || ''),
    storeDomain
  ).toString();
  const jwksUri = assertAuthorizationEndpoint(String(row.jwks_uri || ''), storeDomain).toString();
  return { issuer, authorizationEndpoint, tokenEndpoint, endSessionEndpoint, jwksUri };
}

export function buildAuthorizeUrl(params: {
  authorizationEndpoint: string;
  storeDomain: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = assertAuthorizationEndpoint(params.authorizationEndpoint, params.storeDomain);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', CUSTOMER_ACCOUNT_SCOPE);
  url.searchParams.set('state', params.state);
  url.searchParams.set('nonce', params.nonce);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('region_country', 'SA');
  return url.toString();
}

export function tokenRequestBody(params: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
}): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
  });
}

export function refreshTokenRequestBody(params: {
  clientId: string;
  refreshToken: string;
}): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: params.clientId,
    refresh_token: params.refreshToken,
  });
}

export function customerAccountTokenHeaders(origin: string): Record<string, string> {
  return {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    Origin: origin,
    'User-Agent': CUSTOMER_ACCOUNT_USER_AGENT,
  };
}

export function endSessionUrl(params: {
  endSessionEndpoint: string;
  storeDomain: string;
  idToken: string;
  postLogoutRedirectUri: string;
}): string {
  const url = assertAuthorizationEndpoint(params.endSessionEndpoint, params.storeDomain);
  url.searchParams.set('id_token_hint', params.idToken);
  url.searchParams.set('post_logout_redirect_uri', params.postLogoutRedirectUri);
  return url.toString();
}
