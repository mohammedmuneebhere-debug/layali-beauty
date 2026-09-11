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

/**
 * Server-side Storefront API fetch. Never call from client with secrets.
 */
export async function shopifyFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: { cache?: RequestCache; revalidate?: number | false }
): Promise<T> {
  const token = getStorefrontToken();
  if (!token) throw new Error('SHOPIFY_STOREFRONT_ACCESS_TOKEN is not configured');

  const cache = options?.cache;
  const revalidate = options?.revalidate;

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

  if (!res.ok) {
    throw new Error(`Shopify Storefront HTTP ${res.status}`);
  }

  const json = (await res.json()) as GraphqlResponse<T>;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  if (!json.data) {
    throw new Error('Shopify Storefront returned no data');
  }
  return json.data;
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
