/**
 * Trending GIDs from the Shopify shop record, hydrated by the Storefront API.
 */
import { listTrendingRows, writeTrendingRows } from '@/lib/content/store';
import { fetchShopifyProductsByIds, isShopifyConfigured } from '@/lib/shopify';
import { toCatalogProduct } from '@/lib/shopify/normalize';
import {
  TRENDING_MAX,
  validateTrendingAssignments,
  type TrendingCatalogProduct,
  type TrendingConfigRow,
  type TrendingValidationResult,
} from '@/lib/trending';

export async function fetchTrendingConfig(): Promise<TrendingConfigRow[]> {
  const rows = await listTrendingRows();
  return [...rows].sort((a, b) => a.rank - b.rank);
}

export async function fetchTrendingProducts(): Promise<TrendingCatalogProduct[]> {
  if (!isShopifyConfigured()) return [];
  const rows = (await fetchTrendingConfig())
    .filter((row) => row.isActive)
    .slice(0, TRENDING_MAX);
  const gids = rows.map((row) => row.shopifyProductId).filter(Boolean);
  if (gids.length === 0) return [];
  const products = await fetchShopifyProductsByIds(gids);
  const byId = new Map(products.map((product) => [product.id, toCatalogProduct(product)]));
  return gids
    .map((id) => byId.get(id))
    .filter((product): product is TrendingCatalogProduct => Boolean(product?.handle));
}

export async function replaceTrendingAssignments(
  input: unknown
): Promise<TrendingValidationResult & { rows?: TrendingConfigRow[] }> {
  const parsed = validateTrendingAssignments(input);
  if (!parsed.ok) return parsed;
  const rows: TrendingConfigRow[] = parsed.products.map((item) => ({
    id: item.shopifyProductId,
    shopifyProductId: item.shopifyProductId,
    rank: item.rank,
    isActive: true,
  }));
  await writeTrendingRows(rows);
  return { ok: true, products: parsed.products, rows };
}
