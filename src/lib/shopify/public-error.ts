import { ShopifyStorefrontQueryError, ShopifyThrottleError } from '@/lib/shopify/client';

export type PublicStorefrontFailure = {
  error: 'Unable to load products';
  code:
    | 'storefront_unauthorized'
    | 'storefront_unavailable'
    | 'storefront_throttled'
    | 'storefront_http'
    | 'storefront_query'
    | 'storefront_empty'
    | 'storefront_error';
  storefrontStatus: number | null;
};

/** Safe for a browser response. Does not include the Shopify message or any credential. */
export function publicStorefrontFailure(error: unknown): PublicStorefrontFailure {
  const message = error instanceof Error ? error.message : '';
  const match = message.match(/Shopify Storefront HTTP (\d{3})/);
  if (match) {
    const storefrontStatus = Number(match[1]);
    const code =
      storefrontStatus === 401 || storefrontStatus === 403
        ? 'storefront_unauthorized'
        : storefrontStatus === 402
          ? 'storefront_unavailable'
          : storefrontStatus === 429
            ? 'storefront_throttled'
            : 'storefront_http';
    return { error: 'Unable to load products', code, storefrontStatus };
  }
  if (error instanceof ShopifyThrottleError || /throttl/i.test(message)) {
    return { error: 'Unable to load products', code: 'storefront_throttled', storefrontStatus: 429 };
  }
  if (error instanceof ShopifyStorefrontQueryError || message === 'Shopify Storefront query rejected') {
    return { error: 'Unable to load products', code: 'storefront_query', storefrontStatus: null };
  }
  if (message === 'Shopify Storefront returned no data') {
    return { error: 'Unable to load products', code: 'storefront_empty', storefrontStatus: null };
  }
  return { error: 'Unable to load products', code: 'storefront_error', storefrontStatus: null };
}
