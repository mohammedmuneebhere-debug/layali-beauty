/**
 * Classify and set available=50 at Riyadh for every variant.
 * Does NOT deactivate Hyderabad or mutate other locations' quantities
 * (only activates Riyadh when missing).
 */
import {
  activateInventoryAtLocation,
  fetchVariantInventorySnapshots,
  setAvailableQuantity,
  type VariantInventorySnapshot,
} from '@/lib/migration/inventory-to-riyadh/inventory';
import {
  REFERENCE_URI_PREFIX,
  RIYADH_LOCATION_ID,
  TARGET_AVAILABLE,
} from './constants';

export type SetAction =
  | 'already_at_target'
  | 'would_set'
  | 'set'
  | 'would_activate_and_set'
  | 'activated_and_set'
  | 'skipped_no_inventory_item'
  | 'failed';

export type ItemPlan = {
  action: SetAction;
  productId: string;
  productTitle: string;
  variantId: string;
  inventoryItemId: string | null;
  riyadhAvailable: number | null;
  riyadhOnHand: number | null;
  riyadhLevelId?: string | null;
  otherLocationCount: number;
  reason: string;
  error?: string;
};

export type SetRunOptions = {
  locationId?: string;
  targetAvailable?: number;
  dryRun: boolean;
  logger?: (msg: string) => void;
};

export type SetRunSummary = {
  productsInspected: number;
  variantsInspected: number;
  alreadyAtTarget: number;
  set: number;
  skipped: number;
  failed: number;
  items: ItemPlan[];
};

function riyadhLevel(snap: VariantInventorySnapshot, locationId: string) {
  return snap.levels.find((l) => l.locationId === locationId);
}

export function classifySnapshot(
  snap: VariantInventorySnapshot,
  locationId: string,
  targetAvailable: number
): ItemPlan {
  const base = {
    productId: snap.productId,
    productTitle: snap.productTitle,
    variantId: snap.variantId,
    inventoryItemId: snap.inventoryItemId,
    riyadhAvailable: null as number | null,
    riyadhOnHand: null as number | null,
    otherLocationCount: snap.levels.filter((l) => l.locationId !== locationId)
      .length,
  };

  if (!snap.inventoryItemId) {
    return {
      ...base,
      action: 'skipped_no_inventory_item',
      reason: 'No inventoryItem on variant',
    };
  }

  const riyadh = riyadhLevel(snap, locationId);
  base.riyadhAvailable = riyadh ? riyadh.available : null;
  base.riyadhOnHand = riyadh ? riyadh.onHand : null;

  if (!riyadh) {
    return {
      ...base,
      action: 'would_activate_and_set',
      reason: `Not activated at Riyadh; activate with available=${targetAvailable}`,
      riyadhLevelId: null,
    };
  }

  if (riyadh.available === targetAvailable) {
    return {
      ...base,
      action: 'already_at_target',
      reason: `Riyadh available already ${targetAvailable}`,
      riyadhLevelId: riyadh.inventoryLevelId,
    };
  }

  return {
    ...base,
    action: 'would_set',
    reason: `Set Riyadh available ${riyadh.available} → ${targetAvailable}`,
    riyadhLevelId: riyadh.inventoryLevelId,
  };
}

async function executeSet(
  plan: ItemPlan,
  locationId: string,
  targetAvailable: number,
  kind: 'set' | 'activate_and_set'
): Promise<ItemPlan> {
  if (!plan.inventoryItemId) {
    return { ...plan, action: 'failed', error: 'Missing inventoryItemId' };
  }

  const refUri = `${REFERENCE_URI_PREFIX}/${plan.variantId}`;

  try {
    if (kind === 'activate_and_set' || !plan.riyadhLevelId) {
      const activated = await activateInventoryAtLocation({
        inventoryItemId: plan.inventoryItemId,
        locationId,
        available: targetAvailable,
      });

      if (activated.available !== targetAvailable) {
        await setAvailableQuantity({
          inventoryItemId: plan.inventoryItemId,
          locationId,
          quantity: targetAvailable,
          compareQuantity: activated.available,
          referenceDocumentUri: refUri,
        });
      }

      return {
        ...plan,
        action: 'activated_and_set',
        riyadhAvailable: targetAvailable,
        riyadhLevelId: activated.inventoryLevelId,
        reason: `Activated at Riyadh with available=${targetAvailable}`,
      };
    }

    await setAvailableQuantity({
      inventoryItemId: plan.inventoryItemId,
      locationId,
      quantity: targetAvailable,
      compareQuantity: plan.riyadhAvailable ?? 0,
      referenceDocumentUri: refUri,
    });

    return {
      ...plan,
      action: 'set',
      riyadhAvailable: targetAvailable,
      reason: `Set Riyadh available to ${targetAvailable}`,
    };
  } catch (err) {
    return {
      ...plan,
      action: 'failed',
      error: err instanceof Error ? err.message : String(err),
      reason: 'Mutation failed',
    };
  }
}

export async function planAndOptionallySet(
  variantIds: string[],
  options: SetRunOptions
): Promise<SetRunSummary> {
  const log = options.logger ?? (() => {});
  const locationId = options.locationId ?? RIYADH_LOCATION_ID;
  const targetAvailable = options.targetAvailable ?? TARGET_AVAILABLE;

  const snapshots = await fetchVariantInventorySnapshots(variantIds, {
    logger: log,
  });

  const items: ItemPlan[] = [];
  let alreadyAtTarget = 0;
  let set = 0;
  let skipped = 0;
  let failed = 0;
  const productIds = new Set<string>();

  for (const snap of snapshots) {
    if (snap.productId) productIds.add(snap.productId);

    let plan = classifySnapshot(snap, locationId, targetAvailable);

    if (plan.action === 'would_set') {
      if (options.dryRun) {
        // keep would_set
      } else {
        plan = await executeSet(plan, locationId, targetAvailable, 'set');
        if (plan.action === 'set') set += 1;
        else if (plan.action === 'failed') failed += 1;
      }
    } else if (plan.action === 'would_activate_and_set') {
      if (options.dryRun) {
        // keep would_activate_and_set
      } else {
        plan = await executeSet(
          plan,
          locationId,
          targetAvailable,
          'activate_and_set'
        );
        if (plan.action === 'activated_and_set') set += 1;
        else if (plan.action === 'failed') failed += 1;
      }
    } else if (plan.action === 'already_at_target') {
      alreadyAtTarget += 1;
    } else if (plan.action === 'skipped_no_inventory_item') {
      skipped += 1;
    }

    items.push(plan);
  }

  const wouldSetCount = items.filter(
    (i) => i.action === 'would_set' || i.action === 'would_activate_and_set'
  ).length;

  return {
    productsInspected: productIds.size,
    variantsInspected: snapshots.length,
    alreadyAtTarget,
    set: options.dryRun ? wouldSetCount : set,
    skipped,
    failed,
    items,
  };
}
