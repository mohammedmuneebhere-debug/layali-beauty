/**
 * Pure Shopify → customer status mapping. No network imports.
 */
import type {
  FulfillmentStatusKey,
  ShipmentStatusKey,
  TimelineStepId,
  TimelineStepState,
} from './order-types';

/** Keep in sync with TIMELINE_STEP_IDS in order-types.ts */
const TIMELINE_STEP_IDS = [
  'placed',
  'confirmed',
  'preparing',
  'shipped',
  'out_for_delivery',
  'delivered',
] as const satisfies readonly TimelineStepId[];

export type OrderStatusFulfillment = {
  status?: string | null;
  displayStatus?: string | null;
  createdAt?: string | null;
  inTransitAt?: string | null;
  deliveredAt?: string | null;
  estimatedDeliveryAt?: string | null;
  trackingInfo?: {
    company?: string | null;
    number?: string | null;
    url?: string | null;
  }[];
  events?: {
    nodes?: {
      status?: string | null;
      happenedAt?: string | null;
    }[];
  } | null;
};

export type OrderStatusNode = {
  createdAt?: string | null;
  cancelledAt?: string | null;
  confirmed?: boolean | null;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  fulfillments?: OrderStatusFulfillment[];
};

function upper(value: string | null | undefined): string {
  return (value || '').trim().toUpperCase();
}

export function isActiveFulfillment(f: OrderStatusFulfillment): boolean {
  const status = upper(f.status);
  return status !== 'CANCELLED' && status !== 'ERROR' && status !== 'FAILURE';
}

export function activeFulfillments(node: OrderStatusNode): OrderStatusFulfillment[] {
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

function latestFulfillmentEventStatus(f: OrderStatusFulfillment): string {
  let status = '';
  let at = '';
  for (const event of f.events?.nodes || []) {
    const next = upper(event.status);
    if (!next) continue;
    const happened = event.happenedAt || '';
    if (!status || happened >= at) {
      status = next;
      at = happened;
    }
  }
  return status;
}

function shipmentRank(status: string): number {
  if (DELIVERED_DISPLAY.has(status)) return 4;
  if (OUT_FOR_DELIVERY_DISPLAY.has(status)) return 3;
  if (SHIPPED_DISPLAY.has(status)) return 2;
  return status ? 1 : 0;
}

/** Prefer a later shipment event when Admin displayStatus has not caught up. */
export function fulfillmentShipmentStatus(f: OrderStatusFulfillment): string {
  const display = upper(f.displayStatus);
  const event = latestFulfillmentEventStatus(f);
  return shipmentRank(event) > shipmentRank(display) ? event : display;
}

function fulfillmentDelivered(node: OrderStatusNode): boolean {
  return activeFulfillments(node).some((f) => {
    if (f.deliveredAt) return true;
    return DELIVERED_DISPLAY.has(fulfillmentShipmentStatus(f));
  });
}

function fulfillmentOutForDelivery(node: OrderStatusNode): boolean {
  return activeFulfillments(node).some((f) =>
    OUT_FOR_DELIVERY_DISPLAY.has(fulfillmentShipmentStatus(f))
  );
}

function fulfillmentShipped(node: OrderStatusNode): boolean {
  const display = upper(node.displayFulfillmentStatus);
  if (display === 'FULFILLED' || display === 'PARTIALLY_FULFILLED') return true;

  return activeFulfillments(node).some((f) => {
    const st = upper(f.status);
    const ds = fulfillmentShipmentStatus(f);
    const hasTracking = (f.trackingInfo || []).some((t) => Boolean(t.number || t.url));
    if (f.inTransitAt || f.deliveredAt) return true;
    if (hasTracking) return true;
    if (st === 'SUCCESS') return true;
    return SHIPPED_DISPLAY.has(ds);
  });
}

export function mapFulfillmentStatusKey(
  status: string | null | undefined
): FulfillmentStatusKey | null {
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

export function mapShipmentStatusKey(
  displayStatus: string | null | undefined
): ShipmentStatusKey | null {
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
  fulfillments: OrderStatusFulfillment[],
  pick: (f: OrderStatusFulfillment) => string | null | undefined
): string | null {
  for (const f of fulfillments) {
    const value = pick(f);
    if (value) return value;
  }
  return null;
}

export function mapTimeline(node: OrderStatusNode): {
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
      OUT_FOR_DELIVERY_DISPLAY.has(fulfillmentShipmentStatus(f)) || f.deliveredAt
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

export function mapCustomerFacingStatus(node: OrderStatusNode): {
  cancelled: boolean;
  currentStep: TimelineStepId;
  statusKey: TimelineStepId | 'cancelled';
} {
  const cancelled = Boolean(node.cancelledAt);
  const { currentStep } = mapTimeline(node);
  return {
    cancelled,
    currentStep: cancelled ? 'placed' : currentStep,
    statusKey: cancelled ? 'cancelled' : currentStep,
  };
}
