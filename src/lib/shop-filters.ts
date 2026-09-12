/**
 * Shop brand filters — Shopify `vendor` is the authoritative brand field.
 * Brands are collected from the full loaded catalog (not a static list).
 */

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
