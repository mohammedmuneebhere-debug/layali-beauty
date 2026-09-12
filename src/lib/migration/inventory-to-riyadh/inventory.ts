/**
 * Inventory discovery + mutations for India → Riyadh migration.
 * Shopify Admin inventory is source of truth (not Supabase stock).
 */
import { shopifyAdminFetch, sleep } from '@/lib/shopify/admin';
import { migrationPace } from '@/lib/shopify/admin-products';

export type QtyPair = { available: number; onHand: number };

export type LocationQty = {
  locationId: string;
  locationName: string;
  inventoryLevelId: string;
  available: number;
  onHand: number;
};

export type VariantInventorySnapshot = {
  productId: string;
  productTitle: string;
  variantId: string;
  inventoryItemId: string | null;
  levels: LocationQty[];
};

const VARIANT_INVENTORY_QUERY = /* GraphQL */ `
  query InventoryMigrationVariantNodes($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        product {
          id
          title
        }
        inventoryItem {
          id
          inventoryLevels(first: 20) {
            nodes {
              id
              location {
                id
                name
              }
              quantities(names: ["available", "on_hand"]) {
                name
                quantity
              }
            }
          }
        }
      }
    }
  }
`;

const INVENTORY_ACTIVATE = /* GraphQL */ `
  mutation InventoryMigrationActivate(
    $inventoryItemId: ID!
    $locationId: ID!
    $available: Int
  ) {
    inventoryActivate(
      inventoryItemId: $inventoryItemId
      locationId: $locationId
      available: $available
    ) {
      inventoryLevel {
        id
        quantities(names: ["available", "on_hand"]) {
          name
          quantity
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const INVENTORY_SET_QUANTITIES = /* GraphQL */ `
  mutation InventoryMigrationSetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup {
        reason
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const INVENTORY_DEACTIVATE = /* GraphQL */ `
  mutation InventoryMigrationDeactivate($inventoryLevelId: ID!) {
    inventoryDeactivate(inventoryLevelId: $inventoryLevelId) {
      userErrors {
        field
        message
      }
    }
  }
`;

function parseQuantities(
  quantities: { name: string; quantity: number }[] | undefined
): QtyPair {
  let available = 0;
  let onHand = 0;
  for (const q of quantities ?? []) {
    if (q.name === 'available') available = q.quantity;
    if (q.name === 'on_hand') onHand = q.quantity;
  }
  return { available, onHand };
}

export async function fetchVariantInventorySnapshots(
  variantIds: string[],
  options?: { batchSize?: number; logger?: (msg: string) => void }
): Promise<VariantInventorySnapshot[]> {
  const batchSize = options?.batchSize ?? 25;
  const log = options?.logger ?? (() => {});
  const out: VariantInventorySnapshot[] = [];

  for (let i = 0; i < variantIds.length; i += batchSize) {
    const batch = variantIds.slice(i, i + batchSize);
    const { data, throttleAvailable } = await shopifyAdminFetch<{
      nodes: Array<{
        id?: string;
        title?: string;
        product?: { id: string; title: string };
        inventoryItem?: {
          id: string;
          inventoryLevels: {
            nodes: Array<{
              id: string;
              location: { id: string; name: string };
              quantities: { name: string; quantity: number }[];
            }>;
          };
        } | null;
      } | null>;
    }>(VARIANT_INVENTORY_QUERY, { ids: batch }, { retries: 4 });

    for (const node of data.nodes ?? []) {
      if (!node?.id) continue;
      const levels: LocationQty[] = [];
      for (const lvl of node.inventoryItem?.inventoryLevels?.nodes ?? []) {
        const qty = parseQuantities(lvl.quantities);
        levels.push({
          locationId: lvl.location.id,
          locationName: lvl.location.name,
          inventoryLevelId: lvl.id,
          available: qty.available,
          onHand: qty.onHand,
        });
      }
      out.push({
        productId: node.product?.id ?? '',
        productTitle: node.product?.title ?? '',
        variantId: node.id,
        inventoryItemId: node.inventoryItem?.id ?? null,
        levels,
      });
    }

    log(
      `Inventory discovery: ${Math.min(i + batchSize, variantIds.length)}/${variantIds.length} variants`
    );
    await migrationPace(throttleAvailable);
  }

  return out;
}

export async function activateInventoryAtLocation(params: {
  inventoryItemId: string;
  locationId: string;
  available: number;
}): Promise<{ inventoryLevelId: string | null; available: number; onHand: number }> {
  const { data, throttleAvailable } = await shopifyAdminFetch<{
    inventoryActivate: {
      inventoryLevel: {
        id: string;
        quantities: { name: string; quantity: number }[];
      } | null;
      userErrors: { field?: string[]; message: string }[];
    };
  }>(
    INVENTORY_ACTIVATE,
    {
      inventoryItemId: params.inventoryItemId,
      locationId: params.locationId,
      available: params.available,
    },
    { retries: 4 }
  );

  await migrationPace(throttleAvailable);

  const errors = data.inventoryActivate.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join('; '));
  }

  const level = data.inventoryActivate.inventoryLevel;
  const qty = parseQuantities(level?.quantities);
  return {
    inventoryLevelId: level?.id ?? null,
    available: qty.available,
    onHand: qty.onHand,
  };
}

