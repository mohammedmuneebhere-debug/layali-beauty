import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { isShopifyAdminConfigured } from '@/lib/shopify/admin';
import {
  buildDryRunReport,
  fetchLegacyProducts,
  fetchShopifyProductLinks,
  formatDryRunReport,
  formatMigrationSummary,
  runProductMigration,
} from '@/lib/migration/products-to-shopify';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { supabase, user };
}

/**
 * GET — dry-run migration report (no Shopify writes).
 * Admin session required.
 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const reader = hasServiceRoleKey()
      ? createServiceClient()
      : (await createClient());

    const products = await fetchLegacyProducts(reader);
    const links = await fetchShopifyProductLinks(reader);
    const report = buildDryRunReport(products, links);

    return NextResponse.json({
      ok: true,
      mode: 'dry-run',
      adminConfigured: isShopifyAdminConfigured(),
      report,
      text: formatDryRunReport(report),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Dry-run failed' },
      { status: 500 }
    );
  }
}

/**
 * POST — execute migration. Requires admin session + intentional confirm body.
 * Body: { "confirm": "MIGRATE_PRODUCTS", "limit"?: number }
 *
 * Prefer the CLI for the full 210-product run (avoids HTTP timeouts).
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  let body: { confirm?: string; limit?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.confirm !== 'MIGRATE_PRODUCTS') {
    return NextResponse.json(
      {
        error:
          'Refusing to execute. Send { "confirm": "MIGRATE_PRODUCTS" } intentionally.',
      },
      { status: 400 }
    );
  }

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY is required on the server to write shopify_product_links',
      },
      { status: 500 }
    );
  }

  if (!isShopifyAdminConfigured()) {
    return NextResponse.json(
      { error: 'Shopify Admin credentials are not configured' },
      { status: 500 }
    );
  }

  let limit: number | undefined;
  if (body.limit !== undefined) {
    if (
      typeof body.limit !== 'number' ||
      !Number.isInteger(body.limit) ||
      body.limit < 1 ||
      !Number.isFinite(body.limit)
    ) {
      return NextResponse.json(
        {
          error:
            'limit must be a positive integer >= 1 when provided (omit limit for full catalog)',
        },
        { status: 400 }
      );
    }
    limit = body.limit;
  }

  try {
    const logs: string[] = [];
    const summary = await runProductMigration({
      supabase: createServiceClient(),
      limit,
      logger: (msg) => logs.push(msg),
    });

    return NextResponse.json({
      ok: summary.failed === 0,
      mode: 'execute',
      summary,
      text: formatMigrationSummary(summary),
      logs,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
