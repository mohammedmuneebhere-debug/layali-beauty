import { NextResponse } from 'next/server';
import { handleSignupIntent } from '@/lib/auth/signup-intent-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const result = await handleSignupIntent({
    requestUrl: request.url,
    originHeader: request.headers.get('origin'),
    headers: {
      host: request.headers.get('host'),
      forwardedHost: request.headers.get('x-forwarded-host'),
    },
    readBody: () => request.json(),
  });
  const response = NextResponse.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
  if (result.cookie) {
    response.cookies.set(result.cookie.name, result.cookie.value, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: result.cookie.maxAge,
    });
  }
  return response;
}
