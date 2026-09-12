/** Formatting helpers for inventory → Riyadh migration reports. */
import type { DiscoveredLocation } from './locations';
import { formatLocationLine } from './locations';
import type { ItemPlan, MigrationRunSummary } from './migrate';
import type { ScopeCheckResult } from './scopes';

export function formatLocationsReport(locations: DiscoveredLocation[]): string {
  const lines = [
    '=== Shopify locations (Admin GraphQL) ===',
    `Count: ${locations.length}`,
    '',
  ];
  for (const loc of locations) {
    lines.push(`- ${formatLocationLine(loc)}`);
  }
  return lines.join('\n');
}

function summarizeItemGroup(label: string, items: ItemPlan[], sampleSize = 8): string {
  const totalAvail = items.reduce((s, i) => s + i.indiaAvailable, 0);
  const totalOnHand = items.reduce((s, i) => s + i.indiaOnHand, 0);
  const samples = items.slice(0, sampleSize).map((i) => {
    const riyadh =
      i.riyadhAvailable == null
        ? 'Riyadh=not activated'
        : `Riyadh avail=${i.riyadhAvailable} on_hand=${i.riyadhOnHand ?? 0}`;
    const others =
      i.otherLocations.length > 0
        ? ` | others=[${i.otherLocations
            .map((o) => `${o.name}:avail=${o.available}`)
            .join('; ')}]`
        : '';
    return `  - ${i.productTitle || '(no title)'} | India avail=${i.indiaAvailable} on_hand=${i.indiaOnHand} | ${riyadh}${others} | ${i.reason}`;
  });

  return [
    `--- ${label} ---`,
    `Count: ${items.length}`,
    `Total India available: ${totalAvail}`,
    `Total India on_hand: ${totalOnHand}`,
    items.length
      ? `Samples (up to ${sampleSize}):\n${samples.join('\n')}`
      : 'Samples: none',
  ].join('\n');
}

/** Read-only breakdown of every action category for dry-run analysis. */
export function formatSkipCategoryBreakdown(summary: MigrationRunSummary): string {
  const by = (action: ItemPlan['action']) =>
    summary.items.filter((i) => i.action === action);

  const wouldActivateZero = by('would_activate_zero');
  const skippedNotAtIndia = by('skipped_not_at_india');
  const skippedNoItem = by('skipped_no_inventory_item');
  const ambiguous = by('ambiguous_multi_location');
  const alreadyCorrect = by('already_correct');
  const wouldMove = by('would_move');
  const failed = by('failed');

  // Sub-split skipped_not_at_india: already at Riyadh (zero) vs nowhere vs elsewhere-zero-only
  const notAtIndiaButRiyadhZero = skippedNotAtIndia.filter(
    (i) => i.riyadhAvailable === 0 && i.riyadhOnHand === 0
  );
  const notAtIndiaNoRiyadh = skippedNotAtIndia.filter(
    (i) => i.riyadhAvailable == null
  );
  const notAtIndiaOther = skippedNotAtIndia.filter(
    (i) =>
      !(i.riyadhAvailable === 0 && i.riyadhOnHand === 0) &&
      i.riyadhAvailable != null
  );

  const knownActions = new Set([
    'would_activate_zero',
    'activated_zero',
    'skipped_not_at_india',
    'skipped_no_inventory_item',
    'ambiguous_multi_location',
    'already_correct',
    'would_move',
    'moved',
    'failed',
  ]);
  const other = summary.items.filter((i) => !knownActions.has(i.action));

  return [
    '=== Action category breakdown (read-only) ===',
    '',
    summarizeItemGroup(
      '1. Positive India stock → would move to Riyadh (would_move)',
      wouldMove
    ),
    '',
    summarizeItemGroup(
      '2. Zero India stock → would activate at Riyadh with available=0 (would_activate_zero)',
      wouldActivateZero
    ),
    '',
    summarizeItemGroup(
      '3. Already correct / matched (already_correct)',
      alreadyCorrect
    ),
    '',
    summarizeItemGroup(
      '4. No inventory level at Hyderabad (skipped_not_at_india)',
      skippedNotAtIndia
    ),
    `   └─ not at Hyderabad, also not at Riyadh: ${notAtIndiaNoRiyadh.length}`,
    `   └─ not at Hyderabad, Riyadh present at zero: ${notAtIndiaButRiyadhZero.length}`,
    `   └─ not at Hyderabad, other Riyadh state: ${notAtIndiaOther.length}`,
    '',
    summarizeItemGroup(
      '5. Already active at another location with stock (ambiguous_multi_location)',
      ambiguous
    ),
    '',
    summarizeItemGroup(
      '6. Inventory item not found (skipped_no_inventory_item)',
      skippedNoItem
    ),
    '',
    summarizeItemGroup('7. Failed', failed),
    '',
    other.length
      ? summarizeItemGroup('8. Other / unexpected actions', other)
      : '8. Other / unexpected actions: none',
  ].join('\n');
}

