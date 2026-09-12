import { NextRequest, NextResponse } from 'next/server';
import {
  addToShopifyCart,
  getCart,
  isShopifyConfigured,
  removeCartLines,
  ShopifyThrottleError,
  updateCartLines,
} from '@/lib/shopify';

function isThrottle(err: unknown): boolean {
  if (err instanceof ShopifyThrottleError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /throttl/i.test(msg);
}

function beginStorefrontCallCount(): () => number {
  const g = globalThis as typeof globalThis & { __shopifyStorefrontCalls?: number };
  if (typeof g.__shopifyStorefrontCalls !== 'number') {
    g.__shopifyStorefrontCalls = 0;
  }
  const start = g.__shopifyStorefrontCalls;
  return () => (g.__shopifyStorefrontCalls ?? start) - start;
}

function withDebug<T extends Record<string, unknown>>(payload: T, storefrontCalls: number) {
  if (process.env.CART_DEBUG === '1') {
    return { ...payload, debug: { storefrontCalls } };
  }
  return payload;
}

export async function GET(req: NextRequest) {
  const callsSince = beginStorefrontCallCount();
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json({ cart: null, configured: false });
    }
    const cartId = req.nextUrl.searchParams.get('cartId');
    if (!cartId) return NextResponse.json({ cart: null, configured: true });
    const cart = await getCart(cartId);
    return NextResponse.json(withDebug({ cart, configured: true }, callsSince()));
  } catch (err) {
    console.error('Shopify cart GET error', err);
    if (isThrottle(err)) {
      return NextResponse.json(
        withDebug({ cart: null, error: 'Throttled', throttled: true }, callsSince()),
        { status: 429 }
      );
    }
    return NextResponse.json(
      withDebug({ cart: null, error: 'Unable to load cart' }, callsSince()),
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const callsSince = beginStorefrontCallCount();
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json(
        { error: 'Shopify is not configured', configured: false },
        { status: 503 }
      );
    }

    const body = (await req.json()) as {
      action: 'add' | 'update' | 'remove';
      cartId?: string | null;
      merchandiseId?: string;
      quantity?: number;
      /** Multi-line add (combos) — one Storefront mutation for all lines. */
      lines?: { merchandiseId: string; quantity: number }[];
      lineId?: string;
      lineIds?: string[];
      email?: string;
      countryCode?: string;
      countryLabel?: string;
    };

    if (body.action === 'add') {
      const lines =
        body.lines?.filter((l) => l?.merchandiseId && (l.quantity ?? 0) > 0) ||
        (body.merchandiseId
          ? [{ merchandiseId: body.merchandiseId, quantity: body.quantity ?? 1 }]
          : []);
      if (lines.length === 0) {
        return NextResponse.json(
          { error: 'merchandiseId or lines required' },
          { status: 400 }
        );
      }
      try {
        const cart = await addToShopifyCart({
          cartId: body.cartId || null,
          lines,
          email: body.email,
          countryCode: body.countryCode,
          countryLabel: body.countryLabel,
        });
        return NextResponse.json(
          withDebug({ cart, configured: true, warnings: cart.warnings || [] }, callsSince())
        );
      } catch (err) {
        if (isThrottle(err)) {
          return NextResponse.json(
            withDebug({ error: 'Throttled', throttled: true }, callsSince()),
            { status: 429 }
          );
        }
        const message = err instanceof Error ? err.message : 'Could not add to cart';
        if (/sold out|out of stock|not enough stock|MERCHANDISE_/i.test(message)) {
          return NextResponse.json({ error: message, configured: true }, { status: 409 });
        }
        throw err;
      }
    }

    if (!body.cartId) {
      return NextResponse.json({ error: 'cartId required' }, { status: 400 });
    }

    if (body.action === 'update') {
      if (!body.lineId || body.quantity == null) {
        return NextResponse.json({ error: 'lineId and quantity required' }, { status: 400 });
      }
      if (!Number.isFinite(body.quantity) || body.quantity < 0) {
        return NextResponse.json({ error: 'quantity must be a non-negative number' }, { status: 400 });
      }
      try {
        const cart = await updateCartLines(body.cartId, [
          { id: body.lineId, quantity: body.quantity },
        ]);
        return NextResponse.json(
          withDebug({ cart, configured: true, warnings: cart.warnings || [] }, callsSince())
        );
      } catch (err) {
        if (isThrottle(err)) {
          return NextResponse.json(
            withDebug({ error: 'Throttled', throttled: true }, callsSince()),
            { status: 429 }
          );
        }
        const message = err instanceof Error ? err.message : 'Could not update cart';
        if (/sold out|out of stock|not enough stock|MERCHANDISE_/i.test(message)) {
          return NextResponse.json({ error: message, configured: true }, { status: 409 });
        }
        throw err;
      }
    }

    if (body.action === 'remove') {
      const ids = body.lineIds || (body.lineId ? [body.lineId] : []);
      if (ids.length === 0) {
        return NextResponse.json({ error: 'lineId(s) required' }, { status: 400 });
      }
      try {
        const cart = await removeCartLines(body.cartId, ids);
        return NextResponse.json(
          withDebug({ cart, configured: true, warnings: cart.warnings || [] }, callsSince())
        );
      } catch (err) {
        if (isThrottle(err)) {
          return NextResponse.json(
            withDebug({ error: 'Throttled', throttled: true }, callsSince()),
            { status: 429 }
          );
        }
        throw err;
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Shopify cart POST error', err);
    if (isThrottle(err)) {
      return NextResponse.json(
        withDebug({ error: 'Throttled', throttled: true }, callsSince()),
        { status: 429 }
      );
    }
    const message = err instanceof Error ? err.message : 'Cart update failed';
    return NextResponse.json(withDebug({ error: message }, callsSince()), { status: 502 });
  }
}
