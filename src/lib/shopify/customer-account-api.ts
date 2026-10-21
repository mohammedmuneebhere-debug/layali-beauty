/**
 * Shopify Customer Account API reads and address mutations.
 * The access token comes from the sealed server session, never from the browser body.
 */
import {
  customerAccountApiDiscoveryUrl,
  customerAccountConfig,
  type CustomerAccountConfig,
} from '@/lib/shopify/customer-account';
import type { Address, AddressLabel } from '@/types/database';

type GraphqlError = { message: string };

const discoveryCache = new Map<string, { at: number; graphqlApi: string }>();

export type AccountCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
};

export type AccountAddressInput = {
  label: AddressLabel;
  customLabel?: string | null;
  receiverName: string;
  receiverPhone: string;
  addressLine: string;
  city: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
};

const COUNTRY_CODES: Record<string, string> = {
  'saudi arabia': 'SA',
  saudi: 'SA',
  'kingdom of saudi arabia': 'SA',
  'المملكة العربية السعودية': 'SA',
  'السعودية': 'SA',
  sa: 'SA',
  ksa: 'SA',
  uae: 'AE',
  'united arab emirates': 'AE',
  ae: 'AE',
  kuwait: 'KW',
  kw: 'KW',
  qatar: 'QA',
  qa: 'QA',
  bahrain: 'BH',
  bh: 'BH',
};

const CODE_NAMES: Record<string, string> = {
  SA: 'Saudi Arabia',
  AE: 'UAE',
  KW: 'Kuwait',
  QA: 'Qatar',
  BH: 'Bahrain',
};

export class AddressCountryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddressCountryError';
  }
}

function isAddressValidationMessage(message: string): boolean {
  return message === 'Country is required.' || /^Country "[^"\r\n]{1,40}" is not supported\.$/.test(message);
}

/** Customer-facing address failure. Validation text is kept; Shopify internals are not. */
export function publicAddressError(
  error: unknown,
  fallback = 'Could not save address.'
): { error: string; status: number } {
  if (error instanceof AddressCountryError && isAddressValidationMessage(error.message)) {
    return { error: error.message, status: 400 };
  }
  return { error: fallback, status: 502 };
}

/** Supported country code, or null when the text is missing or not on the allowlist. */
export function resolveSupportedCountryCode(country: string | null | undefined): string | null {
  const key = (country || '').trim().toLowerCase();
  if (!key) return null;
  return COUNTRY_CODES[key] || null;
}

function countryValidationMessage(country: string): string {
  const label = country.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!label) return 'Country is required.';
  return `Country "${label}" is not supported.`;
}

export function splitPersonName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Customer', lastName: 'Layali' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function graphqlEndpoint(config: CustomerAccountConfig): Promise<string> {
  const hit = discoveryCache.get(config.storeDomain);
  if (hit && Date.now() - hit.at < 60_000) return hit.graphqlApi;
  const response = await fetch(customerAccountApiDiscoveryUrl(config.storeDomain), {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: 'application/json', 'User-Agent': 'Layali-CustomerAccounts' },
  });
  if (!response.ok) throw new Error('Customer Account API discovery failed');
  const doc = (await response.json()) as { graphql_api?: string };
  const graphqlApi = doc.graphql_api || '';
  if (!graphqlApi.startsWith('https://')) throw new Error('Customer Account API endpoint is missing');
  discoveryCache.set(config.storeDomain, { at: Date.now(), graphqlApi });
  return graphqlApi;
}

export async function customerAccountGraphql<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const gate = customerAccountConfig(process.env);
  if (!gate.ok) throw new Error('Customer accounts are not configured');
  const endpoint = await graphqlEndpoint(gate.config);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: accessToken,
      'User-Agent': 'Layali-CustomerAccounts',
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await response.json()) as { data?: T; errors?: GraphqlError[] };
  if (!response.ok || json.errors?.length) {
    const message = json.errors?.map((error) => error.message).join('; ') || `HTTP ${response.status}`;
    throw new Error(message);
  }
  if (!json.data) throw new Error('Customer Account API returned no data');
  return json.data;
}

type CustomerNode = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailAddress?: { emailAddress?: string | null } | null;
  phoneNumber?: { phoneNumber?: string | null } | null;
};

