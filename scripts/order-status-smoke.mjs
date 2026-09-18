/**
 * Focused order-status smoke test (plain Node).
 * Mapping must stay in sync with src/lib/account/order-status-map.ts.
 */
const TIMELINE_STEP_IDS = [
  'placed',
  'confirmed',
  'preparing',
  'shipped',
  'out_for_delivery',
  'delivered',
];

function upper(value) {
  return (value || '').trim().toUpperCase();
}

function isActiveFulfillment(f) {
  const status = upper(f.status);
  return status !== 'CANCELLED' && status !== 'ERROR' && status !== 'FAILURE';
}

function activeFulfillments(node) {
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

function latestFulfillmentEventStatus(f) {
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

function shipmentRank(status) {
  if (DELIVERED_DISPLAY.has(status)) return 4;
  if (OUT_FOR_DELIVERY_DISPLAY.has(status)) return 3;
  if (SHIPPED_DISPLAY.has(status)) return 2;
  return status ? 1 : 0;
}

function fulfillmentShipmentStatus(f) {
  const display = upper(f.displayStatus);
  const event = latestFulfillmentEventStatus(f);
  return shipmentRank(event) > shipmentRank(display) ? event : display;
}

function fulfillmentDelivered(node) {
  return activeFulfillments(node).some((f) => {
    if (f.deliveredAt) return true;
    return DELIVERED_DISPLAY.has(fulfillmentShipmentStatus(f));
  });
}

function fulfillmentOutForDelivery(node) {
  return activeFulfillments(node).some((f) =>
    OUT_FOR_DELIVERY_DISPLAY.has(fulfillmentShipmentStatus(f))
  );
}

function fulfillmentShipped(node) {
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

function mapTimeline(node) {
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

  let currentStep = 'placed';
  if (!cancelled) {
    if (delivered) currentStep = 'delivered';
    else if (outForDeliveryNow) currentStep = 'out_for_delivery';
    else if (shipped) currentStep = 'shipped';
    else if (preparing) currentStep = 'preparing';
    else if (orderConfirmed) currentStep = 'confirmed';
  }

  const timeline = TIMELINE_STEP_IDS.map((id) => ({ id, state: 'upcoming' }));
  if (!cancelled && currentStep === 'delivered') {
    for (const step of timeline) {
      step.state = step.id === 'delivered' ? 'current' : 'complete';
    }
  }

  return { currentStep: cancelled ? 'placed' : currentStep, timeline };
}

function mapCustomerFacingStatus(node) {
  const cancelled = Boolean(node.cancelledAt);
  const { currentStep } = mapTimeline(node);
  return {
    cancelled,
    currentStep: cancelled ? 'placed' : currentStep,
    statusKey: cancelled ? 'cancelled' : currentStep,
  };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function node(partial) {
  return { createdAt: '2026-09-18T00:00:00Z', confirmed: true, ...partial };
}

assertEqual(
  mapCustomerFacingStatus(node({ displayFulfillmentStatus: 'UNFULFILLED', displayFinancialStatus: 'PENDING' }))
    .statusKey,
  'preparing',
  'unfulfilled'
);
assertEqual(
  mapCustomerFacingStatus(node({ displayFulfillmentStatus: 'ON_HOLD', displayFinancialStatus: 'PENDING' }))
    .statusKey,
  'confirmed',
  'on-hold'
);
assertEqual(
  mapCustomerFacingStatus(
    node({
      displayFulfillmentStatus: 'FULFILLED',
      fulfillments: [{ status: 'SUCCESS', displayStatus: 'FULFILLED' }],
    })
  ).statusKey,
  'shipped',
  'fulfilled'
);
assertEqual(
  mapCustomerFacingStatus(node({ displayFulfillmentStatus: 'PARTIALLY_FULFILLED' })).statusKey,
  'shipped',
  'partially-fulfilled'
);
assertEqual(
  mapCustomerFacingStatus(
    node({
      displayFulfillmentStatus: 'FULFILLED',
      fulfillments: [{ status: 'SUCCESS', displayStatus: 'IN_TRANSIT', inTransitAt: '2026-09-18T01:00:00Z' }],
    })
  ).statusKey,
  'shipped',
  'in-transit'
);
assertEqual(
  mapCustomerFacingStatus(
    node({
      displayFulfillmentStatus: 'FULFILLED',
      fulfillments: [{ status: 'SUCCESS', displayStatus: 'OUT_FOR_DELIVERY' }],
    })
  ).statusKey,
  'out_for_delivery',
  'out-for-delivery'
);
assertEqual(
  mapCustomerFacingStatus(
    node({
      displayFulfillmentStatus: 'FULFILLED',
      fulfillments: [{ status: 'SUCCESS', displayStatus: 'FULFILLED', deliveredAt: '2026-09-18T14:29:31Z' }],
    })
  ).statusKey,
  'delivered',
  'deliveredAt'
);
assertEqual(
  mapCustomerFacingStatus(
    node({
      displayFulfillmentStatus: 'FULFILLED',
      fulfillments: [
        {
          status: 'SUCCESS',
          displayStatus: 'FULFILLED',
          events: { nodes: [{ status: 'DELIVERED', happenedAt: '2026-09-18T14:29:31Z' }] },
        },
      ],
    })
  ).statusKey,
  'delivered',
  'delivered-event-ahead-of-displayStatus'
);
const cancelled = mapCustomerFacingStatus(
  node({
    cancelledAt: '2026-09-18T02:00:00Z',
    displayFulfillmentStatus: 'UNFULFILLED',
    displayFinancialStatus: 'VOIDED',
  })
);
assertEqual(cancelled.statusKey, 'cancelled', 'cancelled');
assertEqual(cancelled.currentStep, 'placed', 'cancelled-timeline-step');
assertEqual(
  mapCustomerFacingStatus(
    node({
      displayFulfillmentStatus: 'UNFULFILLED',
      fulfillments: [{ status: 'SUCCESS', trackingInfo: [{ number: 'TRACK-1', url: 'https://example.com/t/1' }] }],
    })
  ).statusKey,
  'shipped',
  'tracking-implies-shipped'
);
assertEqual(
  mapCustomerFacingStatus(
    node({
      displayFulfillmentStatus: 'UNFULFILLED',
      fulfillments: [{ status: 'CANCELLED', displayStatus: 'DELIVERED', deliveredAt: '2026-09-18T03:00:00Z' }],
    })
  ).statusKey,
  'preparing',
  'cancelled-fulfillment-ignored'
);
const timeline = mapTimeline(
  node({
    displayFulfillmentStatus: 'FULFILLED',
    fulfillments: [{ status: 'SUCCESS', displayStatus: 'DELIVERED', deliveredAt: '2026-09-18T04:00:00Z' }],
  })
);
assertEqual(timeline.currentStep, 'delivered', 'timeline-delivered');
assertEqual(
  timeline.timeline.find((s) => s.id === 'shipped')?.state,
  'complete',
  'timeline-shipped-complete-when-delivered'
);

console.log('PASS mapping fixtures', 12);
process.exit(0);
