/** Read-only post-migration verification. */
import {
  fetchVariantInventorySnapshots,
  type VariantInventorySnapshot,
} from './inventory';
import type { ItemPlan } from './migrate';
import type { VerificationReport } from './report';

function qtyAt(snap: VariantInventorySnapshot, locationId: string) {
  const lvl = snap.levels.find((l) => l.locationId === locationId);
  return {
    available: lvl?.available ?? 0,
    onHand: lvl?.onHand ?? 0,
    present: Boolean(lvl),
  };
}

/**
 * For items that were moved (or planned with known before India qty),
 * verify Riyadh available matches the expected (before) India available.
 * Also totals remaining India inventory across all inspected variants.
 */
export async function verifyMigration(params: {
  variantIds: string[];
  sourceLocationId: string;
  targetLocationId: string;
  /** Expected India→Riyadh available from pre-migration plans (variantId → available). */
  expectedRiyadhAvailable: Map<string, number>;
  logger?: (msg: string) => void;
}): Promise<VerificationReport> {
  const log = params.logger ?? (() => {});
  const snaps = await fetchVariantInventorySnapshots(params.variantIds, {
    logger: log,
  });

  let matched = 0;
  const mismatched: ItemPlan[] = [];
  let remainingIndiaAvailable = 0;
  let remainingIndiaOnHand = 0;
  let remainingIndiaPositiveVariants = 0;

  for (const snap of snaps) {
    const india = qtyAt(snap, params.sourceLocationId);
    const riyadh = qtyAt(snap, params.targetLocationId);
    remainingIndiaAvailable += india.available;
    remainingIndiaOnHand += india.onHand;
    if (india.available > 0 || india.onHand > 0) {
      remainingIndiaPositiveVariants += 1;
    }

    const expected = params.expectedRiyadhAvailable.get(snap.variantId);
    if (expected === undefined) continue;

    if (riyadh.available === expected) {
      matched += 1;
    } else {
      mismatched.push({
        action: 'failed',
        productId: snap.productId,
        productTitle: snap.productTitle,
        variantId: snap.variantId,
        inventoryItemId: snap.inventoryItemId,
        indiaAvailable: india.available,
        indiaOnHand: india.onHand,
        riyadhAvailable: riyadh.available,
        riyadhOnHand: riyadh.onHand,
        otherLocations: [],
        reason: `Expected Riyadh available=${expected}, got ${riyadh.available}`,
      });
    }
  }

  return {
    checked: params.expectedRiyadhAvailable.size,
    matched,
    mismatched,
    remainingIndiaAvailable,
    remainingIndiaOnHand,
    remainingIndiaPositiveVariants,
  };
}
