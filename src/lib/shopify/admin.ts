/**
 * Server-only Shopify Admin API client (client-credentials).
 * Do not import from Client Components. Never expose client secret or Admin tokens.
 */
import { getShopifyStoreDomain } from './client';

if (typeof window !== 'undefined') {
  throw new Error('Shopify Admin client must only be used on the server');
}

const API_VERSION = '2025-01';

/** Token exchange is typically fast; keep generous for slow networks. */
const TOKEN_FETCH_TIMEOUT_MS = 30_000;
/**
 * productSet + media ingest can be slower than simple queries.
 * 90s avoids premature aborts on normal Admin GraphQL mutations.
 */
const ADMIN_GRAPHQL_TIMEOUT_MS = 90_000;

type GraphqlResponse<T> = {
  data?: T;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
  extensions?: {
    cost?: {
      throttleStatus?: {
        currentlyAvailable?: number;
        restoreRate?: number;
      };
    };
  };
};

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;

export function isShopifyAdminConfigured(): boolean {
  return Boolean(
    getShopifyStoreDomain() &&
      process.env.SHOPIFY_CLIENT_ID?.trim() &&
      process.env.SHOPIFY_CLIENT_SECRET?.trim()
  );
}

export function shopifyAdminEndpoint(): string {
  const domain = getShopifyStoreDomain();
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not configured');
  return `https://${domain}/admin/api/${API_VERSION}/graphql.json`;
}

function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return true;
  return /aborted|timeout/i.test(err.message);
}

/**
 * Parse Retry-After as either delta-seconds or HTTP-date.
 * Returns a finite delay in milliseconds, never NaN.
 */
export function parseRetryAfterMs(header: string | null, fallbackSec = 2): number {
  const fallbackMs = Math.max(1000, fallbackSec * 1000);
  if (!header?.trim()) return fallbackMs;

  const trimmed = header.trim();
  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.max(1000, asSeconds * 1000);
  }

  const asDateMs = Date.parse(trimmed);
  if (Number.isFinite(asDateMs)) {
    const delta = asDateMs - Date.now();
    if (Number.isFinite(delta) && delta > 0) {
      return Math.max(1000, delta);
    }
    return fallbackMs;
  }

  return fallbackMs;
}

/**
 * Client-credentials grant for Dev Dashboard apps.
 * Client ID/secret never leave the server. Token is cached until near expiry (~24h).
 */
export async function getShopifyAdminAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAtMs - 60_000) {
    return tokenCache.accessToken;
  }

  const domain = getShopifyStoreDomain();
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();

  if (!domain || !clientId || !clientSecret) {
    throw new Error(
      'Shopify Admin credentials missing (SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET)'
    );
  }

  let response: Response;
  try {
    response = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TOKEN_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new Error(
        `Shopify client-credentials token request timed out after ${TOKEN_FETCH_TIMEOUT_MS}ms`
      );
    }
    throw err;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Shopify client-credentials token request failed: HTTP ${response.status}${body ? ` — ${body.slice(0, 200)}` : ''}`
    );
  }

  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!json.access_token) {
    throw new Error('Shopify token response missing access_token');
  }

  const expiresInSec = typeof json.expires_in === 'number' ? json.expires_in : 86399;
  tokenCache = {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + expiresInSec * 1000,
  };

  return json.access_token;
}

/** Clear cached Admin token (tests / forced refresh). */
export function clearShopifyAdminTokenCache(): void {
  tokenCache = null;
}

export type AdminFetchResult<T> = {
  data: T;
  /** Present when allowPartialData=true and Shopify returned field-level GraphQL errors. */
  errors?: { message: string; extensions?: Record<string, unknown> }[];
  throttleAvailable?: number;
};

/**
 * Server-side Admin GraphQL fetch. Never call from the browser.
 *
 * Set allowPartialData when a mutation may succeed while a nested field
 * (e.g. DraftOrder.order) is denied by scopes — callers must inspect errors.
 */
export async function shopifyAdminFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: { retries?: number; allowPartialData?: boolean }
): Promise<AdminFetchResult<T>> {
  const retries = options?.retries ?? 3;
  const allowPartialData = options?.allowPartialData === true;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const token = await getShopifyAdminAccessToken();

    let res: Response;
    try {
      res = await fetch(shopifyAdminEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
        cache: 'no-store',
        signal: AbortSignal.timeout(ADMIN_GRAPHQL_TIMEOUT_MS),
      });
    } catch (err) {
      lastError = isTimeoutError(err)
        ? new Error(
            `Shopify Admin GraphQL timed out after ${ADMIN_GRAPHQL_TIMEOUT_MS}ms`
          )
        : err instanceof Error
          ? err
          : new Error(String(err));

      if (attempt >= retries) break;
      await sleep(1000 * (attempt + 1));
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`Shopify Admin HTTP ${res.status}`);
      if (attempt >= retries) break;
      const retryMs = parseRetryAfterMs(res.headers.get('Retry-After'), 2);
      await sleep(retryMs * (attempt + 1));
      continue;
    }

    if (!res.ok) {
      throw new Error(`Shopify Admin HTTP ${res.status}`);
    }

    const json = (await res.json()) as GraphqlResponse<T>;
    if (json.errors?.length) {
      const msg = json.errors.map((e) => e.message).join('; ');
      const throttled = json.errors.some(
        (e) =>
          e.message.toLowerCase().includes('throttl') ||
          e.extensions?.code === 'THROTTLED'
      );
      if (throttled && attempt < retries) {
        lastError = new Error(msg);
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (allowPartialData && json.data) {
        return {
          data: json.data,
          errors: json.errors,
          throttleAvailable: json.extensions?.cost?.throttleStatus?.currentlyAvailable,
        };
      }
      throw new Error(msg);
    }

    if (!json.data) {
      throw new Error('Shopify Admin returned no data');
    }

    return {
      data: json.data,
      throttleAvailable: json.extensions?.cost?.throttleStatus?.currentlyAvailable,
    };
  }

  throw lastError ?? new Error('Shopify Admin request failed after retries');
}

export function sleep(ms: number): Promise<void> {
  const delay = Number.isFinite(ms) && ms > 0 ? ms : 1000;
  return new Promise((resolve) => setTimeout(resolve, delay));
}
