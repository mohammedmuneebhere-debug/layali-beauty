/** Formatting helpers for set-Riyadh-available-to-50 reports. */
import type { DiscoveredLocation } from '@/lib/migration/inventory-to-riyadh/locations';
import type { ScopeCheckResult } from '@/lib/migration/inventory-to-riyadh/scopes';
import { TARGET_AVAILABLE } from './constants';
import type { ItemPlan, SetRunSummary } from './set';

function sampleLines(items: ItemPlan[], size = 10): string {
  if (items.length === 0) return '  (none)';
  return items
    .slice(0, size)
    .map((i) => {
      const qty =
        i.riyadhAvailable == null
          ? 'Riyadh=not activated'
          : `Riyadh avail=${i.riyadhAvailable}`;
      const err = i.error ? ` | error=${i.error}` : '';
      return `  - ${i.productTitle || '(no title)'} ${i.variantId} | ${qty} | ${i.reason}${err}`;
    })
    .join('\n');
}

export function formatDryRunSummary(params: {
  target: DiscoveredLocation;
  scopes: ScopeCheckResult;
  summary: SetRunSummary;
  targetAvailable?: number;
}): string {
  const qty = params.targetAvailable ?? TARGET_AVAILABLE;
  const { target, scopes, summary } = params;
  const wouldSet = summary.items.filter((i) => i.action === 'would_set');
  const wouldActivate = summary.items.filter(
    (i) => i.action === 'would_activate_and_set'
  );
  const already = summary.items.filter((i) => i.action === 'already_at_target');
  const skipped = summary.items.filter(
    (i) => i.action === 'skipped_no_inventory_item'
  );

  return [
    `=== Set Riyadh available=${qty} DRY RUN (zero Shopify mutations) ===`,
    `Target: ${target.name} | ${target.id}`,
    `Scopes OK: ${scopes.ok} | granted=[${scopes.granted.join(', ')}] | missing=[${scopes.missing.join(', ') || 'none'}]`,
    '',
    `Products inspected: ${summary.productsInspected}`,
    `Variants inspected: ${summary.variantsInspected}`,
    `Already at ${qty}: ${summary.alreadyAtTarget}`,
    `Would set (activate or update): ${summary.set}`,
    `  └─ would update existing Riyadh level: ${wouldSet.length}`,
    `  └─ would activate then set: ${wouldActivate.length}`,
    `Skipped (no inventory item): ${summary.skipped}`,
    `Failed: ${summary.failed}`,
    `Other locations: left untouched (Hyderabad not deactivated)`,
    '',
    `Would-set samples:\n${sampleLines(wouldSet)}`,
    '',
    `Would-activate-and-set samples:\n${sampleLines(wouldActivate)}`,
    '',
    `Already-at-target samples:\n${sampleLines(already)}`,
    '',
    `Skipped samples:\n${sampleLines(skipped)}`,
  ].join('\n');
}

export function formatExecuteSummary(params: {
  target: DiscoveredLocation;
  summary: SetRunSummary;
  targetAvailable?: number;
}): string {
  const qty = params.targetAvailable ?? TARGET_AVAILABLE;
  const { target, summary } = params;
  const failed = summary.items.filter((i) => i.action === 'failed');
  const setItems = summary.items.filter(
    (i) => i.action === 'set' || i.action === 'activated_and_set'
  );

  return [
    `=== Set Riyadh available=${qty} EXECUTE ===`,
    `Target: ${target.name} | ${target.id}`,
    '',
    `Products inspected: ${summary.productsInspected}`,
    `Variants inspected: ${summary.variantsInspected}`,
    `Already at ${qty}: ${summary.alreadyAtTarget}`,
    `Set (activated or updated): ${summary.set}`,
    `Skipped: ${summary.skipped}`,
    `Failed: ${summary.failed}`,
    '',
    `Set samples:\n${sampleLines(setItems)}`,
    '',
    failed.length
      ? `Failures:\n${sampleLines(failed, 50)}`
      : 'Failures: none',
  ].join('\n');
}

export type VerificationReport = {
  checked: number;
  matched: number;
  mismatched: Array<{
    variantId: string;
    productTitle: string;
    expected: number;
    actual: number | null;
    reason: string;
  }>;
  missingInventoryItem: number;
};

export function formatVerificationReport(
  report: VerificationReport,
  targetAvailable = TARGET_AVAILABLE
): string {
  return [
    `=== Post-set verification (read-only, expect available=${targetAvailable}) ===`,
    `Variants re-checked: ${report.checked}`,
    `Matched available=${targetAvailable}: ${report.matched}/${report.checked}`,
    `Missing inventory item: ${report.missingInventoryItem}`,
    report.mismatched.length
      ? `Mismatches (up to 20):\n${report.mismatched
          .slice(0, 20)
          .map(
            (m) =>
              `  - ${m.productTitle} ${m.variantId}: expected=${m.expected} actual=${m.actual ?? 'n/a'} (${m.reason})`
          )
          .join('\n')}`
      : 'Mismatches: none',
  ].join('\n');
}
