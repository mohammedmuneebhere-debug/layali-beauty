/**
 * Classify and migrate inventory from India → Riyadh.
 * Default: copy positive quantities / activate zero-stock at Riyadh;
 * do NOT deactivate India unless opted in.
 */
import {
  activateInventoryAtLocation,
  deactivateInventoryLevel,
  fetchVariantInventorySnapshots,
  setAvailableQuantity,
  type LocationQty,
  type VariantInventorySnapshot,
} from './inventory';

export type MigrationAction =
  | 'already_correct'
  | 'would_move'
  | 'moved'
  | 'would_activate_zero'
  | 'activated_zero'
  | 'skipped_no_inventory_item'
  | 'skipped_not_at_india'
  | 'ambiguous_multi_location'
  | 'failed';

export type ItemPlan = {
  action: MigrationAction;
  productId: string;
  productTitle: string;
  variantId: string;
  inventoryItemId: string | null;
  indiaAvailable: number;
  indiaOnHand: number;
  riyadhAvailable: number | null;
  riyadhOnHand: number | null;
  otherLocations: { id: string; name: string; available: number; onHand: number }[];
  reason: string;
  indiaLevelId?: string;
  riyadhLevelId?: string | null;
  error?: string;
};

export type MigrationRunOptions = {
  sourceLocationId: string;
  targetLocationId: string;
  dryRun: boolean;
  deactivateOldLocation: boolean;
  logger?: (msg: string) => void;
};

export type MigrationRunSummary = {
  productsInspected: number;
  variantsInspected: number;
  alreadyCorrect: number;
  /** Positive India stock that would move / did move to Riyadh. */
  moved: number;
  /** Zero India stock that would activate / did activate at Riyadh with available=0. */
  activatedZero: number;
  skipped: number;
  ambiguous: number;
  failed: number;
  totalAvailableMigrated: number;
  totalOnHandMigrated: number;
  deactivatedIndia: number;
  items: ItemPlan[];
};

function levelAt(
  snap: VariantInventorySnapshot,
  locationId: string
): LocationQty | undefined {
  return snap.levels.find((l) => l.locationId === locationId);
}

export function classifySnapshot(
  snap: VariantInventorySnapshot,
  sourceLocationId: string,
  targetLocationId: string
): ItemPlan {
  const base = {
    productId: snap.productId,
    productTitle: snap.productTitle,
    variantId: snap.variantId,
    inventoryItemId: snap.inventoryItemId,
    indiaAvailable: 0,
    indiaOnHand: 0,
    riyadhAvailable: null as number | null,
    riyadhOnHand: null as number | null,
    otherLocations: [] as ItemPlan['otherLocations'],
  };

  if (!snap.inventoryItemId) {
    return {
      ...base,
      action: 'skipped_no_inventory_item',
      reason: 'No inventoryItem on variant',
    };
  }

  const india = levelAt(snap, sourceLocationId);
  const riyadh = levelAt(snap, targetLocationId);
  const others = snap.levels.filter(
    (l) => l.locationId !== sourceLocationId && l.locationId !== targetLocationId
  );

  base.indiaAvailable = india?.available ?? 0;
  base.indiaOnHand = india?.onHand ?? 0;
  base.riyadhAvailable = riyadh ? riyadh.available : null;
  base.riyadhOnHand = riyadh ? riyadh.onHand : null;
  base.otherLocations = others.map((o) => ({
    id: o.locationId,
    name: o.locationName,
    available: o.available,
    onHand: o.onHand,
  }));

  // Ambiguous: stock (or activation) at a third location with any qty > 0
  const othersWithStock = others.filter((o) => o.available > 0 || o.onHand > 0);
  if (othersWithStock.length > 0) {
    return {
      ...base,
      action: 'ambiguous_multi_location',
      reason: `Stock at additional location(s): ${othersWithStock
        .map((o) => `${o.locationName}(avail=${o.available})`)
        .join(', ')}`,
      indiaLevelId: india?.inventoryLevelId,
      riyadhLevelId: riyadh?.inventoryLevelId ?? null,
    };
  }

  // Not at India at all
  if (!india) {
    if (riyadh && (riyadh.available > 0 || riyadh.onHand > 0)) {
      return {
        ...base,
        action: 'already_correct',
        reason: 'Already only at Riyadh (not activated at India)',
        riyadhLevelId: riyadh.inventoryLevelId,
      };
    }
    return {
      ...base,
      action: 'skipped_not_at_india',
      reason: 'Not activated at India; nothing to move',
      riyadhLevelId: riyadh?.inventoryLevelId ?? null,
    };
  }

  // India available/on_hand are 0 — activate at Riyadh with available=0 (do not invent stock)
  if (india.available <= 0 && india.onHand <= 0) {
    if (riyadh) {
      // Already assigned at Riyadh — leave quantities untouched
      return {
        ...base,
        action: 'already_correct',
        reason:
          riyadh.available === 0 && riyadh.onHand === 0
            ? 'Zero at India and already activated at Riyadh (available=0)'
            : `Already activated at Riyadh (avail=${riyadh.available}); India zero — left unchanged`,
        indiaLevelId: india.inventoryLevelId,
        riyadhLevelId: riyadh.inventoryLevelId,
      };
    }
    return {
      ...base,
      action: 'would_activate_zero',
      reason: 'India available/on_hand are zero; activate at Riyadh with available=0',
      indiaLevelId: india.inventoryLevelId,
      riyadhLevelId: null,
    };
  }

  // Already correct: Riyadh matches India available
  if (riyadh && riyadh.available === india.available) {
    return {
      ...base,
      action: 'already_correct',
      reason: `Riyadh available already equals India (${india.available})`,
      indiaLevelId: india.inventoryLevelId,
      riyadhLevelId: riyadh.inventoryLevelId,
    };
  }

  return {
    ...base,
    action: 'would_move',
    reason: riyadh
      ? `Set Riyadh available ${riyadh.available} → ${india.available}`
      : `Activate Riyadh with available=${india.available}`,
    indiaLevelId: india.inventoryLevelId,
    riyadhLevelId: riyadh?.inventoryLevelId ?? null,
  };
}

