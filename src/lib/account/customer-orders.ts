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
  FulfillmentStatusKey,
  ShipmentStatusKey,
  TimelineStepId,
  TimelineStepState,
} from '@/lib/account/order-types';
import { TIMELINE_STEP_IDS } from '@/lib/account/order-types';
import { safeCustomerTrackingUrl } from '@/lib/account/safe-tracking-url';
import { upsertOwnedShopifyOrderLink } from '@/lib/account/shopify-order-links';

export type {
  CustomerOrderDetail,
  CustomerOrderItem,
  CustomerOrderSummary,
  CustomerShippingAddress,
  CustomerTracking,
  TimelineStepId,
  TimelineStepState,
} from '@/lib/account/order-types';

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

type FulfillmentNode = NonNullable<ShopifyCustomerOrderNode['fulfillments']>[number];

function isActiveFulfillment(f: FulfillmentNode): boolean {
  const status = upper(f.status);
  return status !== 'CANCELLED' && status !== 'ERROR' && status !== 'FAILURE';
}

function activeFulfillments(node: ShopifyCustomerOrderNode): FulfillmentNode[] {
  return (node.fulfillments || []).filter(isActiveFulfillment);
}

const DELIVERED_DISPLAY = new Set(['DELIVERED']);
const OUT_FOR_DELIVERY_DISPLAY = new Set(['OUT_FOR_DELIVERY']);
const SHIPPED_DISPLAY = new Set([
  'IN_TRANSIT',
  'FULFILLED',
  'MARKED_AS_FULFILLED',
  'PICKED_UP',
  'READY_FOR_PICKUP',
  'ATTEMPTED_DELIVERY',
  'NOT_DELIVERED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]);

function fulfillmentDelivered(node: ShopifyCustomerOrderNode): boolean {
  return activeFulfillments(node).some((f) => {
    if (f.deliveredAt) return true;
    return DELIVERED_DISPLAY.has(upper(f.displayStatus));
  });
}

function fulfillmentOutForDelivery(node: ShopifyCustomerOrderNode): boolean {
  return activeFulfillments(node).some((f) => OUT_FOR_DELIVERY_DISPLAY.has(upper(f.displayStatus)));
}

function fulfillmentShipped(node: ShopifyCustomerOrderNode): boolean {
  const display = upper(node.displayFulfillmentStatus);
  if (display === 'FULFILLED' || display === 'PARTIALLY_FULFILLED') return true;

  return activeFulfillments(node).some((f) => {
    const st = upper(f.status);
    const ds = upper(f.displayStatus);
    const hasTracking = (f.trackingInfo || []).some((t) => Boolean(t.number || t.url));
    if (f.inTransitAt || f.deliveredAt) return true;
    if (hasTracking) return true;
    if (st === 'SUCCESS') return true;
    return SHIPPED_DISPLAY.has(ds);
  });
}

function mapFulfillmentStatusKey(status: string | null | undefined): FulfillmentStatusKey | null {
  switch (upper(status)) {
    case 'PENDING':
      return 'pending';
    case 'OPEN':
      return 'open';
    case 'SUCCESS':
      return 'success';
    case 'CANCELLED':
      return 'cancelled';
    case 'ERROR':
      return 'error';
    case 'FAILURE':
      return 'failure';
    default:
      return null;
  }
}

function mapShipmentStatusKey(displayStatus: string | null | undefined): ShipmentStatusKey | null {
  switch (upper(displayStatus)) {
    case 'CONFIRMED':
      return 'confirmed';
    case 'IN_TRANSIT':
      return 'in_transit';
    case 'OUT_FOR_DELIVERY':
      return 'out_for_delivery';
    case 'DELIVERED':
      return 'delivered';
    case 'DELAYED':
      return 'delayed';
    case 'READY_FOR_PICKUP':
      return 'ready_for_pickup';
    case 'PICKED_UP':
      return 'picked_up';
    case 'ATTEMPTED_DELIVERY':
      return 'attempted_delivery';
    case 'FULFILLED':
    case 'MARKED_AS_FULFILLED':
      return 'fulfilled';
    default:
      return null;
  }
}

function firstTimestamp(
  fulfillments: FulfillmentNode[],
  pick: (f: FulfillmentNode) => string | null | undefined
): string | null {
  for (const f of fulfillments) {
    const value = pick(f);
    if (value) return value;
  }
  return null;
}

export function mapTimeline(node: ShopifyCustomerOrderNode): {
  currentStep: TimelineStepId;
  timeline: { id: TimelineStepId; state: TimelineStepState; at: string | null }[];
} {
  const cancelled = Boolean(node.cancelledAt);
  const financial = upper(node.displayFinancialStatus);
  const fulfillment = upper(node.displayFulfillmentStatus);
  const onHold = fulfillment === 'ON_HOLD';
  const orderConfirmed = !cancelled && financial !== 'VOIDED' && node.confirmed !== false;

  const delivered = !cancelled && fulfillmentDelivered(node);
  const outForDeliveryNow = !cancelled && fulfillmentOutForDelivery(node);
  const shipped = !cancelled && (delivered || outForDeliveryNow || fulfillmentShipped(node));
  const preparing =
    !cancelled && orderConfirmed && !onHold && (shipped || !['', 'ON_HOLD'].includes(fulfillment));

  let currentStep: TimelineStepId = 'placed';
  if (!cancelled) {
    if (delivered) currentStep = 'delivered';
    else if (outForDeliveryNow) currentStep = 'out_for_delivery';
    else if (shipped) currentStep = 'shipped';
    else if (preparing) currentStep = 'preparing';
    else if (orderConfirmed) currentStep = 'confirmed';
  }

  const active = activeFulfillments(node);
  const atById: Record<TimelineStepId, string | null> = {
    placed: node.createdAt || null,
    confirmed: orderConfirmed ? node.createdAt || null : null,
    preparing: orderConfirmed ? node.createdAt || null : null,
    shipped:
      firstTimestamp(active, (f) => f.inTransitAt) || firstTimestamp(active, (f) => f.createdAt),
    out_for_delivery: firstTimestamp(active, (f) =>
      OUT_FOR_DELIVERY_DISPLAY.has(upper(f.displayStatus)) || f.deliveredAt
        ? f.deliveredAt || f.inTransitAt || f.createdAt
        : null
    ),
    delivered: firstTimestamp(active, (f) => f.deliveredAt),
  };

  const reached: Record<TimelineStepId, boolean> = {
    placed: true,
    confirmed: orderConfirmed,
    preparing,
    shipped,
    out_for_delivery: outForDeliveryNow || delivered,
    delivered,
  };

  const currentIndex = TIMELINE_STEP_IDS.indexOf(currentStep);

  const timeline = TIMELINE_STEP_IDS.map((id, index) => {
    let state: TimelineStepState = 'upcoming';
    if (cancelled && id !== 'placed') {
      state = 'upcoming';
    } else if (id === currentStep) {
      state = 'current';
    } else if (reached[id] && index < currentIndex) {
      state = 'complete';
    } else if (delivered && id !== 'delivered') {
      state = 'complete';
    }
    return {
      id,
      state,
      at: state === 'upcoming' ? null : atById[id],
    };
  });

  if (!cancelled && currentStep === 'delivered') {
    for (const step of timeline) {
      if (step.id !== 'delivered') step.state = 'complete';
    }
  }

  return { currentStep: cancelled ? 'placed' : currentStep, timeline };
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
    const shipmentStatusKey = mapShipmentStatusKey(f.displayStatus);
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
  const { currentStep } = mapTimeline(node);
  const cancelled = Boolean(node.cancelledAt);
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
    cancelled,
    currentStep: cancelled ? 'placed' : currentStep,
    statusKey: cancelled ? 'cancelled' : currentStep,
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
    estimatedDeliveryAt: firstTimestamp(activeFulfillments(node), (f) => f.estimatedDeliveryAt),
    deliveredAt: firstTimestamp(activeFulfillments(node), (f) => f.deliveredAt),
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
  if (links.some((l) => isShopifyOrderGid(l.shopify_order_id))) return links;

  try {
    const discovered = await fetchShopifyOrderRefsForUser(userId);
    if (!discovered.length) return links;
    await persistDiscoveredLinks(userId, discovered);
    links = await loadOwnedLinks(supabase, userId);
    if (!links.some((l) => isShopifyOrderGid(l.shopify_order_id))) {
      return discovered
        .filter((order) => isShopifyOrderGid(order.id))
        .map((order) => ({
          shopify_order_id: order.id,
          shopify_order_name: order.name,
          created_at: null,
        }));
    }
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
