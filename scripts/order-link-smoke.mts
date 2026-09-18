/**
 * Order-link ownership regression tests.
 * Mapping/GID helpers only — no Shopify writes, no checkout UI.
 *
 * Usage: npm run test:order-links
 */
import {
  isResolvedShopifyOrder,
  isShopifyOrderGid,
  retryUntilResolvedOrder,
} from '@/lib/shopify/order-gid';
import {
  decideOrderLinkWrite,
  mergeRecoveredOrderLinks,
  missingOwnedOrderRefs,
} from '@/lib/account/order-link-recovery';

const ORDER_1014 = 'gid://shopify/Order/7096711119092';
const ORDER_1018 = 'gid://shopify/Order/7104796164340';
const ORDER_1017 = 'gid://shopify/Order/7098863288564';
const DRAFT_D18 = 'gid://shopify/DraftOrder/1343944655092';
const USER_A = 'c9721e71-46d6-422a-9343-6c75a4eaaaf1';
const USER_B = '68b9c53d-811c-4f46-b9c0-23bbc5813e58';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

assert('Order GID accepted', isShopifyOrderGid(ORDER_1018));
assert('DraftOrder GID rejected', !isShopifyOrderGid(DRAFT_D18));
assert('empty GID rejected', !isShopifyOrderGid(''));

assert(
  'resolved order requires Order GID and not orderUnresolved',
  isResolvedShopifyOrder({ orderId: ORDER_1018, orderUnresolved: false })
);
assert(
  'unresolved flag skips link even with Order GID',
  !isResolvedShopifyOrder({ orderId: ORDER_1018, orderUnresolved: true })
);
assert(
  'DraftOrder confirmation is not resolved',
  !isResolvedShopifyOrder({ orderId: DRAFT_D18, orderUnresolved: true })
);

assert(
  'draft GID write skipped',
  decideOrderLinkWrite({
    actorUserId: USER_A,
    shopifyOrderId: DRAFT_D18,
    existingOwnerId: null,
  }) === 'skipped'
);
assert(
  'new Order GID inserts',
  decideOrderLinkWrite({
    actorUserId: USER_A,
    shopifyOrderId: ORDER_1018,
    existingOwnerId: null,
  }) === 'insert'
);
assert(
  'same user updates existing #1014',
  decideOrderLinkWrite({
    actorUserId: USER_A,
    shopifyOrderId: ORDER_1014,
    existingOwnerId: USER_A,
  }) === 'update'
);
assert(
  'foreign GID #1017 refused',
  decideOrderLinkWrite({
    actorUserId: USER_A,
    shopifyOrderId: ORDER_1017,
    existingOwnerId: USER_B,
  }) === 'refused_foreign'
);

const existing = [ORDER_1014, ORDER_1017];
const discovered = [
  { id: ORDER_1014, name: '#1014' },
  { id: ORDER_1018, name: '#1018' },
  { id: DRAFT_D18, name: '#D18' },
  { id: ORDER_1017, name: '#1017' },
];
const missing = missingOwnedOrderRefs(existing, discovered);
assert(
  'recovery finds #1018 even when older GIDs exist',
  missing.length === 1 && missing[0].id === ORDER_1018 && missing[0].name === '#1018'
);
assert(
  'recovery does not re-add #1014 or attach a DraftOrder GID',
  !missing.some((row) => row.id === ORDER_1014 || row.id === DRAFT_D18)
);

const merged = mergeRecoveredOrderLinks(
  [
    {
      shopify_order_id: ORDER_1014,
      shopify_order_name: '#1014',
      created_at: '2026-09-14T11:52:27.297896+00:00',
    },
  ],
  [
    { id: ORDER_1018, name: '#1018' },
    { id: ORDER_1014, name: '#1014' },
  ]
);
assert(
  'merged list prepends recovered #1018 and keeps #1014',
  merged[0].shopify_order_id === ORDER_1018 &&
    merged[1].shopify_order_id === ORDER_1014 &&
    merged.length === 2
);

const delays: number[] = [];
const retryResult = await retryUntilResolvedOrder(
  async () => {
    if (delays.length < 2) {
      return { orderId: DRAFT_D18, orderUnresolved: true };
    }
    return { orderId: ORDER_1018, orderUnresolved: false };
  },
  {
    attempts: 5,
    baseDelayMs: 10,
    maxDelayMs: 40,
    sleep: async (ms) => {
      delays.push(ms);
    },
  }
);
assert(
  'retry returns Order GID after unresolved drafts',
  retryResult.orderId === ORDER_1018 && retryResult.orderUnresolved === false
);
assert('retry used bounded backoff', delays.length === 2 && delays[0] === 10 && delays[1] === 20);

let threw = false;
try {
  await retryUntilResolvedOrder(
    async () => {
      throw new Error('not completed');
    },
    { attempts: 2, baseDelayMs: 0, sleep: async () => undefined }
  );
} catch (err) {
  threw = err instanceof Error && err.message === 'not completed';
}
assert('retry rethrows when every attempt fails', threw);

if (failed) {
  console.error(`order-link smoke failed: ${failed}`);
  process.exit(1);
}
console.log('order-link smoke OK');
process.exit(0);
