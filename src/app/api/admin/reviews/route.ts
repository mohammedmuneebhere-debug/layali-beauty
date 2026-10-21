import { NextResponse } from 'next/server';
import { getCustomerContext } from '@/lib/auth/current-customer';
import { requireStaff } from '@/lib/auth/require-staff';
import { addReview, deleteReview, listReviews, updateReview } from '@/lib/content/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const approved = new URL(request.url).searchParams.get('approved');
  if (approved === '1') {
    const reviews = (await listReviews()).filter((review) => review.is_approved);
    return NextResponse.json({ reviews });
  }
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const reviews = (await listReviews()).filter((review) => !review.is_approved);
  return NextResponse.json({ reviews });
}

export async function POST(request: Request) {
  const context = await getCustomerContext();
  if (!context.signedIn) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    rating?: number;
    title?: string;
    content?: string;
  } | null;
  if (!body?.title || !body.content || !body.rating) {
    return NextResponse.json({ error: 'rating, title, and content are required' }, { status: 400 });
  }
  await addReview({
    userId: context.customer.id,
    fullName: context.customer.fullName,
    city: context.customer.city,
    country: context.customer.country,
    rating: Math.min(5, Math.max(1, Number(body.rating))),
    title: body.title.slice(0, 120),
    content: body.content.slice(0, 2000),
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => null)) as { id?: string; is_approved?: boolean } | null;
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await updateReview(body.id, { is_approved: Boolean(body.is_approved) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await deleteReview(id);
  return NextResponse.json({ ok: true });
}
