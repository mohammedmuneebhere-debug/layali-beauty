import { handleCustomerAccountLogout } from '@/lib/shopify/customer-account-flow';
import { flowToResponse } from '../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cookiesFrom(request: Request): { name: string; value: string }[] {
  const header = request.headers.get('cookie') || '';
  if (!header) return [];
  return header
    .split(';')
    .map((part) => {
      const eq = part.indexOf('=');
      if (eq < 1) return null;
      return {
        name: part.slice(0, eq).trim(),
        value: decodeURIComponent(part.slice(eq + 1).trim()),
      };
    })
    .filter((cookie): cookie is { name: string; value: string } => Boolean(cookie?.name));
}

export async function POST(request: Request) {
  const result = await handleCustomerAccountLogout({
    method: 'POST',
    requestUrl: request.url,
    cookies: cookiesFrom(request),
    env: process.env,
  });
  return flowToResponse(result);
}

export async function GET(request: Request) {
  const result = await handleCustomerAccountLogout({
    method: 'GET',
    requestUrl: request.url,
    cookies: [],
    env: process.env,
  });
  return flowToResponse(result);
}
