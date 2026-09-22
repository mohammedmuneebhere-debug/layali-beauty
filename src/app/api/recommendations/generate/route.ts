import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadRecommendationCatalog } from '@/lib/catalog';
import { generatePersonalizedCombo } from '@/lib/ai-recommendation';
import type { RecommendationSurveyInput } from '@/lib/survey/types';

/**
 * POST /api/recommendations/generate
 * Body: { survey, country?, city? }
 * Returns Shopify-GID recommendation (server-side catalog fetch — no N+1).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      survey: RecommendationSurveyInput;
      country?: string;
      city?: string;
    };

    if (!body.survey) {
      return NextResponse.json({ error: 'survey required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { products, source, error } = await loadRecommendationCatalog({
      supabase,
      country: body.country,
      city: body.city,
    });

    if (source === 'unconfigured') {
      return NextResponse.json(
        {
          recommendation: null,
          products: [],
          configured: false,
          error: error || 'Shopify is not configured',
        },
        { status: 200 }
      );
    }

    if (products.length === 0) {
      return NextResponse.json({
        recommendation: generatePersonalizedCombo(body.survey, []),
        products: [],
        configured: true,
        empty: true,
        message: body.country && body.city
          ? 'No products available for your region yet.'
          : 'No products available in the catalog.',
      });
    }

    const recommendation = generatePersonalizedCombo(body.survey, products);
    return NextResponse.json({
      recommendation,
      configured: true,
      empty: recommendation.products.length === 0,
    });
  } catch (err) {
    console.error('Recommendation generate error', err);
    return NextResponse.json(
      { error: 'Unable to generate recommendation' },
      { status: 502 }
    );
  }
}
