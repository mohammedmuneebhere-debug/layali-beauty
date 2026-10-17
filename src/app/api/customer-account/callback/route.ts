import { handleCustomerAccountCallback } from '@/lib/shopify/customer-account-flow';
import { flowToResponse } from '../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const result = await handleCustomerAccountCallback({
    requestUrl: request.url,
    cookies: request.headers.get('cookie')
      ? parseCookieHeader(request.headers.get('cookie') || '')
      : [],
    env: process.env,
  });
  return flowToResponse(result);
}

function parseCookieHeader(header: string): { name: string; value: string }[] {
  return header
    .split(';')
    .map((part) => {
      const eq = part.indexOf('=');
      if (eq < 1) return null;
      const name = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (!name) return null;
      return { name, value: decodeURIComponent(value) };
    })
    .filter((cookie): cookie is { name: string; value: string } => Boolean(cookie));
}
