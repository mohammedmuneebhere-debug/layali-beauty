import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchProductPublicationState,
  publishProductToLayaliChannels,
  resolveLayaliStorePublications,
  type PublishProductChannelsResult,
} from '@/lib/shopify/admin-products';
import { fetchShopifyProductLinks, type MigrationLogger } from './migrate';

/**
 * Fixed fixtures from the 2-product migration test.
 * Publish-only reconciliation — never create/delete products.
 */
export const PUBLISH_TEST_FIXTURES = [
  {
    supabaseProductId: 'fd844fbc-cd11-450a-9b77-b572792529ab',
    shopifyProductId: 'gid://shopify/Product/9655529275636',
    name: 'Isntree Ultra-Low Molecular Hyaluronic Acid Toner (300ml)',
  },
  {
    supabaseProductId: '092a7789-0bf5-43eb-89fb-a938635b9d5b',
    shopifyProductId: 'gid://shopify/Product/9655529406708',
    name: 'Isntree Hyaluronic Acid Toner Plus (200ml)',
  },
] as const;

export type PublishTestFixtureResult = {
  supabaseProductId: string;
  shopifyProductId: string;
  name: string;
  status: 'published' | 'partial' | 'already_published' | 'failed' | 'mapping_mismatch';
  mappingOk: boolean;
  beforePublications: string[];
  publication?: PublishProductChannelsResult;
  error?: string;
};

export type PublishTestSummary = {
  fixtures: number;
  succeeded: number;
  failed: number;
  results: PublishTestFixtureResult[];
};

/**
 * Publish ONLY the two existing test products to Online Store + Headless.
 * Does not create, update, or delete Shopify products (publication state only).
 * Does not modify public.products.
 */
export async function publishTestFixtures(options: {
  supabase: SupabaseClient;
  logger?: MigrationLogger;
}): Promise<PublishTestSummary> {
  const log = options.logger ?? console.log;
  const links = await fetchShopifyProductLinks(options.supabase);
  const linkBySupabase = new Map(
    links.map((l) => [l.supabase_product_id, l] as const)
  );

  const publications = await resolveLayaliStorePublications();
  log(
    `Resolved publications: Online Store=${publications.onlineStore?.name ?? 'MISSING'} (${publications.onlineStore?.id ?? 'n/a'}), Headless=${publications.headless?.name ?? 'MISSING'} (${publications.headless?.id ?? 'n/a'})`
  );

  if (!publications.onlineStore && !publications.headless) {
    throw new Error(
      'Could not resolve Online Store or Headless publications. Ensure read_publications is granted.'
    );
  }

  const results: PublishTestFixtureResult[] = [];

  for (const fixture of PUBLISH_TEST_FIXTURES) {
    const link = linkBySupabase.get(fixture.supabaseProductId);
    if (!link || link.shopify_product_id !== fixture.shopifyProductId) {
      results.push({
        supabaseProductId: fixture.supabaseProductId,
        shopifyProductId: fixture.shopifyProductId,
        name: fixture.name,
        status: 'mapping_mismatch',
        mappingOk: false,
        beforePublications: [],
        error: link
          ? `shopify_product_links has ${link.shopify_product_id}, expected ${fixture.shopifyProductId}`
          : 'Missing shopify_product_links row for this Supabase product',
      });
      log(
        `[fail] ${fixture.name}: mapping mismatch — refusing to publish`
      );
      continue;
    }

    try {
      const before = await fetchProductPublicationState(fixture.shopifyProductId);
      const beforeNames = before.publications
        .filter((p) => p.isPublished)
        .map((p) => p.name);

      log(
        `[reconcile] ${fixture.name} (${fixture.shopifyProductId}) status=${before.status} currentlyPublished=[${beforeNames.join(', ') || 'none'}]`
      );

      const publication = await publishProductToLayaliChannels(
        fixture.shopifyProductId,
        { publications }
      );

      for (const r of publication.results) {
        if (r.status === 'published') {
          log(`  [published] ${r.publicationName} (${r.channel})`);
        } else if (r.status === 'already_published') {
          log(`  [already] ${r.publicationName} (${r.channel})`);
        } else if (r.status === 'failed') {
          log(`  [fail] ${r.publicationName}: ${r.error}`);
        } else {
          log(`  [warn] ${r.channel}: ${r.error}`);
        }
      }

      const allOk =
        publication.failedCount === 0 &&
        publication.results.every(
          (r) =>
            r.status === 'published' ||
            r.status === 'already_published'
        );
      const allAlready =
        publication.alreadyPublishedCount > 0 &&
        publication.publishedCount === 0 &&
        publication.failedCount === 0 &&
        publication.results.every(
          (r) =>
            r.status === 'already_published' ||
            r.status === 'skipped_missing_publication'
        );

      let status: PublishTestFixtureResult['status'];
      if (allAlready) status = 'already_published';
      else if (allOk) status = 'published';
      else if (publication.publishedCount > 0 || publication.alreadyPublishedCount > 0)
        status = 'partial';
      else status = 'failed';

      results.push({
        supabaseProductId: fixture.supabaseProductId,
        shopifyProductId: fixture.shopifyProductId,
        name: fixture.name,
        status,
        mappingOk: true,
        beforePublications: beforeNames,
        publication,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({
        supabaseProductId: fixture.supabaseProductId,
        shopifyProductId: fixture.shopifyProductId,
        name: fixture.name,
        status: 'failed',
        mappingOk: true,
        beforePublications: [],
        error,
      });
      log(`[fail] ${fixture.name}: ${error}`);
    }
  }

  const failed = results.filter(
    (r) => r.status === 'failed' || r.status === 'mapping_mismatch' || r.status === 'partial'
  ).length;
  const succeeded = results.length - failed;

  log('');
  log('=== Publish-test summary ===');
  log(`Fixtures:   ${results.length}`);
  log(`Succeeded:  ${succeeded}`);
  log(`Failed:     ${failed}`);

  return { fixtures: results.length, succeeded, failed, results };
}

export function formatPublishTestSummary(summary: PublishTestSummary): string {
  const lines = [
    '=== Publish-test RESULT (publication only; no product creates) ===',
    `Fixtures:   ${summary.fixtures}`,
    `Succeeded:  ${summary.succeeded}`,
    `Failed:     ${summary.failed}`,
  ];
  for (const r of summary.results) {
    lines.push(
      `- ${r.name}: ${r.status}` +
        (r.error ? ` — ${r.error}` : '') +
        (r.publication
          ? ` [${r.publication.results.map((x) => `${x.channel}=${x.status}`).join(', ')}]`
          : '')
    );
  }
  return lines.join('\n');
}
