/**
 * Server-only Shopify Admin draft-order helpers for Layali custom COD checkout.
 * Never import from Client Components. Never expose Admin tokens.
 */
import { createHash } from 'node:crypto';
import { LAYALI_DELIVERY_FEE } from '@/lib/checkout/pricing';
import { shopifyAdminFetch } from './admin';
import {
  isResolvedShopifyOrder,
  isShopifyOrderGid,
  retryUntilResolvedOrder,
} from './order-gid';

export { isShopifyOrderGid } from './order-gid';

/**
 * Customer account Shopify reads. Mutations keep the 90s / 3-retry Admin budget.
 * One 15s attempt so a customer is not held for ~90s×4 while Shopify is down.
 */
const CUSTOMER_ORDER_ADMIN = {
  retries: 0,
  timeoutMs: 15_000,
  allowPartialData: true,
  revalidate: 0,
} as const;

export type DraftOrderShippingAddress = {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string | null;
  city: string;
  province?: string | null;
  countryCode: string;
  zip?: string | null;
  phone: string;
};

export type DraftOrderLineInput = {
  variantId: string;
  quantity: number;
};

export type CreatedShopifyOrder = {
  draftOrderId: string;
  /** Real Shopify Order GID when readable; otherwise draft GID (orderUnresolved). */
  orderId: string;
  orderName: string;
  financialStatus: string | null;
  totalAmount: number;
  currencyCode: string;
  paymentGatewayNames: string[];
  /** True when draft completed but Order fields were not readable (e.g. missing read_orders). */
  orderUnresolved?: boolean;
};

/**
 * Shopify order/draft-order tags are limited to 40 characters each and may only
 * contain letters, numbers, and hyphens. (Product tags allow 255; do not mix.)
 * Oversized tags make draftOrderCreate return userErrors such as
 * "Title Tag exceeds the maximum length of 40 characters" — once per tag —
 * which must never be shown as customer checkout validation.
 */
export const SHOPIFY_DRAFT_ORDER_TAG_MAX = 40;

export const SUBMISSION_TAG_PREFIX = 'ls-';
export const USER_TAG_PREFIX = 'lu-';
export const USER_SUBMISSION_TAG_PREFIX = 'lus-';

/** Colon + raw UUID prefixes that exceeded the 40-char order-tag limit. */
export const LEGACY_SUBMISSION_TAG_PREFIX = 'layali-sub:';
export const LEGACY_USER_TAG_PREFIX = 'layali-u:';

const GENERIC_DRAFT_ORDER_ERROR = 'Could not place your order. Please try again.';

/** Shopify SEO / order-tag limit messages — not customer checkout validation. */
const NON_CUSTOMER_DRAFT_ERROR =
  /title\s*tag|title_tag|meta\s*description|\bseo\b|exceeds the maximum length of 40 characters/i;

/** Escape Shopify search-syntax specials inside a field value (`: \ ( )`). */
export function escapeShopifySearchValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/([:()])/g, '\\$1');
}

/** Build `tag:...` query with value escaping (do not escape the field separator). */
export function shopifyTagQuery(tag: string): string {
  return `tag:${escapeShopifySearchValue(tag)}`;
}

function compactTagToken(value: string, maxLen: number): string {
  const compact = value.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (compact.length >= Math.min(16, maxLen)) {
    return compact.slice(0, maxLen);
  }
  return createHash('sha256').update(value.trim()).digest('hex').slice(0, maxLen);
}

function isValidShopifyDraftOrderTag(tag: string): boolean {
  return (
    tag.length > 0 &&
    tag.length <= SHOPIFY_DRAFT_ORDER_TAG_MAX &&
    /^[A-Za-z0-9-]+$/.test(tag)
  );
}

