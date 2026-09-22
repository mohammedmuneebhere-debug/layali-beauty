import type { AIRecommendation } from '@/types/database';
import type { RecommendationProduct } from '@/lib/recommendation';
import type { RecommendationSurveyInput, ShoppingIntent } from '@/lib/survey/types';

const SKIN_TYPES = ['oily', 'dry', 'combination', 'normal', 'sensitive'];
const HAIR_TYPES = ['straight', 'wavy', 'curly', 'coily', 'fine', 'thick'];
const SKIN_CONCERNS = [
  'acne', 'dark spots', 'dryness', 'oiliness', 'wrinkles', 'dullness',
  'redness', 'large pores', 'uneven texture', 'hyperpigmentation',
];
const HAIR_CONCERNS = [
  'frizz', 'dryness', 'breakage', 'hair loss', 'dandruff', 'split ends',
  'lack of volume', 'oiliness', 'color damage', 'scalp irritation',
];

const INTENT_CATEGORIES: Record<ShoppingIntent, string[]> = {
  skincare: ['skincare'],
  haircare: ['haircare'],
  lenses: ['lenses'],
  makeup: ['makeup'],
  fragrance: ['fragrance'],
  complete: ['skincare', 'haircare', 'makeup', 'fragrance', 'lenses', 'bodycare'],
};

function resolveShoppingIntent(
  survey: RecommendationSurveyInput
): ShoppingIntent | null {
  if (survey.shopping_intent && survey.shopping_intent in INTENT_CATEGORIES) {
    return survey.shopping_intent;
  }
  const notes = (survey.additional_notes || '').toLowerCase();
  const fromNotes = notes.match(/\bintent:([a-z]+)\b/);
  if (fromNotes && fromNotes[1] in INTENT_CATEGORIES) {
    return fromNotes[1] as ShoppingIntent;
  }
  const shopping = notes.match(/shopping for ([a-z]+)/);
  if (shopping && shopping[1] in INTENT_CATEGORIES) {
    return shopping[1] as ShoppingIntent;
  }
  return null;
}

function productHaystack(product: RecommendationProduct): string {
  return [
    product.name,
    product.description || '',
    product.category,
    ...(product.benefits || []),
    ...(product.tags || []),
  ]
    .join(' ')
    .toLowerCase();
}

function noteTokens(survey: RecommendationSurveyInput): string[] {
  const fromNotes = (survey.additional_notes || '')
    .split('|')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((s) => !s.startsWith('shopping for') && !s.startsWith('intent:'));
  const fromLifestyle = (survey.lifestyle || []).map((s) => s.toLowerCase());
  return [...new Set([...fromNotes, ...fromLifestyle])].filter(
    (t) => t.length > 1 && t !== 'not sure' && t !== 'flexible'
  );
}

/**
 * Rule-based personalized combo scoring.
 * Product resolution must already be Shopify-backed (RecommendationProduct).
 * Scoring is category-aware: shopping intent steers which catalog slice is preferred.
 */
