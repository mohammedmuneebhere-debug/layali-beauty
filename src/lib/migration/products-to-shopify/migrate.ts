import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/database';
import {
  createShopifyProductViaProductSet,
  findShopifyProductByHandle,
  migrationPace,
  publishProductToLayaliChannels,
  resolvePrimaryLocationId,
  resolveLayaliStorePublications,
  type LayaliStorePublications,
  type ProductSetCreateInput,
  type PublishProductChannelsResult,
} from '@/lib/shopify/admin-products';
import {
  buildProductTags,
  buildShopifyHandle,
  collectImageUrls,
  formatShopifyPrice,
  toDescriptionHtml,
  validateProductForMigration,
} from './mapping';
import type { ShopifyProductLinkRow } from './dry-run';

export type MigrationLogger = (message: string) => void;

export type ProductMigrationResult =
  | {
      status: 'created';
      supabaseProductId: string;
      shopifyProductId: string;
      shopifyVariantId: string;
      handle: string;
      publication?: PublishProductChannelsResult;
    }
  | {
      status: 'skipped';
      supabaseProductId: string;
      reason: string;
      shopifyProductId?: string;
      shopifyVariantId?: string;
      publication?: PublishProductChannelsResult;
    }
  | {
      status: 'failed';
      supabaseProductId: string;
      name: string;
      error: string;
    };

export type MigrationSummary = {
  created: number;
  skipped: number;
  failed: number;
  mappingCount: number;
  results: ProductMigrationResult[];
  failures: { supabaseProductId: string; name: string; error: string }[];
};

const PAGE_SIZE = 200;

