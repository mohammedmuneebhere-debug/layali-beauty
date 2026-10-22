/**
 * Browser entry for Shopify Customer Accounts.
 * Sign-in navigates here directly. Sign-up adds signup=1 after the server
 * stores the pending profile. This URL never points at Supabase Auth.
 */
export const CUSTOMER_ACCOUNT_START_PATH = '/api/customer-account/start';
const INTERNAL_ORIGIN = 'https://layali.internal';

export function customerAccountStartUrl(origin: string, returnTo = ''): string {
  const url = new URL(CUSTOMER_ACCOUNT_START_PATH, origin);
  if (returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    url.searchParams.set('return', returnTo);
  }
  return url.toString();
}

export function customerAccountSignupStartPath(returnTo: string | null = null): string {
  const url = new URL(CUSTOMER_ACCOUNT_START_PATH, INTERNAL_ORIGIN);
  url.searchParams.set('signup', '1');
  if (returnTo) url.searchParams.set('return', returnTo);
  return `${url.pathname}${url.search}`;
}

/** Same-origin start path produced by the signup route. Rejects open redirects. */
export function isCustomerAccountSignupStartPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/api/customer-account/start?')) return false;
  if (value.includes('\\') || value.includes('://')) return false;
  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN || url.pathname !== CUSTOMER_ACCOUNT_START_PATH) return false;
    if (url.searchParams.get('signup') !== '1') return false;
    const ret = url.searchParams.get('return');
    if (ret && (!ret.startsWith('/') || ret.startsWith('//') || ret.includes('\\') || ret.includes('://'))) return false;
    return `${url.pathname}${url.search}` === value;
  } catch {
    return false;
  }
}
