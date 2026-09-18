/**
 * Pure ownership-link helpers. No Shopify/Supabase I/O.
 */
import { isShopifyOrderGid } from '@/lib/shopify/order-gid';

export type DiscoveredOrderRef = { id: string; name: string };

export type OrderLinkWriteDecision = 'skipped' | 'refused_foreign' | 'update' | 'insert';

export function decideOrderLinkWrite(params: {
  actorUserId: string;
  shopifyOrderId: string;
  existingOwnerId?: string | null;
}): OrderLinkWriteDecision {
  if (!params.actorUserId || !isShopifyOrderGid(params.shopifyOrderId)) return 'skipped';
  const owner = params.existingOwnerId?.trim() || '';
  if (owner && owner !== params.actorUserId) return 'refused_foreign';
  if (owner === params.actorUserId) return 'update';
  return 'insert';
}

/** Tagged Shopify orders the customer owns that are not yet in shopify_order_links. */
export function missingOwnedOrderRefs(
  existingGids: Iterable<string | null | undefined>,
  discovered: DiscoveredOrderRef[]
): DiscoveredOrderRef[] {
  const have = new Set<string>();
  for (const id of existingGids) {
    if (isShopifyOrderGid(id)) have.add(id as string);
  }
  const out: DiscoveredOrderRef[] = [];
  const seen = new Set<string>();
  for (const order of discovered) {
    if (!isShopifyOrderGid(order.id) || have.has(order.id) || seen.has(order.id)) continue;
    seen.add(order.id);
    out.push({ id: order.id, name: order.name });
  }
  return out;
}

export type RecoverableOrderLink = {
  shopify_order_id: string;
  shopify_order_name: string | null;
  created_at: string | null;
};

/** Prepend recovered refs so a newly tagged order appears even if persist is delayed. */
export function mergeRecoveredOrderLinks(
  existing: RecoverableOrderLink[],
  missing: DiscoveredOrderRef[]
): RecoverableOrderLink[] {
  const extras = missingOwnedOrderRefs(
    existing.map((row) => row.shopify_order_id),
    missing
  ).map((order) => ({
    shopify_order_id: order.id,
    shopify_order_name: order.name,
    created_at: null,
  }));
  return extras.length ? [...extras, ...existing] : existing;
}
