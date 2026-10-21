/**
 * Address country and region mapping. No Shopify calls.
 * Usage: npm run test:customer-address
 */
import {
  AddressCountryError,
  codCheckoutCountryDecision,
  countryFromCustomerAddress,
  mapAccountAddress,
  publicAddressError,
  toCustomerAddressInput,
} from '@/lib/shopify/customer-account-api';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

const saudi = toCustomerAddressInput({
  label: 'home',
  receiverName: 'Layali Customer',
  receiverPhone: '+966500000000',
  addressLine: 'Olaya Street, Building 4',
  city: 'Riyadh',
  country: 'Saudi Arabia',
});

assert('Saudi Arabia writes countryCode SA', saudi.countryCode === 'SA');
assert('Saudi Arabia also writes deprecated territoryCode as the country', saudi.territoryCode === 'SA');
assert('the country is not written as zoneCode', !Object.hasOwn(saudi, 'zoneCode'));
assert('the city stays the city', saudi.city === 'Riyadh');
assert('the street is address1 and the remainder is address2', saudi.address1 === 'Olaya Street' && saudi.address2 === 'Building 4');

const uae = toCustomerAddressInput({
  label: 'work',
  receiverName: 'Amina Noor',
  receiverPhone: '+971500000000',
  addressLine: 'Sheikh Zayed Road',
  city: 'Dubai',
  country: 'UAE',
});
assert('UAE writes countryCode AE', uae.countryCode === 'AE' && uae.territoryCode === 'AE');

const fromCountryCode = countryFromCustomerAddress({
  countryCode: 'SA',
  zoneCode: 'ON',
});
assert('countryCode SA reads back as Saudi Arabia', fromCountryCode === 'Saudi Arabia');
assert('zoneCode is not used as the country', fromCountryCode !== 'ON');

const fromDeprecated = countryFromCustomerAddress({ territoryCode: 'SA', zoneCode: 'RI' });
assert('deprecated territoryCode SA still reads as Saudi Arabia', fromDeprecated === 'Saudi Arabia');

const fromDisplay = countryFromCustomerAddress({
  country: 'Saudi Arabia',
  countryCode: 'SA',
  zoneCode: '01',
});
assert('Shopify country name is kept when present', fromDisplay === 'Saudi Arabia');
assert(
  'Saudi Arabia still satisfies checkout country validation',
  codCheckoutCountryDecision(fromDisplay).ok && codCheckoutCountryDecision('SA').ok && codCheckoutCountryDecision('KSA').ok
);
assert(
  'the Arabic Saudi country name stays valid',
  codCheckoutCountryDecision('المملكة العربية السعودية').ok
);

const mapped = mapAccountAddress(
  {
    id: 'gid://shopify/CustomerAddress/1',
    firstName: 'Layali',
    lastName: 'Customer',
    address1: 'Olaya Street',
    address2: 'Building 4',
    city: 'Riyadh',
    countryCode: 'SA',
    zoneCode: '01',
    phoneNumber: '+966500000000',
  },
  'gid://shopify/Customer/1',
  'gid://shopify/CustomerAddress/1',
  { label: 'home', customLabel: null, latitude: 24.7, longitude: 46.7 }
);
assert('mapped address keeps the city and Saudi country', Boolean(mapped && mapped.city === 'Riyadh' && mapped.country === 'Saudi Arabia'));
assert('mapped address keeps the pin separately from zoneCode', Boolean(mapped && mapped.latitude === 24.7 && mapped.longitude === 46.7));

const kuwait = toCustomerAddressInput({
  label: 'home',
  receiverName: 'Layali Customer',
  receiverPhone: '+96550000000',
  addressLine: 'Fahad Al Salem Street',
  city: 'Kuwait City',
  country: 'Kuwait',
});
assert('Kuwait is stored as KW', kuwait.countryCode === 'KW' && kuwait.territoryCode === 'KW');
assert(
  'a non-Saudi country is rejected for cash on delivery',
  codCheckoutCountryDecision('Kuwait').ok === false &&
    codCheckoutCountryDecision('Kuwait').code === 'unsupported_country' &&
    codCheckoutCountryDecision('UAE').code === 'unsupported_country'
);

const qatar = toCustomerAddressInput({
  label: 'home',
  receiverName: 'Layali Customer',
  receiverPhone: '+97450000000',
  addressLine: 'Corniche Road',
  city: 'Doha',
  country: 'Qatar',
});
assert('Qatar writes countryCode QA', qatar.countryCode === 'QA' && qatar.territoryCode === 'QA');
assert(
  'Qatar is rejected for cash on delivery',
  codCheckoutCountryDecision('Qatar').code === 'unsupported_country' &&
    codCheckoutCountryDecision('QA').code === 'unsupported_country'
);

const bahrain = toCustomerAddressInput({
  label: 'home',
  receiverName: 'Layali Customer',
  receiverPhone: '+97350000000',
  addressLine: 'Government Avenue',
  city: 'Manama',
  country: 'Bahrain',
});
assert('Bahrain writes countryCode BH', bahrain.countryCode === 'BH' && bahrain.territoryCode === 'BH');
assert(
  'Bahrain is rejected for cash on delivery',
  codCheckoutCountryDecision('Bahrain').code === 'unsupported_country' &&
    codCheckoutCountryDecision('BH').code === 'unsupported_country'
);

function rejectedCountry(country: string): string {
  try {
    toCustomerAddressInput({
      label: 'home',
      receiverName: 'Layali Customer',
      receiverPhone: '+966500000000',
      addressLine: 'Olaya Street',
      city: 'Riyadh',
      country,
    });
    return '';
  } catch (error) {
    return error instanceof AddressCountryError ? error.message : '';
  }
}

assert('an unknown country is rejected', rejectedCountry('France') === 'Country "France" is not supported.');
assert('a missing country is rejected', rejectedCountry('   ') === 'Country is required.');
assert('a zoneCode-only address has no country', countryFromCustomerAddress({ zoneCode: '01' }) === '');
assert(
  'an unknown stored country code is not read as Saudi Arabia',
  countryFromCustomerAddress({ countryCode: 'FR', zoneCode: '01' }) === 'FR'
);
const zoneOnly = mapAccountAddress(
  {
    id: 'gid://shopify/CustomerAddress/2',
    firstName: 'Layali',
    lastName: 'Customer',
    address1: 'Olaya Street',
    city: 'Riyadh',
    zoneCode: '01',
  },
  'gid://shopify/Customer/1',
  null,
  undefined
);
assert('a zoneCode-only address is not mapped as Saudi Arabia', zoneOnly?.country === '');
assert(
  'checkout rejects a zoneCode-only address',
  codCheckoutCountryDecision(zoneOnly?.country).code === 'missing_country'
);
assert(
  'checkout rejects an unknown country',
  codCheckoutCountryDecision('France').code === 'invalid_country'
);
assert('checkout rejects a missing country', codCheckoutCountryDecision(null).code === 'missing_country');

const shown = publicAddressError(new AddressCountryError('Country "France" is not supported.'));
assert('a country validation error stays visible', shown.status === 400 && shown.error === 'Country "France" is not supported.');
const hidden = publicAddressError(new Error('Customer Account API discovery failed for gid://shopify/Customer/1'));
assert(
  'a Shopify internal error is not returned to the customer',
  hidden.status === 502 && hidden.error === 'Could not save address.' && !hidden.error.includes('gid://')
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('customer address mapping checks passed');
