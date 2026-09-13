/**
 * Server-only Shopify Admin draft-order helpers for Layali custom COD checkout.
 * Never import from Client Components. Never expose Admin tokens.
 */
import { shopifyAdminFetch } from './admin';

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

export const SUBMISSION_TAG_PREFIX = 'layali-sub:';
export const USER_TAG_PREFIX = 'layali-u:';

/** Escape Shopify search-syntax specials inside a field value (`: \ ( )`). */
export function escapeShopifySearchValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/([:()])/g, '\\$1');
}

/** Build `tag:...` query with value escaping (do not escape the field separator). */
export function shopifyTagQuery(tag: string): string {
  return `tag:${escapeShopifySearchValue(tag)}`;
}

export function submissionTag(submissionId: string): string {
  return `${SUBMISSION_TAG_PREFIX}${submissionId.trim()}`;
}

export function userOwnershipTag(userId: string): string {
  return `${USER_TAG_PREFIX}${userId.trim()}`;
}

/** User-scoped submission tag: layali-sub:<userId>:<submissionId> */
export function userSubmissionTag(userId: string, submissionId: string): string {
  return `${SUBMISSION_TAG_PREFIX}${userId.trim()}:${submissionId.trim()}`;
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
  const legacySub = submissionTag(submissionId);
  const userTag = userOwnershipTag(userId);
  const tags = draft.tags || [];
  const note = draft.note2 || '';

  const tagEquals = (want: string) =>
    tags.some((t) => t === want || t.toLowerCase() === want.toLowerCase());

  if (tagEquals(scoped)) return true;
  if (tagEquals(userTag) && (tagEquals(legacySub) || note.includes(`Layali submission: ${submissionId}`))) {
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
    note.includes('Layali user:') || tags.some((t) => t.startsWith(USER_TAG_PREFIX));
  if (hasAnyUserMarker) return false;

  return tagEquals(legacySub) || note.includes(`Layali submission: ${submissionId}`);
}

/** True when this draft is owned by the authenticated Supabase user. */
function draftOwnedByUser(
  draft: DraftOrderNode,
  userId: string,
  userEmail: string
): boolean {
  const userTag = userOwnershipTag(userId);
  const tags = draft.tags || [];
  if (tags.some((t) => t === userTag || t.toLowerCase() === userTag.toLowerCase())) {
    return true;
  }
  if ((draft.note2 || '').includes(`Layali user: ${userId}`)) {
    return true;
  }
  if (tags.some((t) => t.startsWith(`${SUBMISSION_TAG_PREFIX}${userId}:`))) {
    return true;
  }
  const hasUserMarker =
    (draft.note2 || '').includes('Layali user:') ||
    tags.some((t) => t.startsWith(USER_TAG_PREFIX));
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
}): Promise<{ draftOrderId: string; totalPrice: number; currencyCode: string }> {
  if (!options.lineItems.length) {
    throw new Error('Draft order requires at least one line item');
  }

  const { data } = await shopifyAdminFetch<{
    draftOrderCreate: {
      draftOrder: {
        id: string;
        totalPrice: string;
        currencyCode: string;
      } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(DRAFT_ORDER_CREATE, {
    input: {
      email: options.email,
      note: options.note || null,
      tags: options.tags || ['layali-cod', 'cash-on-delivery'],
      taxExempt: false,
      shippingAddress: options.shippingAddress,
      billingAddress: options.shippingAddress,
      lineItems: options.lineItems.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
      })),
    },
  });

  const payload = data.draftOrderCreate;
  if (payload.userErrors?.length) {
    throw new Error(payload.userErrors.map((e) => e.message).join('; '));
  }
  if (!payload.draftOrder?.id) {
    throw new Error('Shopify did not return a draft order');
  }

  return {
    draftOrderId: payload.draftOrder.id,
    totalPrice: Number(payload.draftOrder.totalPrice || 0),
    currencyCode: payload.draftOrder.currencyCode || 'SAR',
  };
}

/**
 * Completes a draft order as payment-pending (COD / unpaid).
 * Completion is authoritative; Order field resolution is a separate step.
 */
export async function completeCodDraftOrder(
  draftOrderId: string
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
    throw new Error(payload.userErrors.map((e) => e.message).join('; '));
  }
  if (!payload.draftOrder?.id) {
    throw new Error('Shopify did not return a completed draft order');
  }

  const status = (payload.draftOrder.status || '').toUpperCase();
  if (status !== 'COMPLETED') {
    // Rare race: re-resolve; if still incomplete, surface failure (safe to investigate).
    return resolveCompletedDraftOrder(payload.draftOrder.id);
  }

  try {
    return await resolveCompletedDraftOrder(payload.draftOrder.id);
  } catch (err) {
    // Draft is already COMPLETED — never treat as create failure.
    console.error('Layali COD: post-complete order resolve failed; returning draft confirmation', {
      draftOrderId: payload.draftOrder.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      draftOrderId: payload.draftOrder.id,
      orderId: payload.draftOrder.id,
      orderName: payload.draftOrder.name,
      financialStatus: 'PENDING',
      totalAmount: Number(payload.draftOrder.totalPrice || 0),
      currencyCode: payload.draftOrder.currencyCode || 'SAR',
      paymentGatewayNames: [],
      orderUnresolved: true,
    };
  }
}

export function isShopifyOrderGid(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith('gid://shopify/Order/'));
}
