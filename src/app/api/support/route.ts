import { NextResponse } from 'next/server';
import { getCustomerContext } from '@/lib/auth/current-customer';
import { requireStaff } from '@/lib/auth/require-staff';
import {
  addSupportMessage,
  closeSupportConversation,
  customerSupportThread,
  listSupport,
} from '@/lib/content/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get('scope');
  if (scope === 'admin') {
    const auth = await requireStaff();
    if (auth.error) return auth.error;
    return NextResponse.json(await listSupport());
  }
  const context = await getCustomerContext();
  const reviews = scope === 'mine';
  void reviews;
  if (!context.signedIn) {
    return NextResponse.json({ conversation: null, messages: [] });
  }
  return NextResponse.json(await customerSupportThread(context.customer.id));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    message?: string;
    conversationId?: string;
    role?: 'user' | 'admin';
  } | null;
  const message = body?.message?.trim() || '';
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });

  if (body?.role === 'admin') {
    const auth = await requireStaff();
    if (auth.error) return auth.error;
    if (!body.conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    const sent = await addSupportMessage({
      userId: auth.customer.id,
      fullName: auth.customer.fullName,
      email: auth.customer.email,
      city: auth.customer.city,
      country: auth.customer.country,
      senderRole: 'admin',
      message,
      conversationId: body.conversationId,
    });
    return NextResponse.json(sent);
  }

  const context = await getCustomerContext();
  if (!context.signedIn) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const sent = await addSupportMessage({
    userId: context.customer.id,
    fullName: context.customer.fullName,
    email: context.customer.email,
    city: context.customer.city,
    country: context.customer.country,
    senderRole: 'user',
    message,
    conversationId: body?.conversationId,
  });
  return NextResponse.json(sent);
}

export async function PATCH(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!body?.id || body.status !== 'closed') {
    return NextResponse.json({ error: 'id and status=closed required' }, { status: 400 });
  }
  await closeSupportConversation(body.id);
  return NextResponse.json({ ok: true });
}