export async function fetchLegacyProducts(
  supabase: SupabaseClient
): Promise<Product[]> {
  const all: Product[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load products: ${error.message}`);
    const rows = (data ?? []) as Product[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

export async function fetchShopifyProductLinks(
  supabase: SupabaseClient
): Promise<ShopifyProductLinkRow[]> {
  const { data, error } = await supabase
    .from('shopify_product_links')
    .select('supabase_product_id, shopify_product_id, shopify_variant_id, created_at, updated_at');

  if (error) {
    // Table may not exist yet in local env before SQL is applied
    if (/does not exist|Could not find the table/i.test(error.message)) {
      return [];
    }
    throw new Error(`Failed to load shopify_product_links: ${error.message}`);
  }

  return (data ?? []) as ShopifyProductLinkRow[];
}

function buildMetafields(product: Product): ProductSetCreateInput['metafields'] {
  const metafields: NonNullable<ProductSetCreateInput['metafields']> = [
    {
      namespace: 'layali',
      key: 'supabase_product_id',
      type: 'single_line_text_field',
      value: product.id,
    },
  ];

  if (product.gender) {
    metafields.push({
      namespace: 'layali',
      key: 'gender',
      type: 'single_line_text_field',
      value: product.gender,
    });
  }

  metafields.push({
    namespace: 'layali',
    key: 'is_featured',
    type: 'boolean',
    value: product.is_featured ? 'true' : 'false',
  });

  if (product.ingredients?.trim()) {
    metafields.push({
      namespace: 'layali',
      key: 'ingredients',
      type: 'multi_line_text_field',
      value: product.ingredients.trim(),
    });
  }

  if (Array.isArray(product.benefits) && product.benefits.length > 0) {
    metafields.push({
      namespace: 'layali',
      key: 'benefits',
      type: 'json',
      value: JSON.stringify(product.benefits),
    });
  }

  return metafields;
}

function buildProductSetInput(
  product: Product,
  locationId: string
): ProductSetCreateInput {
  const images = collectImageUrls(product);
  const compareAt =
    product.compare_at_price != null && !Number.isNaN(Number(product.compare_at_price))
      ? formatShopifyPrice(Number(product.compare_at_price))
      : null;

  return {
    title: product.name.trim(),
    descriptionHtml: toDescriptionHtml(product.description),
    handle: buildShopifyHandle(product),
    productType: product.category,
    status: product.is_active ? 'ACTIVE' : 'DRAFT',
    tags: buildProductTags(product),
    files: images.map((url, index) => ({
      originalSource: url,
      alt: `${product.name}${index === 0 ? '' : ` ${index + 1}`}`,
      contentType: 'IMAGE' as const,
    })),
    metafields: buildMetafields(product),
    variants: [
      {
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        price: formatShopifyPrice(Number(product.price)),
        compareAtPrice: compareAt,
        inventoryItem: { tracked: true },
        inventoryQuantities: [
          {
            locationId,
            name: 'available',
            quantity: Math.max(0, Math.floor(Number(product.stock_quantity) || 0)),
          },
        ],
      },
    ],
  };
}

async function upsertProductLink(
  supabase: SupabaseClient,
  row: {
    supabase_product_id: string;
    shopify_product_id: string;
    shopify_variant_id: string;
  }
): Promise<void> {
  const { error } = await supabase.from('shopify_product_links').upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'supabase_product_id' }
  );

  if (error) {
    throw new Error(`Failed to upsert shopify_product_links: ${error.message}`);
  }
}

export type RunMigrationOptions = {
  supabase: SupabaseClient;
  /** When true, do not write to Shopify or mapping table. */
  dryRun?: boolean;
  limit?: number;
  logger?: MigrationLogger;
  locationId?: string | null;
};

export async function runProductMigration(
  options: RunMigrationOptions
): Promise<MigrationSummary> {
  const log = options.logger ?? console.log;
  const products = await fetchLegacyProducts(options.supabase);
  const links = await fetchShopifyProductLinks(options.supabase);
  const mapped = new Map(links.map((l) => [l.supabase_product_id, l]));

  // Limit applies to unmapped products so incremental --limit batches make progress.
  const unmapped = products.filter((p) => !mapped.has(p.id));
  const targets =
    typeof options.limit === 'number' ? unmapped.slice(0, options.limit) : products;

  if (options.dryRun) {
    throw new Error('runProductMigration does not perform dry-run; use buildDryRunReport');
  }

  const locationId = await resolvePrimaryLocationId(options.locationId);
  let storePublications: LayaliStorePublications | null = null;
  try {
    storePublications = await resolveLayaliStorePublications();
    log(
      `Publications: Online Store=${storePublications.onlineStore?.name ?? 'MISSING'} (${storePublications.onlineStore?.id ?? 'n/a'}), Headless=${storePublications.headless?.name ?? 'MISSING'} (${storePublications.headless?.id ?? 'n/a'})`
    );
  } catch (err) {
    log(
      `Warning: could not resolve store publications (${err instanceof Error ? err.message : String(err)}). Products will remain channel-unpublished.`
    );
  }

  log(`Migrating up to ${targets.length} products (location=${locationId})…`);

  const results: ProductMigrationResult[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  const attemptPublish = async (
    productId: string,
    isActive: boolean,
    context: string
  ): Promise<PublishProductChannelsResult | undefined> => {
    if (!isActive) return undefined;
    if (!storePublications) {
      log(`[warn] publish skipped for ${context}: publications not resolved`);
      return undefined;
    }
    try {
      const publication = await publishProductToLayaliChannels(productId, {
        publications: storePublications,
      });
      for (const r of publication.results) {
        if (r.status === 'published') {
          log(`[publish] ${context} → ${r.publicationName} (${r.channel})`);
        } else if (r.status === 'already_published') {
          log(`[publish/skip] ${context} already on ${r.publicationName}`);
        } else if (r.status === 'failed') {
          log(`[publish/fail] ${context} ${r.publicationName}: ${r.error}`);
        } else {
          log(`[publish/warn] ${context} ${r.channel}: ${r.error}`);
        }
      }
      return publication;
    } catch (pubErr) {
      log(
        `[publish/fail] ${context}: ${pubErr instanceof Error ? pubErr.message : String(pubErr)}`
      );
      return undefined;
    }
  };

  for (const product of targets) {
    const existing = mapped.get(product.id);
    if (existing) {
      skipped += 1;
      const result: ProductMigrationResult = {
        status: 'skipped',
        supabaseProductId: product.id,
        reason: 'already mapped in shopify_product_links',
        shopifyProductId: existing.shopify_product_id,
        shopifyVariantId: existing.shopify_variant_id,
      };
      results.push(result);
      log(`[skip] ${product.id} ${product.name}`);
      continue;
    }

    const validation = validateProductForMigration(product);
    if (validation.length) {
      failed += 1;
      const result: ProductMigrationResult = {
        status: 'failed',
        supabaseProductId: product.id,
        name: product.name,
        error: validation.join('; '),
      };
      results.push(result);
      log(`[fail] ${product.id} ${product.name} — ${result.error}`);
      continue;
    }

    const handle = buildShopifyHandle(product);

    try {
      // Secondary idempotency: recover mapping if Shopify product exists but link row missing
      const byHandle = await findShopifyProductByHandle(handle);
      if (byHandle?.id && byHandle.variantId) {
        await upsertProductLink(options.supabase, {
          supabase_product_id: product.id,
          shopify_product_id: byHandle.id,
          shopify_variant_id: byHandle.variantId,
        });
        mapped.set(product.id, {
          supabase_product_id: product.id,
          shopify_product_id: byHandle.id,
          shopify_variant_id: byHandle.variantId,
        });
        const publication = await attemptPublish(
          byHandle.id,
          product.is_active,
          `${product.id} ${product.name}`
        );
        skipped += 1;
        results.push({
          status: 'skipped',
          supabaseProductId: product.id,
          reason: 'found existing Shopify product by handle; mapping restored',
          shopifyProductId: byHandle.id,
          shopifyVariantId: byHandle.variantId,
          publication,
        });
        log(`[skip/recover] ${product.id} ${product.name} → ${byHandle.id}`);
        await migrationPace();
        continue;
      }

      const input = buildProductSetInput(product, locationId);
      let createdProduct;
      try {
        createdProduct = await createShopifyProductViaProductSet(input);
      } catch (createErr) {
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        // Metafield definitions may be missing on a fresh shop — retry without metafields.
        if (/metafield/i.test(msg) && input.metafields?.length) {
          log(`[warn] metafields rejected for ${product.id}; retrying without metafields`);
          createdProduct = await createShopifyProductViaProductSet({
            ...input,
            metafields: undefined,
          });
        } else {
          throw createErr;
        }
      }

      await upsertProductLink(options.supabase, {
        supabase_product_id: product.id,
        shopify_product_id: createdProduct.productId,
        shopify_variant_id: createdProduct.variantId,
      });

      mapped.set(product.id, {
        supabase_product_id: product.id,
        shopify_product_id: createdProduct.productId,
        shopify_variant_id: createdProduct.variantId,
      });

      const publication = await attemptPublish(
        createdProduct.productId,
        product.is_active,
        `${product.id} ${product.name}`
      );

      created += 1;
      results.push({
        status: 'created',
        supabaseProductId: product.id,
        shopifyProductId: createdProduct.productId,
        shopifyVariantId: createdProduct.variantId,
        handle: createdProduct.handle,
        publication,
      });
      log(
        `[created] ${product.id} ${product.name} → ${createdProduct.productId} (${createdProduct.handle})`
      );

      await migrationPace();
    } catch (err) {
      failed += 1;
      const error = err instanceof Error ? err.message : String(err);
      results.push({
        status: 'failed',
        supabaseProductId: product.id,
        name: product.name,
        error,
      });
      log(`[fail] ${product.id} ${product.name} — ${error}`);
      await migrationPace();
    }
  }

  const mappingCount = (await fetchShopifyProductLinks(options.supabase)).length;
  const failures = results
    .filter((r): r is Extract<ProductMigrationResult, { status: 'failed' }> => r.status === 'failed')
    .map((r) => ({
      supabaseProductId: r.supabaseProductId,
      name: r.name,
      error: r.error,
    }));

  log('');
  log('=== Migration summary ===');
  log(`Created:  ${created}`);
  log(`Skipped:  ${skipped}`);
  log(`Failed:   ${failed}`);
  log(`Mappings: ${mappingCount}`);
  if (failures.length) {
    log('Failures:');
    for (const f of failures) {
      log(`  - ${f.supabaseProductId} (${f.name}): ${f.error}`);
    }
  }

  return { created, skipped, failed, mappingCount, results, failures };
}

export function formatMigrationSummary(summary: MigrationSummary): string {
  const lines = [
    '=== Supabase → Shopify product migration RESULT ===',
    `Created:  ${summary.created}`,
    `Skipped:  ${summary.skipped}`,
    `Failed:   ${summary.failed}`,
    `Mappings: ${summary.mappingCount}`,
  ];
  if (summary.failures.length) {
    lines.push('Detailed failures:');
    for (const f of summary.failures) {
      lines.push(`  - ${f.supabaseProductId} (${f.name}): ${f.error}`);
    }
  }
  return lines.join('\n');
}
