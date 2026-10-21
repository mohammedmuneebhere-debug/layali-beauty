import { configuredStagingOrigin } from '@/lib/auth/staging-origin';
import { SITE_URL } from '@/lib/constants';

/**
 * Client-side `router.push` after sign-in does not always send a full
 * document request, so middleware/RSC can still see the guest session
 * until the user refreshes. A hard navigation includes the new cookies.
 */

const INTERNAL_ORIGIN = 'https://layali.internal';
const PRODUCTION_HOSTS = new Set(['www.layalibeautystore.com', 'layalibeautystore.com']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export type RedirectHostHeaders = {
  host?: string | null;
  forwardedHost?: string | null;
};

/**
 * Decode a redirect path and keep only a same-origin path.
 * Backslashes are rejected, including values that become backslashes after decoding.
 * Returns null when the value could resolve to another host.
 */
export function normalizeInternalPath(value: string | null | undefined): string | null {
  let path = (value || '').trim();
  if (!path) return null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(path).trim();
    } catch {
      return null;
    }
    if (decoded === path) break;
    path = decoded;
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  if (path.includes('\\') || path.includes('://') || /[\u0000-\u001F\u007F]/.test(path)) return null;
  let resolved: URL;
  try {
    resolved = new URL(path, INTERNAL_ORIGIN);
  } catch {
    return null;
  }
  if (resolved.origin !== INTERNAL_ORIGIN || resolved.username || resolved.password) return null;
  if (!resolved.pathname.startsWith('/') || resolved.pathname.startsWith('//')) return null;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

function firstHostToken(value: string | null | undefined): string {
  return (value || '').split(',')[0]?.trim() || '';
}

/** An allowlisted host, or null when the header must not choose a redirect origin. */
export function originForTrustedHost(
  host: string | null | undefined,
  protocol: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const token = firstHostToken(host).toLowerCase();
  if (!token || token.includes('\\') || token.includes('/') || token.includes('@') || token.includes(' ') || token.includes('*')) {
    return null;
  }
  const port = token.match(/:(\d+)$/)?.[1] || '';
  const hostname = token.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  if (PRODUCTION_HOSTS.has(hostname)) return SITE_URL;
  const staging = configuredStagingOrigin(env);
  if (staging && hostname === new URL(staging).hostname) {
    if (protocol !== 'https:' || port) return null;
    return staging;
  }
  if (!LOCAL_HOSTS.has(hostname)) return null;
  const proto = protocol === 'https:' ? 'https:' : 'http:';
  return port ? `${proto}//${hostname}:${port}` : `${proto}//${hostname}`;
}

/**
 * Redirect origin for authentication.
 * The request URL chooses production, loopback, or the exact staging origin.
 * X-Forwarded-Host is ignored. A Host header cannot move production onto staging.
 */
export function authRedirectOrigin(
  requestUrl: string,
  headers?: RedirectHostHeaders,
  env: NodeJS.ProcessEnv = process.env
): string {
  void headers?.forwardedHost;
  let requestProtocol = 'https:';
  let requestHost = '';
  try {
    const url = new URL(requestUrl);
    requestProtocol = url.protocol;
    requestHost = url.host;
  } catch {
    requestHost = '';
  }
  const fromRequest = originForTrustedHost(requestHost, requestProtocol, env);
  if (fromRequest) return fromRequest;
  const fromHost = originForTrustedHost(headers?.host, requestProtocol, env);
  const staging = configuredStagingOrigin(env);
  if (fromHost && fromHost !== staging) return fromHost;
  return SITE_URL;
}

/** Absolute redirect on a trusted origin, never an arbitrary request host. */
export function sameOriginLocation(
  path: string,
  requestUrl: string,
  fallbackPath = '/shop',
  headers?: RedirectHostHeaders
): string {
  const base = authRedirectOrigin(requestUrl, headers);
  const safe = normalizeInternalPath(path) ?? fallbackPath;
  const resolved = new URL(safe, base);
  if (resolved.origin !== new URL(base).origin) return new URL(fallbackPath, base).toString();
  return resolved.toString();
}

export function safeAuthRedirect(path: string | null | undefined, fallback = '/shop'): string {
  const value = normalizeInternalPath(path);
  if (!value || value.startsWith('/auth')) return fallback;
  return value;
}

export function navigateAfterAuth(path: string) {
  window.location.assign(safeAuthRedirect(path));
}
