import { buildCartBuyerIdentity, getDefaultCartCountryCode } from './buyer-country';
import { isShopifyConfigured, shopifyFetch, ShopifyThrottleError } from './client';
import { normalizeCart } from './normalize';
import {
  CART_BUYER_IDENTITY_UPDATE,
  CART_CREATE,
  CART_LINES_ADD,
  CART_LINES_REMOVE,
  CART_LINES_UPDATE,
  CART_QUERY,
} from './queries';
import type { CartWarning, ShopifyCart } from './types';

export { ShopifyThrottleError };

type UserErrors = { field?: string[] | null; message: string }[];

type MutationWarnings = {
  warnings?: CartWarning[] | null;
  userErrors?: UserErrors;
  cart?: unknown;
};

type CartIdentityInput = {
  email?: string;
  countryCode?: string;
  countryLabel?: string;
};

/** Cart mutations: never retry-storm Shopify (1 attempt). */
const CART_FETCH = { cache: 'no-store' as const, revalidate: false as const, retries: 0 };

/**
 * Markets without sellable inventory (e.g. stale AE persist from older diagnostics)
 * surface as sold-out on cartCreate. Fall back once to the default selling market.
 */
function isMerchandiseStockError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /sold out|out of stock|not enough stock|MERCHANDISE_/i.test(message);
}

function assertNoUserErrors(userErrors: UserErrors | undefined, action: string) {
  if (userErrors?.length) {
    throw new Error(`${action}: ${userErrors.map((e) => e.message).join('; ')}`);
  }
}

function stockWarningMessage(warnings: CartWarning[] | undefined): string | null {
  const stock = warnings?.find(
    (w) =>
      w.code === 'MERCHANDISE_OUT_OF_STOCK' || w.code === 'MERCHANDISE_NOT_ENOUGH_STOCK'
  );
  return stock?.message || null;
}

function normalizeMutationCart(action: string, payload: MutationWarnings): ShopifyCart {
  assertNoUserErrors(payload.userErrors, action);
  const cart = normalizeCart(payload.cart as Parameters<typeof normalizeCart>[0]);
  if (!cart) throw new Error(`${action} returned empty cart`);

  // Filter qty-0 OOS placeholders in normalizeCart only — do NOT call cartLinesRemove
  // here (that doubled Storefront mutations on every +/- click).
  cart.warnings = payload.warnings || [];

  const stockMsg = stockWarningMessage(payload.warnings || undefined);
  if (stockMsg && cart.totalQuantity === 0 && cart.lines.length === 0) {
    throw new Error(stockMsg);
  }
  return cart;
}

export async function createCart(options?: {
  lines?: { merchandiseId: string; quantity: number }[];
  email?: string;
  countryCode?: string;
  countryLabel?: string;
}): Promise<ShopifyCart> {
  if (!isShopifyConfigured()) {
    throw new Error('Shopify is not configured');
  }

  const buyerIdentity = buildCartBuyerIdentity({
    email: options?.email,
    countryCode: options?.countryCode,
    countryLabel: options?.countryLabel,
  });

  const data = await shopifyFetch<{
    cartCreate: MutationWarnings;
  }>(
    CART_CREATE,
    {
      lines: options?.lines?.map((l) => ({
        merchandiseId: l.merchandiseId,
        quantity: l.quantity,
      })),
      buyerIdentity,
    },
    CART_FETCH
  );

  return normalizeMutationCart('cartCreate', data.cartCreate);
}

export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  if (!isShopifyConfigured() || !cartId) return null;
  const data = await shopifyFetch<{ cart: unknown }>(
    CART_QUERY,
    { id: cartId },
    CART_FETCH
  );
  const cart = normalizeCart(data.cart as Parameters<typeof normalizeCart>[0]);
  if (!cart) return null;

  // Read-only: do not chain buyerIdentityUpdate / cartLinesRemove on GET.
  // Those belong on explicit write paths and caused multi-request bursts.
  return cart;
}

export async function addCartLines(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{
    cartLinesAdd: MutationWarnings;
  }>(CART_LINES_ADD, { cartId, lines }, CART_FETCH);
  return normalizeMutationCart('cartLinesAdd', data.cartLinesAdd);
}

