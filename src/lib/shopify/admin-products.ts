/** Server-only Admin product helpers. Do not import from Client Components. */
import { shopifyAdminFetch, sleep } from './admin';

export type ShopifyUserError = {
  field?: string[] | null;
  message: string;
  code?: string | null;
};

const LOCATIONS_QUERY = /* GraphQL */ `
  query MigrationLocations {
    locations(first: 10, includeInactive: false) {
      nodes {
        id
        name
        isActive
        fulfillsOnlineOrders
      }
    }
  }
`;

const PUBLICATIONS_QUERY = /* GraphQL */ `
  query MigrationPublications {
    publications(first: 50) {
      nodes {
        id
        name
      }
    }
  }
`;

const PRODUCT_PUBLICATIONS_QUERY = /* GraphQL */ `
  query ProductPublications($id: ID!) {
    product(id: $id) {
      id
      status
      resourcePublicationsV2(first: 20) {
        nodes {
          isPublished
          publication {
            id
            name
          }
        }
      }
    }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = /* GraphQL */ `
  query ProductByHandle($query: String!) {
    products(first: 1, query: $query) {
      nodes {
        id
        handle
        variants(first: 1) {
          nodes {
            id
          }
        }
      }
    }
  }
`;

const PRODUCT_SET_MUTATION = /* GraphQL */ `
  mutation MigrationProductSet($synchronous: Boolean!, $input: ProductSetInput!) {
    productSet(synchronous: $synchronous, input: $input) {
      product {
        id
        handle
        status
        variants(first: 1) {
          nodes {
            id
            price
            compareAtPrice
            inventoryItem {
              id
            }
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

/**
 * Do not request publication-state fields that require read_product_listings
 * (e.g. publishedOnCurrentPublication).
 */
const PUBLISHABLE_PUBLISH_MUTATION = /* GraphQL */ `
  mutation MigrationPublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

export type ShopifyLocation = {
  id: string;
  name: string;
  isActive: boolean;
  fulfillsOnlineOrders: boolean;
};

export type ShopifyPublication = {
  id: string;
  name: string;
};

export type LayaliChannelKey = 'online_store' | 'headless';

export type LayaliStorePublications = {
  onlineStore: ShopifyPublication | null;
  headless: ShopifyPublication | null;
  all: ShopifyPublication[];
};

export async function fetchShopifyLocations(): Promise<ShopifyLocation[]> {
  const { data } = await shopifyAdminFetch<{
    locations: { nodes: ShopifyLocation[] };
  }>(LOCATIONS_QUERY);
  return data.locations.nodes ?? [];
}

export async function resolvePrimaryLocationId(
  preferredId?: string | null
): Promise<string> {
  if (preferredId?.trim()) return preferredId.trim();

  const envId = process.env.SHOPIFY_LOCATION_ID?.trim();
  if (envId) return envId;

  const locations = await fetchShopifyLocations();
  const preferred =
    locations.find((l) => l.isActive && l.fulfillsOnlineOrders) ||
    locations.find((l) => l.isActive) ||
    locations[0];

  if (!preferred?.id) {
    throw new Error(
      'No Shopify location found. Set SHOPIFY_LOCATION_ID or grant location/inventory access.'
    );
  }
  return preferred.id;
}

export async function fetchShopifyPublications(): Promise<ShopifyPublication[]> {
  const { data } = await shopifyAdminFetch<{
    publications: { nodes: ShopifyPublication[] };
  }>(PUBLICATIONS_QUERY);
  return data.publications.nodes ?? [];
}

/**
 * Resolve Online Store + Headless publications by name (no hard-coded GIDs).
 * Headless matches names like "My Store Headless" / "Headless".
 */
export async function resolveLayaliStorePublications(): Promise<LayaliStorePublications> {
  const all = await fetchShopifyPublications();

  const onlineStore =
    all.find((n) => /^online store$/i.test(n.name.trim())) ||
    all.find((n) => /online\s*store/i.test(n.name)) ||
    null;

  const headless =
    all.find((n) => /my\s+store\s+headless/i.test(n.name)) ||
    all.find((n) => /^headless$/i.test(n.name.trim())) ||
    all.find((n) => /headless/i.test(n.name)) ||
    null;

  return { onlineStore, headless, all };
}

/** @deprecated Prefer resolveLayaliStorePublications().onlineStore */
export async function fetchOnlineStorePublicationId(): Promise<string | null> {
  const { onlineStore } = await resolveLayaliStorePublications();
  return onlineStore?.id ?? null;
}

export type ProductPublicationState = {
  productId: string;
  status: string | null;
  publishedPublicationIds: Set<string>;
  publications: { id: string; name: string; isPublished: boolean }[];
};

export async function fetchProductPublicationState(
  productId: string
): Promise<ProductPublicationState> {
  const { data } = await shopifyAdminFetch<{
    product: {
      id: string;
      status: string;
      resourcePublicationsV2: {
        nodes: {
          isPublished: boolean;
          publication: { id: string; name: string } | null;
        }[];
      };
    } | null;
  }>(PRODUCT_PUBLICATIONS_QUERY, { id: productId });

  const product = data.product;
  const publications = (product?.resourcePublicationsV2?.nodes ?? [])
    .filter((n) => n.publication?.id)
    .map((n) => ({
      id: n.publication!.id,
      name: n.publication!.name,
      isPublished: n.isPublished,
    }));

  const publishedPublicationIds = new Set(
    publications.filter((p) => p.isPublished).map((p) => p.id)
  );

  return {
    productId,
    status: product?.status ?? null,
    publishedPublicationIds,
    publications,
  };
}

export type ExistingShopifyProduct = {
  id: string;
  handle: string;
  variantId: string | null;
};

export async function findShopifyProductByHandle(
  handle: string
): Promise<ExistingShopifyProduct | null> {
  const { data } = await shopifyAdminFetch<{
    products: {
      nodes: {
        id: string;
        handle: string;
        variants: { nodes: { id: string }[] };
      }[];
    };
  }>(PRODUCT_BY_HANDLE_QUERY, { query: `handle:${handle}` });

  const node = data.products.nodes[0];
  if (!node) return null;
  return {
    id: node.id,
    handle: node.handle,
    variantId: node.variants.nodes[0]?.id ?? null,
  };
}

export type ProductSetMediaInput = {
  originalSource: string;
  alt?: string;
  contentType: 'IMAGE';
};

export type ProductSetCreateInput = {
  title: string;
  descriptionHtml?: string;
  handle: string;
  productType?: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  tags?: string[];
  vendor?: string;
  files?: ProductSetMediaInput[];
  metafields?: {
    namespace: string;
    key: string;
    type: string;
    value: string;
  }[];
  variants: {
    optionValues: { optionName: string; name: string }[];
    price: string;
    compareAtPrice?: string | null;
    inventoryItem?: { tracked: boolean };
    inventoryQuantities?: {
      locationId: string;
      name: 'available';
      quantity: number;
    }[];
  }[];
  productOptions?: {
    name: string;
    values: { name: string }[];
  }[];
};

export type ProductSetResult = {
  productId: string;
  variantId: string;
  handle: string;
  inventoryItemId: string | null;
};

export async function createShopifyProductViaProductSet(
  input: ProductSetCreateInput
): Promise<ProductSetResult> {
  const { data } = await shopifyAdminFetch<{
    productSet: {
      product: {
        id: string;
        handle: string;
        variants: {
          nodes: {
            id: string;
            inventoryItem: { id: string } | null;
          }[];
        };
      } | null;
      userErrors: ShopifyUserError[];
    };
  }>(PRODUCT_SET_MUTATION, {
    synchronous: true,
    input: {
      title: input.title,
      descriptionHtml: input.descriptionHtml,
      handle: input.handle,
      productType: input.productType,
      status: input.status,
      tags: input.tags,
      vendor: input.vendor ?? 'Layali',
      files: input.files,
      metafields: input.metafields,
      productOptions: input.productOptions ?? [
        { name: 'Title', values: [{ name: 'Default Title' }] },
      ],
      variants: input.variants,
    },
  });

  if (data.productSet.userErrors?.length) {
    throw new Error(
      data.productSet.userErrors.map((e) => e.message).join('; ')
    );
  }

  const product = data.productSet.product;
  const variant = product?.variants.nodes[0];
  if (!product?.id || !variant?.id) {
    throw new Error('productSet returned no product/variant');
  }

  return {
    productId: product.id,
    variantId: variant.id,
    handle: product.handle,
    inventoryItemId: variant.inventoryItem?.id ?? null,
  };
}

export type PublishChannelResult = {
  channel: LayaliChannelKey;
  publicationId: string;
  publicationName: string;
  status: 'published' | 'already_published' | 'failed' | 'skipped_missing_publication';
  error?: string;
  userErrors?: ShopifyUserError[];
};

export type PublishProductChannelsResult = {
  productId: string;
  results: PublishChannelResult[];
  publishedCount: number;
  alreadyPublishedCount: number;
  failedCount: number;
};

/**
 * Publish a single product to one publication. Surfaces userErrors clearly.
 * Idempotent at the API level when already published.
 */
export async function publishProductToPublication(
  productId: string,
  publicationId: string
): Promise<{ userErrors: ShopifyUserError[] }> {
  const { data } = await shopifyAdminFetch<{
    publishablePublish: { userErrors: ShopifyUserError[] };
  }>(PUBLISHABLE_PUBLISH_MUTATION, {
    id: productId,
    input: [{ publicationId }],
  });

  const userErrors = data.publishablePublish.userErrors ?? [];
  if (userErrors.length) {
    throw new Error(
      userErrors
        .map((e) => {
          const field = e.field?.length ? ` [${e.field.join('.')}]` : '';
          return `${e.message}${field}`;
        })
        .join('; ')
    );
  }

  return { userErrors };
}

/**
 * Publish product to Online Store + Headless.
 * Skips channels already published; never throws for a single channel failure.
 */
export async function publishProductToLayaliChannels(
  productId: string,
  options?: {
    publications?: LayaliStorePublications;
    /** When false, skip the pre-check and always call publishablePublish (still API-idempotent). */
    checkExisting?: boolean;
  }
): Promise<PublishProductChannelsResult> {
  const publications =
    options?.publications ?? (await resolveLayaliStorePublications());
  const checkExisting = options?.checkExisting !== false;

  let alreadyPublished = new Set<string>();
  if (checkExisting) {
    try {
      const state = await fetchProductPublicationState(productId);
      alreadyPublished = state.publishedPublicationIds;
    } catch {
      // If we cannot read current state, still attempt publish (API is idempotent).
      alreadyPublished = new Set();
    }
  }

  const targets: {
    channel: LayaliChannelKey;
    publication: ShopifyPublication | null;
  }[] = [
    { channel: 'online_store', publication: publications.onlineStore },
    { channel: 'headless', publication: publications.headless },
  ];

  const results: PublishChannelResult[] = [];

  for (const target of targets) {
    if (!target.publication) {
      results.push({
        channel: target.channel,
        publicationId: '',
        publicationName: target.channel,
        status: 'skipped_missing_publication',
        error: `Could not resolve ${target.channel} publication on this shop`,
      });
      continue;
    }

    if (alreadyPublished.has(target.publication.id)) {
      results.push({
        channel: target.channel,
        publicationId: target.publication.id,
        publicationName: target.publication.name,
        status: 'already_published',
      });
      continue;
    }

    try {
      await publishProductToPublication(productId, target.publication.id);
      results.push({
        channel: target.channel,
        publicationId: target.publication.id,
        publicationName: target.publication.name,
        status: 'published',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        channel: target.channel,
        publicationId: target.publication.id,
        publicationName: target.publication.name,
        status: 'failed',
        error: message,
      });
    }
  }

  return {
    productId,
    results,
    publishedCount: results.filter((r) => r.status === 'published').length,
    alreadyPublishedCount: results.filter((r) => r.status === 'already_published')
      .length,
    failedCount: results.filter((r) => r.status === 'failed').length,
  };
}

/** Conservative pacing between Admin writes (~2 req/s). */
export async function migrationPace(throttleAvailable?: number): Promise<void> {
  if (typeof throttleAvailable === 'number' && throttleAvailable < 200) {
    await sleep(1500);
    return;
  }
  await sleep(500);
}

