import { NextResponse } from 'next/server';
import { sendOrderEmail } from '@/lib/email';
import { staffEmailDecision } from '@/lib/auth/staff-allowlist';
import { getCustomerContext } from '@/lib/auth/current-customer';
import { DELIVERY_FEE } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const context = await getCustomerContext();
    const decision = staffEmailDecision(context.signedIn ? context.customer.email : null);
    if (decision === 'unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (decision === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: {
      type?: string;
      to?: string;
      customerName?: string;
      orderId?: string;
      totalAmount?: number;
      deliveryFee?: number;
      items?: { name: string; quantity: number; price: number }[];
      shippingAddress?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const {
      type,
      to,
      customerName,
      orderId,
      totalAmount,
      deliveryFee = DELIVERY_FEE,
      items = [],
      shippingAddress,
    } = body;

    if (!type || !to || !orderId || !customerName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type !== 'confirmed' && type !== 'delivered') {
      return NextResponse.json({ error: 'Invalid email type' }, { status: 400 });
    }

    const result = await sendOrderEmail({
      type,
      to,
      customerName,
      orderId,
      totalAmount: Number(totalAmount) || 0,
      deliveryFee: Number(deliveryFee) || DELIVERY_FEE,
      items,
      shippingAddress,
    });

    if (!result.sent) {
      console.error('[api/email/order] provider failed');
      return NextResponse.json({ ok: false, error: 'Email not sent' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, provider: result.provider });
  } catch {
    console.error('[api/email/order] request failed');
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
