import { NextResponse } from 'next/server';
import type { FlowResult } from '@/lib/shopify/customer-account-flow';

function publicBody(result: FlowResult): Record<string, unknown> {
  if (result.status === 200 && result.body) return result.body;
  if (result.status === 404) return { error: 'Not found' };
  if (result.status === 405) return { error: 'Method not allowed' };
  if (result.status === 503) return { error: 'Sign-in is temporarily unavailable' };
  return { error: 'Invalid login callback' };
}

export function flowToResponse(result: FlowResult): NextResponse {
  const response = result.location
    ? NextResponse.redirect(result.location, result.status)
    : NextResponse.json(publicBody(result), { status: result.status });
  response.headers.set('Cache-Control', 'private, no-store');
  for (const cookie of result.cookies) {
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: cookie.maxAge,
    });
  }
  return response;
}
