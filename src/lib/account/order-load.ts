/**
 * Client abort for /api/account/orders*.
 * Server customer-order Shopify reads use a 15s single attempt (not the 90s×3
 * Admin mutation budget). 40s covers list/detail plus tag recovery without
 * trapping the UI if Shopify hangs.
 */
export const CUSTOMER_ORDER_FETCH_TIMEOUT_MS = 40_000;

export function customerOrderFetchTimeoutSignal(): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(CUSTOMER_ORDER_FETCH_TIMEOUT_MS);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), CUSTOMER_ORDER_FETCH_TIMEOUT_MS);
  return controller.signal;
}
