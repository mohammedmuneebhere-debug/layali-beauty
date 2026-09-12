/**
 * Set available quantity to 50 at Riyadh for EVERY product variant.
 *
 * Dry run (zero Shopify mutations):
 *   npm run migrate:inventory:set-50:dry-run
 *
 * Execute:
 *   npm run migrate:inventory:set-50:execute -- --confirm=SET_RIYADH_STOCK_TO_50
 *
 * - Discovers all variants via Admin product pagination (not Supabase links).
 * - Activates Riyadh inventory if needed, then inventorySetQuantities available=50.
 * - Idempotent: already 50 is skipped as already_at_target.
 * - Does NOT deactivate Hyderabad or change other locations' quantities.
 * - Does NOT modify cart, products, prices, or Supabase product data.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkInventoryMigrationScopes } from '../src/lib/migration/inventory-to-riyadh/scopes';
import {
  CONFIRM_TOKEN,
  discoverAllProductVariants,
  formatDryRunSummary,
  formatExecuteSummary,
  formatVerificationReport,
  planAndOptionallySet,
  resolveRiyadhLocation,
  RIYADH_LOCATION_ID,
  TARGET_AVAILABLE,
  verifyRiyadhStock,
} from '../src/lib/migration/inventory-set-riyadh-50/index';
import { isShopifyAdminConfigured } from '../src/lib/shopify/admin';

function loadEnvFile(): void {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(path);
  }
}

function parseArgs(argv: string[]) {
  const get = (name: string): string | undefined => {
    const hits = argv.filter((a) => a.startsWith(`${name}=`));
    if (hits.length === 0) return undefined;
    return hits[hits.length - 1]!.slice(name.length + 1);
  };
  return {
    dryRun: argv.includes('--dry-run'),
    execute: argv.includes('--execute'),
    confirm: get('--confirm'),
    verifyOnly: argv.includes('--verify-only'),
  };
}

async function main() {
  loadEnvFile();

  const args = parseArgs(process.argv.slice(2));

  if (!args.dryRun && !args.execute && !args.verifyOnly) {
    console.error(
      `Specify --dry-run, --execute --confirm=${CONFIRM_TOKEN}, or --verify-only`
    );
    process.exitCode = 1;
    return;
  }

  if (args.dryRun && args.execute) {
    console.error('Choose either --dry-run or --execute, not both');
    process.exitCode = 1;
    return;
  }

  if (!isShopifyAdminConfigured()) {
    console.error(
      'Shopify Admin credentials missing (SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET).'
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Resolving Riyadh location ${RIYADH_LOCATION_ID}…`);
  const target = await resolveRiyadhLocation();
  console.log(
    `Target: ${target.name} | ${target.id} | city=${target.address?.city ?? '—'} | address1=${target.address?.address1 ?? '—'} | active=${target.isActive}`
  );
  console.log('');

  console.log('Checking Admin scopes…');
  const scopes = await checkInventoryMigrationScopes();
  console.log(
    `Scopes: ok=${scopes.ok} granted=[${scopes.granted.join(', ')}] missing=[${scopes.missing.join(', ') || 'none'}]`
  );
  if (!scopes.ok) {
    console.error('');
    console.error(
      `STOP: Missing required Admin scopes: ${scopes.missing.join(', ')}. Grant them in the Shopify app and re-run.`
    );
    process.exitCode = 1;
    return;
  }
  console.log('');

  console.log('Discovering ALL product variants (full pagination)…');
  const discovered = await discoverAllProductVariants({
    logger: (m) => console.log(m),
  });
  const variantIds = [...new Set(discovered.map((d) => d.variantId))];
  console.log(
    `Discovered: ${discovered.length} variant rows | unique variants: ${variantIds.length} | unique products: ${new Set(discovered.map((d) => d.productId)).size}`
  );
  console.log('');

  if (variantIds.length === 0) {
    console.error('STOP: No product variants found in the shop.');
    process.exitCode = 1;
    return;
  }

  if (args.dryRun) {
    const summary = await planAndOptionallySet(variantIds, {
      locationId: RIYADH_LOCATION_ID,
      targetAvailable: TARGET_AVAILABLE,
      dryRun: true,
      logger: (m) => console.log(m),
    });
    console.log('');
    console.log(formatDryRunSummary({ target, scopes, summary }));
    return;
  }

  if (args.execute) {
    if (args.confirm !== CONFIRM_TOKEN) {
      console.error(`Refusing to execute. Pass --confirm=${CONFIRM_TOKEN}`);
      process.exitCode = 1;
      return;
    }

    console.log(
      `NOTE: Will set available=${TARGET_AVAILABLE} at ${target.name} only. Other locations untouched.`
    );

    const summary = await planAndOptionallySet(variantIds, {
      locationId: RIYADH_LOCATION_ID,
      targetAvailable: TARGET_AVAILABLE,
      dryRun: false,
      logger: (m) => console.log(m),
    });

    console.log('');
    console.log(formatExecuteSummary({ target, summary }));

    const skipNoItem = new Set(
      summary.items
        .filter((i) => i.action === 'skipped_no_inventory_item')
        .map((i) => i.variantId)
    );

    console.log('');
    console.log('Running post-set verification…');
    const verification = await verifyRiyadhStock({
      variantIds,
      locationId: RIYADH_LOCATION_ID,
      targetAvailable: TARGET_AVAILABLE,
      skipVariantIds: skipNoItem,
      logger: (m) => console.log(m),
    });
    console.log(formatVerificationReport(verification));

    if (summary.failed > 0 || verification.mismatched.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (args.verifyOnly) {
    const verification = await verifyRiyadhStock({
      variantIds,
      locationId: RIYADH_LOCATION_ID,
      targetAvailable: TARGET_AVAILABLE,
      logger: (m) => console.log(m),
    });
    console.log(formatVerificationReport(verification));
    if (verification.mismatched.length > 0) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
