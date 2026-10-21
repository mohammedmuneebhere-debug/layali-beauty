/**
 * Route gate for a verified Shopify customer session.
 * `staff` is unknown in middleware. The admin layout resolves the allowlist.
 */
export type GateUser = { id: string } | null;
export type GateProfile = {
  staff: boolean | 'unknown';
  onboarding_completed: boolean | null;
} | null;

/** Returns a redirect URL, or null when the request may continue. Mutates `url`. */
export function applyCustomerGate(url: URL, user: GateUser, profile: GateProfile): URL | null {
  const path = url.pathname;

  if (path.startsWith('/account') || path.startsWith('/checkout') || path.startsWith('/survey')) {
    if (!user) {
      url.pathname = '/auth/signin';
      url.searchParams.set('redirect', path);
      return url;
    }
  }

  if (path.startsWith('/admin')) {
    if (!user) {
      url.pathname = '/auth/admin/signin';
      url.search = '';
      return url;
    }
    if (profile?.staff === false) {
      url.pathname = '/';
      url.search = '';
      return url;
    }
  }

  if (user && (path.startsWith('/auth/signin') || path.startsWith('/auth/signup') || path.startsWith('/auth/admin/signin'))) {
    const redirect = url.searchParams.get('redirect');
    url.pathname = '/auth/continue';
    url.search = '';
    if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
      url.searchParams.set('redirect', redirect);
    }
    return url;
  }

  return null;
}