/**
 * Set absolute available quantity with compare-and-set.
 * Retries once on compare mismatch by re-reading (caller should pass fresh compare).
 * Falls back to ignoreCompareQuantity only when compare fails repeatedly.
 */
export async function setAvailableQuantity(params: {
  inventoryItemId: string;
  locationId: string;
  quantity: number;
  compareQuantity: number;
  referenceDocumentUri: string;
  allowIgnoreCompare?: boolean;
}): Promise<void> {
  const trySet = async (compareQuantity: number | null, ignore: boolean) => {
    const input: Record<string, unknown> = {
      name: 'available',
      reason: 'correction',
      referenceDocumentUri: params.referenceDocumentUri,
      quantities: [
        {
          inventoryItemId: params.inventoryItemId,
          locationId: params.locationId,
          quantity: params.quantity,
          ...(ignore ? {} : { compareQuantity }),
        },
      ],
    };
    if (ignore) {
      input.ignoreCompareQuantity = true;
    }

    const { data, throttleAvailable } = await shopifyAdminFetch<{
      inventorySetQuantities: {
        userErrors: { field?: string[]; message: string; code?: string }[];
      };
    }>(INVENTORY_SET_QUANTITIES, { input }, { retries: 4 });

    await migrationPace(throttleAvailable);
    return data.inventorySetQuantities.userErrors ?? [];
  };

  let errors = await trySet(params.compareQuantity, false);
  if (errors.length === 0) return;

  const compareFail = errors.some(
    (e) =>
      /compare/i.test(e.message) ||
      e.code === 'COMPARE_QUANTITY_REQUIRED' ||
      e.code === 'COMPARE_QUANTITY_STALE'
  );

  if (compareFail && params.allowIgnoreCompare !== false) {
    // One more attempt with ignore — only when CAS cannot succeed (stale concurrent write).
    await sleep(400);
    errors = await trySet(null, true);
    if (errors.length === 0) return;
  }

  throw new Error(errors.map((e) => e.message).join('; '));
}

export async function deactivateInventoryLevel(
  inventoryLevelId: string
): Promise<void> {
  const { data, throttleAvailable } = await shopifyAdminFetch<{
    inventoryDeactivate: {
      userErrors: { field?: string[]; message: string }[];
    };
  }>(INVENTORY_DEACTIVATE, { inventoryLevelId }, { retries: 4 });

  await migrationPace(throttleAvailable);

  const errors = data.inventoryDeactivate.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join('; '));
  }
}

/** Re-fetch a single variant's levels (post-migration verification). */
export async function fetchSingleVariantInventory(
  variantId: string
): Promise<VariantInventorySnapshot | null> {
  const [snap] = await fetchVariantInventorySnapshots([variantId]);
  return snap ?? null;
}
