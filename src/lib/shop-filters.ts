/**
 * Shop brand filters — Shopify `vendor` is the authoritative brand field.
 * Brands are collected from the full loaded catalog (not a static list).
 */
import { shopSearchScore } from '@/lib/shop-search';

export const PAGE_SIZE = 12;

export function collectVendors(
  products: { vendor?: string | null }[]
): string[] {
  const set = new Set<string>();
  for (const p of products) {
    const vendor = p.vendor?.trim();
    if (vendor) set.add(vendor);
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

/** Alias for collectVendors — shop UI historically called this collectBrands. */
export function collectBrands(
  products: { vendor?: string | null }[]
): string[] {
  return collectVendors(products);
}

export type ShopListProduct = {
  name: string;
  description?: string | null;
  category: string;
  vendor?: string | null;
  price: number | string;
  tags?: string[] | null;
};

export type ShopListFilters = {
  category?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  search?: string;
};

/** Same predicate the shop page uses before sort and pagination. */
export function filterShopProducts<T extends ShopListProduct>(
  products: T[],
  filters: ShopListFilters
): T[] {
  const category = filters.category?.trim() || '';
  const brand = filters.brand?.trim() || '';
  const q = filters.search?.trim().toLowerCase() || '';
  const min = filters.minPrice ? Number(filters.minPrice) : null;
  const max = filters.maxPrice ? Number(filters.maxPrice) : null;

  const narrowed: { product: T; index: number }[] = [];
  products.forEach((product, index) => {
    if (category && product.category !== category) return;
    if (brand && (product.vendor || '').trim() !== brand) return;
    const price = Number(product.price);
    if (min != null && !Number.isNaN(min) && price < min) return;
    if (max != null && !Number.isNaN(max) && price > max) return;
    narrowed.push({ product, index });
  });

  if (!q) return narrowed.map((row) => row.product);

  return narrowed
    .map((row) => ({ ...row, score: shopSearchScore(row.product, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.product);
}

export type ShopSortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';

/**
 * Shop sort. `featured` keeps the incoming order. A search already ordered
 * that list by relevance; other keys reorder a copy. The input array is not mutated.
 */
export function sortShopProducts<T extends { name: string; price: number | string }>(
  products: readonly T[],
  sort: ShopSortKey
): T[] {
  const sorted = [...products];
  if (sort === 'price-asc') sorted.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === 'price-desc') sorted.sort((a, b) => Number(b.price) - Number(a.price));
  if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}

export function paginateShopProducts<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    currentPage,
    totalPages,
  };
}
