/**
 * Local-only reader for `.env.staging.local`.
 *
 * This module is not imported by the storefront, cart, checkout, or Admin client.
 * It never assigns Shopify variables onto process.env, and it never calls the
 * Admin API. The only network helper is a fixed Storefront catalog read.
 */

import path from 'node:path';

export const STAGING_ENV_BASENAME = '.env.staging.local';
export const STAGING_API_VERSION = '2025-01';
export const STAGING_REQUIRED_KEYS = [
  'STAGING_SHOPIFY_STORE_DOMAIN',
  'STAGING_SHOPIFY_STOREFRONT_ACCESS_TOKEN',
] as const;

/** Live app variable names. Values under these names in the staging file are ignored. */
const PRIVILEGED_KEYS = new Set([
  'SHOPIFY_STORE_DOMAIN',
  'NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN',
  'SHOPIFY_STOREFRONT_ACCESS_TOKEN',
  'SHOPIFY_CLIENT_ID',
  'SHOPIFY_CLIENT_SECRET',
  'SHOPIFY_ADMIN_ACCESS_TOKEN',
  'SHOPIFY_LOCATION_ID',
  'STAGING_SHOPIFY_CLIENT_ID',
  'STAGING_SHOPIFY_CLIENT_SECRET',
  'STAGING_SHOPIFY_ADMIN_ACCESS_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
]);

const WRITE_OPERATION =
  /\b(mutation|cartCreate|cartLinesAdd|cartLinesUpdate|cartLinesRemove|cartBuyerIdentityUpdate|draftOrderCreate|draftOrderComplete|draftOrderUpdate|inventorySetQuantities|inventoryAdjustQuantities|productSet|productCreate|productUpdate|productDelete|publishablePublish|customerCreate|customerUpdate)\b/i;

export const STAGING_PRODUCTS_QUERY = `query StagingCatalogProducts($first: Int!, $after: String) @inContext(country: SA) {
  products(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      handle
      title
      availableForSale
      featuredImage { url altText }
      priceRange { minVariantPrice { amount currencyCode } }
      variants(first: 50) {
        nodes {
          id
          title
          sku
          availableForSale
          price { amount currencyCode }
          selectedOptions { name value }
          image { url altText }
        }
      }
      collections(first: 10) {
        nodes { id handle title }
      }
    }
  }
}`;

export const STAGING_COLLECTIONS_QUERY = `query StagingCatalogCollections($first: Int!, $after: String) {
  collections(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { id handle title }
  }
}`;

const ALLOWED_QUERIES = new Set([
  STAGING_PRODUCTS_QUERY.trim(),
  STAGING_COLLECTIONS_QUERY.trim(),
]);

export class StagingConfigError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'StagingConfigError';
    this.code = code;
  }
}

export type StagingEnvParse = {
  ok: boolean;
  domain: string;
  token: string;
  hostnameValid: boolean;
  ignoredPrivilegedKeys: string[];
  problems: string[];
};

export type StagingPublicStatus = {
  stagingFile: 'present';
  hostnameValid: boolean;
  tokenPresent: boolean;
  ignoredPrivilegedKeys: string[];
  problems: string[];
  shopifyContacted: false;
  writesEnabled: false;
};

export function assertOfflineStagingProcess(env: NodeJS.ProcessEnv): void {
  if (env.VERCEL === '1' || env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') {
    throw new StagingConfigError(
      'vercel_blocked',
      'The staging catalog check cannot run on Vercel'
    );
  }
}

export function resolveStagingEnvPath(repoRoot: string): string {
  const root = path.resolve(repoRoot);
  const full = path.resolve(root, STAGING_ENV_BASENAME);
  if (path.basename(full) !== STAGING_ENV_BASENAME) {
    throw new StagingConfigError('staging_env_path', 'Staging config must be .env.staging.local');
  }
  const expected = path.resolve(path.join(root, STAGING_ENV_BASENAME));
  if (full !== expected) {
    throw new StagingConfigError(
      'staging_env_path',
      'Staging config must sit in the repository root'
    );
  }
  return full;
}

export function assertStagingRealpath(repoRoot: string, realPath: string): void {
  const expected = resolveStagingEnvPath(repoRoot);
  const real = path.resolve(realPath);
  const localEnv = path.resolve(repoRoot, '.env.local');
  if (path.basename(real) !== STAGING_ENV_BASENAME) {
    throw new StagingConfigError(
      'staging_env_path',
      'Refusing to read a file that is not .env.staging.local'
    );
  }
  if (real === localEnv) {
    throw new StagingConfigError('staging_env_path', 'Refusing to read .env.local');
  }
  if (path.dirname(real) !== path.dirname(expected)) {
    throw new StagingConfigError(
      'staging_env_path',
      'Staging file must stay in the repository root'
    );
  }
}