export function formatDryRunSummary(params: {
  source: DiscoveredLocation;
  target: DiscoveredLocation;
  scopes: ScopeCheckResult;
  summary: MigrationRunSummary;
}): string {
  const { source, target, scopes, summary } = params;
  const ambiguousItems = summary.items.filter(
    (i) => i.action === 'ambiguous_multi_location'
  );
  const wouldMove = summary.items.filter((i) => i.action === 'would_move');
  const wouldActivateZero = summary.items.filter(
    (i) => i.action === 'would_activate_zero'
  );
  const skippedItems = summary.items.filter(
    (i) =>
      i.action === 'skipped_not_at_india' ||
      i.action === 'skipped_no_inventory_item'
  );

  return [
    '=== Inventory → Riyadh DRY RUN (zero Shopify mutations) ===',
    `Source (India): ${source.name} | ${source.id}`,
    `Target (Riyadh/SA): ${target.name} | ${target.id}`,
    `Scopes OK: ${scopes.ok} | granted=[${scopes.granted.join(', ')}] | missing=[${scopes.missing.join(', ') || 'none'}]`,
    '',
    `Products inspected: ${summary.productsInspected}`,
    `Variants inspected: ${summary.variantsInspected}`,
    `Already correct (at Riyadh / matched): ${summary.alreadyCorrect}`,
    `Would move positive stock (India → Riyadh): ${summary.moved}`,
    `Would activate zero-stock at Riyadh (available=0): ${summary.activatedZero}`,
    `Skipped (not at India / no inventory item): ${summary.skipped}`,
    `Ambiguous / multi-location: ${summary.ambiguous}`,
    `Failed: ${summary.failed}`,
    `Total available to migrate (positive moves only): ${summary.totalAvailableMigrated}`,
    `Total on_hand to migrate (positive moves only): ${summary.totalOnHandMigrated}`,
    `India deactivation: NOT included (pass --deactivate-old-location on execute)`,
    '',
    wouldMove.length
      ? `Would-move (positive) sample (up to 10):\n${wouldMove
          .slice(0, 10)
          .map(
            (i) =>
              `  - ${i.productTitle} avail=${i.indiaAvailable} on_hand=${i.indiaOnHand} → Riyadh`
          )
          .join('\n')}`
      : 'Would-move (positive): none',
    '',
    wouldActivateZero.length
      ? `Would-activate-zero sample (up to 10):\n${wouldActivateZero
          .slice(0, 10)
          .map((i) => `  - ${i.productTitle} ${i.variantId} → Riyadh available=0`)
          .join('\n')}`
      : 'Would-activate-zero: none',
    '',
    ambiguousItems.length
      ? `Ambiguous sample (up to 10):\n${ambiguousItems
          .slice(0, 10)
          .map((i) => `  - ${i.productTitle} ${i.variantId}: ${i.reason}`)
          .join('\n')}`
      : 'Ambiguous: none',
    '',
    skippedItems.length
      ? `Skipped sample (up to 10):\n${skippedItems
          .slice(0, 10)
          .map((i) => `  - ${i.productTitle} ${i.variantId}: ${i.reason}`)
          .join('\n')}`
      : 'Skipped: none',
    '',
    formatSkipCategoryBreakdown(summary),
  ].join('\n');
}

export function formatExecuteSummary(params: {
  source: DiscoveredLocation;
  target: DiscoveredLocation;
  summary: MigrationRunSummary;
  deactivateOldLocation: boolean;
}): string {
  const { source, target, summary, deactivateOldLocation } = params;
  const failed = summary.items.filter((i) => i.action === 'failed');

  return [
    '=== Inventory → Riyadh EXECUTE ===',
    `Source: ${source.name} | ${source.id}`,
    `Target: ${target.name} | ${target.id}`,
    `Deactivate India: ${deactivateOldLocation}`,
    '',
    `Products inspected: ${summary.productsInspected}`,
    `Variants inspected: ${summary.variantsInspected}`,
    `Already correct: ${summary.alreadyCorrect}`,
    `Moved (positive stock): ${summary.moved}`,
    `Activated zero-stock at Riyadh: ${summary.activatedZero}`,
    `Skipped: ${summary.skipped}`,
    `Ambiguous: ${summary.ambiguous}`,
    `Failed: ${summary.failed}`,
    `Total available migrated: ${summary.totalAvailableMigrated}`,
    `Total on_hand migrated: ${summary.totalOnHandMigrated}`,
    `India levels deactivated: ${summary.deactivatedIndia}`,
    '',
    failed.length
      ? `Failures:\n${failed
          .map((i) => `  - ${i.productTitle} ${i.variantId}: ${i.error}`)
          .join('\n')}`
      : 'Failures: none',
  ].join('\n');
}

export type VerificationReport = {
  checked: number;
  matched: number;
  mismatched: ItemPlan[];
  remainingIndiaAvailable: number;
  remainingIndiaOnHand: number;
  remainingIndiaPositiveVariants: number;
};

export function formatVerificationReport(report: VerificationReport): string {
  return [
    '=== Post-migration verification (read-only) ===',
    `Variants re-checked: ${report.checked}`,
    `BEFORE India available == AFTER Riyadh available: ${report.matched}/${report.checked}`,
    `Remaining India available (sum): ${report.remainingIndiaAvailable}`,
    `Remaining India on_hand (sum): ${report.remainingIndiaOnHand}`,
    `Variants still with India stock > 0: ${report.remainingIndiaPositiveVariants}`,
    report.mismatched.length
      ? `Mismatches:\n${report.mismatched
          .slice(0, 20)
          .map(
            (i) =>
              `  - ${i.productTitle}: India=${i.indiaAvailable} Riyadh=${i.riyadhAvailable} (${i.reason})`
          )
          .join('\n')}`
      : 'Mismatches: none',
  ].join('\n');
}
