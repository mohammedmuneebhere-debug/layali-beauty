import { NextRequest, NextResponse } from 'next/server';
import {
  addToShopifyCart,
  getCart,
  isShopifyConfigured,
  removeCartLines,
  updateCartLines,
} from '@/lib/shopify';

export async function GET(req: NextRequest) {
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json({ cart: null, configured: false });
    }
    const cartId = req.nextUrl.searchParams.get('cartId');
    if (!cartId) return NextResponse.json({ cart: null, configured: true });
    const cart = await getCart(cartId);
    return NextResponse.json({ cart, configured: true });
  } catch (err) {
    console.error('Shopify cart GET error', err);
    return NextResponse.json({ cart: null, error: 'Unable to load cart' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
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
      lineId?: string;
      lineIds?: string[];
      email?: string;
    };

    if (body.action === 'add') {
      if (!body.merchandiseId) {
        return NextResponse.json({ error: 'merchandiseId required' }, { status: 400 });
      }
      const cart = await addToShopifyCart({
        cartId: body.cartId || null,
        merchandiseId: body.merchandiseId,
        quantity: body.quantity ?? 1,
        email: body.email,
      });
      return NextResponse.json({ cart, configured: true });
    }

    if (!body.cartId) {
      return NextResponse.json({ error: 'cartId required' }, { status: 400 });
    }

    if (body.action === 'update') {
      if (!body.lineId || body.quantity == null) {
        return NextResponse.json({ error: 'lineId and quantity required' }, { status: 400 });
      }
      const cart = await updateCartLines(body.cartId, [
        { id: body.lineId, quantity: body.quantity },
      ]);
      return NextResponse.json({ cart, configured: true });
    }

    if (body.action === 'remove') {
      const ids = body.lineIds || (body.lineId ? [body.lineId] : []);
      if (ids.length === 0) {
        return NextResponse.json({ error: 'lineId(s) required' }, { status: 400 });
      }
      const cart = await removeCartLines(body.cartId, ids);
      return NextResponse.json({ cart, configured: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Shopify cart POST error', err);
    return NextResponse.json({ error: 'Cart update failed' }, { status: 502 });
  }
}
