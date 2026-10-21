/**
 * Trending assignment validation.
 * The ordered Shopify product GIDs live in a shop metafield.
 * Storefront hydration stays in trending-data.ts so this module can be imported by client UI.
 * Empty selection → empty list. No silent first-N catalog fallback.
 */
import type { CatalogProduct } from '@/lib/shopify/normalize';

export const TRENDING_MAX = 8;

export type TrendingCatalogProduct = CatalogProduct;

export type TrendingAssignment = {
  shopifyProductId: string;
  rank: number;
};

const SHOPIFY_PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;

export type TrendingValidationResult =
  | { ok: true; products: TrendingAssignment[] }
  | { ok: false; error: string };

export function validateTrendingAssignments(input: unknown): TrendingValidationResult {
  if (!Array.isArray(input)) {
    return { ok: false, error: 'products must be an array' };
  }
  if (input.length > TRENDING_MAX) {
    return { ok: false, error: `Maximum ${TRENDING_MAX} trending products` };
  }

  const products: TrendingAssignment[] = [];
  const ranks = new Set<number>();
  const ids = new Set<string>();

  for (const row of input) {
    if (!row || typeof row !== 'object') {
      return { ok: false, error: 'Each trending product must be an object' };
    }
    const shopifyProductId =
      typeof (row as { shopifyProductId?: unknown }).shopifyProductId === 'string'
        ? (row as { shopifyProductId: string }).shopifyProductId.trim()
        : '';
    const rankRaw = (row as { rank?: unknown }).rank;
    const rank = typeof rankRaw === 'number' ? rankRaw : Number(rankRaw);

    if (!SHOPIFY_PRODUCT_GID.test(shopifyProductId)) {
      return { ok: false, error: 'shopifyProductId must be a Shopify product GID' };
    }
    if (!Number.isInteger(rank)) {
      return { ok: false, error: 'rank must be an integer' };
    }
    if (rank < 1 || rank > TRENDING_MAX) {
      return { ok: false, error: `rank must be between 1 and ${TRENDING_MAX}` };
    }
    if (ranks.has(rank)) {
      return { ok: false, error: `Duplicate rank ${rank}` };
    }
    if (ids.has(shopifyProductId)) {
      return { ok: false, error: 'Duplicate Shopify product in trending list' };
    }

    ranks.add(rank);
    ids.add(shopifyProductId);
    products.push({ shopifyProductId, rank });
  }

  return { ok: true, products };
}

export type TrendingConfigRow = {
  id: string;
  shopifyProductId: string;
  rank: number;
  isActive: boolean;
};