export function normalizeShopHost(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')
    .toLowerCase();
}

export function isMyshopifyHost(host: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host);
}

function unescapeEnvValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Parse staging file text. Does not expand `$VAR` and does not read process.env. */
export function parseStagingEnvText(text: string): StagingEnvParse {
  const values = new Map<string, string>();
  const ignoredPrivilegedKeys: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const body = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eq = body.indexOf('=');
    if (eq < 1) continue;
    const key = body.slice(0, eq).trim();
    const value = unescapeEnvValue(body.slice(eq + 1));
    if (PRIVILEGED_KEYS.has(key)) {
      ignoredPrivilegedKeys.push(key);
      continue;
    }
    if (key === 'STAGING_SHOPIFY_STORE_DOMAIN' || key === 'STAGING_SHOPIFY_STOREFRONT_ACCESS_TOKEN') {
      values.set(key, value);
    }
  }

  const domain = normalizeShopHost(values.get('STAGING_SHOPIFY_STORE_DOMAIN') || '');
  const token = (values.get('STAGING_SHOPIFY_STOREFRONT_ACCESS_TOKEN') || '').trim();
  const hostnameValid = isMyshopifyHost(domain);
  const problems: string[] = [];
  if (!domain) problems.push('missing_domain');
  else if (!hostnameValid) problems.push('invalid_hostname');
  if (!token) problems.push('missing_token');
  if (/\s/.test(token)) problems.push('token_has_whitespace');

  return {
    ok: problems.length === 0,
    domain: hostnameValid ? domain : '',
    token: problems.includes('missing_token') || problems.includes('token_has_whitespace') ? '' : token,
    hostnameValid,
    ignoredPrivilegedKeys,
    problems,
  };
}

export function publicStagingStatus(parsed: StagingEnvParse): StagingPublicStatus {
  return {
    stagingFile: 'present',
    hostnameValid: parsed.hostnameValid,
    tokenPresent: parsed.token.length > 0,
    ignoredPrivilegedKeys: parsed.ignoredPrivilegedKeys,
    problems: parsed.problems,
    shopifyContacted: false,
    writesEnabled: false,
  };
}

export function assertCatalogReadQuery(query: string): void {
  const trimmed = query.trim();
  if (!ALLOWED_QUERIES.has(trimmed) || WRITE_OPERATION.test(trimmed)) {
    throw new StagingConfigError(
      'write_query_blocked',
      'Only the fixed Storefront catalog read is allowed'
    );
  }
}

type PageInfo = { hasNextPage: boolean; endCursor: string | null };
type ProductNode = {
  id?: string;
  handle?: string;
  title?: string;
  availableForSale?: boolean;
  featuredImage?: { url?: string | null } | null;
  priceRange?: { minVariantPrice?: { amount?: string; currencyCode?: string } };
  variants?: {
    nodes?: {
      id?: string;
      sku?: string | null;
      availableForSale?: boolean;
      price?: { amount?: string; currencyCode?: string };
    }[];
  };
  collections?: { nodes?: { id?: string; handle?: string }[] };
};
type CollectionNode = { id?: string; handle?: string; title?: string };

type ProductsData = {
  products?: {
    pageInfo?: PageInfo;
    nodes?: ProductNode[];
  };
};
type CollectionsData = {
  collections?: {
    pageInfo?: PageInfo;
    nodes?: CollectionNode[];
  };
};

export type StagingCatalogSummary = {
  shopifyContacted: true;
  writesEnabled: false;
  catalog: 'verified_empty' | 'verified_products' | 'api_failure';
  productCount: number | null;
  variantCount: number | null;
  collectionCount: number | null;
  currencies: string[];
  availableProductCount: number | null;
  productsWithImages: number | null;
  variantsWithSku: number | null;
  truncated: boolean;
  httpStatus: number | null;
};

function redact(message: string, token: string): string {
  if (!token) return message.slice(0, 180);
  return message.split(token).join('[redacted]').slice(0, 180);
}

