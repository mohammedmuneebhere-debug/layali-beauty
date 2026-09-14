import { isShopifyConfigured, shopifyFetch } from './client';
import { resolveStorefrontCategory } from './category';
import { normalizeProduct, toCatalogProduct, type CatalogProduct } from './normalize';
import {
  COLLECTION_PRODUCTS_QUERY,
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCT_BY_ID_QUERY,
  PRODUCTS_BY_IDS_QUERY,
  PRODUCTS_QUERY,
} from './queries';
import type { ShopifyProduct } from './types';

/** Storefront API page size (max 250). */
const STOREFRONT_PAGE_SIZE = 100;
/** Safety cap: 100 pages × 100 = 10_000 products. */
const MAX_CATALOG_PAGES = 100;

type ProductsResult = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: unknown[];
  };
};

type CollectionProductsResult = {
  collection: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: unknown[];
    };
  } | null;
};

export async function fetchShopifyProducts(options?: {
  first?: number;
  after?: string | null;
  query?: string;
}): Promise<{ products: ShopifyProduct[]; hasNextPage: boolean; endCursor: string | null }> {
  if (!isShopifyConfigured()) {
    return { products: [], hasNextPage: false, endCursor: null };
  }

  const first = Math.min(Math.max(options?.first ?? STOREFRONT_PAGE_SIZE, 1), 250);

  const data = await shopifyFetch<ProductsResult>(PRODUCTS_QUERY, {
    first,
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

/**
 * Cursor-paginate Storefront products until exhausted (or optional maxCount).
 * Does NOT filter by availableForSale / inventory — unpublished channels aside,
 * out-of-stock products remain in the catalog when Shopify returns them.
 */
export async function fetchAllShopifyProducts(options?: {
  query?: string;
  pageSize?: number;
  maxCount?: number;
}): Promise<ShopifyProduct[]> {
  if (!isShopifyConfigured()) return [];

  const pageSize = Math.min(
    Math.max(options?.pageSize ?? STOREFRONT_PAGE_SIZE, 1),
    250
  );
  const maxCount = options?.maxCount;
  const all: ShopifyProduct[] = [];
  let after: string | null = null;
  let hasNextPage = true;
  let guard = 0;

  while (hasNextPage && guard < MAX_CATALOG_PAGES) {
    guard += 1;
    const remaining =
      typeof maxCount === 'number' ? Math.max(maxCount - all.length, 0) : pageSize;
    if (typeof maxCount === 'number' && remaining === 0) break;

    const page = await fetchShopifyProducts({
      first: typeof maxCount === 'number' ? Math.min(pageSize, remaining) : pageSize,
      after,
      query: options?.query,
    });

    all.push(...page.products);
    hasNextPage = page.hasNextPage;
    after = page.endCursor;

    if (!page.products.length) break;
    if (typeof maxCount === 'number' && all.length >= maxCount) {
      return all.slice(0, maxCount);
    }
  }

  return all;
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
  options?: { maxCount?: number; pageSize?: number }
): Promise<ShopifyProduct[]> {
  if (!isShopifyConfigured() || !handle) return [];

  const pageSize = Math.min(
    Math.max(options?.pageSize ?? STOREFRONT_PAGE_SIZE, 1),
    250
  );
  const maxCount = options?.maxCount;
  const all: ShopifyProduct[] = [];
  let after: string | null = null;
  let hasNextPage = true;
  let guard = 0;

  while (hasNextPage && guard < MAX_CATALOG_PAGES) {
    guard += 1;
    const remaining =
      typeof maxCount === 'number' ? Math.max(maxCount - all.length, 0) : pageSize;
    if (typeof maxCount === 'number' && remaining === 0) break;

    const data: CollectionProductsResult = await shopifyFetch<CollectionProductsResult>(
      COLLECTION_PRODUCTS_QUERY,
      {
        handle,
        first: typeof maxCount === 'number' ? Math.min(pageSize, remaining) : pageSize,
        after,
      }
    );

    if (!data.collection) break;

    const nodes: unknown[] = data.collection.products.nodes || [];
    const page = nodes
      .map((n) => normalizeProduct(n as Parameters<typeof normalizeProduct>[0]))
      .filter((p): p is ShopifyProduct => Boolean(p));

    all.push(...page);
    hasNextPage = data.collection.products.pageInfo.hasNextPage;
    after = data.collection.products.pageInfo.endCursor;

    if (!page.length) break;
    if (typeof maxCount === 'number' && all.length >= maxCount) {
      return all.slice(0, maxCount);
    }
  }

  return all;
}

/** Full catalog list for shop UI (cursor-paginated; not capped at 50).
 *
 * Caching: `shopifyFetch` defaults to Next.js Data Cache `revalidate: 60` per
 * Storefront GraphQL page. There is no separate in-memory catalog cache — omitting
 * `first` still returns the complete published catalog; repeat hits within 60s reuse
 * cached page responses.
 */
export async function getCatalogProducts(options?: {
  category?: string;
  query?: string;
  /** Optional upper bound. Omit to fetch the complete published Storefront catalog. */
  first?: number;
}): Promise<CatalogProduct[]> {
  const category = options?.category?.trim().toLowerCase();
  let products: ShopifyProduct[] = [];

  if (category) {
    // Prefer Shopify collection handle matching category
    products = await fetchCollectionProducts(category, {
      maxCount: options?.first,
    });
    if (products.length === 0) {
      const q = [`product_type:${category}`, `tag:${category}`].join(' OR ');
      products = await fetchAllShopifyProducts({
        query: options?.query ? `(${q}) AND ${options.query}` : q,
        maxCount: options?.first,
      });
    }
  } else {
    products = await fetchAllShopifyProducts({
      query: options?.query,
      maxCount: options?.first,
    });
  }

  let catalog = products.map(toCatalogProduct);
  if (category) {
    catalog = catalog.filter((p) => p.category === category);
    // Shopify type/collection/tag may not match the storefront slug
    // (e.g. cosmetic lenses still typed as makeup). Resolve from the
    // published catalog rather than hiding a first-class category.
    if (catalog.length === 0) {
      const all = await fetchAllShopifyProducts({
        query: options?.query,
        maxCount: options?.first,
      });
      catalog = all
        .filter((p) => resolveStorefrontCategory(p) === category)
        .map(toCatalogProduct);
    }
  }

  return catalog;
}

export async function getCatalogProductByHandle(
  handle: string
): Promise<(CatalogProduct & { shopify: ShopifyProduct }) | null> {
  const product = await fetchShopifyProductByHandle(handle);
  if (!product) return null;
  return { ...toCatalogProduct(product), shopify: product };
}

/** Paginated Storefront product count */
export async function countCatalogProducts(): Promise<number> {
  if (!isShopifyConfigured()) return 0;
  const products = await fetchAllShopifyProducts();
  return products.length;
}

export type { CatalogProduct };
