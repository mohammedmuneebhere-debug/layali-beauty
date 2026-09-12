/**
 * Shopify CDN image URL helpers.
 * Prefer GraphQL `url(transform:)` when fetching; use these for client/card URLs.
 */

/** Typical product-card display width (2-up mobile → ~180 CSS px @2x ≈ 360; desktop 4-up ≈ 400). */
export const SHOP_CARD_IMAGE_WIDTH = 600;

/** Cart thumbnail / small UI. */
export const SHOP_THUMB_IMAGE_WIDTH = 160;

/**
 * Append Shopify CDN resize params. No-op for empty/invalid URLs.
 * Works with cdn.shopify.com / *.myshopify.com file URLs.
 */
export function shopifyImageUrl(
  url: string | null | undefined,
  width: number,
  options?: { height?: number }
): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.searchParams.set('width', String(Math.max(1, Math.round(width))));
    if (options?.height) {
      u.searchParams.set('height', String(Math.max(1, Math.round(options.height))));
    }
    return u.toString();
  } catch {
    return url;
  }
}
