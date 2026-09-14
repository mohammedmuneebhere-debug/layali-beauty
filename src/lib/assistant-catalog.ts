/**
 * Server-side catalog tools for Ask Laila.
 * Shopify remains the product source of truth; these helpers never invent SKUs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  loadShopCatalog,
  loadShopProductByParam,
  withProductMetadata,
  type ShopProduct,
} from '@/lib/catalog';

export const ASSISTANT_SEARCH_LIMIT = 24;
const DETAIL_EXCERPT = 520;

export type CatalogConcern =
  | 'hydration'
  | 'oil_control'
  | 'sensitive'
  | 'acne'
  | 'brightening'
  | 'hair_damage'
  | 'frizz'
  | 'scalp'
  | 'everyday_makeup'
  | 'occasion_makeup'
  | 'everyday_fragrance'
  | 'beginner';

export const CONCERN_TERMS: Record<CatalogConcern, string[]> = {
  hydration: [
    'dry',
    'dryness',
    'dehydrat',
    'hydrat',
    'moisture',
    'moistur',
    'nourish',
    'barrier',
    'جاف',
    'جفاف',
    'ترطيب',
    'مرطب',
  ],
  oil_control: ['oily', 'oil control', 'matte', 'sebum', 'pore', 'shine', 'دهني', 'لمعان'],
  sensitive: ['sensitive', 'calm', 'sooth', 'gentle', 'fragrance-free', 'irritat', 'حساس', 'لطيف'],
  acne: ['acne', 'blemish', 'breakout', 'salicylic', 'حبوب', 'حب الشباب'],
  brightening: ['bright', 'dull', 'glow', 'vitamin c', 'dark spot', 'pigment', 'تفتيح', 'إشراق'],
  hair_damage: [
    'damage',
    'repair',
    'keratin',
    'bond',
    'split',
    'breakage',
    'تالف',
    'تساقط',
    'ترميم',
  ],
  frizz: ['frizz', 'smooth', 'anti-frizz', 'sleek', 'هيشان', 'تنعيم'],
  scalp: ['scalp', 'dandruff', 'itchy scalp', 'فروة', 'قشرة'],
  everyday_makeup: ['everyday', 'daily', 'natural makeup', 'nude', 'يومي', 'طبيعي'],
  occasion_makeup: ['occasion', 'evening', 'glam', 'party', 'bridal', 'سهرة', 'مناسبات'],
  everyday_fragrance: ['everyday', 'daily', 'fresh', 'light scent', 'mist', 'يومي', 'منعش'],
  beginner: ['beginner', 'simple', 'starter', 'gentle', 'basic', 'مبتدئ', 'بسيط'],
};

const CATEGORY_WORDS: Record<string, string[]> = {
  skincare: [
    'skincare',
    'skin',
    'serum',
    'moisturizer',
    'moisturiser',
    'cleanser',
    'toner',
    'face',
    'cream',
    'sunscreen',
    'spf',
    'بشرة',
    'سيروم',
    'مرطب',
    'غسول',
  ],
  makeup: [
    'makeup',
    'make up',
    'lipstick',
    'mascara',
    'foundation',
    'blush',
    'cosmetic',
    'مكياج',
    'أحمر',
    'فاونديشن',
  ],
  haircare: [
    'hair',
    'haircare',
    'shampoo',
    'conditioner',
    'scalp',
    'شعر',
    'شامبو',
    'بلسم',
  ],
  fragrance: ['fragrance', 'perfume', 'scent', 'oud', 'mist', 'عطر', 'رائحة', 'عود'],
  bodycare: ['body', 'bodycare', 'lotion', 'shower', 'bath', 'جسم', 'لوشن'],
  lenses: ['lenses', 'contact lenses', 'contacts', 'lensme', 'عدسات'],
};

const PRODUCT_TYPE_WORDS = [
  'moisturizer',
  'moisturiser',
  'serum',
  'cleanser',
  'toner',
  'sunscreen',
  'shampoo',
  'conditioner',
  'mask',
  'oil',
  'lipstick',
  'mascara',
  'foundation',
  'perfume',
  'fragrance',
  'mist',
  'cream',
  'lotion',
  'مرطب',
  'سيروم',
  'غسول',
  'شامبو',
  'عطر',
];

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
  'something',
  'please',
  'would',
  'could',
  'should',
  'want',
  'looking',
  'recommend',
  'recommendation',
  'show',
  'find',
  'buy',
  'good',
  'best',
  'help',
  'me',
  'my',
  'a',
  'an',
  'or',
  'to',
  'of',
  'in',
  'on',
  'is',
  'it',
  'about',
  'product',
  'products',
  'description',
  'item',
  'items',
  'such',
  'none',
  'one',
  'ones',
  'which',
]);

function textHasToken(text: string, token: string) {
  if (token.length <= 3) {
    return new RegExp(`(?:^|[^a-z0-9\\u0600-\\u06ff])${token}(?:[^a-z0-9\\u0600-\\u06ff]|$)`).test(
      text
    );
  }
  return text.includes(token);
}

export function detectCategories(query: string): string[] {
  const q = query.toLowerCase();
  return Object.entries(CATEGORY_WORDS)
    .filter(([, words]) => words.some((word) => q.includes(word)))
    .map(([category]) => category);
}

export function detectConcerns(query: string): CatalogConcern[] {
  const q = query.toLowerCase();
  return (Object.keys(CONCERN_TERMS) as CatalogConcern[]).filter((concern) =>
    CONCERN_TERMS[concern].some((term) => q.includes(term))
  );
}

export function parseBudget(query: string): number | null {
  const q = query.toLowerCase();
  const under = q.match(
    /(?:under|below|less than|upto|up to|أقل من|تحت)\s*(?:sar|rs|ر\.?\s*س\.?|﷼)?\s*([\d,]+)/i
  );
  const currencyFirst = q.match(/(?:sar|rs|ر\.?\s*س\.?|﷼)\s*([\d,]+)/i);
  const plain = q.match(/\b([\d,]{2,6})\b/);
  const raw =
    under?.[1] ||
    currencyFirst?.[1] ||
    (/(budget|under|cheap|affordable|ميزانية)/i.test(q) ? plain?.[1] : null);
  if (!raw) return null;
  const amount = Number(raw.replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06ff]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

export function productHaystack(product: ShopProduct): string {
  return `${product.name} ${product.category} ${product.vendor} ${product.description || ''} ${(product.tags || []).join(' ')} ${(product.benefits || []).join(' ')}`.toLowerCase();
}

export function excerpt(text: string | null | undefined, max = DETAIL_EXCERPT): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

export function sizeHint(product: ShopProduct): string | null {
  const blob = `${product.name} ${(product.tags || []).join(' ')}`;
  const match = blob.match(/(\d+(?:\.\d+)?\s?(?:ml|g|mg|oz|مل|غ)\b)/i);
  return match?.[1] || null;
}

export function toAssistantProduct(product: ShopProduct, reason: string) {
  return {
    id: product.id,
    handle: product.handle,
    name: product.name,
    price: Number(product.price),
    compare_at_price: product.compare_at_price,
    category: product.category,
    image_url: product.image_url,
    available: product.available,
    defaultVariantId: product.defaultVariantId,
    vendor: product.vendor,
    reason,
  };
}

export function compactProduct(product: ShopProduct) {
  return {
    handle: product.handle,
    name: product.name,
    price: Number(product.price),
    compare_at_price: product.compare_at_price,
    category: product.category,
    vendor: product.vendor,
    available: product.available,
    tags: (product.tags || []).slice(0, 8),
    benefits: (product.benefits || []).slice(0, 8),
    size: sizeHint(product),
    excerpt: excerpt(product.description, 360),
    ingredients: product.ingredients || null,
    catalog_limits: [
      product.ingredients
        ? null
        : 'Ingredients are not listed in the catalog. Do not invent them or an INCI list.',
      (product.benefits || []).length
        ? null
        : 'No structured benefits list is available. Only quote the description/excerpt.',
    ]
      .filter(Boolean)
      .join(' ') || undefined,
  };
}

export type SearchProductsInput = {
  query?: string;
  category?: string;
  maxPrice?: number;
  minPrice?: number;
  concern?: string;
  limit?: number;
};

export async function searchCatalogProducts(
  supabase: SupabaseClient,
  input: SearchProductsInput
): Promise<ShopProduct[]> {
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 12);
  const categories = input.category ? [input.category] : detectCategories(input.query || '');
  const concerns = [
    ...detectConcerns(input.query || ''),
    ...(input.concern ? detectConcerns(input.concern) : []),
  ];
  const tokens = queryTokens(`${input.query || ''} ${input.concern || ''}`);
  const shopifyQuery = buildShopifyQuery(tokens, concerns, input.query);
  const category = categories.length === 1 ? categories[0] : undefined;

  // One bounded Storefront search — do not paginate collections here.
  const { products: raw } = await loadShopCatalog({
    supabase,
    query: shopifyQuery,
    first: ASSISTANT_SEARCH_LIMIT,
    enrichMetadata: false,
  });

  let products = raw.filter((p) => p.handle);
  if (category) {
    const inCategory = products.filter((p) => p.category === category);
    if (inCategory.length >= 3) products = inCategory;
  }

  const scored = scoreProducts(products, {
    tokens,
    categories,
    concerns,
    budget: input.maxPrice ?? null,
    minPrice: input.minPrice ?? null,
    typeTerms: detectProductTypeTerms(`${input.query || ''} ${input.concern || ''}`),
  });

  const top = scored.slice(0, limit);
  if (top.length === 0) return [];
  return withProductMetadata(supabase, top);
}

function buildShopifyQuery(
  tokens: string[],
  concerns: CatalogConcern[],
  rawQuery?: string
): string | undefined {
  const expansion = concerns.flatMap((c) => CONCERN_TERMS[c].filter((term) => /^[a-z]/.test(term)));
  const terms = [...tokens, ...expansion]
    .map((term) => term.replace(/[^\w\u0600-\u06ff-]/g, ''))
    .filter((term) => term.length > 2)
    .slice(0, 8);
  if (terms.length === 0) {
    const cleaned = (rawQuery || '').trim();
    return cleaned ? cleaned.slice(0, 80) : undefined;
  }
  return terms.join(' OR ');
}

export function scoreProducts(
  products: ShopProduct[],
  opts: {
    tokens: string[];
    categories: string[];
    concerns: CatalogConcern[];
    budget: number | null;
    minPrice?: number | null;
    typeTerms?: string[];
  }
): ShopProduct[] {
  const ranked = products
    .map((product) => {
      const text = productHaystack(product);
      let score = 0;
      for (const token of opts.tokens) {
        if (textHasToken(product.name.toLowerCase(), token)) score += 4;
        else if (textHasToken(text, token)) score += 2;
      }
      if (opts.categories.includes(product.category)) score += 5;
      for (const term of opts.typeTerms || []) {
        if (product.name.toLowerCase().includes(term)) score += 8;
        else if (text.includes(term)) score += 5;
      }
      for (const concern of opts.concerns) {
        const hits = CONCERN_TERMS[concern].filter((term) => text.includes(term)).length;
        score += Math.min(hits, 4) * 2;
      }
      const price = Number(product.price);
      if (opts.budget != null && price <= opts.budget) score += 4;
      if (opts.budget != null && price > opts.budget) score -= 8;
      if (opts.minPrice != null && price < opts.minPrice) score -= 3;
      if (product.available) score += 0.2;
      if (product.is_featured) score += 0.4;
      return { product, score };
    })
    .filter((row) => {
      if (opts.budget != null && Number(row.product.price) > opts.budget) return false;
      if (opts.minPrice != null && Number(row.product.price) < opts.minPrice) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score);
  const matched = ranked.filter((row) => row.score >= 2);
  if (matched.length > 0) return matched.map((row) => row.product);
  if (opts.categories.length > 0 || opts.budget != null) {
    return ranked.map((row) => row.product);
  }
  return [];
}

export function reasonForProduct(
  product: ShopProduct,
  query: string,
  budget: number | null,
  concerns: CatalogConcern[]
): string {
  const text = productHaystack(product);
  const snippet = excerpt(product.description, 110);
  for (const concern of concerns) {
    const hit = CONCERN_TERMS[concern].find((term) => text.includes(term));
    if (hit) {
      return snippet
        ? `Fits ${concern.replace(/_/g, ' ')} from the catalog notes: ${snippet}`
        : `Tagged and described around ${concern.replace(/_/g, ' ')}.`;
    }
  }
  if (budget != null && Number(product.price) <= budget) {
    return `Priced at ${Math.round(Number(product.price))} SAR, within ${budget} SAR.`;
  }
  const token = queryTokens(query).find((t) => textHasToken(product.name.toLowerCase(), t));
  if (token) return `Matched “${token}” in the product name.`;
  if (snippet) return snippet;
  if (product.category) return `From the ${product.category} collection.`;
  return 'From the live Layali catalog.';
}

export async function loadProductsByRefs(
  supabase: SupabaseClient,
  refs: string[]
): Promise<ShopProduct[]> {
  const unique = [...new Set(refs.map((r) => r.trim()).filter(Boolean))].slice(0, 8);
  const loaded = (await Promise.all(unique.map((ref) => loadShopProductByParam(ref)))).filter(
    (p) => p != null
  );
  if (loaded.length === 0) return [];
  return withProductMetadata(supabase, loaded);
}

export async function getProductDetails(
  supabase: SupabaseClient,
  ref: string
): Promise<ShopProduct | null> {
  const [product] = await loadProductsByRefs(supabase, [ref]);
  return product || null;
}

export type ComparisonRow = { label: string; values: string[] };

export type CatalogComparison = {
  products: ShopProduct[];
  rows: ComparisonRow[];
  pick: { product: ShopProduct; reason: string } | null;
};

export function compareCatalogProducts(
  products: ShopProduct[],
  query: string
): CatalogComparison {
  const usable = products.slice(0, 3);
  if (usable.length < 2) {
    return { products: usable, rows: [], pick: null };
  }

  const concerns = detectConcerns(query);
  const budget = parseBudget(query);
  const wantsValue = /value|cheaper|budget|afford|worth|سعر|قيمة/.test(query.toLowerCase());

  const rows: ComparisonRow[] = [
    { label: 'Best for', values: usable.map((p) => bestForLabel(p, concerns)) },
    { label: 'Key benefit', values: usable.map((p) => keyBenefit(p)) },
    { label: 'Type', values: usable.map((p) => p.category || '—') },
    { label: 'Brand', values: usable.map((p) => p.vendor || '—') },
    {
      label: 'Price',
      values: usable.map((p) => `${Math.round(Number(p.price))} SAR`),
    },
    { label: 'Size', values: usable.map((p) => sizeHint(p) || 'Not listed') },
    {
      label: 'Availability',
      values: usable.map((p) => (p.available ? 'In stock' : 'Out of stock')),
    },
  ];

  const scored = usable.map((product) => {
    let score = 0;
    const text = productHaystack(product);
    for (const concern of concerns) {
      score += CONCERN_TERMS[concern].filter((term) => text.includes(term)).length * 2;
    }
    if (wantsValue || budget != null) {
      const max = Math.max(...usable.map((p) => Number(p.price)));
      const min = Math.min(...usable.map((p) => Number(p.price)));
      if (max > min && Number(product.price) === min) score += 3;
    }
    if (product.available) score += 0.5;
    return { product, score, text };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];
  const runner = scored[1];
  let pick: CatalogComparison['pick'] = null;

  if (winner && (scored.length === 1 || winner.score > (runner?.score ?? -1) || wantsValue || concerns.length > 0)) {
    const reason = pickReason(winner.product, runner?.product, concerns, wantsValue, query);
    pick = { product: winner.product, reason };
  } else if (winner) {
    pick = {
      product: winner.product,
      reason: pickReason(winner.product, runner?.product, concerns, true, query),
    };
  }

  return { products: usable, rows, pick };
}

function bestForLabel(product: ShopProduct, concerns: CatalogConcern[]): string {
  if (concerns.length > 0) {
    const text = productHaystack(product);
    const matched = concerns.find((c) => CONCERN_TERMS[c].some((term) => text.includes(term)));
    if (matched) return matched.replace(/_/g, ' ');
  }
  if (product.benefits[0]) return product.benefits[0];
  return product.category || 'Everyday use';
}

function keyBenefit(product: ShopProduct): string {
  if (product.benefits[0]) return product.benefits[0];
  const sentence = (product.description || '').split(/[.!?]/)[0]?.trim();
  if (sentence && sentence.length > 12) return excerpt(sentence, 80);
  return product.tags[0] || 'See product page for details';
}

function pickReason(
  winner: ShopProduct,
  other: ShopProduct | undefined,
  concerns: CatalogConcern[],
  wantsValue: boolean,
  query: string
): string {
  const concern = concerns[0]?.replace(/_/g, ' ');
  if (concern) {
    return `If ${concern} is the priority, ${winner.name} is the stronger catalog match.`;
  }
  if (wantsValue && other) {
    const w = Number(winner.price);
    const o = Number(other.price);
    if (w <= o) {
      return `${winner.name} is the better value at ${Math.round(w)} SAR versus ${Math.round(o)} SAR.`;
    }
  }
  if (/beginner|new to|simple/i.test(query)) {
    return `${winner.name} is the simpler everyday pick from the compared set.`;
  }
  return `${winner.name} is the clearer fit from the catalog details available.`;
}

export function relevantDescription(product: ShopProduct, query: string): string {
  const description = product.description?.trim();
  if (!description) {
    const bits = [
      product.benefits[0],
      product.tags.slice(0, 3).join(', '),
      product.category ? `${product.category} by ${product.vendor || 'Layali'}` : '',
    ].filter(Boolean);
    return bits.join('. ') || '';
  }
  const tokens = queryTokens(query);
  const sentences = description.split(/(?<=[.!?])\s+/);
  const matched = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return tokens.some((token) => lower.includes(token));
  });
  const chosen = (matched.length ? matched : sentences).slice(0, 3).join(' ');
  return excerpt(chosen, 420);
}

export function detectProductTypeTerms(query: string): string[] {
  const q = query.toLowerCase();
  return PRODUCT_TYPE_WORDS.filter((word) => q.includes(word));
}
