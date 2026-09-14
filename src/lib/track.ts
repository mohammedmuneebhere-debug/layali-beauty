/**
 * Modular storefront analytics. No PII.
 * Events go to dataLayer when present; otherwise they are no-ops in production.
 */

export type StorefrontEventName =
  | 'page_view'
  | 'search'
  | 'product_view'
  | 'category_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'cart_view'
  | 'checkout_start'
  | 'purchase'
  | 'survey_start'
  | 'survey_complete'
  | 'recommendation_click'
  | 'AI_assistant_open'
  | 'AI_product_click';

export type StorefrontEventPayload = {
  event: StorefrontEventName;
  path?: string;
  id?: string;
  name?: string;
  category?: string;
  query?: string;
  value?: number;
  currency?: string;
};

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track(payload: StorefrontEventPayload) {
  if (typeof window === 'undefined') return;

  const event = {
    ...payload,
    path: payload.path || window.location.pathname,
    ts: Date.now(),
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);

  window.dispatchEvent(new CustomEvent('layali:track', { detail: event }));
}
