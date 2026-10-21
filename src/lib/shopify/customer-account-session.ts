/**
 * Encrypted Customer Account session cookie and ID token checks.
 * The cookie is HttpOnly. Callers must not send these tokens to the Storefront API.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  randomBytes,
  verify,
  type JsonWebKey,
} from 'node:crypto';
import {
  CUSTOMER_ACCOUNT_SESSION_CHUNK_COOKIES,
  CUSTOMER_ACCOUNT_SESSION_COOKIE,
  accessTokenExpired,
  safeEqualText,
} from '@/lib/shopify/customer-account';

const CHUNK_SIZE = 3200;

export type CustomerAccountSession = {
  accessToken: string;
  refreshToken: string | null;
  idToken: string;
  expiresAtMs: number;
  idTokenExpiresAtMs: number;
  sub: string | null;
};

export type SessionCookie = { name: string; value: string; maxAge: number };

type StoredSession = CustomerAccountSession & { v: 1 };

export type IdTokenCheck =
  | { ok: true; sub: string | null; expMs: number }
  | { ok: false; reason: 'invalid_id_token' | 'nonce_mismatch' };

export function sessionCookieNames(): string[] {
  return [CUSTOMER_ACCOUNT_SESSION_COOKIE, ...CUSTOMER_ACCOUNT_SESSION_CHUNK_COOKIES];
}

function keyFromSecret(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function sealCustomerAccountSession(
  session: CustomerAccountSession,
  secret: string
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify({ v: 1, ...session } satisfies StoredSession), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), body.toString('base64url')].join('.');
}

export function openCustomerAccountSession(
  sealed: string,
  secret: string
): CustomerAccountSession | null {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const data = Buffer.from(parts[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || data.length === 0) return null;
    const decipher = createDecipheriv('aes-256-gcm', keyFromSecret(secret), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(json) as Partial<StoredSession>;
    if (parsed.v !== 1 || typeof parsed.accessToken !== 'string' || typeof parsed.idToken !== 'string') {
      return null;
    }
    if (!Number.isFinite(parsed.expiresAtMs) || !Number.isFinite(parsed.idTokenExpiresAtMs)) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === 'string' && parsed.refreshToken ? parsed.refreshToken : null,
      idToken: parsed.idToken,
      expiresAtMs: Number(parsed.expiresAtMs),
      idTokenExpiresAtMs: Number(parsed.idTokenExpiresAtMs),
      sub: typeof parsed.sub === 'string' && parsed.sub ? parsed.sub : null,
    };
  } catch {
    return null;
  }
}

export function packSessionCookies(sealed: string, maxAge: number): SessionCookie[] {
  const chunks = sealed.length <= CHUNK_SIZE ? [sealed] : splitChunks(sealed);
  const names = sessionCookieNames();
  if (chunks.length > names.length) {
    throw new Error('Customer Account session cookie is too large');
  }
  return names.map((name, index) => ({
    name,
    value: chunks[index] || '',
    maxAge: chunks[index] ? maxAge : 0,
  }));
}

function splitChunks(sealed: string): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < sealed.length; offset += CHUNK_SIZE) {
    chunks.push(sealed.slice(offset, offset + CHUNK_SIZE));
  }
  return chunks;
}

export function readPackedSession(
  cookies: { name: string; value: string }[],
  secret: string
): CustomerAccountSession | null {
  const byName = new Map(cookies.map((cookie) => [cookie.name, cookie.value]));
  const sealed = sessionCookieNames()
    .map((name) => byName.get(name) || '')
    .filter(Boolean)
    .join('');
  if (!sealed) return null;
  return openCustomerAccountSession(sealed, secret);
}

export function sessionNeedsRefresh(session: CustomerAccountSession, now: number): boolean {
  return accessTokenExpired(session.expiresAtMs, now);
}

function decodeJsonSegment(segment: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function audienceMatches(audience: unknown, clientId: string): boolean {
  if (typeof audience === 'string') return safeEqualText(clientId, audience);
  if (!Array.isArray(audience)) return false;
  return audience.some((entry) => typeof entry === 'string' && safeEqualText(clientId, entry));
}

export function verifyShopifyIdToken(params: {
  idToken: string;
  jwks: { keys?: Array<Record<string, unknown>> };
  issuer: string;
  audience: string;
  nonce: string | null;
  now: number;
  skewMs?: number;
}): IdTokenCheck {
  const fail = (): IdTokenCheck => ({ ok: false, reason: 'invalid_id_token' });
  if (!params.idToken || params.idToken.length > 12_000) return fail();
  const segments = params.idToken.split('.');
  if (segments.length !== 3) return fail();
  const header = decodeJsonSegment(segments[0]);
  const payload = decodeJsonSegment(segments[1]);
  if (!header || !payload) return fail();
  if (header.alg !== 'RS256') return fail();
  if (header.typ && header.typ !== 'JWT') return fail();
  const kid = typeof header.kid === 'string' ? header.kid : '';
  if (!kid) return fail();
  const jwk = (params.jwks.keys || []).find((key) => key.kid === kid && key.kty === 'RSA');
  if (!jwk) return fail();
  if (jwk.alg && jwk.alg !== 'RS256') return fail();

  let signatureOk = false;
  try {
    const key = createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' });
    const signature = Buffer.from(segments[2], 'base64url');
    signatureOk = verify(
      'RSA-SHA256',
      Buffer.from(`${segments[0]}.${segments[1]}`),
      key,
      signature
    );
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return fail();

  const skew = params.skewMs ?? 30_000;
  const iss = typeof payload.iss === 'string' ? payload.iss.replace(/\/$/, '') : '';
  if (!safeEqualText(params.issuer, iss)) return fail();
  if (!audienceMatches(payload.aud, params.audience)) return fail();
  const exp = typeof payload.exp === 'number' ? payload.exp : Number.NaN;
  if (!Number.isFinite(exp) || params.now > exp * 1000 + skew) return fail();
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : null;
  if (nbf != null && params.now + skew < nbf * 1000) return fail();

  const tokenNonce = typeof payload.nonce === 'string' ? payload.nonce : '';
  if (params.nonce != null) {
    if (!tokenNonce || !safeEqualText(params.nonce, tokenNonce)) {
      return { ok: false, reason: 'nonce_mismatch' };
    }
  }

  const sub = typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  return { ok: true, sub, expMs: exp * 1000 };
}