export function generatePersonalizedCombo(
  survey: RecommendationSurveyInput,
  availableProducts: RecommendationProduct[]
): AIRecommendation {
  const intent = resolveShoppingIntent(survey);
  const allowedCategories = intent ? INTENT_CATEGORIES[intent] : null;
  const tokens = noteTokens(survey);

  const scored = availableProducts.map((product) => {
    let score = 0;
    const reasons: string[] = [];
    const hay = productHaystack(product);
    const inFocus =
      !allowedCategories || allowedCategories.includes(product.category);

    // Complete Routine: selected beauty priorities (skincare, haircare, …)
    const completePriorities =
      intent === 'complete'
        ? tokens.filter((t) =>
            ['skincare', 'haircare', 'makeup', 'fragrance', 'lenses', 'bodycare'].includes(
              t
            )
          )
        : [];
    const inCompletePriority =
      completePriorities.length === 0 || completePriorities.includes(product.category);

    if (allowedCategories) {
      if (inFocus) {
        score += 5;
        if (intent && intent !== 'complete') {
          reasons.push(`Matched to your ${intent} ritual`);
        }
      } else if (intent && intent !== 'complete') {
        // Keep off-category products out of single-intent results.
        score -= 8;
      }
    }

    if (intent === 'complete' && completePriorities.length > 0) {
      if (inCompletePriority) {
        score += 6;
        reasons.push(`Matches your ${product.category} priority`);
      } else {
        // Do not treat non-priority categories as equal fillers.
        score -= 10;
      }
    }

    if (survey.skin_type && product.category === 'skincare' && inFocus) {
      if (hay.includes(survey.skin_type)) {
        score += 3;
        reasons.push(`Perfect for ${survey.skin_type} skin`);
      }
    }

    if (survey.hair_type && product.category === 'haircare' && inFocus) {
      if (hay.includes(survey.hair_type)) {
        score += 3;
        reasons.push(`Ideal for ${survey.hair_type} hair`);
      }
    }

    (survey.skin_concerns || []).forEach((concern) => {
      if (!inFocus && intent && intent !== 'complete') return;
      if (intent === 'complete' && completePriorities.length > 0 && !inCompletePriority) {
        return;
      }
      if (hay.includes(concern.toLowerCase())) {
        score += 2;
        reasons.push(`Targets ${concern}`);
      }
    });

    (survey.hair_concerns || []).forEach((concern) => {
      if (!inFocus && intent && intent !== 'complete') return;
      if (intent === 'complete' && completePriorities.length > 0 && !inCompletePriority) {
        return;
      }
      if (hay.includes(concern.toLowerCase())) {
        score += 2;
        reasons.push(`Addresses ${concern}`);
      }
    });

    tokens.forEach((token) => {
      if (!inFocus && intent && intent !== 'complete') return;
      if (intent === 'complete' && completePriorities.length > 0 && !inCompletePriority) {
        return;
      }
      if (token.length < 3) return;
      // Category-name tokens are handled via priority boost, not keyword hay match.
      if (
        ['skincare', 'haircare', 'makeup', 'fragrance', 'lenses', 'bodycare'].includes(token)
      ) {
        return;
      }
      if (hay.includes(token)) {
        score += 2;
        if (reasons.length < 3) {
          reasons.push(`Fits “${token}”`);
        }
      }
    });

    if (product.is_featured && inFocus && inCompletePriority) score += 1;

    const budgetMatch = (survey.additional_notes || '').match(/budget:(\d+)/i);
    if (budgetMatch) {
      const max = Number(budgetMatch[1]);
      if (Number.isFinite(max) && product.price <= max) {
        score += 2;
        reasons.push('Fits your selected budget');
      } else if (Number.isFinite(max) && product.price > max) {
        score -= 2;
      }
    }

    return { product, score, reasons, inFocus, inCompletePriority };
  });

  let pool = scored;
  if (intent && intent !== 'complete') {
    const focused = scored.filter((s) => s.inFocus);
    // Never pad a single-intent ritual with unrelated categories.
    pool = focused;
  } else if (intent === 'complete') {
    const priorities = tokens.filter((t) =>
      ['skincare', 'haircare', 'makeup', 'fragrance', 'lenses', 'bodycare'].includes(t)
    );
    if (priorities.length > 0) {
      // Restrict to selected priorities whenever any matching catalog rows exist;
      // if none exist, keep an empty pool rather than filling with other categories.
      pool = scored.filter((s) => priorities.includes(s.product.category));
    }
  }

  const topProducts = pool
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Only fill from the already category-restricted pool — never reach outside it.
  const selected =
    topProducts.length > 0
      ? topProducts
      : [...pool].filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);

  const skincare = selected.filter((s) => s.product.category === 'skincare');
  const haircare = selected.filter((s) => s.product.category === 'haircare');
  const other = selected.filter(
    (s) => !['skincare', 'haircare'].includes(s.product.category)
  );

  const morning: string[] = [];
  const evening: string[] = [];

  skincare.forEach((s, i) => {
    if (i % 2 === 0) morning.push(`Apply ${s.product.name}`);
    else evening.push(`Apply ${s.product.name}`);
  });

  haircare.forEach((s) => {
    morning.push(`Use ${s.product.name} on wash days`);
  });

  other.forEach((s) => {
    evening.push(`Apply ${s.product.name}`);
  });

  if (morning.length === 0 && evening.length === 0) {
    selected.forEach((s, i) => {
      const line = `Try ${s.product.name}`;
      if (i % 2 === 0) morning.push(line);
      else evening.push(line);
    });
  }

  const summary = buildSummary(survey, intent);

  return {
    summary,
    products: selected.map((s) => ({
      shopify_product_id: s.product.shopifyProductId,
      shopify_variant_id: s.product.shopifyVariantId,
      name: s.product.name,
      reason: s.reasons[0] || 'Recommended for your beauty profile',
      price: s.product.price,
      handle: s.product.handle,
      image_url: s.product.image_url,
      available: s.product.available && Boolean(s.product.shopifyVariantId),
      quantity: 1,
    })),
    routine: { morning, evening },
    tips: [
      'Always patch test new products before full application',
      'Stay consistent with your routine for best results',
      'Apply sunscreen daily, even on cloudy days',
      'Drink plenty of water for healthy skin from within',
    ],
  };
}

function buildSummary(
  survey: RecommendationSurveyInput,
  intent: ShoppingIntent | null
): string {
  if (intent === 'skincare') {
    const skin = survey.skin_type || 'your';
    const concerns = (survey.skin_concerns || []).slice(0, 3);
    return `Based on your ${skin} skin profile${
      concerns.length ? ` and concerns including ${concerns.join(', ')}` : ''
    }, we've curated a skincare ritual from the Layali catalog.`;
  }
  if (intent === 'haircare') {
    const hair = survey.hair_type || 'your';
    const concerns = (survey.hair_concerns || []).slice(0, 3);
    return `Based on your ${hair} hair profile${
      concerns.length ? ` and concerns including ${concerns.join(', ')}` : ''
    }, we've curated a haircare ritual from the Layali catalog.`;
  }
  if (intent === 'lenses') {
    return `Based on your lens preferences, we've curated colored and cosmetic lens picks from the Layali catalog.`;
  }
  if (intent === 'makeup') {
    return `Based on your makeup style and finish preferences, we've curated products from the Layali makeup collection.`;
  }
  if (intent === 'fragrance') {
    return `Based on your scent profile and mood, we've curated fragrance picks from the Layali catalog.`;
  }
  if (intent === 'complete') {
    return `Based on your full beauty routine preferences, we've curated a personalized Layali combo across your priorities.`;
  }

  const skinTypeLabel = survey.skin_type || 'your unique';
  const concerns = [...(survey.skin_concerns || []), ...(survey.hair_concerns || [])].slice(
    0,
    3
  );
  return `Based on your ${skinTypeLabel} skin profile${
    concerns.length ? ` and concerns including ${concerns.join(', ')}` : ''
  }, we've curated a personalized beauty routine just for you.`;
}

export { SKIN_TYPES, HAIR_TYPES, SKIN_CONCERNS, HAIR_CONCERNS };
