/**
 * Isolation tests for the local staging catalog reader.
 * No Shopify calls and no `.env.local` reads.
 *
 * Usage: npm run test:staging-shopify
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  STAGING_COLLECTIONS_QUERY,
  STAGING_PRODUCTS_QUERY,
  StagingConfigError,
  assertCatalogReadQuery,
  assertOfflineStagingProcess,
  assertStagingRealpath,
  catalogFailureFromError,
  parseStagingEnvText,
  publicStagingStatus,
  readStagingCatalog,
  resolveStagingEnvPath,
} from '@/lib/shopify/staging-catalog';

const SECRET = 'shpt_test_secret_value_do_not_print';
let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

function throwsCode(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof StagingConfigError ? error.code : 'other';
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layali-staging-'));
const stagingFile = path.join(root, '.env.staging.local');
fs.writeFileSync(
  stagingFile,
  [
    'SHOPIFY_STORE_DOMAIN=old-store.myshopify.com',
    'SHOPIFY_STOREFRONT_ACCESS_TOKEN=old_token',
    'SHOPIFY_CLIENT_SECRET=old_admin_secret',
    'STAGING_SHOPIFY_STORE_DOMAIN=https://new-store.myshopify.com/admin',
    `STAGING_SHOPIFY_STOREFRONT_ACCESS_TOKEN=${SECRET}`,
  ].join('\n'),
  'utf8'
);

const parsed = parseStagingEnvText(fs.readFileSync(stagingFile, 'utf8'));
assert('accepts staging host and strips a path', parsed.domain === 'new-store.myshopify.com');
assert('keeps the staging token in memory only', parsed.token === SECRET);
assert('ignores live Shopify variable names', parsed.ignoredPrivilegedKeys.includes('SHOPIFY_CLIENT_SECRET'));
assert('does not keep the ignored admin secret', !JSON.stringify(publicStagingStatus(parsed)).includes('old_admin_secret'));

const status = publicStagingStatus(parsed);
const statusText = JSON.stringify(status);
assert('public status hides the token', !statusText.includes(SECRET));
assert('public status does not enable writes', status.writesEnabled === false && status.shopifyContacted === false);
assert('public status reports the token as present', status.tokenPresent === true);

const missing = parseStagingEnvText('STAGING_SHOPIFY_STORE_DOMAIN=not-a-shop\n');
assert('rejects a non-myshopify host', missing.problems.includes('invalid_hostname'));
assert('does not return an invalid host', missing.domain === '');
assert('reports a missing token without echoing it', missing.problems.includes('missing_token') && missing.token === '');

assert(
  'refuses .env.local as the staging path',
  throwsCode(() => assertStagingRealpath(root, path.join(root, '.env.local'))) === 'staging_env_path'
);
assert('resolves only the root staging file', path.basename(resolveStagingEnvPath(root)) === '.env.staging.local');
assert(
  'blocks Vercel production',
  throwsCode(() => assertOfflineStagingProcess({ VERCEL_ENV: 'production' })) === 'vercel_blocked'
);
assert(
  'blocks Vercel preview',
  throwsCode(() => assertOfflineStagingProcess({ VERCEL_ENV: 'preview' })) === 'vercel_blocked'
);
assert('allows a local process', throwsCode(() => assertOfflineStagingProcess({})) === null);

assert(
  'blocks a draft-order mutation',
  throwsCode(() => assertCatalogReadQuery('mutation { draftOrderCreate(input: {}) { draftOrder { id } } }')) ===
    'write_query_blocked'
);
assert('allows the fixed product query', throwsCode(() => assertCatalogReadQuery(STAGING_PRODUCTS_QUERY)) === null);
assert(
  'allows the fixed collection query',
  throwsCode(() => assertCatalogReadQuery(STAGING_COLLECTIONS_QUERY)) === null
);

const ambientToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'ambient_production_token';
const isolated = parseStagingEnvText(`STAGING_SHOPIFY_STORE_DOMAIN=new-store.myshopify.com\nSTAGING_SHOPIFY_STOREFRONT_ACCESS_TOKEN=${SECRET}\n`);
assert('does not read the ambient Storefront token', isolated.token === SECRET);
if (ambientToken === undefined) delete process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
else process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = ambientToken;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const calls: { url: string; query: string }[] = [];
const fetchImpl: typeof fetch = async (input, init) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body)) as { query: string; variables: { after?: string | null } };
  calls.push({ url, query: body.query });
  assertCatalogReadQuery(body.query);
  if (body.query.includes('StagingCatalogCollections')) {
    return jsonResponse({
      data: {
        collections: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [{ id: 'gid://shopify/Collection/1', handle: 'skincare', title: 'Skincare' }],
        },
      },
    });
  }
  if (!body.variables.after) {
    return jsonResponse({
      data: {
        products: {
          pageInfo: { hasNextPage: true, endCursor: 'cursor-2' },
          nodes: [
            {
              id: 'gid://shopify/Product/1',
              handle: 'toner',
              title: 'Toner',
              availableForSale: true,
              featuredImage: { url: 'https://cdn.shopify.com/toner.jpg' },
              priceRange: { minVariantPrice: { amount: '72.0', currencyCode: 'SAR' } },
              variants: {
                nodes: [
                  { id: 'gid://shopify/ProductVariant/1', sku: 'TONER-300', availableForSale: true, price: { amount: '72.0', currencyCode: 'SAR' } },
                  { id: 'gid://shopify/ProductVariant/2', sku: '', availableForSale: true, price: { amount: '40.0', currencyCode: 'SAR' } },
                ],
              },
            },
          ],
        },
      },
    });
  }
  return jsonResponse({
    data: {
      products: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          {
            id: 'gid://shopify/Product/2',
            handle: 'cream',
            title: 'Cream',
            availableForSale: false,
            featuredImage: null,
            variants: { nodes: [{ id: 'gid://shopify/ProductVariant/3', sku: 'CREAM-50', price: { amount: '10.0', currencyCode: 'SAR' } }] },
          },
        ],
      },
    },
  });
};

const summary = await readStagingCatalog({
  domain: 'new-store.myshopify.com',
  token: SECRET,
  fetchImpl,
});
assert('paginates products', summary.productCount === 2 && summary.variantCount === 3);
assert('counts collections, images, skus, and SAR', summary.collectionCount === 1 && summary.productsWithImages === 1 && summary.variantsWithSku === 2 && summary.currencies.join() === 'SAR');
assert('marks a non-empty catalog verified', summary.catalog === 'verified_products' && summary.writesEnabled === false);
assert('calls only the storefront endpoint', calls.every((call) => call.url === 'https://new-store.myshopify.com/api/2025-01/graphql.json'));
assert('summary does not contain the token', !JSON.stringify(summary).includes(SECRET));

let throttled = false;
const empty = await readStagingCatalog({
  domain: 'new-store.myshopify.com',
  token: SECRET,
  fetchImpl: async (input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: string };
    if (!throttled && body.query.includes('StagingCatalogProducts')) {
      throttled = true;
      return jsonResponse({ errors: 'throttled' }, 429);
    }
    if (body.query.includes('StagingCatalogCollections')) {
      return jsonResponse({
        data: { collections: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } },
      });
    }
    return jsonResponse({
      data: { products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } },
    });
  },
});
assert('retries a throttle and accepts an empty catalog', throttled && empty.catalog === 'verified_empty' && empty.productCount === 0);

const denied = catalogFailureFromError(new StagingConfigError('storefront_http', 'Storefront HTTP 401'));
assert('an HTTP failure is not an empty catalog', denied.catalog === 'api_failure' && denied.productCount === null && denied.httpStatus === 401);

fs.rmSync(root, { recursive: true, force: true });

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('staging shopify isolation checks passed');
