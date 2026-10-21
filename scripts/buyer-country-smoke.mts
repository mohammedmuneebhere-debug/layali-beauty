/**
 * Buyer-country mapping. No Shopify calls.
 * Usage: npm run test:buyer-country
 */
import { codCheckoutCountryDecision } from '@/lib/shopify/customer-account-api';
import {
  cartMarketIdentity,
  cartMarketRetry,
  mapCountryToShopifyCode,
  resolveBuyerCountry,
} from '@/lib/shopify/buyer-country';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

const previousCartCountry = process.env.SHOPIFY_CART_COUNTRY;
delete process.env.SHOPIFY_CART_COUNTRY;

try {
  assert('explicit Saudi Arabia maps to SA', mapCountryToShopifyCode('Saudi Arabia') === 'SA');
  assert('explicit SA maps to SA', mapCountryToShopifyCode('SA') === 'SA');
  assert('explicit KSA maps to SA', resolveBuyerCountry({ countryLabel: 'KSA' }).status === 'explicit' && resolveBuyerCountry({ countryCode: 'SA' }).code === 'SA');
  assert('a missing country is not mapped to SA', mapCountryToShopifyCode('') === null && mapCountryToShopifyCode(null) === null);
  assert('a missing country stays missing', resolveBuyerCountry({}).status === 'missing');
  assert('an unknown country is not mapped to SA', mapCountryToShopifyCode('France') === null);
  assert('an unknown country stays unknown', resolveBuyerCountry({ countryLabel: 'France' }).status === 'unknown');
  const franceCode = resolveBuyerCountry({ countryCode: 'FR' });
  assert('an explicit FR code is not rewritten to SA', franceCode.status === 'explicit' && franceCode.code === 'FR');
  assert('UAE stays AE', mapCountryToShopifyCode('UAE') === 'AE');
  assert('Kuwait stays KW', mapCountryToShopifyCode('Kuwait') === 'KW');
  assert('Qatar stays QA', mapCountryToShopifyCode('Qatar') === 'QA');
  assert('Bahrain stays BH', mapCountryToShopifyCode('Bahrain') === 'BH');

  const unknownMarket = cartMarketIdentity({ countryLabel: 'France' });
  assert('an unknown cart country is not stored as SA', unknownMarket.source === 'unknown' && unknownMarket.countryCode === undefined);

  const missingMarket = cartMarketIdentity({});
  assert(
    'a cart with no country uses the selling market without claiming an address country',
    missingMarket.source === 'catalog-default' && missingMarket.countryCode === 'SA'
  );

  const saudiMarket = cartMarketIdentity({ countryCode: 'SA' });
  assert('an explicit SA cart market stays SA', saudiMarket.source === 'explicit' && saudiMarket.countryCode === 'SA');

  assert('checkout still rejects a missing delivery country', codCheckoutCountryDecision(null).code === 'missing_country');
  assert('checkout still rejects an unknown delivery country', codCheckoutCountryDecision('France').code === 'invalid_country');
  assert('checkout still rejects Qatar', codCheckoutCountryDecision('Qatar').code === 'unsupported_country');
  assert('checkout still accepts explicit Saudi Arabia', codCheckoutCountryDecision('Saudi Arabia').ok === true);

  assert('explicit SA does not retry onto another market', cartMarketRetry({ countryCode: 'SA' }).retry === false);
  assert('a missing country does not retry as SA', cartMarketRetry({}).retry === false);
  assert('an unknown country does not retry as SA', cartMarketRetry({ countryLabel: 'France' }).retry === false);
  const uaeRetry = cartMarketRetry({ countryCode: 'AE' });
  assert(
    'an explicit non-Saudi market can retry once onto the Saudi selling market',
    uaeRetry.retry === true && uaeRetry.countryCode === 'SA'
  );
  assert('Qatar does not pass cash on delivery because the cart market changed', codCheckoutCountryDecision('QA').code === 'unsupported_country');
} finally {
  if (previousCartCountry === undefined) delete process.env.SHOPIFY_CART_COUNTRY;
  else process.env.SHOPIFY_CART_COUNTRY = previousCartCountry;
}

process.env.SHOPIFY_CART_COUNTRY = 'AE';
try {
  const overriddenSaudi = cartMarketIdentity({ countryCode: 'SA' });
  assert(
    'a diagnostic cart override does not replace explicit SA',
    overriddenSaudi.source === 'explicit' && overriddenSaudi.countryCode === 'SA'
  );
  const overriddenUnknown = cartMarketIdentity({ countryLabel: 'France' });
  assert(
    'a diagnostic cart override does not turn an unknown country into a market',
    overriddenUnknown.source === 'unknown' && overriddenUnknown.countryCode === undefined
  );
  const overriddenMissing = cartMarketIdentity({});
  assert(
    'a diagnostic cart override is only the selling market when no country was supplied',
    overriddenMissing.source === 'catalog-default' && overriddenMissing.countryCode === 'AE'
  );
  assert('a diagnostic non-SA selling market does not retry an explicit AE cart', cartMarketRetry({ countryCode: 'AE' }).retry === false);
  assert('a diagnostic non-SA selling market does not move explicit SA', cartMarketRetry({ countryCode: 'SA' }).retry === false);
  assert('a diagnostic override does not retry a missing country', cartMarketRetry({}).retry === false);
} finally {
  if (previousCartCountry === undefined) delete process.env.SHOPIFY_CART_COUNTRY;
  else process.env.SHOPIFY_CART_COUNTRY = previousCartCountry;
}

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('buyer country checks passed');
