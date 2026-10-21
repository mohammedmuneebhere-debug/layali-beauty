import { NextResponse } from 'next/server';
import { customerPublic, getCustomerContext } from '@/lib/auth/current-customer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const context = await getCustomerContext();
  if (!context.signedIn) {
    return NextResponse.json(
      { signedIn: false, configured: context.configured, customer: null },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
  return NextResponse.json(
    { signedIn: true, configured: true, customer: customerPublic(context.customer) },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
