import type { ShopProduct } from '@/lib/catalog';

export type AssistantProduct = {
  id: string;
  handle: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  category: string;
  image_url: string | null;
  available: boolean;
  reason: string;
};

export type AssistantReply = {
  message: string;
  products: AssistantProduct[];
};

const CATEGORY_WORDS: Record<string, string[]> = {
  skincare: ['skincare', 'skin', 'serum', 'moisturizer', 'cleanser', 'toner', 'face'],
  makeup: ['makeup', 'make up', 'lipstick', 'mascara', 'foundation', 'blush', 'cosmetic'],
  haircare: ['hair', 'haircare', 'shampoo', 'conditioner', 'scalp'],
  fragrance: ['fragrance', 'perfume', 'scent', 'oud', 'mist'],
  bodycare: ['body', 'bodycare', 'lotion', 'shower', 'bath'],
  lenses: ['lenses', 'contact lenses', 'contact lens', 'contacts', 'lensme', 'lens me'],
};

function parseBudget(query: string): number | null {
  const under = query.match(/(?:under|below|less than|upto|up to|<)\s*(?:sar|rs|₹)?\s*([\d,]+)/i);
  const currencyFirst = query.match(/(?:sar|rs|₹)\s*([\d,]+)/i);
  const plain = query.match(/\b([\d,]{2,6})\b/);
  const raw = under?.[1] || currencyFirst?.[1] || (/(budget|under|cheap|affordable)/i.test(query) ? plain?.[1] : null);
  if (!raw) return null;
  const amount = Number(raw.replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function detectCategories(query: string): string[] {
  const q = query.toLowerCase();
  return Object.entries(CATEGORY_WORDS)
    .filter(([, words]) => words.some((word) => q.includes(word)))
    .map(([category]) => category);
}

function isNight(query: string) {
  return /night|evening|pm\b|sleep/.test(query);
}

function isMorning(query: string) {
  return /morning|daytime|am\b|sunrise/.test(query);
}

function isRoutine(query: string) {
  return /routine|ritual|regimen|complete|set|combo/.test(query);
}

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'from',
  'with',
  'what',
  'can',
  'get',
  'need',
  'simple',
  'that',
  'this',
  'have',
  'just',
  'into',
  'your',
  'you',
  'are',
  'was',
  'how',
  'any',
  'all',
]);

function queryTokens(query: string): string[] {
  return query
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function reasonFor(product: ShopProduct, query: string, budget: number | null): string {
  if (budget != null && Number(product.price) <= budget) {
    return `Within your budget at ${Math.round(Number(product.price))} SAR.`;
  }
  if (isNight(query) && /night|sleep|repair|retinol/i.test(`${product.name} ${product.description || ''}`)) {
    return 'Fits a nighttime ritual from the catalog description.';
  }
  if (product.category) {
    return `From the ${product.category} collection.`;
  }
  return 'Matched from the live Layali catalog.';
}

export function answerCatalogQuery(query: string, catalog: ShopProduct[]): AssistantReply {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      message: 'Tell me what you are looking for — a category, a budget, or a simple routine.',
      products: [],
    };
  }

  const q = trimmed.toLowerCase();
  const budget = parseBudget(q);
  const categories = detectCategories(q);
  const available = catalog.filter((p) => p.handle && p.defaultVariantId);

  const tokens = queryTokens(q);

  const scored = available
    .map((product) => {
      const text = `${product.name} ${product.category} ${product.vendor} ${product.description || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (text.includes(token)) score += 2;
      }
      if (categories.includes(product.category)) score += 5;
      if (budget != null && Number(product.price) <= budget) score += 4;
      if (budget != null && Number(product.price) > budget) score -= 6;
      if (isNight(q) && /night|repair|sleep|retinol/.test(text)) score += 3;
      if (isMorning(q) && /day|spf|sunscreen|morning|vitamin c/.test(text)) score += 3;
      if (isRoutine(q) && product.is_featured) score += 1;
      if (product.available) score += 0.1;
      return { product, score };
    })
    .filter((row) => {
      if (row.score < 2) return false;
      if (budget != null && Number(row.product.price) > budget) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score);

  let picks = scored.slice(0, isRoutine(q) ? 4 : 6).map((row) => row.product);

  if (picks.length === 0 && (budget != null || categories.length > 0)) {
    picks = available
      .filter((p) => (categories.length ? categories.includes(p.category) : true))
      .filter((p) => (budget != null ? Number(p.price) <= budget : true))
      .slice(0, 4);
  }

  if (picks.length === 0) {
    return {
      message:
        'I could not find matching products in the current Layali catalog. Try a category, a product name, or a budget.',
      products: [],
    };
  }

  const products: AssistantProduct[] = picks.map((product) => ({
    id: product.id,
    handle: product.handle,
    name: product.name,
    price: Number(product.price),
    compare_at_price: product.compare_at_price,
    category: product.category,
    image_url: product.image_url,
    available: product.available,
    reason: reasonFor(product, q, budget),
  }));

  const intro = isRoutine(q)
    ? 'Here is a catalog-based ritual from products currently available at Layali.'
    : budget != null
      ? `Here are catalog products that fit what you asked, including a budget of ${budget} SAR.`
      : 'Here are matching products from the live Layali catalog.';

  return { message: intro, products };
}
