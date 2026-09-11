/**
 * Normalized product shape for AI / survey scoring.
 * Commerce identity is always Shopify GIDs — never Supabase product UUIDs.
 */

import type { ComboShopifyItem } from '@/types/database';

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

export type { ComboShopifyItem };
export type RecommendationLine = ComboShopifyItem;

export function isShopifyGid(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith('gid://shopify/'));
}

export function isProductGid(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith('gid://shopify/Product/'));
}

export function isVariantGid(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith('gid://shopify/ProductVariant/'));
}

/** Expand combo shopify_items into Shopify Cart line inputs */
export function comboItemsToCartLines(
  items: ComboShopifyItem[] | null | undefined
): { merchandiseId: string; quantity: number }[] {
  if (!items?.length) return [];
  return items
    .filter((i) => i.available !== false && isVariantGid(i.shopify_variant_id))
    .map((i) => ({
      merchandiseId: i.shopify_variant_id as string,
      quantity: Math.max(1, Number(i.quantity) || 1),
    }));
}
