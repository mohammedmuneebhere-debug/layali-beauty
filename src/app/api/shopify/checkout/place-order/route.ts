import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCart, isShopifyConfigured } from '@/lib/shopify';
import { isShopifyAdminConfigured } from '@/lib/shopify/admin';
import {
  buildMailingAddress,
  completeCodDraftOrder,
  createCodDraftOrder,
  findCompletedCheckoutBySubmissionId,
  isShopifyOrderGid,
  resolveCompletedDraftOrder,
  submissionTag,
  userOwnershipTag,
  userSubmissionTag,
  type CreatedShopifyOrder,
} from '@/lib/shopify/admin-orders';
import { upsertOwnedShopifyOrderLink } from '@/lib/account/shopify-order-links';
import { toShopifyAddressParts } from '@/lib/address/structured';
import { checkoutPayableTotal, LAYALI_DELIVERY_FEE } from '@/lib/checkout/pricing';

export const runtime = 'nodejs';
/** Shopify Admin draft+complete can exceed the default platform budget. */
export const maxDuration = 300;

type PlaceOrderBody = {
  cartId?: string;
  addressId?: string;
  notes?: string;
  paymentMethod?: 'cod';
  submissionId?: string;
};

type PlaceOrderSuccess = {
  ok: true;
  order: {
    id: string;
    name: string;
    totalAmount: number;
    currencyCode: string;
    financialStatus: string | null;
    paymentMethod: 'cod';
    paymentLabel: string;
    shippingAddress: {
      receiverName: string;
      phone: string;
      addressLine: string;
      city: string;
      country: string;
    };
  };
  /** Present when Shopify Order GID could not be read (scopes); draft still completed. */
  warning?: 'order_unresolved';
  alreadyCompleted?: boolean;
};

type PlaceOrderError = {
  ok: false;
  error: string;
  code?: string;
  /** When set, client must NOT rotate submissionId / must NOT create another order. */
  retrySafe?: boolean;
};

type CachedResult = {
  at: number;
  response: PlaceOrderSuccess;
};

const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;
const completedBySubmission = new Map<string, CachedResult>();
const inflightBySubmission = new Map<string, Promise<PlaceOrderSuccess>>();

function pruneIdempotencyCache() {
  const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
  for (const [key, value] of completedBySubmission) {
    if (value.at < cutoff) completedBySubmission.delete(key);
  }
}

function idempotencyKey(userId: string, submissionId: string): string {
  return `${userId}:${submissionId}`;
}

/**
 * Map address country text to ISO code.
 * Unknown/empty/unrecognized values return null — never silently become SA.
 */
function mapCountryToCode(country?: string | null): string | null {
  const key = (country || '').trim().toLowerCase();
  if (!key) return null;
  if (key === 'sa' || key.includes('saudi')) return 'SA';
  if (key === 'ae' || key.includes('emirates') || key === 'uae') return 'AE';
  if (/^[a-z]{2}$/.test(key)) return key.toUpperCase();
  return null;
}

function buildSuccess(params: {
  order: CreatedShopifyOrder;
  receiverName: string;
  phone: string;
  addressLine: string;
  city: string;
  alreadyCompleted?: boolean;
}): PlaceOrderSuccess {
  return {
    ok: true,
    alreadyCompleted: params.alreadyCompleted || undefined,
    warning: params.order.orderUnresolved ? 'order_unresolved' : undefined,
    order: {
      id: params.order.orderId,
      name: params.order.orderName,
      totalAmount: params.order.totalAmount,
      currencyCode: params.order.currencyCode || 'SAR',
      financialStatus: params.order.financialStatus,
      paymentMethod: 'cod',
      paymentLabel: 'Cash on Delivery',
      shippingAddress: {
        receiverName: params.receiverName,
        phone: params.phone,
        addressLine: params.addressLine,
        city: params.city,
        country: 'Saudi Arabia',
      },
    },
  };
}

async function linkShopifyOrder(params: {
  userId: string;
  order: CreatedShopifyOrder;
  submissionId: string;
}) {
  if (!isShopifyOrderGid(params.order.orderId)) {
    console.warn('shopify_order_links skipped — Order GID unresolved', {
      draftOrderId: params.order.draftOrderId,
      submissionId: params.submissionId,
    });
    return;
  }

  const result = await upsertOwnedShopifyOrderLink({
    userId: params.userId,
    shopifyOrderId: params.order.orderId,
    shopifyOrderName: params.order.orderName,
    submissionId: params.submissionId,
  });

  if (result === 'refused_foreign') {
    console.error('shopify_order_links refused — order already linked to another user', {
      orderId: params.order.orderId,
      submissionId: params.submissionId,
    });
    return;
  }

  if (result === 'failed') {
    // Post-completion — never fail the customer response for link issues.
    console.error('shopify_order_links upsert failed', {
      orderId: params.order.orderId,
      submissionId: params.submissionId,
    });
  }
}

