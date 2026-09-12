/**
 * India → Riyadh inventory location migration CLI.
 *
 * Dry run (zero Shopify mutations):
 *   npm run migrate:inventory:dry-run
 *
 * Execute:
 *   npm run migrate:inventory:execute -- --confirm=MOVE_INVENTORY_TO_RIYADH
 *
 * Optional India deactivation (NOT default):
 *   npm run migrate:inventory:execute -- --confirm=MOVE_INVENTORY_TO_RIYADH --deactivate-old-location
 *
 * Positive Hyderabad stock → activate/set at Riyadh with same available qty.
 * Zero Hyderabad stock → activate at Riyadh with available=0.
 * India levels are left active unless --deactivate-old-location is passed.
 * Target matching prefers address: Ibn Ayaaz Al Kinani, Al Olaya, Riyadh.
 * Does NOT modify cart, products, prices, or Supabase product data.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetchShopifyProductLinks } from '../src/lib/migration/products-to-shopify/migrate';
import {
  checkInventoryMigrationScopes,
  discoverAllLocations,
  findIndiaCandidates,
  findSaudiRiyadhCandidates,
  formatDryRunSummary,
  formatExecuteSummary,
  formatLocationsReport,
  formatVerificationReport,
  pickRiyadhTarget,
  planAndOptionallyMigrate,
  verifyMigration,
} from '../src/lib/migration/inventory-to-riyadh/index';
import { isShopifyAdminConfigured } from '../src/lib/shopify/admin';

const CONFIRM_TOKEN = 'MOVE_INVENTORY_TO_RIYADH';

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
    deactivateOldLocation: argv.includes('--deactivate-old-location'),
    verifyOnly: argv.includes('--verify-only'),
  };
}

function createSupabaseClient(): { client: SupabaseClient; mode: 'service' | 'anon' } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');

  if (serviceKey) {
    return {
      mode: 'service',
      client: createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  }

  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY is required');
  }

  return {
    mode: 'anon',
    client: createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

function pickIndiaSource(candidates: Awaited<ReturnType<typeof discoverAllLocations>>) {
  if (candidates.length === 1) return candidates[0]!;
  if (candidates.length > 1) {
    const withInv = candidates.filter((c) => c.hasActiveInventory && c.isActive);
    if (withInv.length === 1) return withInv[0]!;
    return null;
  }
  return null;
}

async function main() {
  loadEnvFile();

  const args = parseArgs(process.argv.slice(2));

  if (!args.dryRun && !args.execute && !args.verifyOnly) {
    console.error(
      'Specify --dry-run, --execute --confirm=MOVE_INVENTORY_TO_RIYADH, or --verify-only'
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

  console.log('Discovering Shopify locations…');
  const locations = await discoverAllLocations();
  console.log(formatLocationsReport(locations));
  console.log('');

  const saudiCandidates = findSaudiRiyadhCandidates(locations);
  console.log(
    `Saudi/Riyadh candidates (${saudiCandidates.length}):`,
    saudiCandidates.map((l) => l.name).join(', ') || 'none'
  );

  const target = pickRiyadhTarget(saudiCandidates);
  if (!target) {
    console.error('');
    console.error(
      'STOP: Could not uniquely resolve Riyadh target matching "Ibn Ayaaz Al Kinani, Al Olaya, Riyadh".'
    );
    console.error(
      'Available locations listed above. Do not invent a location. Create/fix the location in Shopify Admin, then re-run.'
    );
    if (saudiCandidates.length > 1) {
      console.error(
        'Multiple Saudi/Riyadh candidates — ambiguous. Prefer the Al Olaya / Ibn Ayaaz Al Kinani address.'
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Target resolved: ${target.name} | ${target.id} | city=${target.address?.city ?? '—'} | address1=${target.address?.address1 ?? '—'}`
  );

  const indiaCandidates = findIndiaCandidates(locations);
  const source = pickIndiaSource(indiaCandidates);
  if (!source) {
    console.error('');
    console.error(
      indiaCandidates.length === 0
        ? 'STOP: No India location found among Shopify locations.'
        : `STOP: Ambiguous India locations (${indiaCandidates.length}): ${indiaCandidates.map((l) => l.name).join(', ')}`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Source resolved: ${source.name} | ${source.id} | city=${source.address?.city ?? '—'} | country=${source.address?.countryCode ?? '—'}`
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
    if (scopes.missing.includes('read_inventory')) {
      console.error('read_inventory is required to discover inventory levels safely.');
    }
    process.exitCode = 1;
    return;
  }
  console.log('');

  const { client, mode } = createSupabaseClient();
  console.log(`Supabase client mode: ${mode}`);
  const links = await fetchShopifyProductLinks(client);
  if (links.length === 0) {
    console.error(
      'STOP: No rows in shopify_product_links. Nothing to migrate. (Use service role if RLS hides links.)'
    );
    process.exitCode = 1;
    return;
  }

  const variantIds = [
    ...new Set(links.map((l) => l.shopify_variant_id).filter(Boolean)),
  ];
  const productIdByVariant = new Map(
    links.map((l) => [l.shopify_variant_id, l.shopify_product_id])
  );

  console.log(
    `Mapped links: ${links.length} | unique variants: ${variantIds.length} | unique products: ${new Set(links.map((l) => l.shopify_product_id)).size}`
  );
  console.log('');

  if (args.dryRun) {
    const summary = await planAndOptionallyMigrate(variantIds, productIdByVariant, {
      sourceLocationId: source.id,
      targetLocationId: target.id,
      dryRun: true,
      deactivateOldLocation: false,
      logger: (m) => console.log(m),
    });
    console.log('');
    console.log(
      formatDryRunSummary({ source, target, scopes, summary })
    );
    return;
  }

  if (args.execute) {
    if (args.confirm !== CONFIRM_TOKEN) {
      console.error(
        `Refusing to execute. Pass --confirm=${CONFIRM_TOKEN}`
      );
      process.exitCode = 1;
      return;
    }

    if (args.deactivateOldLocation) {
      console.log(
        'NOTE: --deactivate-old-location is ON — India inventory levels will be deactivated after copy.'
      );
    } else {
      console.log(
        'NOTE: India will remain active (default). Pass --deactivate-old-location to deactivate after copy.'
      );
    }

    const summary = await planAndOptionallyMigrate(variantIds, productIdByVariant, {
      sourceLocationId: source.id,
      targetLocationId: target.id,
      dryRun: false,
      deactivateOldLocation: args.deactivateOldLocation,
      logger: (m) => console.log(m),
    });

    console.log('');
    console.log(
      formatExecuteSummary({
        source,
        target,
        summary,
        deactivateOldLocation: args.deactivateOldLocation,
      })
    );

    const expected = new Map<string, number>();
    for (const item of summary.items) {
      if (item.action === 'moved') {
        expected.set(item.variantId, item.indiaAvailable);
      } else if (item.action === 'activated_zero') {
        expected.set(item.variantId, 0);
      }
    }

    console.log('');
    console.log('Running post-migration verification…');
    const verification = await verifyMigration({
      variantIds,
      sourceLocationId: source.id,
      targetLocationId: target.id,
      expectedRiyadhAvailable: expected,
      logger: (m) => console.log(m),
    });
    console.log(formatVerificationReport(verification));

    if (summary.failed > 0) process.exitCode = 1;
    return;
  }

  if (args.verifyOnly) {
    const summary = await planAndOptionallyMigrate(variantIds, productIdByVariant, {
      sourceLocationId: source.id,
      targetLocationId: target.id,
      dryRun: true,
      deactivateOldLocation: false,
      logger: (m) => console.log(m),
    });
    const expected = new Map<string, number>();
    for (const item of summary.items) {
      if (item.indiaAvailable > 0) {
        expected.set(item.variantId, item.indiaAvailable);
      } else if (item.riyadhAvailable != null && item.riyadhAvailable > 0) {
        expected.set(item.variantId, item.riyadhAvailable);
      }
    }
    const verification = await verifyMigration({
      variantIds,
      sourceLocationId: source.id,
      targetLocationId: target.id,
      expectedRiyadhAvailable: expected,
      logger: (m) => console.log(m),
    });
    console.log(formatVerificationReport(verification));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
