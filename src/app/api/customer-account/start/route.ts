import { handleCustomerAccountStart } from '@/lib/shopify/customer-account-flow';
import { flowToResponse } from '../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const result = await handleCustomerAccountStart({
    requestUrl: request.url,
    env: process.env,
  });
  return flowToResponse(result);
}
