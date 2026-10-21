/**
 * Server-only customer order reads.
 * Ownership is the Shopify order customer, matched to the Customer Account session.
 */
import {
  fetchOrdersForShopifyCustomer,
  type ShopifyCustomerOrderNode,
} from '@/lib/shopify/admin-orders';
import { shopifyImageUrl } from '@/lib/shopify/image';
import { displayOrderNumber, isForbiddenOrderRef, refsMatchOrderName, toCustomerOrderRef } from '@/lib/account/order-ref';
import type {
  CustomerOrderDetail,
  CustomerOrderItem,
  CustomerOrderSummary,
  CustomerTracking,
} from '@/lib/account/order-types';
import { safeCustomerTrackingUrl } from '@/lib/account/safe-tracking-url';
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

export async function listCustomerOrders(customerGid: string): Promise<CustomerOrderSummary[]> {
  const nodes = await fetchOrdersForShopifyCustomer(customerGid);
  const orders: CustomerOrderSummary[] = [];
  for (const node of nodes) {
    const summary = mapSummary(node, node.createdAt || null);
    if (summary) orders.push(summary);
  }
  return orders;
}

export async function getCustomerOrder(
  customerGid: string,
  orderRef: string
): Promise<CustomerOrderDetail | null> {
  if (isForbiddenOrderRef(orderRef)) return null;
  const nodes = await fetchOrdersForShopifyCustomer(customerGid);
  const node = nodes.find((candidate) => refsMatchOrderName(candidate.name, orderRef));
  if (!node) return null;
  return mapDetail(node, node.createdAt || null);
}
