/**
 * Lightweight grounding helpers for Ask Laila's optional LLM path.
 * Catches obvious unsupported structured claims — not a full NL fact checker.
 */

import type { ShopProduct } from '@/lib/catalog';

export type GroundedAnswer = {
  message: string;
  productHandles: string[];
};

const MISSING_HEDGE =
  /don'?t see|doesn'?t (?:list|provide|specify|include|mention)|does not (?:list|provide|specify|include|mention)|not listed|no ingredient|without (?:an? )?ingredient|isn'?t listed|aren'?t listed|catalog (?:doesn'?t|does not)|unavailable in the catalog|i don'?t have|غير مذكور|لا يذكر|لا توجد|غير متوفر/i;

const HEADING =
  /^(top recommendation|why i picked it|alternative|my pick|best|recommendation|why|اختياري|أفضل توصية|بديل)$/i;

export function parseGroundedAnswer(raw: unknown): GroundedAnswer | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const message = typeof row.message === 'string' ? row.message.trim() : '';
  if (!message) return null;
  const handleRaw = row.productHandles ?? row.product_handles;
  const productHandles = Array.isArray(handleRaw)
    ? handleRaw
        .filter((h): h is string => typeof h === 'string' && Boolean(h.trim()))
        .map((h) => h.trim())
        .slice(0, 4)
    : [];
  return { message: message.slice(0, 2000), productHandles };
}

export function parseAnswerFromText(text: string): GroundedAnswer | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    return parseGroundedAnswer(JSON.parse(trimmed) as unknown);
  } catch {
    return null;
  }
}

function pricesFromQuery(query: string): number[] {
  return (query.match(/\b\d{2,5}\b/g) || [])
    .map((n) => Number(n.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 10);
}

export function allowedPrices(products: ShopProduct[], query: string): Set<number> {
  const prices = new Set<number>(pricesFromQuery(query));
  for (const product of products) {
    const price = Math.round(Number(product.price));
    if (Number.isFinite(price) && price > 0) prices.add(price);
    if (product.compare_at_price != null) {
      const compare = Math.round(Number(product.compare_at_price));
      if (Number.isFinite(compare) && compare > 0) prices.add(compare);
    }
  }
  return prices;
}

export function validateGroundedMessage(
  message: string,
  products: ShopProduct[],
  query: string
): { ok: true } | { ok: false; reason: string } {
  const text = message.trim();
  if (!text) return { ok: false, reason: 'empty' };

  const allowed = allowedPrices(products, query);
  const priceMentions = [
    ...text.matchAll(/(?:SAR|ر\.?\s*س\.?|﷼)\s*([\d,]+)/gi),
    ...text.matchAll(/([\d,]+)\s*(?:SAR|ر\.?\s*س\.?|﷼)/gi),
  ];
  for (const match of priceMentions) {
    const amount = Number((match[1] || '').replace(/,/g, ''));
    if (Number.isFinite(amount) && amount >= 10 && !allowed.has(amount)) {
      return { ok: false, reason: `unsupported-price:${amount}` };
    }
  }

  const hasIngredientField = products.some((p) => Boolean(p.ingredients && p.ingredients.trim()));
  if (!hasIngredientField) {
    const inventedList = /ingredients?\s*(?:are|:)\s*[A-Za-z][A-Za-z0-9 ,%()/.-]{20,}/i.test(text);
    if (inventedList && !MISSING_HEDGE.test(text)) {
      return { ok: false, reason: 'unsupported-ingredient-list' };
    }
  }

  if (products.length > 0) {
    const names = products.map((p) => p.name.toLowerCase());
    const handles = products.map((p) => p.handle.toLowerCase());
    for (const match of text.matchAll(/\*\*([^*]+)\*\*/g)) {
      const bold = match[1].trim();
      if (bold.length < 8 || HEADING.test(bold)) continue;
      const lower = bold.toLowerCase();
      const known =
        names.some((name) => name.includes(lower) || lower.includes(name.slice(0, 18))) ||
        handles.includes(lower);
      if (!known && bold.split(/\s+/).length >= 2) {
        return { ok: false, reason: `unsupported-name:${bold.slice(0, 80)}` };
      }
    }
  }

  if (products.length > 0 && products.every((p) => !p.available)) {
    if (/\bin stock\b|\bavailable now\b/i.test(text) && !MISSING_HEDGE.test(text)) {
      return { ok: false, reason: 'unsupported-availability' };
    }
  }

  return { ok: true };
}

export function knownHandles(handles: string[], catalog: Map<string, ShopProduct>): string[] {
  return handles.filter((handle) => catalog.has(handle));
}
