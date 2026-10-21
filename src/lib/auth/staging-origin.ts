const WWW_HOST = 'www.layalibeautystore.com';
const APEX_HOST = 'layalibeautystore.com';
const REJECTED_STAGING_HOSTS = new Set([WWW_HOST, APEX_HOST, 'localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Preview-only Customer Account origin.
 * Accepts exactly `https://hostname` with one DNS name. Unset and invalid values disable staging.
 */
export function configuredStagingOrigin(env: NodeJS.ProcessEnv): string | null {
  const raw = env.LAYALI_STAGING_ORIGIN ?? '';
  if (!raw || raw !== raw.trim() || /[\s*#,\\]/.test(raw) || raw.includes('@')) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  const hostname = url.hostname.toLowerCase();
  if (
    !hostname ||
    hostname !== url.hostname ||
    REJECTED_STAGING_HOSTS.has(hostname) ||
    !/^[a-z0-9.-]+$/.test(hostname) ||
    !hostname.includes('.') ||
    hostname.startsWith('.') ||
    hostname.endsWith('.') ||
    hostname.includes('..')
  ) {
    return null;
  }
  const origin = `https://${hostname}`;
  if (raw !== origin || url.origin !== origin) return null;
  return origin;
}
