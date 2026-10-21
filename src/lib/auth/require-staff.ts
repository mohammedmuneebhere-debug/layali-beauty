import { NextResponse } from 'next/server';
import { getCustomerContext, type StorefrontCustomer } from '@/lib/auth/current-customer';

export async function requireStaff(): Promise<
  | { customer: StorefrontCustomer; error?: undefined }
  | { error: NextResponse; customer?: undefined }
> {
  const context = await getCustomerContext();
  if (!context.signedIn) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!context.customer.staff) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { customer: context.customer };
}