export async function updateCartLines(
  cartId: string,
  lines: { id: string; quantity: number }[]
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{
    cartLinesUpdate: MutationWarnings;
  }>(CART_LINES_UPDATE, { cartId, lines }, CART_FETCH);
  return normalizeMutationCart('cartLinesUpdate', data.cartLinesUpdate);
}

export async function removeCartLines(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const data = await shopifyFetch<{
    cartLinesRemove: MutationWarnings;
  }>(CART_LINES_REMOVE, { cartId, lineIds }, CART_FETCH);
  assertNoUserErrors(data.cartLinesRemove.userErrors, 'cartLinesRemove');
  const cart = normalizeCart(
    data.cartLinesRemove.cart as Parameters<typeof normalizeCart>[0]
  );
  if (!cart) throw new Error('cartLinesRemove returned empty cart');
  cart.warnings = data.cartLinesRemove.warnings || [];
  return cart;
}

export async function updateCartBuyerIdentity(
  cartId: string,
  options?: { email?: string; countryCode?: string; countryLabel?: string }
): Promise<ShopifyCart> {
  const buyerIdentity = buildCartBuyerIdentity(options);
  const data = await shopifyFetch<{
    cartBuyerIdentityUpdate: MutationWarnings;
  }>(CART_BUYER_IDENTITY_UPDATE, { cartId, buyerIdentity }, CART_FETCH);
  return normalizeMutationCart('cartBuyerIdentityUpdate', data.cartBuyerIdentityUpdate);
}

async function createCartWithMarketFallback(
  lines: { merchandiseId: string; quantity: number }[],
  identity: CartIdentityInput
): Promise<ShopifyCart> {
  try {
    return await createCart({
      lines,
      ...identity,
    });
  } catch (err) {
    if (err instanceof ShopifyThrottleError) throw err;
    if (!isMerchandiseStockError(err)) throw err;

    const requested = buildCartBuyerIdentity(identity).countryCode;
    const fallback = getDefaultCartCountryCode();
    // Same market already failed — genuine OOS, do not mask.
    if (requested === fallback) throw err;

    return createCart({
      lines,
      email: identity.email,
      countryCode: fallback,
    });
  }
}

/** Ensure a cart exists, then add one or more variant lines in a single Storefront write. */
export async function addToShopifyCart(options: {
  cartId: string | null;
  merchandiseId?: string;
  quantity?: number;
  /** Prefer this for combos — one cartCreate/cartLinesAdd for all lines. */
  lines?: { merchandiseId: string; quantity: number }[];
  email?: string;
  countryCode?: string;
  countryLabel?: string;
}): Promise<ShopifyCart> {
  const lines =
    options.lines?.filter((l) => l.merchandiseId && l.quantity > 0) ||
    (options.merchandiseId
      ? [{ merchandiseId: options.merchandiseId, quantity: options.quantity ?? 1 }]
      : []);

  if (lines.length === 0) {
    throw new Error('At least one merchandiseId is required');
  }

  const identity: CartIdentityInput = {
    email: options.email,
    countryCode: options.countryCode,
    countryLabel: options.countryLabel,
  };

  if (!options.cartId) {
    return createCartWithMarketFallback(lines, identity);
  }

  try {
    // Single mutation for all lines (combos must not partial-add via N POSTs).
    return await addCartLines(options.cartId, lines);
  } catch (err) {
    if (err instanceof ShopifyThrottleError) throw err;
    const message = err instanceof Error ? err.message : '';
    // Only recreate when the cart id itself is unusable — not on stock/user errors.
    if (/not found|does not exist|expired|cart.*unavailable/i.test(message)) {
      return createCartWithMarketFallback(lines, identity);
    }
    // Stale cart in a market without inventory: recreate under the selling market.
    if (isMerchandiseStockError(err)) {
      const requested = buildCartBuyerIdentity(identity).countryCode;
      const fallback = getDefaultCartCountryCode();
      if (requested !== fallback) {
        return createCart({
          lines,
          email: identity.email,
          countryCode: fallback,
        });
      }
    }
    throw err;
  }
}
