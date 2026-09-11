import { isShopifyConfigured, shopifyFetch } from './client';
import { normalizeCart } from './normalize';
import {
  CART_CREATE,
  CART_LINES_ADD,
  CART_LINES_REMOVE,
  CART_LINES_UPDATE,
  CART_QUERY,
} from './queries';
import type { ShopifyCart } from './types';

type UserErrors = { field?: string[] | null; message: string }[];

function assertNoUserErrors(userErrors: UserErrors | undefined, action: string) {
  if (userErrors?.length) {
    throw new Error(`${action}: ${userErrors.map((e) => e.message).join('; ')}`);
  }
}

export async function createCart(options?: {
  lines?: { merchandiseId: string; quantity: number }[];
  email?: string;
}): Promise<ShopifyCart> {
  if (!isShopifyConfigured()) {
    throw new Error('Shopify is not configured');
  }

  const data = await shopifyFetch<{
    cartCreate: { cart: unknown; userErrors: UserErrors };
  }>(
    CART_CREATE,
    {
      lines: options?.lines?.map((l) => ({
        merchandiseId: l.merchandiseId,
        quantity: l.quantity,
      })),
      buyerIdentity: options?.email ? { email: options.email } : null,
    },
    { cache: 'no-store', revalidate: false }
  );

  assertNoUserErrors(data.cartCreate.userErrors, 'cartCreate');
  const cart = normalizeCart(data.cartCreate.cart as Parameters<typeof normalizeCart>[0]);
  if (!cart) throw new Error('cartCreate returned empty cart');
  return cart;
}

export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  if (!isShopifyConfigured() || !cartId) return null;
  const data = await shopifyFetch<{ cart: unknown }>(
    CART_QUERY,
    { id: cartId },
    { cache: 'no-store', revalidate: false }
  );
  return normalizeCart(data.cart as Parameters<typeof normalizeCart>[0]);
}

export async function addCartLines(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{
    cartLinesAdd: { cart: unknown; userErrors: UserErrors };
  }>(
    CART_LINES_ADD,
    { cartId, lines },
    { cache: 'no-store', revalidate: false }
  );
  assertNoUserErrors(data.cartLinesAdd.userErrors, 'cartLinesAdd');
  const cart = normalizeCart(data.cartLinesAdd.cart as Parameters<typeof normalizeCart>[0]);
  if (!cart) throw new Error('cartLinesAdd returned empty cart');
  return cart;
}

export async function updateCartLines(
  cartId: string,
  lines: { id: string; quantity: number }[]
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{
    cartLinesUpdate: { cart: unknown; userErrors: UserErrors };
  }>(
    CART_LINES_UPDATE,
    { cartId, lines },
    { cache: 'no-store', revalidate: false }
  );
  assertNoUserErrors(data.cartLinesUpdate.userErrors, 'cartLinesUpdate');
  const cart = normalizeCart(data.cartLinesUpdate.cart as Parameters<typeof normalizeCart>[0]);
  if (!cart) throw new Error('cartLinesUpdate returned empty cart');
  return cart;
}

export async function removeCartLines(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const data = await shopifyFetch<{
    cartLinesRemove: { cart: unknown; userErrors: UserErrors };
  }>(
    CART_LINES_REMOVE,
    { cartId, lineIds },
    { cache: 'no-store', revalidate: false }
  );
  assertNoUserErrors(data.cartLinesRemove.userErrors, 'cartLinesRemove');
  const cart = normalizeCart(data.cartLinesRemove.cart as Parameters<typeof normalizeCart>[0]);
  if (!cart) throw new Error('cartLinesRemove returned empty cart');
  return cart;
}

/** Ensure a cart exists, then add a variant line */
export async function addToShopifyCart(options: {
  cartId: string | null;
  merchandiseId: string;
  quantity?: number;
  email?: string;
}): Promise<ShopifyCart> {
  const quantity = options.quantity ?? 1;
  if (!options.cartId) {
    return createCart({
      lines: [{ merchandiseId: options.merchandiseId, quantity }],
      email: options.email,
    });
  }
  try {
    return await addCartLines(options.cartId, [
      { merchandiseId: options.merchandiseId, quantity },
    ]);
  } catch {
    // Cart may have expired — create a new one
    return createCart({
      lines: [{ merchandiseId: options.merchandiseId, quantity }],
      email: options.email,
    });
  }
}
