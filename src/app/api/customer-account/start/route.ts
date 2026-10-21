import { normalizeInternalPath } from '@/lib/auth/navigate-after-auth';
import { handleCustomerAccountStart } from '@/lib/shopify/customer-account-flow';
import { CUSTOMER_ACCOUNT_RETURN_COOKIE } from '@/lib/shopify/customer-account-cookie';
import { flowToResponse } from '../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const result = await handleCustomerAccountStart({
    requestUrl: request.url,
    env: process.env,
  });
  const returnTo = normalizeInternalPath(new URL(request.url).searchParams.get('return'));
  if (result.reason === 'authorize' && returnTo) {
    result.cookies.push({ name: CUSTOMER_ACCOUNT_RETURN_COOKIE, value: returnTo, maxAge: 600 });
  }
  return flowToResponse(result);
}

