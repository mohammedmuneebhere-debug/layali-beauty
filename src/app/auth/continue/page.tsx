import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { normalizeInternalPath } from '@/lib/auth/navigate-after-auth';
import { CUSTOMER_ACCOUNT_RETURN_COOKIE } from '@/lib/shopify/customer-account-cookie';

export const dynamic = 'force-dynamic';

/**
 * Reads the post-login return path and hands the response to a Route Handler.
 * The handler sets session cookies and clears the return cookie.
 */
export default async function ContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const requested = normalizeInternalPath(params.redirect || jar.get(CUSTOMER_ACCOUNT_RETURN_COOKIE)?.value || '');
  const target = new URL('/api/customer-account/continue', 'https://www.layalibeautystore.com');
  if (requested) target.searchParams.set('return', requested);
  redirect(`${target.pathname}${target.search}`);
}
