import { getCart } from './cart';

/**
 * Checkout is owned by Shopify.
 * Retrieve the hosted checkout URL for the current Storefront cart.
 */
export async function getCheckoutUrl(cartId: string): Promise<string | null> {
  const cart = await getCart(cartId);
  return cart?.checkoutUrl || null;
}

export { getCart as getCheckoutCart };