export async function fetchAccountCustomer(accessToken: string): Promise<AccountCustomer> {
  const data = await customerAccountGraphql<{ customer: CustomerNode | null }>(
    accessToken,
    `#graphql
      query LayaliCustomer {
        customer {
          id
          firstName
          lastName
          emailAddress { emailAddress }
          phoneNumber { phoneNumber }
        }
      }
    `
  );
  const customer = data.customer;
  const id = customer?.id || '';
  const email = customer?.emailAddress?.emailAddress?.trim() || '';
  if (!id.startsWith('gid://shopify/Customer/') || !email) {
    throw new Error('Customer profile is unavailable');
  }
  return {
    id,
    email,
    firstName: customer?.firstName?.trim() || '',
    lastName: customer?.lastName?.trim() || '',
    phone: customer?.phoneNumber?.phoneNumber?.trim() || null,
  };
}

type AddressNode = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  /** @deprecated Country code. 2026-10 prefers countryCode. */
  territoryCode?: string | null;
  /** Province, state, or district code. Not the country. */
  zoneCode?: string | null;
  phoneNumber?: string | null;
};

/**
 * Customer Account API 2026-10:
 * countryCode is the ISO country. territoryCode is the deprecated country code.
 * zoneCode is the region code, such as a province, and is not written from the country.
 */
export function customerAddressCountryCode(country: string): string {
  const code = resolveSupportedCountryCode(country);
  if (!code) throw new AddressCountryError(countryValidationMessage(country));
  return code;
}

export type CodCountryDecision =
  | { ok: true; code: 'SA' }
  | { ok: false; code: 'missing_country' | 'invalid_country' | 'unsupported_country'; message: string };

/** Cash on delivery accepts only a reliably identified Saudi address. */
export function codCheckoutCountryDecision(country: string | null | undefined): CodCountryDecision {
  if (!(country || '').trim()) {
    return {
      ok: false,
      code: 'missing_country',
      message: 'Delivery country is missing. Add a country before checkout.',
    };
  }
  const code = resolveSupportedCountryCode(country);
  if (!code) {
    return {
      ok: false,
      code: 'invalid_country',
      message: 'Delivery country is not recognized. Cash on delivery cannot use this address.',
    };
  }
  if (code !== 'SA') {
    return {
      ok: false,
      code: 'unsupported_country',
      message: 'Cash on Delivery checkout currently supports Saudi Arabia addresses only.',
    };
  }
  return { ok: true, code: 'SA' };
}

export function toCustomerAddressInput(input: AccountAddressInput): {
  firstName: string;
  lastName: string;
  address1: string;
  address2: string | null;
  city: string;
  phoneNumber: string;
  countryCode: string;
  territoryCode: string;
} {
  const person = splitPersonName(input.receiverName);
  const parts = input.addressLine.split(',').map((part) => part.trim()).filter(Boolean);
  const country = customerAddressCountryCode(input.country);
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    address1: (parts[0] || input.addressLine).slice(0, 255),
    address2: parts.slice(1).join(', ') || null,
    city: input.city,
    phoneNumber: input.receiverPhone,
    countryCode: country,
    territoryCode: country,
  };
}

export function countryFromCustomerAddress(node: {
  country?: string | null;
  countryCode?: string | null;
  territoryCode?: string | null;
  zoneCode?: string | null;
}): string {
  const display = node.country?.trim();
  if (display) return display;
  const code = (node.countryCode || node.territoryCode || '').trim().toUpperCase();
  if (!code) return '';
  return CODE_NAMES[code] || code;
}

