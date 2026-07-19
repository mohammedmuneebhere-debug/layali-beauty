import { NextResponse } from 'next/server';
import { sendOrderEmail } from '@/lib/email';
import { DELIVERY_FEE } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const body = await request.json();
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
      return NextResponse.json(
        { ok: false, error: result.error || 'Email not sent' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, provider: result.provider });
  } catch (error) {
    console.error('[api/email/order]', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
