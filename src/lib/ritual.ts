import type { ShopProduct } from '@/lib/catalog';

export type RitualStep = 'Cleanse' | 'Treat' | 'Moisturize' | 'Enhance' | 'Finish';

const STEP_HINTS: Record<RitualStep, string[]> = {
  Cleanse: ['cleanse', 'cleanser', 'wash', 'foam', 'micellar', 'toner'],
  Treat: ['serum', 'treat', 'essence', 'ampoule', 'retinol', 'vitamin', 'acid'],
  Moisturize: ['moistur', 'cream', 'lotion', 'hydrate', 'balm', 'oil'],
  Enhance: ['makeup', 'lipstick', 'mascara', 'foundation', 'blush', 'palette', 'liner'],
  Finish: ['fragrance', 'perfume', 'mist', 'setting', 'spray', 'scent'],
};

const CATEGORY_STEP: Record<string, RitualStep> = {
  skincare: 'Treat',
  makeup: 'Enhance',
  haircare: 'Treat',
  bodycare: 'Moisturize',
  fragrance: 'Finish',
};

function haystack(product: Pick<ShopProduct, 'name' | 'category' | 'tags' | 'description'>) {
  return `${product.name} ${product.category} ${(product.tags || []).join(' ')} ${product.description || ''}`.toLowerCase();
}

export function ritualStepFor(product: Pick<ShopProduct, 'name' | 'category' | 'tags' | 'description'>): RitualStep {
  const text = haystack(product);
  for (const [step, hints] of Object.entries(STEP_HINTS) as [RitualStep, string[]][]) {
    if (hints.some((hint) => text.includes(hint))) return step;
  }
  return CATEGORY_STEP[product.category] || 'Enhance';
}

/**
 * Complementary catalog products for "Complete Your Ritual".
 * Never fabricates items — returns [] when the catalog has nothing suitable.
 */
export function pickRitualProducts(
  current: Pick<ShopProduct, 'id' | 'name' | 'category' | 'tags' | 'description' | 'available'>,
  catalog: ShopProduct[],
  limit = 4
): ShopProduct[] {
  const currentStep = ritualStepFor(current);
  const seen = new Set<string>([current.id]);
  const scored = catalog
    .filter((p) => p.id !== current.id && p.available && p.defaultVariantId && p.handle)
    .map((product) => {
      const step = ritualStepFor(product);
      let score = 0;
      if (step !== currentStep) score += 4;
      if (product.category !== current.category) score += 2;
      else score += 1;
      if (product.is_featured) score += 1;
      return { product, step, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const out: ShopProduct[] = [];
  const usedSteps = new Set<RitualStep>([currentStep]);

  for (const row of scored) {
    if (out.length >= limit) break;
    if (usedSteps.has(row.step) && out.length < limit - 1) continue;
    if (seen.has(row.product.id)) continue;
    seen.add(row.product.id);
    usedSteps.add(row.step);
    out.push(row.product);
  }

  if (out.length < 2) {
    for (const row of scored) {
      if (out.length >= limit) break;
      if (seen.has(row.product.id)) continue;
      seen.add(row.product.id);
      out.push(row.product);
    }
  }

  return out.length >= 2 ? out.slice(0, limit) : [];
}
