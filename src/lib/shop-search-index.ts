import { getCatalogProducts } from '@/lib/shopify/products';
import { rankShopProducts } from '@/lib/shop-search';
import type { CatalogProduct } from '@/lib/shopify/normalize';

const INDEX_TTL_MS = 60_000;
const DEFAULT_LIMIT = 6;

let cached: { at: number; products: CatalogProduct[] } | null = null;
let pending: Promise<CatalogProduct[]> | null = null;

async function searchableCatalog(): Promise<CatalogProduct[]> {
  const now = Date.now();
  if (cached && now - cached.at < INDEX_TTL_MS) return cached.products;
  if (!pending) {
    pending = getCatalogProducts()
      .then((products) => {
        cached = { at: Date.now(), products };
        pending = null;
        return products;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

export type SearchSuggestion = {
  id: string;
  handle: string;
  name: string;
  vendor: string;
  price: number;
  image_url: string | null;
};

/** Rank the cached catalog. Keystrokes do not each download Shopify. */
export async function suggestStorefrontProducts(
  query: string,
  limit = DEFAULT_LIMIT
): Promise<SearchSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const products = await searchableCatalog();
  const bounded = Math.min(Math.max(limit, 1), 8);
  return rankShopProducts(products, q)
    .slice(0, bounded)
    .map((product) => ({
      id: product.id,
      handle: product.handle,
      name: product.name,
      vendor: product.vendor,
      price: product.price,
      image_url: product.image_url,
    }));
}
