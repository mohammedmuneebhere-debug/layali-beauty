/**
 * Cart buyer country for Shopify Markets inventory.
 * This does not decide delivery eligibility. Checkout validates the saved address.
 *
 * An unknown or missing country is never rewritten to SA inside the mapper.
 * The store selling market is applied only when the shopper has not supplied a country.
 */
const COUNTRY_TO_CODE: Record<string, string> = {
  'saudi arabia': 'SA',
  saudi: 'SA',
  'kingdom of saudi arabia': 'SA',
  'المملكة العربية السعودية': 'SA',
  'السعودية': 'SA',
  sa: 'SA',
  ksa: 'SA',
  uae: 'AE',
  'united arab emirates': 'AE',
  emirates: 'AE',
  ae: 'AE',
  kuwait: 'KW',
  kw: 'KW',
  qatar: 'QA',
  qa: 'QA',
  bahrain: 'BH',
  bh: 'BH',
  oman: 'OM',
  om: 'OM',
  india: 'IN',
  in: 'IN',
};

export type BuyerCountryResolution =
  | { status: 'explicit'; code: string }
  | { status: 'missing' }
  | { status: 'unknown' };

/**
 * Storefront selling market used only when the shopper supplied no country.
 *
 * SHOPIFY_CART_COUNTRY is a diagnostic override from the September 2026 cart
 * incident. It is not a buyer-country or delivery-country setting. A two-letter
 * value selects this selling market; it must not replace an explicit country
 * or turn an unknown country into that market. Production should leave it unset,
 * which keeps the selling market at SA.
 */
export function getDefaultCartCountryCode(): string {
  const fromEnv = process.env.SHOPIFY_CART_COUNTRY?.trim().toUpperCase();
  if (fromEnv && /^[A-Z]{2}$/.test(fromEnv)) return fromEnv;
  return 'SA';
}

/** Known country text, or null when it is missing or not recognized. */
export function mapCountryToShopifyCode(country?: string | null): string | null {
  const key = (country || '').trim().toLowerCase();
  if (!key) return null;
  return COUNTRY_TO_CODE[key] || null;
}

export function resolveBuyerCountry(options?: {
  countryCode?: string | null;
  countryLabel?: string | null;
}): BuyerCountryResolution {
  const explicit = options?.countryCode?.trim().toUpperCase() || '';
  if (explicit) {
    if (!/^[A-Z]{2}$/.test(explicit)) return { status: 'unknown' };
    return { status: 'explicit', code: COUNTRY_TO_CODE[explicit.toLowerCase()] || explicit };
  }
  const label = options?.countryLabel?.trim() || '';
  if (!label) return { status: 'missing' };
  const code = mapCountryToShopifyCode(label);
  if (!code) return { status: 'unknown' };
  return { status: 'explicit', code };
}

export function buildCartBuyerIdentity(options?: {
  email?: string | null;
  countryCode?: string | null;
  countryLabel?: string | null;
}): { countryCode?: string; email?: string; countryStatus: BuyerCountryResolution['status'] } {
  const email = options?.email?.trim() || undefined;
  const resolved = resolveBuyerCountry(options);
  if (resolved.status === 'explicit') {
    return { countryCode: resolved.code, email, countryStatus: 'explicit' };
  }
  return { email, countryStatus: resolved.status };
}

/**
 * Buyer identity sent to the Storefront Cart API.
 * Missing country uses the selling market. An unknown country is left unset.
 */
export function cartMarketIdentity(options?: {
  email?: string | null;
  countryCode?: string | null;
  countryLabel?: string | null;
}): { countryCode?: string; email?: string; source: 'explicit' | 'catalog-default' | 'unknown' } {
  const built = buildCartBuyerIdentity(options);
  if (built.countryStatus === 'missing') {
    return { countryCode: getDefaultCartCountryCode(), email: built.email, source: 'catalog-default' };
  }
  if (built.countryStatus === 'unknown') {
    return { email: built.email, source: 'unknown' };
  }
  return { countryCode: built.countryCode, email: built.email, source: 'explicit' };
}

export type CartMarketRetry =
  | { retry: false; reason: 'unknown' | 'missing' | 'explicit-sa' | 'selling-market-not-sa' }
  | { retry: true; countryCode: 'SA' };

/**
 * Stock retry onto the Saudi selling market.
 * Missing and unknown countries never retry. Explicit SA never moves.
 * An explicit other market retries only when the selling market itself is SA.
 * A non-SA SHOPIFY_CART_COUNTRY value disables that retry.
 */
export function cartMarketRetry(options?: {
  countryCode?: string | null;
  countryLabel?: string | null;
}): CartMarketRetry {
  const market = cartMarketIdentity(options);
  if (market.source === 'unknown') return { retry: false, reason: 'unknown' };
  if (market.source !== 'explicit' || !market.countryCode) return { retry: false, reason: 'missing' };
  if (market.countryCode === 'SA') return { retry: false, reason: 'explicit-sa' };
  if (getDefaultCartCountryCode() !== 'SA') return { retry: false, reason: 'selling-market-not-sa' };
  return { retry: true, countryCode: 'SA' };
}
