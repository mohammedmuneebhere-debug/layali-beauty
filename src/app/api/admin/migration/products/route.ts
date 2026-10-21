import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Legacy Supabase product copy is retired. The live catalog is Shopify. */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Legacy product migration is retired. Manage products in Shopify.',
    },
    { status: 410 }
  );
}

export async function POST() {
  return GET();
}
