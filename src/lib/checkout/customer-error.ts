/**
 * Customer-facing checkout errors.
 * Only exact messages for known validation codes are returned.
 * Everything else becomes one generic sentence.
 */

const GENERIC_CHECKOUT_ERROR = 'Could not place order. Please try again.';
const CHECKOUT_NOT_CONFIGURED = 'Order placement is not configured yet. Please contact support.';

const MESSAGE_BY_CODE: Record<string, string> = {
  empty_cart: 'Your cart is empty.',
  invalid_variant: 'Cart contains an invalid product variant.',
  invalid_quantity: 'Cart contains an invalid quantity.',
  invalid_address: 'Please select a valid delivery address.',
  incomplete_address: 'Delivery address is incomplete. Please update name, phone, address, and city.',
  missing_country: 'Delivery country is missing. Add a country before checkout.',
  invalid_country: 'Delivery country is not recognized. Cash on delivery cannot use this address.',
  unsupported_country: 'Cash on Delivery checkout currently supports Saudi Arabia addresses only.',
  delivery_charge: 'Could not place your order. Please try again.',
};

const PUBLIC_CODES = new Set([
  ...Object.keys(MESSAGE_BY_CODE),
  'order_failed',
  'missing_admin_scopes',
  'unexpected',
  'shopify_not_configured',
  'unauthorized',
]);

export function checkoutCustomerMessage(code: string, message: string, accessDenied = false): string {
  if (accessDenied) return CHECKOUT_NOT_CONFIGURED;
  const approved = MESSAGE_BY_CODE[code];
  if (approved && message === approved) return approved;
  return GENERIC_CHECKOUT_ERROR;
}

/** Response code. Unexpected values, including ids, stay off the client payload. */
export function checkoutCustomerCode(code: string, accessDenied = false): string {
  if (accessDenied) return 'missing_admin_scopes';
  return PUBLIC_CODES.has(code) ? code : 'order_failed';
}

/** Server-log text with credentials, ids, and contact details removed. */
export function redactCheckoutLog(value: string): string {
  return value
    .replace(/shpat_[A-Za-z0-9]+/g, '[redacted]')
    .replace(/shpss_[A-Za-z0-9]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b(token|secret|password|authorization)\b\s*[:=]?\s*\S+/gi, '$1 [redacted]')
    .replace(/gid:\/\/shopify\/[A-Za-z]+\/[^\s"',]+/g, '[redacted-id]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\+\d[\d\s()-]{6,}\d/g, '[redacted-phone]');
}
