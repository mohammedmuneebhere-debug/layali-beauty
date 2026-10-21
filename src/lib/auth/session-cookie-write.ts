import { normalizeInternalPath } from '@/lib/auth/navigate-after-auth';
import { sessionNeedsRefresh, type CustomerAccountSession } from '@/lib/shopify/customer-account-session';

/**
 * A sealed session needs a Route Handler to write cookies when the access
 * token must be refreshed or cleared. Server Components cannot do that write.
 */
export function sessionCookieWriteDecision(
  session: CustomerAccountSession | null,
  now: number
): 'none' | 'commit' {
  if (!session) return 'none';
  return sessionNeedsRefresh(session, now) ? 'commit' : 'none';
}

/** Relative path for the cookie-commit redirect. Rejects open redirects and loops. */
export function safeSessionCommitReturn(value: string | null | undefined, fallback = '/account'): string {
  const path = normalizeInternalPath(value);
  if (!path) return fallback;
  if (path.startsWith('/api/customer-account/commit-session')) return fallback;
  if (path.startsWith('/auth/continue')) return fallback;
  return path;
}
