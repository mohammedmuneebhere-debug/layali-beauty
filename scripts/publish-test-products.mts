/**
 * Publish-only reconciliation for the TWO existing migration test products.
 *
 * Does NOT create Shopify products.
 * Does NOT migrate the catalog.
 * Does NOT modify public.products.
 *
 * Safe command:
 *   npm run migrate:products:publish-test
 *
 * Direct invocation requires explicit confirm:
 *   ... scripts/publish-test-products.mts --confirm=PUBLISH_TEST_PRODUCTS
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { isShopifyAdminConfigured } from '../src/lib/shopify/admin';
import {
  formatPublishTestSummary,
  publishTestFixtures,
  PUBLISH_TEST_FIXTURES,
} from '../src/lib/migration/products-to-shopify/publish';

function loadEnvFile(): void {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(path);
  }
}

async function main() {
  loadEnvFile();

  const argv = process.argv.slice(2);
  if (argv.includes('--dry-run') || argv.includes('--execute') || argv.includes('--limit')) {
    console.error(
      'This command only publishes the 2 existing test products. Do not pass --dry-run, --execute, or --limit.'
    );
    process.exitCode = 1;
    return;
  }

  const confirmHit = argv.find((a) => a.startsWith('--confirm='));
  const confirm = confirmHit?.slice('--confirm='.length);
  // npm script embeds confirm; allow direct runs with the same flag.
  if (confirm !== 'PUBLISH_TEST_PRODUCTS') {
    console.error(
      'Refusing to run. Pass --confirm=PUBLISH_TEST_PRODUCTS (or use npm run migrate:products:publish-test).'
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    console.error(
      'SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required to verify shopify_product_links.'
    );
    process.exitCode = 1;
    return;
  }

  console.log('Publish-test fixtures (publication only):');
  for (const f of PUBLISH_TEST_FIXTURES) {
    console.log(`  - ${f.name}`);
    console.log(`    supabase=${f.supabaseProductId}`);
    console.log(`    shopify=${f.shopifyProductId}`);
  }
  console.log('');

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary = await publishTestFixtures({
    supabase,
    logger: (msg) => console.log(msg),
  });

  console.log('');
  console.log(formatPublishTestSummary(summary));
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
