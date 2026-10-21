/**
 * Catalog error responses. No network.
 * Usage: npm run test:catalog-error
 */
import { ShopifyStorefrontQueryError } from '@/lib/shopify/client';
import { ShopifyThrottleError } from '@/lib/shopify/client';
import { publicStorefrontFailure } from '@/lib/shopify/public-error';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

const unavailable = publicStorefrontFailure(new Error('Shopify Storefront HTTP 402'));
assert('402 is an unavailable shop', unavailable.code === 'storefront_unavailable' && unavailable.storefrontStatus === 402);
assert('the response does not include the raw message', !JSON.stringify(unavailable).includes('Shopify Storefront'));

const denied = publicStorefrontFailure(new Error('Shopify Storefront HTTP 401'));
assert('401 is unauthorized', denied.code === 'storefront_unauthorized' && denied.storefrontStatus === 401);

const throttled = publicStorefrontFailure(new ShopifyThrottleError('Throttled'));
assert('throttle stays generic', throttled.code === 'storefront_throttled' && throttled.storefrontStatus === 429);

const query = publicStorefrontFailure(new ShopifyStorefrontQueryError());
assert('query rejection is distinct', query.code === 'storefront_query' && query.storefrontStatus === null);

const empty = publicStorefrontFailure(new Error('Shopify Storefront returned no data'));
assert('empty payload is distinct', empty.code === 'storefront_empty');

const other = publicStorefrontFailure(new Error('secret-token-should-not-leak'));
assert('other errors hide the message', other.code === 'storefront_error' && !JSON.stringify(other).includes('secret-token'));

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('catalog error checks passed');