async function executeMove(
  plan: ItemPlan,
  options: MigrationRunOptions,
  kind: 'move' | 'activate_zero'
): Promise<ItemPlan> {
  if (!plan.inventoryItemId) {
    return { ...plan, action: 'failed', error: 'Missing inventoryItemId' };
  }

  const targetQty = kind === 'activate_zero' ? 0 : plan.indiaAvailable;
  const refUri = `layali://inventory-migration/india-to-riyadh/${plan.variantId}`;

  try {
    if (plan.riyadhLevelId) {
      // Already activated — set absolute available via CAS (positive moves only)
      await setAvailableQuantity({
        inventoryItemId: plan.inventoryItemId,
        locationId: options.targetLocationId,
        quantity: targetQty,
        compareQuantity: plan.riyadhAvailable ?? 0,
        referenceDocumentUri: refUri,
      });
    } else {
      // Activate with initial available quantity (0 for zero-stock activation)
      const activated = await activateInventoryAtLocation({
        inventoryItemId: plan.inventoryItemId,
        locationId: options.targetLocationId,
        available: targetQty,
      });

      // If activate left a different available (edge case), correct with set
      if (activated.available !== targetQty) {
        await setAvailableQuantity({
          inventoryItemId: plan.inventoryItemId,
          locationId: options.targetLocationId,
          quantity: targetQty,
          compareQuantity: activated.available,
          referenceDocumentUri: refUri,
        });
      }
      plan.riyadhLevelId = activated.inventoryLevelId;
    }

    let deactivatedIndia = false;
    if (options.deactivateOldLocation && plan.indiaLevelId) {
      await deactivateInventoryLevel(plan.indiaLevelId);
      deactivatedIndia = true;
    }

    if (kind === 'activate_zero') {
      return {
        ...plan,
        action: 'activated_zero',
        riyadhAvailable: 0,
        reason: deactivatedIndia
          ? 'Activated at Riyadh with available=0; India deactivated'
          : 'Activated at Riyadh with available=0; India left active',
      };
    }

    return {
      ...plan,
      action: 'moved',
      riyadhAvailable: targetQty,
      reason: deactivatedIndia
        ? `Moved available=${targetQty} to Riyadh; India deactivated`
        : `Copied available=${targetQty} to Riyadh; India left active`,
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

export async function planAndOptionallyMigrate(
  variantIds: string[],
  productIdByVariant: Map<string, string>,
  options: MigrationRunOptions
): Promise<MigrationRunSummary> {
  const log = options.logger ?? (() => {});
  const snapshots = await fetchVariantInventorySnapshots(variantIds, {
    logger: log,
  });

  const items: ItemPlan[] = [];
  let moved = 0;
  let activatedZero = 0;
  let alreadyCorrect = 0;
  let skipped = 0;
  let ambiguous = 0;
  let failed = 0;
  let totalAvailableMigrated = 0;
  let totalOnHandMigrated = 0;
  let deactivatedIndia = 0;

  const productIds = new Set<string>();

  for (const snap of snapshots) {
    if (snap.productId) productIds.add(snap.productId);
    else {
      const fromMap = productIdByVariant.get(snap.variantId);
      if (fromMap) productIds.add(fromMap);
    }

    let plan = classifySnapshot(
      snap,
      options.sourceLocationId,
      options.targetLocationId
    );

    if (plan.action === 'would_move') {
      if (options.dryRun) {
        // Keep would_move for dry-run reporting
        totalAvailableMigrated += plan.indiaAvailable;
        totalOnHandMigrated += plan.indiaOnHand;
      } else {
        plan = await executeMove(plan, options, 'move');
        if (plan.action === 'moved') {
          moved += 1;
          totalAvailableMigrated += plan.indiaAvailable;
          totalOnHandMigrated += plan.indiaOnHand;
          if (options.deactivateOldLocation) deactivatedIndia += 1;
        } else if (plan.action === 'failed') {
          failed += 1;
        }
      }
    } else if (plan.action === 'would_activate_zero') {
      if (options.dryRun) {
        // available/on_hand stay 0 — do not invent stock
      } else {
        plan = await executeMove(plan, options, 'activate_zero');
        if (plan.action === 'activated_zero') {
          activatedZero += 1;
          if (options.deactivateOldLocation) deactivatedIndia += 1;
        } else if (plan.action === 'failed') {
          failed += 1;
        }
      }
    } else if (plan.action === 'already_correct') {
      alreadyCorrect += 1;
    } else if (plan.action === 'ambiguous_multi_location') {
      ambiguous += 1;
    } else if (
      plan.action === 'skipped_no_inventory_item' ||
      plan.action === 'skipped_not_at_india'
    ) {
      skipped += 1;
    }

    items.push(plan);
  }

  // Dry-run counts mirror planned actions
  const wouldMoveCount = items.filter((i) => i.action === 'would_move').length;
  const wouldActivateZeroCount = items.filter(
    (i) => i.action === 'would_activate_zero'
  ).length;

  return {
    productsInspected: productIds.size,
    variantsInspected: snapshots.length,
    alreadyCorrect,
    moved: options.dryRun ? wouldMoveCount : moved,
    activatedZero: options.dryRun ? wouldActivateZeroCount : activatedZero,
    skipped,
    ambiguous,
    failed,
    totalAvailableMigrated,
    totalOnHandMigrated,
    deactivatedIndia,
    items,
  };
}