export async function POST(req: NextRequest) {
  pruneIdempotencyCache();

  try {
    if (!isShopifyConfigured() || !isShopifyAdminConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Checkout is temporarily unavailable. Please try again later.',
          code: 'shopify_not_configured',
          retrySafe: true,
        } satisfies PlaceOrderError,
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id || !user.email) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Please sign in to place your order.',
          code: 'unauthorized',
          retrySafe: true,
        } satisfies PlaceOrderError,
        { status: 401 }
      );
    }

    const body = (await req.json()) as PlaceOrderBody;
    const cartId = body.cartId?.trim();
    const addressId = body.addressId?.trim();
    const submissionId = body.submissionId?.trim();
    const paymentMethod = body.paymentMethod || 'cod';
    const notes = body.notes?.trim() || '';

    if (!submissionId || submissionId.length < 8 || submissionId.length > 80) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid checkout submission. Please refresh and try again.',
          code: 'invalid_submission',
          retrySafe: true,
        } satisfies PlaceOrderError,
        { status: 400 }
      );
    }

    if (paymentMethod !== 'cod') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Only Cash on Delivery is available right now.',
          code: 'payment_method_unavailable',
          retrySafe: true,
        } satisfies PlaceOrderError,
        { status: 400 }
      );
    }

    if (!cartId || !addressId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Cart and delivery address are required.',
          code: 'missing_fields',
          retrySafe: true,
        } satisfies PlaceOrderError,
        { status: 400 }
      );
    }

    const cacheKey = idempotencyKey(user.id, submissionId);

    const cached = completedBySubmission.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached.response);
    }

    const inflight = inflightBySubmission.get(cacheKey);
    if (inflight) {
      const result = await inflight;
      return NextResponse.json(result);
    }

    const run = (async (): Promise<PlaceOrderSuccess> => {
      // User-scoped durable idempotency (never returns another user's checkout).
      const prior = await findCompletedCheckoutBySubmissionId(
        submissionId,
        user.id,
        user.email!
      );
      if (prior) {
        const { data: addressForPrior } = await supabase
          .from('addresses')
          .select('*')
          .eq('id', addressId)
          .eq('user_id', user.id)
          .maybeSingle();

        const success = buildSuccess({
          order: prior,
          receiverName: String(addressForPrior?.receiver_name || 'Customer'),
          phone: String(addressForPrior?.receiver_phone || ''),
          addressLine: String(addressForPrior?.address_line || ''),
          city: String(addressForPrior?.city || ''),
          alreadyCompleted: true,
        });

        await linkShopifyOrder({
          userId: user.id,
          order: prior,
          submissionId,
        });

        completedBySubmission.set(cacheKey, { at: Date.now(), response: success });
        console.info('Layali COD idempotent hit — existing completed checkout', {
          submissionId,
          userId: user.id,
          orderName: prior.orderName,
          orderUnresolved: prior.orderUnresolved || false,
        });
        return success;
      }

      const cart = await getCart(cartId);
      if (!cart || cart.lines.length === 0 || cart.totalQuantity <= 0) {
        throw Object.assign(new Error('Your cart is empty.'), {
          status: 400,
          code: 'empty_cart',
          retrySafe: true,
        });
      }

      for (const line of cart.lines) {
        if (!line.merchandiseId?.startsWith('gid://shopify/ProductVariant/')) {
          throw Object.assign(new Error('Cart contains an invalid product variant.'), {
            status: 400,
            code: 'invalid_variant',
            retrySafe: true,
          });
        }
        if (!Number.isFinite(line.quantity) || line.quantity < 1) {
          throw Object.assign(new Error('Cart contains an invalid quantity.'), {
            status: 400,
            code: 'invalid_quantity',
            retrySafe: true,
          });
        }
      }

      const { data: address, error: addressError } = await supabase
        .from('addresses')
        .select('*')
        .eq('id', addressId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (addressError || !address) {
        throw Object.assign(new Error('Please select a valid delivery address.'), {
          status: 400,
          code: 'invalid_address',
          retrySafe: true,
        });
      }

      const receiverName = String(address.receiver_name || '').trim();
      const phone = String(address.receiver_phone || '').trim();
      const addressLine = String(address.address_line || '').trim();
      const city = String(address.city || '').trim();
      const countryCode = mapCountryToCode(address.country);

      if (receiverName.length < 2 || phone.length < 8 || addressLine.length < 5 || !city) {
        throw Object.assign(
          new Error('Delivery address is incomplete. Please update name, phone, address, and city.'),
          { status: 400, code: 'incomplete_address', retrySafe: true }
        );
      }

      if (countryCode !== 'SA') {
        throw Object.assign(
          new Error('Cash on Delivery checkout currently supports Saudi Arabia addresses only.'),
          { status: 400, code: 'unsupported_country', retrySafe: true }
        );
      }

      const shippingParts = toShopifyAddressParts({ address_line: addressLine, city });
      if (!shippingParts.address1 || shippingParts.address1.length < 5) {
        throw Object.assign(
          new Error('Delivery address is incomplete. Please update name, phone, address, and city.'),
          { status: 400, code: 'incomplete_address', retrySafe: true }
        );
      }

      const shippingAddress = buildMailingAddress({
        receiverName,
        phone,
        address1: shippingParts.address1,
        address2: shippingParts.address2,
        city,
        province: city,
        zip: shippingParts.zip,
        countryCode: 'SA',
      });

      const pinNote =
        address.latitude != null && address.longitude != null
          ? `Pin: ${Number(address.latitude).toFixed(5)}, ${Number(address.longitude).toFixed(5)}`
          : '';
      const noteParts = [
        'Payment: Cash on Delivery',
        notes ? `Customer notes: ${notes}` : '',
        pinNote,
        `Layali user: ${user.id}`,
        `Layali submission: ${submissionId}`,
      ].filter(Boolean);

      let draftOrderId: string | null = null;
      let draftTotal = 0;
      let draftCurrency = 'SAR';

      try {
        const draft = await createCodDraftOrder({
          email: user.email!,
          note: noteParts.join('\n'),
          tags: [
            'layali-cod',
            'cash-on-delivery',
            'layali-custom-checkout',
            userOwnershipTag(user.id),
            userSubmissionTag(user.id, submissionId),
            // Legacy submission-only tag retained for dual-read during transition.
            submissionTag(submissionId),
          ],
          shippingAddress,
          currencyCode: cart.total.currencyCode || cart.subtotal.currencyCode || 'SAR',
          lineItems: cart.lines.map((l) => ({
            variantId: l.merchandiseId,
            quantity: l.quantity,
          })),
        });
        const expectedTotal = checkoutPayableTotal(cart.total.amount);
        const shippingMissing =
          draft.shippingPrice < LAYALI_DELIVERY_FEE - 0.004 &&
          draft.totalPrice + 0.004 < expectedTotal;
        if (shippingMissing) {
          console.error('Layali COD: draft total does not include delivery fee', {
            draftOrderId: draft.draftOrderId,
            draftTotal: draft.totalPrice,
            shippingPrice: draft.shippingPrice,
            expectedTotal,
            expectedShipping: LAYALI_DELIVERY_FEE,
          });
          throw Object.assign(new Error('Could not place your order. Please try again.'), {
            status: 502,
            code: 'order_failed',
            retrySafe: true,
          });
        }
        draftOrderId = draft.draftOrderId;
        draftTotal = draft.totalPrice;
        draftCurrency = draft.currencyCode;
      } catch (createErr) {
        // Another request may have completed first — re-check before failing.
        const raced = await findCompletedCheckoutBySubmissionId(
          submissionId,
          user.id,
          user.email!
        );
        if (raced) {
          const success = buildSuccess({
            order: raced,
            receiverName,
            phone,
            addressLine,
            city,
            alreadyCompleted: true,
          });
          await linkShopifyOrder({ userId: user.id, order: raced, submissionId });
          completedBySubmission.set(cacheKey, { at: Date.now(), response: success });
          return success;
        }
        throw createErr;
      }

      let order: CreatedShopifyOrder;
      try {
        order = await completeCodDraftOrder(draftOrderId, {
          userId: user.id,
          userEmail: user.email!,
          submissionId,
        });
      } catch (completeErr) {
        // If complete failed but a completed draft now exists for this submission, recover.
        const recovered = await findCompletedCheckoutBySubmissionId(
          submissionId,
          user.id,
          user.email!
        );
        if (recovered) {
          order = recovered;
        } else if (draftOrderId) {
          // Last resort: draft may be completed without tag visibility yet.
          try {
            order = await resolveCompletedDraftOrder(draftOrderId);
          } catch {
            throw Object.assign(
              completeErr instanceof Error
                ? completeErr
                : new Error('Could not complete order'),
              {
                status: 502,
                code: 'order_failed',
                retrySafe: false,
                draftOrderId,
              }
            );
          }
        } else {
          throw completeErr;
        }
      }

      order = {
        ...order,
        totalAmount: order.totalAmount || draftTotal,
        currencyCode: order.currencyCode || draftCurrency,
      };

      // Non-authoritative link only — Shopify remains order SOT.
      // Link failures must not convert a completed Shopify order into a customer failure.
      await linkShopifyOrder({
        userId: user.id,
        order,
        submissionId,
      });

      const success = buildSuccess({
        order,
        receiverName,
        phone,
        addressLine,
        city,
      });

      completedBySubmission.set(cacheKey, { at: Date.now(), response: success });
      console.info('Layali COD order created', {
        orderName: order.orderName,
        financialStatus: order.financialStatus,
        orderUnresolved: order.orderUnresolved || false,
        lineCount: cart.lines.length,
        deliveryFee: LAYALI_DELIVERY_FEE,
        totalAmount: order.totalAmount,
        submissionId,
        userId: user.id,
      });
      return success;
    })();

    inflightBySubmission.set(cacheKey, run);

    try {
      const result = await run;
      return NextResponse.json(result);
    } catch (err) {
      const status =
        typeof err === 'object' && err && 'status' in err
          ? Number((err as { status?: number }).status) || 502
          : 502;
      const code =
        typeof err === 'object' && err && 'code' in err
          ? String((err as { code?: string }).code || 'order_failed')
          : 'order_failed';
      const retrySafe =
        typeof err === 'object' && err && 'retrySafe' in err
          ? Boolean((err as { retrySafe?: boolean }).retrySafe)
          : false;
      const message = err instanceof Error ? err.message : 'Could not place order';
      const accessDenied = /access denied|write_draft_orders|write_orders|write_quick_sale/i.test(
        message
      );

      // Never tell the customer the order failed if Shopify may have completed it.
      if (!retrySafe && !accessDenied) {
        const recovered = await findCompletedCheckoutBySubmissionId(
          submissionId,
          user.id,
          user.email!
        ).catch(() => null);
        if (recovered) {
          const { data: address } = await supabase
            .from('addresses')
            .select('*')
            .eq('id', addressId)
            .eq('user_id', user.id)
            .maybeSingle();
          const success = buildSuccess({
            order: recovered,
            receiverName: String(address?.receiver_name || 'Customer'),
            phone: String(address?.receiver_phone || ''),
            addressLine: String(address?.address_line || ''),
            city: String(address?.city || ''),
            alreadyCompleted: true,
          });
          await linkShopifyOrder({
            userId: user.id,
            order: recovered,
            submissionId,
          });
          completedBySubmission.set(cacheKey, { at: Date.now(), response: success });
          console.warn('Layali COD recovered completed order after error path', {
            submissionId,
            userId: user.id,
            orderName: recovered.orderName,
            originalError: message,
          });
          return NextResponse.json(success);
        }
      }

      const safeMessage = accessDenied
        ? 'Order placement is not configured yet. Please contact support.'
        : message;
      const safeCode = accessDenied ? 'missing_admin_scopes' : code;

      console.error('Layali COD place-order failed', {
        code: safeCode,
        message,
        submissionId,
        retrySafe: accessDenied ? false : retrySafe,
      });

      return NextResponse.json(
        {
          ok: false,
          error: safeMessage,
          code: safeCode,
          // Scope misconfiguration after a possible complete must not invite a duplicate.
          retrySafe: accessDenied ? false : retrySafe,
        } satisfies PlaceOrderError,
        { status: accessDenied ? 503 : status >= 400 && status < 600 ? status : 502 }
      );
    } finally {
      inflightBySubmission.delete(cacheKey);
    }
  } catch (err) {
    console.error('Layali COD place-order unexpected error', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'Could not place order. Please try again.',
        code: 'unexpected',
        retrySafe: true,
      } satisfies PlaceOrderError,
      { status: 500 }
    );
  }
}
