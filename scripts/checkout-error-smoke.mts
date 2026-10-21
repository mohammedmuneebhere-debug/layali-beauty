/**
 * Checkout customer error allowlist. No Shopify calls.
 * Usage: npm run test:checkout-error
 */
import { checkoutCustomerCode, checkoutCustomerMessage, redactCheckoutLog } from '@/lib/checkout/customer-error';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

const phone = 'Phone is invalid';
assert(
  'a Shopify phone validation error is generic',
  checkoutCustomerMessage('order_failed', phone) === 'Could not place order. Please try again.' &&
    !checkoutCustomerMessage('order_failed', phone).includes('Phone')
);

const field = 'Variable $input of type DraftOrderInput was provided invalid value for countryCode';
assert(
  'an unexpected Shopify field error is generic',
  checkoutCustomerMessage('order_failed', field) === 'Could not place order. Please try again.' &&
    !checkoutCustomerMessage('order_failed', field).includes('DraftOrderInput')
);

const graphql = 'GraphQL error: gid://shopify/Customer/1 token shpat_secret';
const graphqlShown = checkoutCustomerMessage('order_failed', graphql);
assert(
  'a GraphQL error is generic',
  graphqlShown === 'Could not place order. Please try again.' && !graphqlShown.includes('gid://') && !graphqlShown.includes('shpat_')
);

const sensitive = checkoutCustomerMessage('invalid_country', 'Delivery country is not recognized. token=shpat_abc gid://shopify/Customer/9');
assert(
  'a validation code cannot carry a sensitive message',
  sensitive === 'Could not place order. Please try again.' && !sensitive.includes('shpat_') && !sensitive.includes('gid://')
);

assert(
  'a missing country keeps its approved message',
  checkoutCustomerMessage('missing_country', 'Delivery country is missing. Add a country before checkout.') ===
    'Delivery country is missing. Add a country before checkout.'
);
assert(
  'an unsupported country keeps its approved message',
  checkoutCustomerMessage(
    'unsupported_country',
    'Cash on Delivery checkout currently supports Saudi Arabia addresses only.'
  ).includes('Saudi Arabia')
);
assert(
  'access denied stays a configuration message',
  checkoutCustomerMessage('order_failed', 'access denied for write_draft_orders', true) ===
    'Order placement is not configured yet. Please contact support.'
);

assert(
  'a response code cannot carry an internal id',
  checkoutCustomerCode('gid://shopify/Customer/1') === 'order_failed' && checkoutCustomerCode('missing_country') === 'missing_country'
);

const logged = redactCheckoutLog(
  'failed for gid://shopify/Customer/42 email layali@example.com phone +966500000000 token=shpat_abc123 Bearer secret-value'
);
assert('logs redact ids, email, phone, and tokens', !/gid:\/\/|shpat_|layali@example.com|\+966500000000|secret-value/.test(logged));

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('checkout error checks passed');
