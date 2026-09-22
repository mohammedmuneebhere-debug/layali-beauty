/**
 * Map Layali profile / region country labels to Shopify CountryCode values.
 * Used for Cart buyerIdentity so Markets inventory resolves correctly.
 */
const COUNTRY_TO_CODE: Record<string, string> = {
  'saudi arabia': 'SA',
  saudi: 'SA',
  sa: 'SA',
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

/**
 * Default cart buyer country for Storefront Cart API.
 *
 * Production default is SA (Saudi Arabia). Do not permanently override with AE.
 *
 * Observed 2026-09: AE/IN cartCreate returns MERCHANDISE_OUT_OF_STOCK for in-stock
 * catalog items while SA cartCreate succeeds. Stale client persist of countryCode=AE
 * (from older SHOPIFY_CART_COUNTRY=AE diagnostics) made Add to Cart fail with
 * "Could not add this item" — especially on phones that still held that persist.
 * addToShopifyCart falls back to this default market on stock errors.
 *
 * SHOPIFY_CART_COUNTRY is diagnostic-only (ISO 3166-1 alpha-2), not a product fix.
 */
export function getDefaultCartCountryCode(): string {
  const fromEnv = process.env.SHOPIFY_CART_COUNTRY?.trim().toUpperCase();
  if (fromEnv && /^[A-Z]{2}$/.test(fromEnv)) return fromEnv;
  return 'SA';
}

export function mapCountryToShopifyCode(country?: string | null): string {
  if (!country?.trim()) return getDefaultCartCountryCode();
  const key = country.trim().toLowerCase();
  return COUNTRY_TO_CODE[key] || getDefaultCartCountryCode();
}

export function buildCartBuyerIdentity(options?: {
  email?: string | null;
  countryCode?: string | null;
  countryLabel?: string | null;
}): { countryCode: string; email?: string } {
  // Env override is diagnostic-only (see getDefaultCartCountryCode). Production = SA.
  const envOverride = process.env.SHOPIFY_CART_COUNTRY?.trim().toUpperCase();
  if (envOverride && /^[A-Z]{2}$/.test(envOverride)) {
    const identity: { countryCode: string; email?: string } = {
      countryCode: envOverride,
    };
    if (options?.email?.trim()) identity.email = options.email.trim();
    return identity;
  }

  const explicit =
    options?.countryCode?.trim().toUpperCase() &&
    /^[A-Z]{2}$/.test(options.countryCode.trim().toUpperCase())
      ? options.countryCode.trim().toUpperCase()
      : null;

  const countryCode = explicit || mapCountryToShopifyCode(options?.countryLabel);
  const identity: { countryCode: string; email?: string } = { countryCode };
  if (options?.email?.trim()) identity.email = options.email.trim();
  return identity;
}
