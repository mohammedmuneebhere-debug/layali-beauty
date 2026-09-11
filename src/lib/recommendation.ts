/**
 * Normalized product shape for AI / survey scoring.
 * Commerce identity is always Shopify GIDs — never Supabase product UUIDs.
 */

export type ShopifyProductId = string;
export type ShopifyVariantId = string;

export type RecommendationProduct = {
  shopifyProductId: ShopifyProductId;
  /** Deterministic default: first available variant, else first variant, else null */
  shopifyVariantId: ShopifyVariantId | null;
  handle: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  /** Layali metadata + Shopify tags used for keyword scoring */
  benefits: string[];
  tags: string[];
  available: boolean;
  is_featured: boolean;
};

export type RecommendationLine = {
  shopify_product_id: ShopifyProductId;
  shopify_variant_id: ShopifyVariantId | null;
  name: string;
  reason: string;
  price: number;
  handle: string;
  image_url: string | null;
  available: boolean;
};

export function isShopifyGid(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith('gid://shopify/'));
}

export function isProductGid(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith('gid://shopify/Product/'));
}

export function isVariantGid(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith('gid://shopify/ProductVariant/'));
}
