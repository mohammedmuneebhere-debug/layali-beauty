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
  TimelineStepId,
  TimelineStepState,
} from '@/lib/account/order-types';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';

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

function isCodOrder(node: ShopifyCustomerOrderNode): boolean {
  const tags = (node.tags || []).map((t) => t.toLowerCase());
  const gateways = (node.paymentGatewayNames || []).map((g) => g.toLowerCase());
  if (tags.some((t) => t.includes('cod') || t.includes('cash-on-delivery'))) return true;
  if (gateways.some((g) => g.includes('cash') || g.includes('cod'))) return true;
  return true;
}

function fulfillmentShipped(node: ShopifyCustomerOrderNode): boolean {
  const fulfillments = node.fulfillments || [];
  const active = fulfillments.filter((f) => {
    const status = (f.status || '').toUpperCase();
    return status && status !== 'CANCELLED' && status !== 'ERROR' && status !== 'FAILURE';
  });
  if (!active.length) return false;

  const display = (node.displayFulfillmentStatus || '').toUpperCase();
  if (['FULFILLED', 'PARTIALLY_FULFILLED', 'IN_PROGRESS'].includes(display)) return true;

  return active.some((f) => {
    const st = (f.status || '').toUpperCase();
    const ds = (f.displayStatus || '').toUpperCase();
    const hasTracking = (f.trackingInfo || []).some((t) => Boolean(t.number || t.url));
    if (hasTracking) return true;
    if (st === 'SUCCESS') return true;
    if (
      [
        'FULFILLED',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'PICKED_UP',
        'CONFIRMED',
        'LABEL_PRINTED',
        'LABEL_PURCHASED',
        'READY_FOR_PICKUP',
        'MARKED_AS_FULFILLED',
      ].includes(ds)
    ) {
      return true;
    }
    return false;
  });
}

function fulfillmentDelivered(node: ShopifyCustomerOrderNode): boolean {
  return (node.fulfillments || []).some((f) => {
    if (f.deliveredAt) return true;
    const ds = (f.displayStatus || '').toUpperCase();
    return ds === 'DELIVERED';
  });
}

export function mapTimeline(node: ShopifyCustomerOrderNode): {
  currentStep: TimelineStepId;
  timeline: { id: TimelineStepId; state: TimelineStepState; at: string | null }[];
} {
  const cancelled = Boolean(node.cancelledAt);
  const delivered = !cancelled && fulfillmentDelivered(node);
  const shipped = delivered || (!cancelled && fulfillmentShipped(node));
  const processing = !cancelled;

  let currentStep: TimelineStepId = 'processing';
  if (delivered) currentStep = 'delivered';
  else if (shipped) currentStep = 'shipped';
  else if (processing) currentStep = 'processing';

  const shippedAt =
    node.fulfillments?.find((f) => f.createdAt)?.createdAt || null;
  const deliveredAt =
    node.fulfillments?.find((f) => f.deliveredAt)?.deliveredAt || null;

  const ids: TimelineStepId[] = ['placed', 'processing', 'shipped', 'delivered'];
  const reached: Record<TimelineStepId, boolean> = {
    placed: true,
    processing,
    shipped,
    delivered,
  };

  const timeline = ids.map((id) => {
    let state: TimelineStepState = 'upcoming';
    if (cancelled && id !== 'placed') {
      state = 'upcoming';
    } else if (id === currentStep) {
      state = 'current';
    } else if (reached[id] && ids.indexOf(id) < ids.indexOf(currentStep)) {
      state = 'complete';
    } else if (delivered && id !== 'delivered') {
      state = 'complete';
    }
    const at =
      id === 'placed'
        ? node.createdAt || null
        : id === 'shipped'
          ? shippedAt
          : id === 'delivered'
            ? deliveredAt
            : node.createdAt || null;
    return { id, state, at: state === 'upcoming' ? null : at };
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
  for (const f of node.fulfillments || []) {
    for (const t of f.trackingInfo || []) {
      const number = t.number?.trim() || null;
      const url = t.url?.trim() || null;
      const company = t.company?.trim() || null;
      if (!number && !url) continue;
      const key = `${company || ''}|${number || ''}|${url || ''}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ company, number, url });
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
  };
}

async function persistDiscoveredLinks(
  supabase: SupabaseClient,
  userId: string,
  discovered: { id: string; name: string }[]
) {
  for (const order of discovered) {
    if (!isShopifyOrderGid(order.id)) continue;

    const { data: existing } = await supabase
      .from('shopify_order_links')
      .select('supabase_user_id')
      .eq('shopify_order_id', order.id)
      .maybeSingle();

    if (existing?.supabase_user_id && existing.supabase_user_id !== userId) {
      continue;
    }

    const row = {
      supabase_user_id: userId,
      shopify_order_id: order.id,
      shopify_order_name: order.name,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase
      .from('shopify_order_links')
      .upsert(row, { onConflict: 'shopify_order_id' });

    if (error && hasServiceRoleKey()) {
      const admin = createServiceClient();
      const { data: owned } = await admin
        .from('shopify_order_links')
        .select('supabase_user_id')
        .eq('shopify_order_id', order.id)
        .maybeSingle();
      if (owned?.supabase_user_id && owned.supabase_user_id !== userId) {
        continue;
      }
      ({ error } = await admin.from('shopify_order_links').upsert(row, {
        onConflict: 'shopify_order_id',
      }));
    }

    if (error) {
      console.error('shopify_order_links recovery upsert failed', error.message);
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
    await persistDiscoveredLinks(supabase, userId, discovered);
    links = await loadOwnedLinks(supabase, userId);
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
