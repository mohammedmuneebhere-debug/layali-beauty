const API_VERSION = '2025-01';

export function getShopifyStoreDomain(): string {
  return (
    process.env.SHOPIFY_STORE_DOMAIN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ||
    ''
  ).replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function getStorefrontToken(): string {
  return process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || '';
}

export function isShopifyConfigured(): boolean {
  return Boolean(getShopifyStoreDomain() && getStorefrontToken());
}

export function shopifyStorefrontEndpoint(): string {
  const domain = getShopifyStoreDomain();
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not configured');
  return `https://${domain}/api/${API_VERSION}/graphql.json`;
}

type GraphqlResponse<T> = {
  data?: T;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isThrottleError(errors?: { message: string }[]) {
  return Boolean(errors?.some((e) => /throttl/i.test(e.message)));
}

export class ShopifyThrottleError extends Error {
  constructor(message = 'Throttled') {
    super(message);
    this.name = 'ShopifyThrottleError';
  }
}

/**
 * Server-side Storefront API fetch. Never call from client with secrets.
 *
 * Cart mutations must NOT retry aggressively — retries amplify rate limits and
 * turn one "+" click into a burst of Storefront POSTs (seen as Vercel 502 Throttled).
 * Pass `retries: 0` for all cart ops (see CART_FETCH in cart.ts).
 */
export async function shopifyFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: {
    cache?: RequestCache;
    revalidate?: number | false;
    /** Extra attempts after the first. Cart ops must pass 0. Default 0 (fail fast). */
    retries?: number;
  }
): Promise<T> {
  const token = getStorefrontToken();
  if (!token) throw new Error('SHOPIFY_STOREFRONT_ACCESS_TOKEN is not configured');

  const cache = options?.cache;
  const revalidate = options?.revalidate;
  const maxAttempts = 1 + Math.max(0, options?.retries ?? 0);

  // Optional proof counter for local CART_DEBUG verification scripts.
  const g = globalThis as typeof globalThis & { __shopifyStorefrontCalls?: number };
  if (typeof g.__shopifyStorefrontCalls === 'number') {
    g.__shopifyStorefrontCalls += 1;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(shopifyStorefrontEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Shopify-Storefront-Private-Token': token,
      },
      body: JSON.stringify({ query, variables }),
      ...(cache ? { cache } : {}),
      ...(revalidate !== undefined
        ? { next: { revalidate: revalidate === false ? 0 : revalidate } }
        : { next: { revalidate: 60 } }),
    });

    if (res.status === 429) {
      if (attempt < maxAttempts - 1) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw new ShopifyThrottleError('Throttled');
    }

    if (!res.ok) {
      throw new Error(`Shopify Storefront HTTP ${res.status}`);
    }

    const json = (await res.json()) as GraphqlResponse<T>;
    if (isThrottleError(json.errors)) {
      if (attempt < maxAttempts - 1) {
        await sleep(2500 * (attempt + 1));
        continue;
      }
      throw new ShopifyThrottleError(
        json.errors?.map((e) => e.message).join('; ') || 'Throttled'
      );
    }
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join('; '));
    }
    if (!json.data) {
      throw new Error('Shopify Storefront returned no data');
    }
    return json.data;
  }

  throw new Error('Shopify Storefront request failed after retries');
}

export function parseMoney(amount: string | number | null | undefined, currencyCode = 'SAR'): {
  amount: number;
  currencyCode: string;
} {
  return {
    amount: amount == null ? 0 : Number(amount),
    currencyCode,
  };
}

export function gidToLegacyId(gid: string): string {
  const parts = gid.split('/');
  return parts[parts.length - 1] || gid;
}
