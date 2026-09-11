/**
 * Supabase → Shopify product migration CLI.
 *
 * Dry run (no Shopify writes):
 *   npm run migrate:products:dry-run
 *
 * Execute (intentional; confirm is already included by the npm script):
 *   npm run migrate:products:execute
 *
 * Do NOT append another --confirm=MIGRATE_PRODUCTS when using the npm script.
 * Optional: npm run migrate:products:execute -- --limit=N
 *
 * Direct script invocation (not via npm script) still requires:
 *   ... scripts/migrate-products-to-shopify.mts --execute --confirm=MIGRATE_PRODUCTS
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildDryRunReport,
  formatDryRunReport,
  fetchLegacyProducts,
  fetchShopifyProductLinks,
  runProductMigration,
  formatMigrationSummary,
} from '../src/lib/migration/products-to-shopify/index';
import { isShopifyAdminConfigured } from '../src/lib/shopify/admin';

function loadEnvFile(): void {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  // Node 20.12+
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(path);
  }
}

function parsePositiveIntLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;

  // Reject decimals / non-integers before Number() coercion quirks.
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(
      `--limit must be a positive integer (received "${raw}"). Omit --limit to migrate the full catalog.`
    );
  }

  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      `--limit must be a positive integer >= 1 (received "${raw}"). Omit --limit to migrate the full catalog.`
    );
  }

  return parsed;
}

function parseArgs(argv: string[]) {
  const get = (name: string): string | undefined => {
    const hits = argv.filter((a) => a.startsWith(`${name}=`));
    if (hits.length === 0) return undefined;
    // Prefer the last occurrence if the flag was passed more than once.
    return hits[hits.length - 1]!.slice(name.length + 1);
  };
  return {
    dryRun: argv.includes('--dry-run'),
    execute: argv.includes('--execute'),
    confirm: get('--confirm'),
    limit: parsePositiveIntLimit(get('--limit')),
  };
}

function createAnonOrServiceClient(): { client: SupabaseClient; mode: 'service' | 'anon' } {
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

async function main() {
  loadEnvFile();

  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  if (!args.dryRun && !args.execute) {
    console.error(
      'Specify --dry-run or --execute --confirm=MIGRATE_PRODUCTS'
    );
    process.exitCode = 1;
    return;
  }

  if (args.dryRun && args.execute) {
    console.error('Choose either --dry-run or --execute, not both');
    process.exitCode = 1;
    return;
  }

  const { client, mode } = createAnonOrServiceClient();
  console.log(`Supabase client mode: ${mode}`);

  if (args.dryRun) {
    const products = await fetchLegacyProducts(client);
    const links = await fetchShopifyProductLinks(client);
    if (mode === 'anon') {
      console.log(
        'Note: using anon key — shopify_product_links may be empty/invisible under RLS; use SUPABASE_SERVICE_ROLE_KEY for accurate already-mapped counts.\n'
      );
    }
    const report = buildDryRunReport(products, links);
    console.log(formatDryRunReport(report));
    console.log('\nAdmin credentials configured:', isShopifyAdminConfigured());
    return;
  }

  if (args.confirm !== 'MIGRATE_PRODUCTS') {
    console.error(
      'Refusing to execute. Pass --confirm=MIGRATE_PRODUCTS to run the real migration.'
    );
    process.exitCode = 1;
    return;
  }

  if (mode !== 'service') {
    console.error(
      'Execute mode requires SUPABASE_SERVICE_ROLE_KEY so shopify_product_links can be written.'
    );
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

  const summary = await runProductMigration({
    supabase: client,
    limit: args.limit,
    logger: (msg) => console.log(msg),
  });

  console.log('');
  console.log(formatMigrationSummary(summary));
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
