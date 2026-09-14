import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runAssistant, type AssistantHistoryTurn, type AssistantPageContext } from '@/lib/assistant';
import { isShopifyConfigured } from '@/lib/shopify';

export const runtime = 'nodejs';

const CATALOG_TROUBLE =
  'I’m having trouble accessing the product catalog right now. Please try again in a moment.';

const WINDOW_MS = 60_000;
const MAX_HITS = 24;
const hits = new Map<string, number[]>();

function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

function consumeQuota(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_HITS) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

function cleanRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().slice(0, 180);
  if (!s) return null;
  if (s.startsWith('gid://shopify/Product/')) return s;
  if (/^[A-Za-z0-9][A-Za-z0-9-_]*$/.test(s)) return s;
  return null;
}

function parseHistory(raw: unknown): AssistantHistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: AssistantHistoryTurn[] = [];
  for (const item of raw.slice(-8)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { role?: unknown; text?: unknown };
    if (row.role !== 'user' && row.role !== 'assistant') continue;
    if (typeof row.text !== 'string' || !row.text.trim()) continue;
    turns.push({ role: row.role, text: row.text.trim().slice(0, 500) });
  }
  return turns;
}

function parseContext(raw: unknown): AssistantPageContext {
  if (!raw || typeof raw !== 'object') return {};
  const row = raw as Record<string, unknown>;
  const cartRaw = Array.isArray(row.cart) ? row.cart : [];
  return {
    currentHandle: cleanRef(row.currentHandle),
    compareHandles: Array.isArray(row.compareHandles)
      ? row.compareHandles.map(cleanRef).filter((v): v is string => Boolean(v)).slice(0, 3)
      : [],
    recentlyViewedHandles: Array.isArray(row.recentlyViewedHandles)
      ? row.recentlyViewedHandles.map(cleanRef).filter((v): v is string => Boolean(v)).slice(0, 8)
      : [],
    lastProductHandles: Array.isArray(row.lastProductHandles)
      ? row.lastProductHandles.map(cleanRef).filter((v): v is string => Boolean(v)).slice(0, 6)
      : [],
    cart: cartRaw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const line = item as { handle?: unknown; name?: unknown };
        const handle = cleanRef(line.handle);
        const name = typeof line.name === 'string' ? line.name.trim().slice(0, 120) : '';
        if (!handle || !name) return null;
        return { handle, name };
      })
      .filter((v): v is { handle: string; name: string } => Boolean(v))
      .slice(0, 8),
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!consumeQuota(`assistant:${clientKey(req.headers)}`)) {
      return NextResponse.json(
        {
          message: 'I’m getting a lot of questions right now. Please try again in a moment.',
          products: [],
        },
        { status: 429 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const query = typeof body.query === 'string' ? body.query.slice(0, 500) : '';
    const locale = body.locale === 'ar' ? 'ar' : 'en';
    const history = parseHistory(body.history);
    const context = parseContext(body.context);

    if (!isShopifyConfigured()) {
      return NextResponse.json({
        message: CATALOG_TROUBLE,
        products: [],
      });
    }

    const supabase = await createClient();
    const reply = await runAssistant(supabase, { query, locale, history, context });
    return NextResponse.json(reply);
  } catch (err) {
    console.error('Assistant ask error', err);
    return NextResponse.json(
      { message: CATALOG_TROUBLE, products: [] },
      { status: 502 }
    );
  }
}
