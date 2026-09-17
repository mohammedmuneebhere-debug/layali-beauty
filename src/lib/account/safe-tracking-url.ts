/**
 * Customer-facing tracking hrefs must be safe web navigations.
 *
 * Shopify/carrier payloads can contain javascript: / data: URLs. Only http(s)
 * is allowed. http:// is included because some carrier tracking pages still
 * serve http; javascript:, data:, and other schemes are rejected.
 */
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

export function safeCustomerTrackingUrl(raw: string | null | undefined): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  if (/[\u0000-\u001F\u007F]/.test(value)) return null;
  if (/\s/.test(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
  if (parsed.username || parsed.password) return null;
  if (!parsed.hostname) return null;
  return parsed.href;
}
