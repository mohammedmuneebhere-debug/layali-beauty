/**
 * Application records stored as Shopify shop or customer JSON metafields.
 * Shopify Admin is the store. There is no second database.
 * Reads fall back when Admin is not configured. Writes require Admin credentials.
 */
import { isShopifyAdminConfigured, shopifyAdminFetch } from '@/lib/shopify/admin';

const NAMESPACE = 'layali';
const CACHE_MS = 15_000;

type CacheEntry = { at: number; raw: string | null };

const cache = new Map<string, CacheEntry>();
let shopGid: string | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

export class ShopRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShopRecordError';
  }
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function shopId(): Promise<string> {
  if (shopGid) return shopGid;
  const { data } = await shopifyAdminFetch<{ shop: { id: string } | null }>(
    `#graphql
      query LayaliShopId {
        shop { id }
      }
    `
  );
  const id = data.shop?.id;
  if (!id) throw new ShopRecordError('Shopify did not return a shop id');
  shopGid = id;
  return id;
}

async function readRaw(ownerId: string, key: string): Promise<string | null> {
  const cacheKey = `${ownerId}:${key}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.raw;

  const { data } = await shopifyAdminFetch<{
    node: { metafield: { value: string } | null } | null;
  }>(
    `#graphql
      query LayaliRecord($id: ID!, $namespace: String!, $key: String!) {
        node(id: $id) {
          ... on Shop {
            metafield(namespace: $namespace, key: $key) { value }
          }
          ... on Customer {
            metafield(namespace: $namespace, key: $key) { value }
          }
        }
      }
    `,
    { id: ownerId, namespace: NAMESPACE, key }
  );
  const raw = data.node?.metafield?.value ?? null;
  cache.set(cacheKey, { at: Date.now(), raw });
  return raw;
}

async function writeRaw(ownerId: string, key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  if (json.length > 900_000) {
    throw new ShopRecordError('This record is too large to store on Shopify');
  }
  const { data } = await shopifyAdminFetch<{
    metafieldsSet: {
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(
    `#graphql
      mutation LayaliRecordSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id }
          userErrors { field message }
        }
      }
    `,
    {
      metafields: [
        {
          ownerId,
          namespace: NAMESPACE,
          key,
          type: 'json',
          value: json,
        },
      ],
    }
  );
  const errors = data.metafieldsSet?.userErrors || [];
  if (errors.length) {
    throw new ShopRecordError(errors.map((error) => error.message).join('; '));
  }
  cache.set(`${ownerId}:${key}`, { at: Date.now(), raw: json });
}

export async function readShopJson<T>(key: string, fallback: T): Promise<T> {
  if (!isShopifyAdminConfigured()) return fallback;
  try {
    const raw = await readRaw(await shopId(), key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error('Layali shop record read failed', key, err instanceof Error ? err.message : 'error');
    return fallback;
  }
}

export async function writeShopJson(key: string, value: unknown): Promise<void> {
  if (!isShopifyAdminConfigured()) {
    throw new ShopRecordError('Shopify Admin is not configured');
  }
  await enqueue(async () => {
    await writeRaw(await shopId(), key, value);
  });
}

export async function readCustomerJson<T>(customerId: string, key: string): Promise<T | null> {
  if (!isShopifyAdminConfigured() || !customerId.startsWith('gid://shopify/Customer/')) return null;
  try {
    const raw = await readRaw(customerId, key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error('Layali customer record read failed', key, err instanceof Error ? err.message : 'error');
    return null;
  }
}

export async function writeCustomerJson(customerId: string, key: string, value: unknown): Promise<void> {
  if (!customerId.startsWith('gid://shopify/Customer/')) {
    throw new ShopRecordError('Customer id is not a Shopify customer');
  }
  if (!isShopifyAdminConfigured()) {
    throw new ShopRecordError('Shopify Admin is not configured');
  }
  await enqueue(() => writeRaw(customerId, key, value));
}
