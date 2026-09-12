/**
 * Discover every product variant via Admin GraphQL pagination.
 * Paginates products and nested variants fully (no Supabase dependency).
 */
import { shopifyAdminFetch, type AdminFetchResult } from '@/lib/shopify/admin';
import { migrationPace } from '@/lib/shopify/admin-products';

export type DiscoveredVariant = {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
};

const PRODUCTS_PAGE = /* GraphQL */ `
  query InventorySetRiyadh50Products($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        variants(first: 100) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            title
          }
        }
      }
    }
  }
`;

const PRODUCT_VARIANTS_PAGE = /* GraphQL */ `
  query InventorySetRiyadh50ProductVariants($productId: ID!, $cursor: String) {
    product(id: $productId) {
      id
      title
      variants(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
        }
      }
    }
  }
`;

type VariantNode = { id: string; title: string };

type VariantsConnection = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: VariantNode[];
};

type ProductVariantsPageData = {
  product: {
    id: string;
    title: string;
    variants: VariantsConnection;
  } | null;
};

type ProductsPageData = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: Array<{
      id: string;
      title: string;
      variants: VariantsConnection;
    }>;
  };
};

async function fetchRemainingVariantsForProduct(
  productId: string,
  productTitle: string,
  afterCursor: string,
  log: (msg: string) => void
): Promise<DiscoveredVariant[]> {
  const out: DiscoveredVariant[] = [];
  let nextCursor: string | null = afterCursor;

  while (nextCursor) {
    const requestCursor = nextCursor;
    const result: AdminFetchResult<ProductVariantsPageData> = await shopifyAdminFetch(
      PRODUCT_VARIANTS_PAGE,
      { productId, cursor: requestCursor },
      { retries: 4 }
    );
    await migrationPace(result.throttleAvailable);

    const product = result.data.product;
    const conn = product?.variants;
    if (!conn) break;

    for (const v of conn.nodes ?? []) {
      out.push({
        productId,
        productTitle: product?.title ?? productTitle,
        variantId: v.id,
        variantTitle: v.title,
      });
    }

    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) {
      break;
    }
    nextCursor = conn.pageInfo.endCursor;
    log(`Variant pagination: product ${productId} +${out.length} extra variants…`);
  }

  return out;
}

/**
 * Paginate all products (and nested variants) until exhaustion.
 */
export async function discoverAllProductVariants(options?: {
  logger?: (msg: string) => void;
}): Promise<DiscoveredVariant[]> {
  const log = options?.logger ?? (() => {});
  const out: DiscoveredVariant[] = [];
  let nextCursor: string | null = null;
  let productCount = 0;
  let hasNext = true;

  while (hasNext) {
    const requestCursor = nextCursor;
    const result: AdminFetchResult<ProductsPageData> = await shopifyAdminFetch(
      PRODUCTS_PAGE,
      { cursor: requestCursor },
      { retries: 4 }
    );
    await migrationPace(result.throttleAvailable);

    const products = result.data.products;
    for (const product of products.nodes ?? []) {
      productCount += 1;
      const firstPage = product.variants;

      for (const v of firstPage.nodes ?? []) {
        out.push({
          productId: product.id,
          productTitle: product.title,
          variantId: v.id,
          variantTitle: v.title,
        });
      }

      if (firstPage.pageInfo.hasNextPage && firstPage.pageInfo.endCursor) {
        const rest = await fetchRemainingVariantsForProduct(
          product.id,
          product.title,
          firstPage.pageInfo.endCursor,
          log
        );
        out.push(...rest);
      }
    }

    log(`Product discovery: ${productCount} products, ${out.length} variants so far`);

    hasNext = Boolean(products.pageInfo.hasNextPage && products.pageInfo.endCursor);
    nextCursor = products.pageInfo.endCursor;
  }

  log(`Product discovery complete: ${productCount} products, ${out.length} variants`);
  return out;
}
