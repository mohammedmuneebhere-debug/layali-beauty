/**
 * Shopify Order GID helpers. Safe to import from account + Admin order code.
 * DraftOrder GIDs must never be stored in shopify_order_links.
 */

export const SHOPIFY_ORDER_GID_PREFIX = 'gid://shopify/Order/';

export function isShopifyOrderGid(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith(SHOPIFY_ORDER_GID_PREFIX));
}

export function isResolvedShopifyOrder(order: {
  orderId?: string | null;
  orderUnresolved?: boolean;
}): boolean {
  return isShopifyOrderGid(order.orderId) && order.orderUnresolved !== true;
}

/** Bounded retries after draftOrderComplete — Order association can lag the COMPLETED status. */
export const ORDER_GID_RESOLVE_ATTEMPTS = 5;
export const ORDER_GID_RESOLVE_BASE_DELAY_MS = 200;
export const ORDER_GID_RESOLVE_MAX_DELAY_MS = 1000;

export async function retryUntilResolvedOrder<
  T extends { orderId?: string | null; orderUnresolved?: boolean },
>(
  load: () => Promise<T>,
  opts?: {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<T> {
  const attempts = Math.max(1, opts?.attempts ?? ORDER_GID_RESOLVE_ATTEMPTS);
  const baseDelayMs = Math.max(0, opts?.baseDelayMs ?? ORDER_GID_RESOLVE_BASE_DELAY_MS);
  const maxDelayMs = Math.max(baseDelayMs, opts?.maxDelayMs ?? ORDER_GID_RESOLVE_MAX_DELAY_MS);
  const sleep =
    opts?.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;
  let last: T | undefined;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      const delay = Math.min(baseDelayMs * 2 ** (i - 1), maxDelayMs);
      if (delay > 0) await sleep(delay);
    }
    try {
      last = await load();
      lastError = undefined;
    } catch (err) {
      lastError = err;
      continue;
    }
    if (isResolvedShopifyOrder(last)) return last;
  }

  if (last) return last;
  throw lastError instanceof Error ? lastError : new Error('Could not resolve Shopify Order GID');
}
