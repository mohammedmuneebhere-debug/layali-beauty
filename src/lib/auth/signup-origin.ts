import { authRedirectOrigin, type RedirectHostHeaders } from '@/lib/auth/navigate-after-auth';

/**
 * Origin allowed to store a pending signup.
 * authRedirectOrigin chooses it from the request URL. That helper ignores
 * X-Forwarded-Host, and a Host header cannot select the staging origin.
 * Returns null when Origin is missing, malformed, or different.
 */
export function trustedSignupOrigin(
  requestUrl: string,
  originHeader: string | null | undefined,
  headers?: RedirectHostHeaders,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (typeof originHeader !== 'string' || originHeader.length === 0 || originHeader.length > 200) return null;
  if (originHeader !== originHeader.trim() || /[\s\\*@]/.test(originHeader)) return null;
  let url: URL;
  try {
    url = new URL(originHeader);
  } catch {
    return null;
  }
  if (url.origin !== originHeader || url.username || url.password) return null;
  if (url.pathname !== '/' || url.search || url.hash) return null;
  const expected = authRedirectOrigin(requestUrl, headers, env);
  if (url.origin !== expected) return null;
  return expected;
}
