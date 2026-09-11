import type { Product } from '@/types/database';
import {
  buildBaseHandleSlug,
  buildShopifyHandle,
  collectImageUrls,
  validateProductForMigration,
  type ProductValidationIssue,
} from './mapping';

export type ShopifyProductLinkRow = {
  supabase_product_id: string;
  shopify_product_id: string;
  shopify_variant_id: string;
  created_at?: string;
  updated_at?: string;
};

export type DryRunReport = {
  generatedAt: string;
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  eligibleForMigration: number;
  alreadyMapped: number;
  wouldCreate: number;
  wouldSkipMapped: number;
  validationErrorCount: number;
  duplicateNames: { name: string; count: number; productIds: string[] }[];
  categories: Record<string, number>;
  withImages: number;
  missingImages: number;
  inventory: {
    zero: number;
    positive: number;
    max: number;
    totalUnits: number;
  };
  withPrice: number;
  withCompareAtPrice: number;
  handlesRequiringUniquenessSuffix: number;
  sampleHandles: { id: string; name: string; handle: string }[];
  validationErrors: ProductValidationIssue[];
  notes: string[];
};

export function buildDryRunReport(
  products: Product[],
  existingLinks: ShopifyProductLinkRow[]
): DryRunReport {
  const mappedIds = new Set(existingLinks.map((l) => l.supabase_product_id));
  const nameBuckets = new Map<string, string[]>();
  const baseSlugBuckets = new Map<string, string[]>();
  const categories: Record<string, number> = {};

  let withImages = 0;
  let missingImages = 0;
  let inventoryZero = 0;
  let inventoryPositive = 0;
  let inventoryMax = 0;
  let inventoryTotal = 0;
  let withPrice = 0;
  let withCompareAt = 0;
  const validationErrors: ProductValidationIssue[] = [];
  const sampleHandles: DryRunReport['sampleHandles'] = [];

  for (const p of products) {
    const nameKey = p.name.trim().toLowerCase();
    const ids = nameBuckets.get(nameKey) ?? [];
    ids.push(p.id);
    nameBuckets.set(nameKey, ids);

    const base = buildBaseHandleSlug(p.name);
    const baseIds = baseSlugBuckets.get(base) ?? [];
    baseIds.push(p.id);
    baseSlugBuckets.set(base, baseIds);

    categories[p.category] = (categories[p.category] ?? 0) + 1;

    const images = collectImageUrls(p);
    if (images.length > 0) withImages += 1;
    else missingImages += 1;

    const qty = Number(p.stock_quantity) || 0;
    inventoryTotal += qty;
    inventoryMax = Math.max(inventoryMax, qty);
    if (qty > 0) inventoryPositive += 1;
    else inventoryZero += 1;

    if (p.price != null && !Number.isNaN(Number(p.price))) withPrice += 1;
    if (p.compare_at_price != null && !Number.isNaN(Number(p.compare_at_price))) {
      withCompareAt += 1;
    }

    const issues = validateProductForMigration(p);
    if (issues.length) {
      validationErrors.push({
        productId: p.id,
        name: p.name,
        messages: issues,
      });
    }

    if (sampleHandles.length < 8) {
      sampleHandles.push({
        id: p.id,
        name: p.name,
        handle: buildShopifyHandle(p),
      });
    }
  }

  const duplicateNames = Array.from(nameBuckets.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([name, productIds]) => ({
      name,
      count: productIds.length,
      productIds,
    }))
    .sort((a, b) => b.count - a.count);

  const handlesRequiringUniquenessSuffix = Array.from(baseSlugBuckets.values()).filter(
    (ids) => ids.length > 1
  ).length;

  const alreadyMapped = products.filter((p) => mappedIds.has(p.id)).length;
  const validationErrorIds = new Set(validationErrors.map((v) => v.productId));
  const eligible = products.filter(
    (p) => !mappedIds.has(p.id) && !validationErrorIds.has(p.id)
  );
  const activeProducts = products.filter((p) => p.is_active).length;
  const inactiveProducts = products.length - activeProducts;

  return {
    generatedAt: new Date().toISOString(),
    totalProducts: products.length,
    activeProducts,
    inactiveProducts,
    eligibleForMigration: eligible.length,
    alreadyMapped,
    wouldCreate: eligible.length,
    wouldSkipMapped: alreadyMapped,
    validationErrorCount: validationErrors.length,
    duplicateNames,
    categories,
    withImages,
    missingImages,
    inventory: {
      zero: inventoryZero,
      positive: inventoryPositive,
      max: inventoryMax,
      totalUnits: inventoryTotal,
    },
    withPrice,
    withCompareAtPrice: withCompareAt,
    handlesRequiringUniquenessSuffix,
    sampleHandles,
    validationErrors,
    notes: [
      'Dry run performs NO Shopify writes.',
      'Service-role reads include inactive products; anon RLS only exposes is_active=true (historically 210).',
      'Inactive products migrate as Shopify DRAFT; active as ACTIVE (+ Online Store publish when possible).',
      'Duplicate product names are preserved as separate Shopify products.',
      'Contact lenses remain under existing category values (no recategorization).',
      'Handles always include a deterministic Supabase-id suffix for uniqueness.',
      'Empty benefits / null cost_price are not invented.',
      'Legacy public.products rows are not modified or deleted.',
    ],
  };
}

export function formatDryRunReport(report: DryRunReport): string {
  const lines: string[] = [];
  lines.push('=== Supabase → Shopify product migration DRY RUN ===');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(`Total products:              ${report.totalProducts}`);
  lines.push(`  active (is_active=true):   ${report.activeProducts}`);
  lines.push(`  inactive (is_active=false):${report.inactiveProducts}`);
  lines.push(`Already mapped (skip):       ${report.alreadyMapped}`);
  lines.push(`Eligible to create:          ${report.eligibleForMigration}`);
  lines.push(`Validation errors:           ${report.validationErrorCount}`);
  lines.push('');
  lines.push('Categories:');
  for (const [cat, count] of Object.entries(report.categories).sort()) {
    lines.push(`  - ${cat}: ${count}`);
  }
  lines.push('');
  lines.push(`With images:                 ${report.withImages}`);
  lines.push(`Missing images:              ${report.missingImages}`);
  lines.push(
    `Inventory: zero=${report.inventory.zero}, positive=${report.inventory.positive}, max=${report.inventory.max}, totalUnits=${report.inventory.totalUnits}`
  );
  lines.push(`With price:                  ${report.withPrice}`);
  lines.push(`With compare-at price:       ${report.withCompareAtPrice}`);
  lines.push(
    `Base-handle collisions (need unique suffix): ${report.handlesRequiringUniquenessSuffix}`
  );
  lines.push('');
  if (report.duplicateNames.length) {
    lines.push('Duplicate names (kept as separate products):');
    for (const d of report.duplicateNames) {
      lines.push(`  - "${d.name}" × ${d.count} (${d.productIds.join(', ')})`);
    }
  } else {
    lines.push('Duplicate names: none');
  }
  lines.push('');
  lines.push('Sample handles:');
  for (const s of report.sampleHandles) {
    lines.push(`  - ${s.handle}  ← ${s.name}`);
  }
  if (report.validationErrors.length) {
    lines.push('');
    lines.push('Validation errors:');
    for (const err of report.validationErrors) {
      lines.push(`  - ${err.productId} (${err.name}): ${err.messages.join('; ')}`);
    }
  }
  lines.push('');
  lines.push('Notes:');
  for (const n of report.notes) lines.push(`  - ${n}`);
  return lines.join('\n');
}