/** Drop tags Shopify would reject so tag-limit userErrors never reach checkout. */
export function filterShopifyDraftOrderTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!isValidShopifyDraftOrderTag(tag)) {
      if (tag) {
        console.error('Layali COD: dropped Shopify draft-order tag (invalid charset or >40 chars)', {
          length: tag.length,
          preview: tag.slice(0, 64),
        });
      }
      continue;
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function submissionTag(submissionId: string): string {
  return `${SUBMISSION_TAG_PREFIX}${compactTagToken(submissionId, 32)}`;
}

export function userOwnershipTag(userId: string): string {
  return `${USER_TAG_PREFIX}${compactTagToken(userId, 32)}`;
}

/** User-scoped submission tag (fits Shopify's 40-char order-tag limit). */
export function userSubmissionTag(userId: string, submissionId: string): string {
  const userTok = compactTagToken(userId, 16);
  const subTok = compactTagToken(submissionId, 16);
  return `${USER_SUBMISSION_TAG_PREFIX}${userTok}${subTok}`;
}

function legacySubmissionTag(submissionId: string): string {
  return `${LEGACY_SUBMISSION_TAG_PREFIX}${submissionId.trim()}`;
}

function legacyUserOwnershipTag(userId: string): string {
  return `${LEGACY_USER_TAG_PREFIX}${userId.trim()}`;
}

function legacyUserSubmissionTag(userId: string, submissionId: string): string {
  return `${LEGACY_SUBMISSION_TAG_PREFIX}${userId.trim()}:${submissionId.trim()}`;
}

function isNonCustomerShopifyDraftError(err: {
  field?: string[] | null;
  message: string;
}): boolean {
  const field = (err.field || []).join('.').toLowerCase();
  const msg = err.message || '';
  if (NON_CUSTOMER_DRAFT_ERROR.test(msg)) return true;
  if (/\btitle_tag\b|\bseo\b/.test(field)) return true;
  if (/(^|\.)tags$/.test(field) && /maximum length|too long|40 character/i.test(msg)) {
    return true;
  }
  return false;
}

/**
 * Map Shopify draft-order userErrors to customer-facing checkout text.
 * Dedupes identical messages and omits SEO / title-tag / order-tag-limit noise.
 */
export function customerFacingDraftUserErrors(
  userErrors: { field?: string[] | null; message: string }[]
): string | null {
  const seen = new Set<string>();
  const messages: string[] = [];
  for (const err of userErrors) {
    if (isNonCustomerShopifyDraftError(err)) {
      console.error('Layali COD: omitted non-customer Shopify userError', {
        field: err.field,
        message: err.message,
      });
      continue;
    }
    const msg = (err.message || '').trim();
    if (!msg) continue;
    const key = msg.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    messages.push(msg);
  }
  return messages.length ? messages.join('; ') : null;
}

const ORDER_FIELDS = `#graphql
  fragment LayaliCodOrderFields on Order {
    id
    name
    displayFinancialStatus
    paymentGatewayNames
    totalPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    shippingAddress {
      address1
      city
      countryCodeV2
      phone
      name
    }
  }
`;

const DRAFT_ORDER_CREATE = `#graphql
  mutation LayaliDraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        status
        totalPrice
        currencyCode
        shippingLine {
          title
          originalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
        lineItems(first: 100) {
          nodes {
            quantity
            variant {
              id
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/** Complete only — do not request Order fields here (scope isolation). */
const DRAFT_ORDER_COMPLETE = `#graphql
  mutation LayaliDraftOrderComplete($id: ID!, $paymentPending: Boolean) {
    draftOrderComplete(id: $id, paymentPending: $paymentPending) {
      draftOrder {
        id
        name
        status
        totalPrice
        currencyCode
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DRAFT_ORDER_RESOLVE = `#graphql
  ${ORDER_FIELDS}
  query LayaliResolveDraftOrder($id: ID!) {
    draftOrder(id: $id) {
      id
      name
      status
      email
      totalPrice
      currencyCode
      note2
      tags
      order {
        ...LayaliCodOrderFields
      }
    }
  }
`;

const DRAFT_ORDERS_BY_TAG = `#graphql
  ${ORDER_FIELDS}
  query LayaliDraftOrdersBySubmissionTag($query: String!) {
    draftOrders(first: 5, query: $query, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        name
        status
        email
        totalPrice
        currencyCode
        note2
        tags
        order {
          ...LayaliCodOrderFields
        }
      }
    }
  }
`;

const RECENT_COMPLETED_DRAFTS = `#graphql
  ${ORDER_FIELDS}
  query LayaliRecentCompletedDrafts {
    draftOrders(first: 25, query: "status:completed", sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        name
        status
        email
        totalPrice
        currencyCode
        note2
        tags
        order {
          ...LayaliCodOrderFields
        }
      }
    }
  }
`;

type DraftOrderNode = {
  id: string;
  name: string;
  status: string;
  email?: string | null;
  totalPrice?: string | null;
  currencyCode?: string | null;
  note2?: string | null;
  tags?: string[] | null;
  order?: {
    id: string;
    name: string;
    displayFinancialStatus?: string | null;
    paymentGatewayNames?: string[] | null;
    totalPriceSet?: {
      shopMoney?: { amount: string; currencyCode: string } | null;
    } | null;
  } | null;
};

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Customer', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export function buildMailingAddress(input: {
  receiverName: string;
  phone: string;
  address1: string;
  address2?: string | null;
  city: string;
  province?: string | null;
  zip?: string | null;
  countryCode: string;
}): DraftOrderShippingAddress {
  const { firstName, lastName } = splitName(input.receiverName);
  const countryCode = input.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error('A valid ISO country code is required for the shipping address.');
  }
  return {
    firstName,
    lastName,
    address1: input.address1.trim(),
    address2: input.address2?.trim() || null,
    city: input.city.trim(),
    province: input.province?.trim() || input.city.trim() || null,
    countryCode,
    zip: input.zip?.trim() || null,
    phone: input.phone.trim(),
  };
}

function mapDraftToCreatedOrder(
  draft: DraftOrderNode,
  opts?: { orderUnresolved?: boolean }
): CreatedShopifyOrder {
  const order = draft.order;
  if (order?.id && order.name) {
    return {
      draftOrderId: draft.id,
      orderId: order.id,
      orderName: order.name,
      financialStatus: order.displayFinancialStatus || 'PENDING',
      totalAmount: Number(order.totalPriceSet?.shopMoney?.amount || draft.totalPrice || 0),
      currencyCode: order.totalPriceSet?.shopMoney?.currencyCode || draft.currencyCode || 'SAR',
      paymentGatewayNames: order.paymentGatewayNames || [],
      orderUnresolved: false,
    };
  }

  return {
    draftOrderId: draft.id,
    orderId: draft.id,
    orderName: draft.name,
    financialStatus: 'PENDING',
    totalAmount: Number(draft.totalPrice || 0),
    currencyCode: draft.currencyCode || 'SAR',
    paymentGatewayNames: [],
    orderUnresolved: opts?.orderUnresolved ?? true,
  };
}

function matchesSubmission(
  draft: DraftOrderNode,
  submissionId: string,
  userId: string
): boolean {
  const scoped = userSubmissionTag(userId, submissionId);
  const subTag = submissionTag(submissionId);
  const userTag = userOwnershipTag(userId);
  const tags = draft.tags || [];
  const note = draft.note2 || '';

  const tagEquals = (want: string) =>
    tags.some((t) => t === want || t.toLowerCase() === want.toLowerCase());

  if (tagEquals(scoped) || tagEquals(legacyUserSubmissionTag(userId, submissionId))) {
    return true;
  }
  if (
    (tagEquals(userTag) || tagEquals(legacyUserOwnershipTag(userId))) &&
    (tagEquals(subTag) ||
      tagEquals(legacySubmissionTag(submissionId)) ||
      note.includes(`Layali submission: ${submissionId}`))
  ) {
    return true;
  }
  if (
    note.includes(`Layali user: ${userId}`) &&
    note.includes(`Layali submission: ${submissionId}`)
  ) {
    return true;
  }

  // Legacy probe drafts: submission only (no user markers).
  const hasAnyUserMarker =
    note.includes('Layali user:') ||
    tags.some(
      (t) => t.startsWith(USER_TAG_PREFIX) || t.startsWith(LEGACY_USER_TAG_PREFIX)
    );
  if (hasAnyUserMarker) return false;

  return (
    tagEquals(subTag) ||
    tagEquals(legacySubmissionTag(submissionId)) ||
    note.includes(`Layali submission: ${submissionId}`)
  );
}

/** True when this draft is owned by the authenticated Supabase user. */
function draftOwnedByUser(
  draft: DraftOrderNode,
  userId: string,
  userEmail: string
): boolean {
  const userTag = userOwnershipTag(userId);
  const legacyUserTag = legacyUserOwnershipTag(userId);
  const tags = draft.tags || [];
  if (
    tags.some(
      (t) =>
        t === userTag ||
        t.toLowerCase() === userTag.toLowerCase() ||
        t === legacyUserTag ||
        t.toLowerCase() === legacyUserTag.toLowerCase()
    )
  ) {
    return true;
  }
  if ((draft.note2 || '').includes(`Layali user: ${userId}`)) {
    return true;
  }
  const userTok = compactTagToken(userId, 16);
  if (
    tags.some(
      (t) =>
        t.startsWith(`${LEGACY_SUBMISSION_TAG_PREFIX}${userId}:`) ||
        t.startsWith(`${USER_SUBMISSION_TAG_PREFIX}${userTok}`)
    )
  ) {
    return true;
  }
  const hasUserMarker =
    (draft.note2 || '').includes('Layali user:') ||
    tags.some(
      (t) => t.startsWith(USER_TAG_PREFIX) || t.startsWith(LEGACY_USER_TAG_PREFIX)
    );
  if (hasUserMarker) return false;

  const email = (draft.email || '').trim().toLowerCase();
  return Boolean(email && email === userEmail.trim().toLowerCase());
}

/**
 * Resolve the Order created from a completed draft.
 * Uses allowPartialData so missing read_orders does not discard draft status.
 */
export async function resolveCompletedDraftOrder(
  draftOrderId: string
): Promise<CreatedShopifyOrder> {
  const { data, errors } = await shopifyAdminFetch<{
    draftOrder: DraftOrderNode | null;
  }>(DRAFT_ORDER_RESOLVE, { id: draftOrderId }, { allowPartialData: true });

  const draft = data.draftOrder;
  if (!draft?.id) {
    throw new Error('Shopify draft order not found after completion');
  }

  const status = (draft.status || '').toUpperCase();
  if (status !== 'COMPLETED') {
    const errMsg = errors?.map((e) => e.message).join('; ');
    throw new Error(
      errMsg || `Draft order is not completed (status=${draft.status || 'unknown'})`
    );
  }

  if (draft.order?.id && draft.order.name) {
    return mapDraftToCreatedOrder(draft, { orderUnresolved: false });
  }

  const denied = (errors || []).some((e) =>
    /access denied|read_orders|read_marketplace_orders|read_quick_sale/i.test(e.message)
  );
  if (denied || !draft.order) {
    console.warn('Layali COD: draft completed but Order fields unread', {
      draftOrderId: draft.id,
      draftName: draft.name,
      graphqlErrors: errors?.map((e) => e.message) || null,
    });
    return mapDraftToCreatedOrder(draft, { orderUnresolved: true });
  }

  return mapDraftToCreatedOrder(draft, { orderUnresolved: true });
}

/**
 * Idempotent lookup: find a previously completed checkout for this user+submissionId.
 * Prefer user-scoped tag match; fall back to note2 scan of recent completed drafts.
 * Never returns another user's checkout.
 */
export async function findCompletedCheckoutBySubmissionId(
  submissionId: string,
  userId: string,
  userEmail: string
): Promise<CreatedShopifyOrder | null> {
  const scopedTag = userSubmissionTag(userId, submissionId);
  const byTag = await shopifyAdminFetch<{
    draftOrders: { nodes: DraftOrderNode[] };
  }>(
    DRAFT_ORDERS_BY_TAG,
    { query: shopifyTagQuery(scopedTag) },
    { allowPartialData: true }
  );

  const tagged = (byTag.data.draftOrders?.nodes || []).find(
    (n) =>
      (n.status || '').toUpperCase() === 'COMPLETED' &&
      matchesSubmission(n, submissionId, userId) &&
      draftOwnedByUser(n, userId, userEmail)
  );
  if (tagged) {
    if (tagged.order?.id) return mapDraftToCreatedOrder(tagged, { orderUnresolved: false });
    return resolveCompletedDraftOrder(tagged.id);
  }

  // Also try legacy submission-only tag (escaped), then filter by ownership.
  const legacyTag = submissionTag(submissionId);
  const byLegacy = await shopifyAdminFetch<{
    draftOrders: { nodes: DraftOrderNode[] };
  }>(
    DRAFT_ORDERS_BY_TAG,
    { query: shopifyTagQuery(legacyTag) },
    { allowPartialData: true }
  );
  const legacyHit = (byLegacy.data.draftOrders?.nodes || []).find(
    (n) =>
      (n.status || '').toUpperCase() === 'COMPLETED' &&
      matchesSubmission(n, submissionId, userId) &&
      draftOwnedByUser(n, userId, userEmail)
  );
  if (legacyHit) {
    if (legacyHit.order?.id) return mapDraftToCreatedOrder(legacyHit, { orderUnresolved: false });
    return resolveCompletedDraftOrder(legacyHit.id);
  }

  const recent = await shopifyAdminFetch<{
    draftOrders: { nodes: DraftOrderNode[] };
  }>(RECENT_COMPLETED_DRAFTS, undefined, { allowPartialData: true });

  const match = (recent.data.draftOrders?.nodes || []).find(
    (n) =>
      matchesSubmission(n, submissionId, userId) && draftOwnedByUser(n, userId, userEmail)
  );
  if (!match) return null;

  if (match.order?.id) return mapDraftToCreatedOrder(match, { orderUnresolved: false });
  return resolveCompletedDraftOrder(match.id);
}

export async function createCodDraftOrder(options: {
  email: string;
  note?: string | null;
  tags?: string[];
  shippingAddress: DraftOrderShippingAddress;
  lineItems: DraftOrderLineInput[];
  currencyCode?: string;
}): Promise<{ draftOrderId: string; totalPrice: number; currencyCode: string; shippingPrice: number }> {
  if (!options.lineItems.length) {
    throw new Error('Draft order requires at least one line item');
  }

  const currencyCode = options.currencyCode || 'SAR';
  const { data } = await shopifyAdminFetch<{
    draftOrderCreate: {
      draftOrder: {
        id: string;
        totalPrice: string;
        currencyCode: string;
        shippingLine: {
          title?: string | null;
          originalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } | null } | null;
        } | null;
      } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(DRAFT_ORDER_CREATE, {
    input: {
      email: options.email,
      note: options.note || null,
      tags: filterShopifyDraftOrderTags(
        options.tags || ['layali-cod', 'cash-on-delivery']
      ),
      taxExempt: false,
      shippingAddress: options.shippingAddress,
      billingAddress: options.shippingAddress,
      // Custom shippingLine only — omit shippingRateHandle so Shopify does not
      // apply a carrier/profile rate on top of the fixed Layali fee.
      shippingLine: {
        title: 'Delivery',
        priceWithCurrency: {
          amount: LAYALI_DELIVERY_FEE.toFixed(2),
          currencyCode,
        },
      },
      lineItems: options.lineItems.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
      })),
    },
  });

  const payload = data.draftOrderCreate;
  if (payload.userErrors?.length) {
    const customerMsg = customerFacingDraftUserErrors(payload.userErrors);
    if (!payload.draftOrder?.id) {
      throw new Error(customerMsg || GENERIC_DRAFT_ORDER_ERROR);
    }
    if (customerMsg) {
      throw new Error(customerMsg);
    }
  }
  if (!payload.draftOrder?.id) {
    throw new Error('Shopify did not return a draft order');
  }

  const shippingPrice = Number(
    payload.draftOrder.shippingLine?.originalPriceSet?.shopMoney?.amount || 0
  );
  if (shippingPrice < LAYALI_DELIVERY_FEE - 0.004) {
    // Create response may omit shippingLine even when input applied it.
    // place-order compares draft totalPrice to merchandise + delivery.
    console.warn('Layali COD: draft create response missing shippingLine amount', {
      draftOrderId: payload.draftOrder.id,
      shippingPrice,
      expected: LAYALI_DELIVERY_FEE,
      totalPrice: payload.draftOrder.totalPrice,
    });
  }

  return {
    draftOrderId: payload.draftOrder.id,
    totalPrice: Number(payload.draftOrder.totalPrice || 0),
    currencyCode: payload.draftOrder.currencyCode || currencyCode,
    shippingPrice,
  };
}

