import { isShopifyConfigured, shopifyFetch } from './client';
import { normalizeProduct, toCatalogProduct, type CatalogProduct } from './normalize';
import {
  COLLECTION_PRODUCTS_QUERY,
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCT_BY_ID_QUERY,
  PRODUCTS_BY_IDS_QUERY,
  PRODUCTS_QUERY,
} from './queries';
import type { ShopifyProduct } from './types';

type ProductsResult = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: unknown[];
  };
};

export async function fetchShopifyProducts(options?: {
  first?: number;
  after?: string | null;
  query?: string;
}): Promise<{ products: ShopifyProduct[]; hasNextPage: boolean; endCursor: string | null }> {
  if (!isShopifyConfigured()) {
    return { products: [], hasNextPage: false, endCursor: null };
  }

  const data = await shopifyFetch<ProductsResult>(PRODUCTS_QUERY, {
    first: options?.first ?? 50,
    after: options?.after ?? null,
    query: options?.query || null,
  });

  const products = data.products.nodes
    .map((n) => normalizeProduct(n as Parameters<typeof normalizeProduct>[0]))
    .filter((p): p is ShopifyProduct => Boolean(p));

  return {
    products,
    hasNextPage: data.products.pageInfo.hasNextPage,
    endCursor: data.products.pageInfo.endCursor,
  };
}

export async function fetchShopifyProductByHandle(
  handle: string
): Promise<ShopifyProduct | null> {
  if (!isShopifyConfigured() || !handle) return null;
  const data = await shopifyFetch<{ product: unknown }>(PRODUCT_BY_HANDLE_QUERY, { handle });
  return normalizeProduct(data.product as Parameters<typeof normalizeProduct>[0]);
}

export async function fetchShopifyProductById(id: string): Promise<ShopifyProduct | null> {
  if (!isShopifyConfigured() || !id) return null;
  const data = await shopifyFetch<{ product: unknown }>(PRODUCT_BY_ID_QUERY, { id });
  return normalizeProduct(data.product as Parameters<typeof normalizeProduct>[0]);
}

export async function fetchShopifyProductsByIds(ids: string[]): Promise<ShopifyProduct[]> {
  if (!isShopifyConfigured() || ids.length === 0) return [];
  const data = await shopifyFetch<{ nodes: unknown[] }>(PRODUCTS_BY_IDS_QUERY, { ids });
  return (data.nodes || [])
    .map((n) => normalizeProduct(n as Parameters<typeof normalizeProduct>[0]))
    .filter((p): p is ShopifyProduct => Boolean(p));
}

export async function fetchCollectionProducts(
  handle: string,
  first = 50
): Promise<ShopifyProduct[]> {
  if (!isShopifyConfigured() || !handle) return [];
  const data = await shopifyFetch<{
    collection: { products: { nodes: unknown[] } } | null;
  }>(COLLECTION_PRODUCTS_QUERY, { handle, first });

  return (data.collection?.products.nodes || [])
    .map((n) => normalizeProduct(n as Parameters<typeof normalizeProduct>[0]))
    .filter((p): p is ShopifyProduct => Boolean(p));
}

/** Catalog list for shop UI */
export async function getCatalogProducts(options?: {
  category?: string;
  query?: string;
  first?: number;
}): Promise<CatalogProduct[]> {
  const category = options?.category?.trim();
  let products: ShopifyProduct[] = [];

  if (category) {
    // Prefer Shopify collection handle matching category
    products = await fetchCollectionProducts(category, options?.first ?? 50);
    if (products.length === 0) {
      const q = [`product_type:${category}`, `tag:${category}`].join(' OR ');
      const res = await fetchShopifyProducts({
        first: options?.first ?? 50,
        query: options?.query ? `(${q}) AND ${options.query}` : q,
      });
      products = res.products;
    }
  } else {
    const res = await fetchShopifyProducts({
      first: options?.first ?? 50,
      query: options?.query,
    });
    products = res.products;
  }

  return products.map(toCatalogProduct);
}

export async function getCatalogProductByHandle(
  handle: string
): Promise<(CatalogProduct & { shopify: ShopifyProduct }) | null> {
  const product = await fetchShopifyProductByHandle(handle);
  if (!product) return null;
  return { ...toCatalogProduct(product), shopify: product };
}

/** Paginated Storefront product count (approximate upper bound: 2000) */
export async function countCatalogProducts(): Promise<number> {
  if (!isShopifyConfigured()) return 0;

  let total = 0;
  let after: string | null = null;
  let hasNextPage = true;
  let guard = 0;

  while (hasNextPage && guard < 20) {
    guard += 1;
    const page = await fetchShopifyProducts({ first: 100, after });
    total += page.products.length;
    hasNextPage = page.hasNextPage;
    after = page.endCursor;
    if (!hasNextPage) break;
  }

  return total;
}

export type { CatalogProduct };
