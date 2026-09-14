const ORDER_NAV_KEY = 'layali-checkout-order-navigating';

/** Survives checkout remount so empty-cart redirect cannot steal success navigation. */
export function markCheckoutOrderNavigating(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(ORDER_NAV_KEY, '1');
  } catch {
    // Private mode / quota — in-memory refs on the checkout page still apply.
  }
}

export function isCheckoutOrderNavigating(): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(ORDER_NAV_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearCheckoutOrderNavigating(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(ORDER_NAV_KEY);
  } catch {
    // ignore
  }
}