export type AddressGeo = {
  label: AddressLabel;
  customLabel: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function mapAccountAddress(
  node: AddressNode,
  customerId: string,
  defaultId: string | null,
  geo: AddressGeo | undefined
): Address | null {
  if (!node.id) return null;
  const name = [node.firstName, node.lastName].filter(Boolean).join(' ').trim() || 'Customer';
  const line = [node.address1, node.address2].filter(Boolean).join(', ');
  return {
    id: node.id,
    user_id: customerId,
    label: geo?.label || 'home',
    custom_label: geo?.customLabel || null,
    receiver_name: name,
    receiver_phone: node.phoneNumber || '',
    address_line: line,
    city: node.city || null,
    country: countryFromCustomerAddress(node),
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
    is_default: Boolean(defaultId && node.id === defaultId),
    created_at: '',
    updated_at: '',
  };
}

export async function listAccountAddresses(
  accessToken: string,
  customerId: string,
  geoById: Record<string, AddressGeo>
): Promise<Address[]> {
  const data = await customerAccountGraphql<{
    customer: {
      defaultAddress?: { id?: string | null } | null;
      addresses: { nodes: AddressNode[] };
    } | null;
  }>(
    accessToken,
    `#graphql
      query LayaliAddresses {
        customer {
          defaultAddress { id }
          addresses(first: 20) {
            nodes {
              id
              firstName
              lastName
              address1
              address2
              city
              country
              countryCode
              territoryCode
              zoneCode
              phoneNumber
            }
          }
        }
      }
    `
  );
  const defaultId = data.customer?.defaultAddress?.id || null;
  return (data.customer?.addresses.nodes || [])
    .map((node) => mapAccountAddress(node, customerId, defaultId, node.id ? geoById[node.id] : undefined))
    .filter((row): row is Address => Boolean(row));
}

function addressInput(input: AccountAddressInput) {
  return toCustomerAddressInput(input);
}

export async function createAccountAddress(
  accessToken: string,
  input: AccountAddressInput
): Promise<string> {
  const data = await customerAccountGraphql<{
    customerAddressCreate: {
      customerAddress: { id: string } | null;
      userErrors: { message: string }[];
    };
  }>(
    accessToken,
    `#graphql
      mutation LayaliAddressCreate($address: CustomerAddressInput!, $defaultAddress: Boolean) {
        customerAddressCreate(address: $address, defaultAddress: $defaultAddress) {
          customerAddress { id }
          userErrors { field message }
        }
      }
    `,
    { address: addressInput(input), defaultAddress: Boolean(input.isDefault) }
  );
  const payload = data.customerAddressCreate;
  if (payload.userErrors?.length || !payload.customerAddress?.id) {
    throw new Error(payload.userErrors?.map((error) => error.message).join('; ') || 'Could not save address');
  }
  return payload.customerAddress.id;
}

export async function updateAccountAddress(
  accessToken: string,
  addressId: string,
  input: AccountAddressInput
): Promise<void> {
  const data = await customerAccountGraphql<{
    customerAddressUpdate: { userErrors: { message: string }[] };
  }>(
    accessToken,
    `#graphql
      mutation LayaliAddressUpdate($addressId: ID!, $address: CustomerAddressInput!, $defaultAddress: Boolean) {
        customerAddressUpdate(addressId: $addressId, address: $address, defaultAddress: $defaultAddress) {
          customerAddress { id }
          userErrors { field message }
        }
      }
    `,
    { addressId, address: addressInput(input), defaultAddress: input.isDefault ?? null }
  );
  const errors = data.customerAddressUpdate?.userErrors || [];
  if (errors.length) throw new Error(errors.map((error) => error.message).join('; '));
}

export async function deleteAccountAddress(accessToken: string, addressId: string): Promise<void> {
  const data = await customerAccountGraphql<{
    customerAddressDelete: { userErrors: { message: string }[]; deletedAddressId: string | null };
  }>(
    accessToken,
    `#graphql
      mutation LayaliAddressDelete($addressId: ID!) {
        customerAddressDelete(addressId: $addressId) {
          deletedAddressId
          userErrors { field message }
        }
      }
    `,
    { addressId }
  );
  const errors = data.customerAddressDelete?.userErrors || [];
  if (errors.length) throw new Error(errors.map((error) => error.message).join('; '));
}

export async function setDefaultAccountAddress(accessToken: string, addressId: string): Promise<void> {
  const data = await customerAccountGraphql<{
    customerAddressUpdate: { userErrors: { message: string }[] };
  }>(
    accessToken,
    `#graphql
      mutation LayaliDefaultAddress($addressId: ID!) {
        customerAddressUpdate(addressId: $addressId, defaultAddress: true) {
          customerAddress { id }
          userErrors { field message }
        }
      }
    `,
    { addressId }
  );
  const errors = data.customerAddressUpdate?.userErrors || [];
  if (errors.length) throw new Error(errors.map((error) => error.message).join('; '));
}

export async function updateAccountName(
  accessToken: string,
  firstName: string,
  lastName: string
): Promise<void> {
  const data = await customerAccountGraphql<{
    customerUpdate: { userErrors: { message: string }[] };
  }>(
    accessToken,
    `#graphql
      mutation LayaliCustomerUpdate($input: CustomerUpdateInput!) {
        customerUpdate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }
    `,
    { input: { firstName, lastName } }
  );
  const errors = data.customerUpdate?.userErrors || [];
  if (errors.length) throw new Error(errors.map((error) => error.message).join('; '));
}
