import type { ShopProduct } from '@/lib/catalog';

const SIMILAR_MIN = 4;
const SIMILAR_MAX = 8;

/** Escape a value for Shopify Storefront product search (quoted string). */
export function shopifySearchQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function vendorSearchQuery(vendor: string): string {
  return `vendor:"${shopifySearchQuoted(vendor.trim())}"`;
}

/**
 * Prefer same vendor, then same category. Exclude current. Dedupe. Cap 4–8.
 */
export function pickSimilarProducts(
  candidates: ShopProduct[],
  current: Pick<ShopProduct, 'id' | 'vendor' | 'category'>,
  limit = SIMILAR_MAX
): ShopProduct[] {
  const cap = Math.min(Math.max(limit, SIMILAR_MIN), SIMILAR_MAX);
  const excludeId = current.id;
  const vendor = current.vendor?.trim() || '';
  const category = current.category?.trim().toLowerCase() || '';

  const seen = new Set<string>([excludeId]);
  const out: ShopProduct[] = [];

  const push = (list: ShopProduct[]) => {
    for (const p of list) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
      if (out.length >= cap) return;
    }
  };

  if (vendor) {
    push(candidates.filter((p) => p.vendor?.trim() === vendor));
  }
  if (out.length < cap && category) {
    push(candidates.filter((p) => p.category?.toLowerCase() === category));
  }
  if (out.length < cap) {
    push(candidates);
  }

  return out;
}
