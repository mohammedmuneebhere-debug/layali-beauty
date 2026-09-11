import type { SurveyResponse, AIRecommendation } from '@/types/database';
import type { RecommendationProduct } from '@/lib/recommendation';

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

/**
 * Rule-based personalized combo scoring.
 * Product resolution must already be Shopify-backed (RecommendationProduct).
 * Scoring logic is intentionally unchanged from the legacy Product-based version.
 */
export function generatePersonalizedCombo(
  survey: Partial<SurveyResponse>,
  availableProducts: RecommendationProduct[]
): AIRecommendation {
  const scored = availableProducts.map((product) => {
    let score = 0;
    const reasons: string[] = [];

    if (survey.skin_type && product.category === 'skincare') {
      const desc = (product.description || '').toLowerCase();
      const benefits = (product.benefits || []).map((b) => b.toLowerCase());

      if (desc.includes(survey.skin_type) || benefits.some((b) => b.includes(survey.skin_type!))) {
        score += 3;
        reasons.push(`Perfect for ${survey.skin_type} skin`);
      }
    }

    if (survey.hair_type && product.category === 'haircare') {
      const desc = (product.description || '').toLowerCase();
      if (desc.includes(survey.hair_type)) {
        score += 3;
        reasons.push(`Ideal for ${survey.hair_type} hair`);
      }
    }

    (survey.skin_concerns || []).forEach((concern) => {
      const benefits = (product.benefits || []).map((b) => b.toLowerCase());
      const desc = (product.description || '').toLowerCase();
      if (benefits.some((b) => b.includes(concern)) || desc.includes(concern)) {
        score += 2;
        reasons.push(`Targets ${concern}`);
      }
    });

    (survey.hair_concerns || []).forEach((concern) => {
      const benefits = (product.benefits || []).map((b) => b.toLowerCase());
      if (benefits.some((b) => b.includes(concern))) {
        score += 2;
        reasons.push(`Addresses ${concern}`);
      }
    });

    if (product.is_featured) score += 1;

    return { product, score, reasons };
  });

  const topProducts = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const selected = topProducts.length >= 3
    ? topProducts
    : scored.sort((a, b) => b.score - a.score).slice(0, 4);

  const skincare = selected.filter((s) => s.product.category === 'skincare');
  const haircare = selected.filter((s) => s.product.category === 'haircare');
  const other = selected.filter((s) => !['skincare', 'haircare'].includes(s.product.category));

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

  const skinTypeLabel = survey.skin_type || 'your unique';
  const concerns = [...(survey.skin_concerns || []), ...(survey.hair_concerns || [])].slice(0, 3);

  return {
    summary: `Based on your ${skinTypeLabel} skin profile${concerns.length ? ` and concerns including ${concerns.join(', ')}` : ''}, we've curated a personalized beauty routine just for you.`,
    products: selected.map((s) => ({
      shopify_product_id: s.product.shopifyProductId,
      shopify_variant_id: s.product.shopifyVariantId,
      name: s.product.name,
      reason: s.reasons[0] || 'Recommended for your beauty profile',
      price: s.product.price,
      handle: s.product.handle,
      image_url: s.product.image_url,
      available: s.product.available && Boolean(s.product.shopifyVariantId),
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

export { SKIN_TYPES, HAIR_TYPES, SKIN_CONCERNS, HAIR_CONCERNS };