export type CodOrderResolveContext = {
  userId: string;
  userEmail: string;
  submissionId: string;
};

function unresolvedDraftConfirmation(draft: {
  id: string;
  name: string;
  totalPrice?: string | number | null;
  currencyCode?: string | null;
}): CreatedShopifyOrder {
  return {
    draftOrderId: draft.id,
    orderId: draft.id,
    orderName: draft.name,
    financialStatus: 'PENDING',
    totalAmount: Number(draft.totalPrice || 0),
    currencyCode: draft.currencyCode || 'SAR',
    paymentGatewayNames: [],
    orderUnresolved: true,
  };
}

/**
 * After draftOrderComplete, wait briefly for draft.order.id, then look up by
 * user/submission tags. Never stores a DraftOrder GID as shopify_order_links.
 */
async function resolveOrderAfterDraftComplete(
  draft: { id: string; name: string; totalPrice?: string | null; currencyCode?: string | null },
  context?: CodOrderResolveContext,
  opts?: { allowUnresolved?: boolean }
): Promise<CreatedShopifyOrder> {
  try {
    const resolved = await retryUntilResolvedOrder(() => resolveCompletedDraftOrder(draft.id));
    if (isResolvedShopifyOrder(resolved)) return resolved;
  } catch (err) {
    console.error('Layali COD: post-complete order resolve failed', {
      draftOrderId: draft.id,
      message: err instanceof Error ? err.message : String(err),
    });
    if (!opts?.allowUnresolved && !context) throw err;
  }

  if (context?.userId && context.userEmail && context.submissionId) {
    try {
      const tagged = await findCompletedCheckoutBySubmissionId(
        context.submissionId,
        context.userId,
        context.userEmail
      );
      if (tagged && isShopifyOrderGid(tagged.orderId)) {
        return { ...tagged, orderUnresolved: false };
      }
    } catch (err) {
      console.error('Layali COD: tag fallback after complete failed', {
        draftOrderId: draft.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (opts?.allowUnresolved) {
    console.warn('Layali COD: Order GID unresolved after retry and tag fallback', {
      draftOrderId: draft.id,
    });
    return unresolvedDraftConfirmation(draft);
  }

  throw new Error('Shopify Order GID was not available after draft completion');
}

/**
 * Completes a draft order as payment-pending (COD / unpaid).
 * Completion is authoritative; Order GID resolution retries, then uses tags.
 */
export async function completeCodDraftOrder(
  draftOrderId: string,
  context?: CodOrderResolveContext
): Promise<CreatedShopifyOrder> {
  const { data } = await shopifyAdminFetch<{
    draftOrderComplete: {
      draftOrder: {
        id: string;
        name: string;
        status: string;
        totalPrice: string;
        currencyCode: string;
      } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(DRAFT_ORDER_COMPLETE, {
    id: draftOrderId,
    paymentPending: true,
  });

  const payload = data.draftOrderComplete;
  if (payload.userErrors?.length) {
    const customerMsg = customerFacingDraftUserErrors(payload.userErrors);
    if (!payload.draftOrder?.id) {
      throw new Error(customerMsg || GENERIC_DRAFT_ORDER_ERROR);
    }
    if (customerMsg) {
      throw new Error(customerMsg);
    }
  }
  if (!payload.draftOrder?.id) {
    throw new Error('Shopify did not return a completed draft order');
  }

  const completed = (payload.draftOrder.status || '').toUpperCase() === 'COMPLETED';
  return resolveOrderAfterDraftComplete(payload.draftOrder, context, {
    allowUnresolved: completed,
  });
}

/** Customer account history — additive Order reads only. Does not affect COD mutations. */
const CUSTOMER_ORDER_FIELDS = `#graphql
  fragment LayaliCustomerOrderFields on Order {
    id
    name
    createdAt
    cancelledAt
    confirmed
    closed
    displayFinancialStatus
    displayFulfillmentStatus
    tags
    paymentGatewayNames
    totalPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    subtotalPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    totalShippingPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    shippingAddress {
      name
      phone
      address1
      address2
      city
      province
      zip
      country
    }
    lineItems(first: 50) {
      nodes {
        title
        variantTitle
        quantity
        image {
          url
          altText
        }
        discountedUnitPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        originalUnitPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
    }
    fulfillments(first: 20) {
      status
      displayStatus
      createdAt
      inTransitAt
      deliveredAt
      estimatedDeliveryAt
      trackingInfo(first: 10) {
        company
        number
        url
      }
      events(first: 10) {
        nodes {
          status
          happenedAt
        }
      }
    }
  }
`;

const CUSTOMER_ORDERS_BY_IDS = `#graphql
  ${CUSTOMER_ORDER_FIELDS}
  query LayaliCustomerOrdersByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        ...LayaliCustomerOrderFields
      }
    }
  }
`;

/** Fallback if a nested Order field is unavailable on this API version. */
const CUSTOMER_ORDERS_BY_IDS_MINIMAL = `#graphql
  query LayaliCustomerOrdersByIdsMinimal($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        name
        createdAt
        cancelledAt
        confirmed
        closed
        displayFinancialStatus
        displayFulfillmentStatus
        tags
        paymentGatewayNames
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        subtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalShippingPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        shippingAddress {
          name
          phone
          address1
          address2
          city
          province
          zip
          country
        }
        lineItems(first: 50) {
          nodes {
            title
            variantTitle
            quantity
            discountedUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            originalUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;

const ORDERS_BY_QUERY = `#graphql
  query LayaliOrdersByQuery($query: String!) {
    orders(first: 50, query: $query, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        tags
      }
    }
  }
`;

const DRAFT_ORDERS_FOR_USER_HISTORY = `#graphql
  query LayaliDraftOrdersForUserHistory($query: String!) {
    draftOrders(first: 50, query: $query, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        status
        tags
        order {
          id
          name
          tags
        }
      }
    }
  }
`;

export type ShopifyOwnedOrderRef = {
  id: string;
  name: string;
};

export type ShopifyCustomerOrderNode = {
  id?: string | null;
  name?: string | null;
  createdAt?: string | null;
  cancelledAt?: string | null;
  confirmed?: boolean | null;
  closed?: boolean | null;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  tags?: string[] | null;
  paymentGatewayNames?: string[] | null;
  totalPriceSet?: { shopMoney?: { amount: string; currencyCode: string } | null } | null;
  subtotalPriceSet?: { shopMoney?: { amount: string; currencyCode: string } | null } | null;
  totalShippingPriceSet?: { shopMoney?: { amount: string; currencyCode: string } | null } | null;
  shippingAddress?: {
    name?: string | null;
    phone?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province?: string | null;
    zip?: string | null;
    country?: string | null;
  } | null;
  lineItems?: {
    nodes?: {
      title?: string | null;
      variantTitle?: string | null;
      quantity?: number | null;
      image?: { url?: string | null; altText?: string | null } | null;
      discountedUnitPriceSet?: { shopMoney?: { amount: string; currencyCode: string } | null } | null;
      originalUnitPriceSet?: { shopMoney?: { amount: string; currencyCode: string } | null } | null;
    }[];
  } | null;
  fulfillments?: {
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
  }[];
};

const NODES_BATCH = 40;

function indexCustomerOrderNode(
  byGid: Map<string, ShopifyCustomerOrderNode>,
  node: ShopifyCustomerOrderNode | null | undefined
) {
  if (!node?.id || !isShopifyOrderGid(node.id) || !node.name) return;
  byGid.set(node.id, node);
}

async function fetchCustomerOrderNodeBatch(
  query: string,
  batch: string[]
): Promise<{
  nodes: (ShopifyCustomerOrderNode | null)[];
  errors?: { message: string }[];
}> {
  const { data, errors } = await shopifyAdminFetch<{
    nodes: (ShopifyCustomerOrderNode | null)[];
  }>(query, { ids: batch }, CUSTOMER_ORDER_ADMIN);
  return { nodes: data?.nodes || [], errors };
}

/**
 * Fetch Shopify Order payloads for customer account views.
 * Input GIDs must already be ownership-checked. Never returns GIDs to callers
 * of the customer DTO mappers — this returns Admin nodes keyed internally.
 */
export async function fetchShopifyCustomerOrderNodes(
  orderGids: string[]
): Promise<Map<string, ShopifyCustomerOrderNode>> {
  const unique = [...new Set(orderGids.filter((id) => isShopifyOrderGid(id)))];
  const byGid = new Map<string, ShopifyCustomerOrderNode>();
  if (!unique.length) return byGid;

  for (let i = 0; i < unique.length; i += NODES_BATCH) {
    const batch = unique.slice(i, i + NODES_BATCH);
    let { nodes, errors } = await fetchCustomerOrderNodeBatch(CUSTOMER_ORDERS_BY_IDS, batch);

    if (errors?.length) {
      console.error('Layali customer orders: Shopify partial errors', {
        messages: errors.map((e) => e.message),
      });
    }

    const before = byGid.size;
    for (const node of nodes) indexCustomerOrderNode(byGid, node);

    if (byGid.size === before) {
      ({ nodes, errors } = await fetchCustomerOrderNodeBatch(
        CUSTOMER_ORDERS_BY_IDS_MINIMAL,
        batch
      ));
      if (errors?.length) {
        console.error('Layali customer orders: Shopify minimal-query errors', {
          messages: errors.map((e) => e.message),
        });
      }
      for (const node of nodes) indexCustomerOrderNode(byGid, node);
    }
  }

  return byGid;
}

/**
 * Server-side recovery for the authenticated user only.
 * Finds Shopify orders tagged with this user's compact ownership tag.
 * Does not list the shop's full order book and does not take IDs from the client.
 */
export async function fetchShopifyOrderRefsForUser(
  userId: string
): Promise<ShopifyOwnedOrderRef[]> {
  const tag = userOwnershipTag(userId);
  const { data, errors } = await shopifyAdminFetch<{
    orders?: { nodes?: { id?: string | null; name?: string | null; tags?: string[] | null }[] };
  }>(ORDERS_BY_QUERY, { query: shopifyTagQuery(tag) }, CUSTOMER_ORDER_ADMIN);

  if (errors?.length) {
    console.error('Layali customer orders: ownership-tag query errors', {
      messages: errors.map((e) => e.message),
    });
  }

  const out: ShopifyOwnedOrderRef[] = [];
  const seen = new Set<string>();
  const remember = (id: string, name: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, name });
  };

  for (const node of data?.orders?.nodes || []) {
    if (!node?.id || !isShopifyOrderGid(node.id) || !node.name) continue;
    const tags = node.tags || [];
    const owned = tags.some((t) => t === tag || t.toLowerCase() === tag.toLowerCase());
    if (!owned) continue;
    remember(node.id, node.name);
  }

  // Draft tags are the ownership stamp written at COD checkout. They may not
  // always copy onto the completed Order; still only this user's tag.
  const drafts = await shopifyAdminFetch<{
    draftOrders?: {
      nodes?: {
        status?: string | null;
        tags?: string[] | null;
        order?: { id?: string | null; name?: string | null; tags?: string[] | null } | null;
      }[];
    };
  }>(DRAFT_ORDERS_FOR_USER_HISTORY, { query: shopifyTagQuery(tag) }, CUSTOMER_ORDER_ADMIN);

  if (drafts.errors?.length) {
    console.error('Layali customer orders: draft ownership-tag query errors', {
      messages: drafts.errors.map((e) => e.message),
    });
  }

  for (const draft of drafts.data?.draftOrders?.nodes || []) {
    if ((draft.status || '').toUpperCase() !== 'COMPLETED') continue;
    const draftOwned = (draft.tags || []).some(
      (t) => t === tag || t.toLowerCase() === tag.toLowerCase()
    );
    if (!draftOwned) continue;
    const order = draft.order;
    if (!order?.id || !isShopifyOrderGid(order.id) || !order.name) continue;
    remember(order.id, order.name);
  }

  return out;
}
