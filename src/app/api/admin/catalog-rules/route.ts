import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/require-staff';
import { readCatalogRules, writeCatalogRules } from '@/lib/content/store';
import { saveProductRegions } from '@/lib/products';
import type { Region } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  return NextResponse.json(await readCatalogRules());
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => null)) as {
    action?: 'add-region' | 'toggle-region' | 'delete-region' | 'save-product-regions' | 'save-cost';
    country?: string;
    city?: string;
    id?: string;
    shopifyProductId?: string;
    regionIds?: string[];
    costPrice?: number | null;
  } | null;
  if (!body?.action) return NextResponse.json({ error: 'action required' }, { status: 400 });
  const rules = await readCatalogRules();

  if (body.action === 'add-region') {
    if (!body.country || !body.city) return NextResponse.json({ error: 'country and city required' }, { status: 400 });
    const region: Region = {
      id: crypto.randomUUID(),
      country: body.country,
      city: body.city,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    rules.regions.push(region);
  } else if (body.action === 'toggle-region' && body.id) {
    rules.regions = rules.regions.map((region) =>
      region.id === body.id ? { ...region, is_active: !region.is_active } : region
    );
  } else if (body.action === 'delete-region' && body.id) {
    rules.regions = rules.regions.filter((region) => region.id !== body.id);
    rules.productRegions = rules.productRegions.filter((row) => row.regionId !== body.id);
  } else if (body.action === 'save-product-regions' && body.shopifyProductId) {
    await saveProductRegions(body.shopifyProductId, body.regionIds || []);
    return NextResponse.json(await readCatalogRules());
  } else if (body.action === 'save-cost' && body.shopifyProductId) {
    rules.costs = rules.costs.filter((row) => row.shopifyProductId !== body.shopifyProductId);
    if (body.costPrice != null && Number.isFinite(body.costPrice)) {
      rules.costs.push({ shopifyProductId: body.shopifyProductId, costPrice: Number(body.costPrice) });
    }
  } else {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  await writeCatalogRules(rules);
  return NextResponse.json(rules);
}
