/** Normalize navigation hrefs so same-site links stay in-tab as SPA routes */
export function normalizeAppHref(href: string | undefined | null): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed) return undefined;

  // mailto / tel / hash — leave as-is
  if (/^(mailto:|tel:|#)/i.test(trimmed)) return trimmed;

  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./, '');
      if (host === 'layalibeautystore.com' || host === 'localhost' || host === '127.0.0.1') {
        return `${url.pathname}${url.search}${url.hash}` || '/';
      }
      return trimmed;
    }
  } catch {
    // fall through
  }

  if (trimmed.startsWith('/')) return trimmed;
  // treat bare paths as internal
  if (!trimmed.includes('://')) return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return trimmed;
}

export function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(href);
}
