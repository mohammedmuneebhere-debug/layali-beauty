/**
 * Server-only customer order reads.
 * Ownership is always shopify_order_links for the authenticated user, then Shopify.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchShopifyCustomerOrderNodes,
  fetchShopifyOrderRefsForUser,
  isShopifyOrderGid,
  type ShopifyCustomerOrderNode,
} from '@/lib/shopify/admin-orders';
import { mergeRecoveredOrderLinks, missingOwnedOrderRefs } from '@/lib/account/order-link-recovery';
import { shopifyImageUrl } from '@/lib/shopify/image';
import {
  displayOrderNumber,
  isForbiddenOrderRef,
  refsMatchOrderName,
  toCustomerOrderRef,
} from '@/lib/account/order-ref';
import type {
  CustomerOrderDetail,
  CustomerOrderItem,
  CustomerOrderSummary,
  CustomerTracking,
} from '@/lib/account/order-types';
import { safeCustomerTrackingUrl } from '@/lib/account/safe-tracking-url';
import { upsertOwnedShopifyOrderLink } from '@/lib/account/shopify-order-links';
import {
  activeFulfillments,
  fulfillmentShipmentStatus,
  mapCustomerFacingStatus,
  mapFulfillmentStatusKey,
  mapShipmentStatusKey,
  mapTimeline,
} from '@/lib/account/order-status-map';

export type {
  CustomerOrderDetail,
  CustomerOrderItem,
  CustomerOrderSummary,
  CustomerShippingAddress,
  CustomerTracking,
  TimelineStepId,
  TimelineStepState,
} from '@/lib/account/order-types';

export { mapCustomerFacingStatus, mapTimeline } from '@/lib/account/order-status-map';

type OrderLinkRow = {
  shopify_order_id: string;
  shopify_order_name: string | null;
  created_at: string | null;
};

function moneyAmount(
  set?: { shopMoney?: { amount: string; currencyCode: string } | null } | null
): { amount: number; currencyCode: string } {
  const amount = Number(set?.shopMoney?.amount || 0);
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    currencyCode: set?.shopMoney?.currencyCode || 'SAR',
  };
}

function upper(value: string | null | undefined): string {
  return (value || '').trim().toUpperCase();
}

function isCodOrder(node: ShopifyCustomerOrderNode): boolean {
  const tags = (node.tags || []).map((t) => t.toLowerCase());
  const gateways = (node.paymentGatewayNames || []).map((g) => g.toLowerCase());
  if (tags.some((t) => t.includes('cod') || t.includes('cash-on-delivery'))) return true;
  if (gateways.some((g) => g.includes('cash') || g.includes('cod'))) return true;
  return true;
}

function mapItems(node: ShopifyCustomerOrderNode): CustomerOrderItem[] {
  return (node.lineItems?.nodes || []).map((line) => {
    const quantity = Number(line.quantity || 0) || 0;
    const unit = moneyAmount(line.discountedUnitPriceSet || line.originalUnitPriceSet);
    const imageUrl = shopifyImageUrl(line.image?.url, 240);
    return {
      name: line.title?.trim() || 'Item',
      variantTitle:
        line.variantTitle && line.variantTitle !== 'Default Title'
          ? line.variantTitle
          : null,
      quantity,
      unitPrice: unit.amount,
      lineTotal: unit.amount * quantity,
      imageUrl,
      imageAlt: line.image?.altText || line.title || null,
    };
  });
}

function mapTracking(node: ShopifyCustomerOrderNode): CustomerTracking[] {
  const seen = new Set<string>();
  const out: CustomerTracking[] = [];

  for (const f of activeFulfillments(node)) {
    const fulfillmentStatusKey = mapFulfillmentStatusKey(f.status);
    const shipmentStatusKey = mapShipmentStatusKey(fulfillmentShipmentStatus(f));
    const estimatedDeliveryAt = f.estimatedDeliveryAt || null;
    const deliveredAt = f.deliveredAt || null;
    const infos = (f.trackingInfo || [])
      .map((t) => ({
        number: t.number?.trim() || null,
        url: safeCustomerTrackingUrl(t.url),
        company: t.company?.trim() || null,
      }))
      .filter((t) => t.number || t.url);

    if (infos.length === 0) {
      if (!fulfillmentStatusKey && !shipmentStatusKey && !estimatedDeliveryAt && !deliveredAt) {
        continue;
      }
      const key = `status|${upper(f.status)}|${upper(f.displayStatus)}|${deliveredAt || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        company: null,
        number: null,
        url: null,
        fulfillmentStatusKey,
        shipmentStatusKey,
        estimatedDeliveryAt,
        deliveredAt,
      });
      continue;
    }

    for (const t of infos) {
      const number = t.number;
      const url = t.url;
      const company = t.company;
      const key = `${company || ''}|${number || ''}|${url || ''}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        company,
        number,
        url,
        fulfillmentStatusKey,
        shipmentStatusKey,
        estimatedDeliveryAt,
        deliveredAt,
      });
    }
  }
  return out;
}

function mapSummary(
  node: ShopifyCustomerOrderNode,
  fallbackCreatedAt: string | null
): CustomerOrderSummary | null {
  const number = displayOrderNumber(node.name);
  const ref = toCustomerOrderRef(node.name);
  if (!ref) return null;

  const items = mapItems(node);
  const total = moneyAmount(node.totalPriceSet);
  const facing = mapCustomerFacingStatus(node);
  const financial = (node.displayFinancialStatus || '').toUpperCase();
  const paymentDue =
    isCodOrder(node) && !['PAID', 'PARTIALLY_PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(financial);

  return {
    ref,
    number,
    createdAt: node.createdAt || fallbackCreatedAt,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    previewImageUrl: items.find((i) => i.imageUrl)?.imageUrl || null,
    previewAlt: items.find((i) => i.imageUrl)?.imageAlt || null,
    totalAmount: total.amount,
    currencyCode: total.currencyCode,
    paymentMethod: 'cod',
    paymentDue,
    cancelled: facing.cancelled,
    currentStep: facing.currentStep,
    statusKey: facing.statusKey,
  };
}

function mapDetail(
  node: ShopifyCustomerOrderNode,
  fallbackCreatedAt: string | null
): CustomerOrderDetail | null {
  const summary = mapSummary(node, fallbackCreatedAt);
  if (!summary) return null;
  const items = mapItems(node);
  const subtotal = moneyAmount(node.subtotalPriceSet);
  const shipping = moneyAmount(node.totalShippingPriceSet);
  const addr = node.shippingAddress;
  const { timeline } = mapTimeline(node);

  return {
    ...summary,
    items,
    subtotalAmount: subtotal.amount,
    shippingAmount: shipping.amount,
    shippingAddress: addr
      ? {
          name: addr.name?.trim() || '',
          phone: addr.phone?.trim() || '',
          address1: addr.address1?.trim() || '',
          address2: addr.address2?.trim() || null,
          city: addr.city?.trim() || '',
          province: addr.province?.trim() || null,
          zip: addr.zip?.trim() || null,
          country: addr.country?.trim() || null,
        }
      : null,
    tracking: mapTracking(node),
    timeline,
    estimatedDeliveryAt:
      activeFulfillments(node).find((f) => f.estimatedDeliveryAt)?.estimatedDeliveryAt || null,
    deliveredAt: activeFulfillments(node).find((f) => f.deliveredAt)?.deliveredAt || null,
  };
}

async function persistDiscoveredLinks(
  userId: string,
  discovered: { id: string; name: string }[]
) {
  for (const order of discovered) {
    if (!isShopifyOrderGid(order.id)) continue;
    const result = await upsertOwnedShopifyOrderLink({
      userId,
      shopifyOrderId: order.id,
      shopifyOrderName: order.name,
    });
    if (result === 'failed') {
      console.error('shopify_order_links recovery upsert failed', order.id);
    }
  }
}

async function loadOwnedLinks(
  supabase: SupabaseClient,
  userId: string
): Promise<OrderLinkRow[]> {
  const { data, error } = await supabase
    .from('shopify_order_links')
    .select('shopify_order_id, shopify_order_name, created_at')
    .eq('supabase_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('shopify_order_links list failed', error.message);
    throw Object.assign(new Error('unavailable'), { status: 502 });
  }
  return (data as OrderLinkRow[]) || [];
}

async function loadOwnedLinksWithRecovery(
  supabase: SupabaseClient,
  userId: string
): Promise<OrderLinkRow[]> {
  let links = await loadOwnedLinks(supabase, userId);

  try {
    const discovered = await fetchShopifyOrderRefsForUser(userId);
    const missing = missingOwnedOrderRefs(
      links.map((row) => row.shopify_order_id),
      discovered
    );
    if (!missing.length) return links;

    await persistDiscoveredLinks(userId, missing);
    links = await loadOwnedLinks(supabase, userId);
    return mergeRecoveredOrderLinks(links, discovered);
  } catch (err) {
    console.error('Layali customer orders: ownership-tag recovery failed', err);
  }
  return links;
}

function nodeForLink(
  nodes: Map<string, ShopifyCustomerOrderNode>,
  gid: string
): ShopifyCustomerOrderNode | undefined {
  const direct = nodes.get(gid);
  if (direct) return direct;
  const suffix = gid.match(/Order\/(\d+)/)?.[1];
  if (!suffix) return undefined;
  for (const [key, node] of nodes) {
    if (key.endsWith(`/${suffix}`)) return node;
  }
  return undefined;
}

export async function listCustomerOrders(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerOrderSummary[]> {
  const links = await loadOwnedLinksWithRecovery(supabase, userId);
  const gids = links.map((l) => l.shopify_order_id).filter((id) => isShopifyOrderGid(id));
  const nodes = gids.length ? await fetchShopifyCustomerOrderNodes(gids) : new Map();

  console.info('Layali customer orders list', {
      linkRows: links.length,
    validGids: gids.length,
    fetched: nodes.size,
  });

  if (gids.length && nodes.size === 0) {
    throw Object.assign(new Error('unavailable'), { status: 502 });
  }

  const orders: CustomerOrderSummary[] = [];
  for (const link of links) {
    if (!isShopifyOrderGid(link.shopify_order_id)) continue;
    const node = nodeForLink(nodes, link.shopify_order_id);
    if (!node) continue;
    const summary = mapSummary(node, link.created_at);
    if (summary) orders.push(summary);
  }
  return orders;
}

function isOwnedOrderGid(ownedGids: Set<string>, gid: string): boolean {
  if (ownedGids.has(gid)) return true;
  const suffix = gid.match(/Order\/(\d+)/)?.[1];
  if (!suffix) return false;
  for (const owned of ownedGids) {
    if (owned.endsWith(`/${suffix}`)) return true;
  }
  return false;
}

export async function getCustomerOrder(
  supabase: SupabaseClient,
  userId: string,
  orderRef: string
): Promise<CustomerOrderDetail | null> {
  if (isForbiddenOrderRef(orderRef)) return null;

  const links = await loadOwnedLinksWithRecovery(supabase, userId);
  const ownedGids = new Set(
    links.map((l) => l.shopify_order_id).filter((id) => isShopifyOrderGid(id))
  );
  if (!ownedGids.size) return null;

  const named = links.find((row) => refsMatchOrderName(row.shopify_order_name, orderRef));
  const gidsToFetch =
    named && isShopifyOrderGid(named.shopify_order_id)
      ? [named.shopify_order_id]
      : [...ownedGids];

  const nodes = await fetchShopifyCustomerOrderNodes(gidsToFetch);

  let matchedGid: string | null =
    named && isShopifyOrderGid(named.shopify_order_id) ? named.shopify_order_id : null;
  let node = matchedGid ? nodeForLink(nodes, matchedGid) : undefined;

  if (!node || !refsMatchOrderName(node.name, orderRef)) {
    node = undefined;
    matchedGid = null;
    for (const [gid, candidate] of nodes) {
      if (!isOwnedOrderGid(ownedGids, gid)) continue;
      if (!refsMatchOrderName(candidate.name, orderRef)) continue;
      node = candidate;
      matchedGid = gid;
      break;
    }
  }

  if (!node || !matchedGid || !isOwnedOrderGid(ownedGids, matchedGid)) return null;
  const link =
    links.find((l) => l.shopify_order_id === matchedGid) ||
    links.find((l) => nodeForLink(nodes, l.shopify_order_id) === node);
  return mapDetail(node, link?.created_at || null);
}