async function storefrontQuery<T>(
  domain: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
  fetchImpl: typeof fetch
): Promise<T> {
  assertCatalogReadQuery(query);
  const endpoint = `https://${domain}/api/${STAGING_API_VERSION}/graphql.json`;
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Shopify-Storefront-Private-Token': token,
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new StagingConfigError('storefront_unreachable', 'Storefront request failed');
  }

  if (response.status === 429) {
    throw new StagingConfigError('storefront_throttled', 'Storefront HTTP 429');
  }
  if (!response.ok) {
    throw new StagingConfigError('storefront_http', `Storefront HTTP ${response.status}`);
  }

  let json: { data?: T; errors?: { message?: string }[] };
  try {
    json = (await response.json()) as { data?: T; errors?: { message?: string }[] };
  } catch {
    throw new StagingConfigError('storefront_http', 'Storefront returned invalid JSON');
  }
  if (json.errors?.length) {
    const message = redact(json.errors.map((error) => error.message || 'GraphQL error').join('; '), token);
    throw new StagingConfigError('storefront_graphql', message);
  }
  if (!json.data) {
    throw new StagingConfigError('storefront_graphql', 'Storefront returned no data');
  }
  return json.data;
}

async function withThrottleRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof StagingConfigError) || error.code !== 'storefront_throttled') {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return run();
  }
}

export async function readStagingCatalog(options: {
  domain: string;
  token: string;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}): Promise<StagingCatalogSummary> {
  if (!isMyshopifyHost(options.domain) || !options.token) {
    throw new StagingConfigError('staging_not_configured', 'Staging Storefront config is incomplete');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxPages = options.maxPages ?? 20;
  const currencies = new Set<string>();
  let productCount = 0;
  let variantCount = 0;
  let availableProductCount = 0;
  let productsWithImages = 0;
  let variantsWithSku = 0;
  let truncated = false;
  let after: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const data: ProductsData = await withThrottleRetry(() =>
      storefrontQuery<ProductsData>(
        options.domain,
        options.token,
        STAGING_PRODUCTS_QUERY,
        { first: 50, after },
        fetchImpl
      )
    );
    const connection = data.products;
    if (!connection) {
      return failureSummary(null);
    }
    for (const product of connection.nodes || []) {
      productCount += 1;
      if (product.availableForSale) availableProductCount += 1;
      if (product.featuredImage?.url) productsWithImages += 1;
      const price = product.priceRange?.minVariantPrice;
      if (price?.currencyCode) currencies.add(price.currencyCode);
      for (const variant of product.variants?.nodes || []) {
        variantCount += 1;
        if (variant.sku?.trim()) variantsWithSku += 1;
        if (variant.price?.currencyCode) currencies.add(variant.price.currencyCode);
      }
    }
    if (!connection.pageInfo?.hasNextPage) {
      after = null;
      break;
    }
    after = connection.pageInfo.endCursor || null;
    if (!after) {
      truncated = true;
      break;
    }
    if (page === maxPages - 1) truncated = true;
  }

  const collectionIds = new Set<string>();
  after = null;
  for (let page = 0; page < maxPages; page += 1) {
    const data: CollectionsData = await withThrottleRetry(() =>
      storefrontQuery<CollectionsData>(
        options.domain,
        options.token,
        STAGING_COLLECTIONS_QUERY,
        { first: 50, after },
        fetchImpl
      )
    );
    const connection = data.collections;
    if (!connection) break;
    for (const collection of connection.nodes || []) {
      if (collection.id) collectionIds.add(collection.id);
    }
    if (!connection.pageInfo?.hasNextPage) break;
    after = connection.pageInfo.endCursor || null;
    if (!after || page === maxPages - 1) {
      truncated = true;
      break;
    }
  }

  return {
    shopifyContacted: true,
    writesEnabled: false,
    catalog: productCount === 0 ? 'verified_empty' : 'verified_products',
    productCount,
    variantCount,
    collectionCount: collectionIds.size,
    currencies: [...currencies].sort(),
    availableProductCount,
    productsWithImages,
    variantsWithSku,
    truncated,
    httpStatus: 200,
  };
}

function failureSummary(httpStatus: number | null): StagingCatalogSummary {
  return {
    shopifyContacted: true,
    writesEnabled: false,
    catalog: 'api_failure',
    productCount: null,
    variantCount: null,
    collectionCount: null,
    currencies: [],
    availableProductCount: null,
    productsWithImages: null,
    variantsWithSku: null,
    truncated: false,
    httpStatus,
  };
}

export function catalogFailureFromError(error: unknown): StagingCatalogSummary {
  const httpStatus =
    error instanceof StagingConfigError && error.code === 'storefront_http'
      ? Number(error.message.replace(/\D/g, '')) || null
      : error instanceof StagingConfigError && error.code === 'storefront_throttled'
        ? 429
        : null;
  return failureSummary(httpStatus);
}
