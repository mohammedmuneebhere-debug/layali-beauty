/**
 * Shop brand filters — Shopify `vendor` is the authoritative brand field.
 * Brands are collected from the full loaded catalog (not a static list).
 */
import { searchableCategory } from '@/lib/shopify/category';

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

  return products.filter((product) => {
    if (category && product.category !== category) return false;
    if (brand && (product.vendor || '').trim() !== brand) return false;
    const price = Number(product.price);
    if (min != null && !Number.isNaN(min) && price < min) return false;
    if (max != null && !Number.isNaN(max) && price > max) return false;
    if (q) {
      const hay =
        `${product.name} ${product.description || ''} ${searchableCategory(product.category)} ${product.vendor || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type ShopSortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';

/**
 * Shop sort. `featured` keeps catalog order — the order Storefront pagination
 * already returned. Other keys reorder a copy. The input array is not mutated.
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
