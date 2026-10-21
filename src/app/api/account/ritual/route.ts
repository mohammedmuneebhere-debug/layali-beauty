import { NextResponse } from 'next/server';
import { getCustomerContext } from '@/lib/auth/current-customer';
import { readCustomerJson, writeCustomerJson } from '@/lib/shopify/shop-records';
import type { ProfileExtras } from '@/lib/auth/current-customer';
import type { AIRecommendation } from '@/types/database';
import type { RecommendationSurveyInput } from '@/lib/survey/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const context = await getCustomerContext();
  if (!context.signedIn) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    survey?: RecommendationSurveyInput;
    recommendation?: AIRecommendation | null;
  } | null;
  if (!body?.survey) return NextResponse.json({ error: 'survey required' }, { status: 400 });
  await writeCustomerJson(context.customer.id, 'ritual', {
    survey: body.survey,
    recommendation: body.recommendation || null,
    updatedAt: new Date().toISOString(),
  });
  const extras = (await readCustomerJson<ProfileExtras>(context.customer.id, 'profile')) || {};
  await writeCustomerJson(context.customer.id, 'profile', {
    ...extras,
    onboardingCompleted: true,
  });
  return NextResponse.json({ ok: true });
}
