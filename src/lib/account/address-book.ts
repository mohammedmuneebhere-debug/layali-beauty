import { readCustomerJson, writeCustomerJson } from '@/lib/shopify/shop-records';
import {
  createAccountAddress,
  deleteAccountAddress,
  listAccountAddresses,
  setDefaultAccountAddress,
  type AccountAddressInput,
  type AddressGeo,
} from '@/lib/shopify/customer-account-api';
import type { Address } from '@/types/database';

const GEO_KEY = 'address_geo';

export async function readAddressGeo(customerId: string): Promise<Record<string, AddressGeo>> {
  return (await readCustomerJson<Record<string, AddressGeo>>(customerId, GEO_KEY)) || {};
}

export async function listCustomerAddresses(accessToken: string, customerId: string): Promise<Address[]> {
  const geo = await readAddressGeo(customerId);
  const rows = await listAccountAddresses(accessToken, customerId, geo);
  return rows.sort((a, b) => Number(b.is_default) - Number(a.is_default));
}

export async function createCustomerAddress(
  accessToken: string,
  customerId: string,
  input: AccountAddressInput
): Promise<Address> {
  const addressId = await createAccountAddress(accessToken, input);
  const geo = await readAddressGeo(customerId);
  geo[addressId] = {
    label: input.label,
    customLabel: input.customLabel || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  };
  await writeCustomerJson(customerId, GEO_KEY, geo);
  const rows = await listCustomerAddresses(accessToken, customerId);
  const created = rows.find((row) => row.id === addressId);
  if (!created) throw new Error('Saved address could not be read back');
  return created;
}

export async function updateCustomerAddressPin(
  customerId: string,
  addressId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const geo = await readAddressGeo(customerId);
  const current = geo[addressId] || { label: 'home' as const, customLabel: null, latitude: null, longitude: null };
  geo[addressId] = { ...current, latitude, longitude };
  await writeCustomerJson(customerId, GEO_KEY, geo);
}

export async function removeCustomerAddress(
  accessToken: string,
  customerId: string,
  addressId: string
): Promise<void> {
  await deleteAccountAddress(accessToken, addressId);
  const geo = await readAddressGeo(customerId);
  delete geo[addressId];
  await writeCustomerJson(customerId, GEO_KEY, geo);
}

export async function makeDefaultAddress(
  accessToken: string,
  addressId: string
): Promise<void> {
  await setDefaultAccountAddress(accessToken, addressId);
}
