import { getCart } from './cart';

/**
 * Hosted Shopify Checkout URL (legacy handoff).
 * Layali COD uses Admin draft orders via /api/shopify/checkout/place-order instead.
 */
export async function getCheckoutUrl(cartId: string): Promise<string | null> {
  const cart = await getCart(cartId);
  return cart?.checkoutUrl || null;
}

export { getCart as getCheckoutCart };
