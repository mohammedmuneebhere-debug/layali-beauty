/** Read-only verification that Riyadh available equals the target for every variant. */
import { fetchVariantInventorySnapshots } from '@/lib/migration/inventory-to-riyadh/inventory';
import { RIYADH_LOCATION_ID, TARGET_AVAILABLE } from './constants';
import type { VerificationReport } from './report';

export async function verifyRiyadhStock(params: {
  variantIds: string[];
  locationId?: string;
  targetAvailable?: number;
  /** Only verify variants that should have been set / already correct (skip no-item). */
  skipVariantIds?: Set<string>;
  logger?: (msg: string) => void;
}): Promise<VerificationReport> {
  const log = params.logger ?? (() => {});
  const locationId = params.locationId ?? RIYADH_LOCATION_ID;
  const targetAvailable = params.targetAvailable ?? TARGET_AVAILABLE;
  const skip = params.skipVariantIds ?? new Set<string>();

  const toCheck = params.variantIds.filter((id) => !skip.has(id));
  const snaps = await fetchVariantInventorySnapshots(toCheck, { logger: log });

  let matched = 0;
  let missingInventoryItem = 0;
  const mismatched: VerificationReport['mismatched'] = [];

  for (const snap of snaps) {
    if (!snap.inventoryItemId) {
      missingInventoryItem += 1;
      mismatched.push({
        variantId: snap.variantId,
        productTitle: snap.productTitle,
        expected: targetAvailable,
        actual: null,
        reason: 'No inventoryItem',
      });
      continue;
    }

    const riyadh = snap.levels.find((l) => l.locationId === locationId);
    if (!riyadh) {
      mismatched.push({
        variantId: snap.variantId,
        productTitle: snap.productTitle,
        expected: targetAvailable,
        actual: null,
        reason: 'Not activated at Riyadh',
      });
      continue;
    }

    if (riyadh.available === targetAvailable) {
      matched += 1;
    } else {
      mismatched.push({
        variantId: snap.variantId,
        productTitle: snap.productTitle,
        expected: targetAvailable,
        actual: riyadh.available,
        reason: `Expected available=${targetAvailable}, got ${riyadh.available}`,
      });
    }
  }

  return {
    checked: snaps.length,
    matched,
    mismatched,
    missingInventoryItem,
  };
}
