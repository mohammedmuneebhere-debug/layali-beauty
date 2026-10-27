/**
 * Storefront search ranking.
 * Exact names and brands outrank partial, description, and typo matches.
 */
import { searchableCategory } from '@/lib/shopify/category';

export type SearchableProduct = {
  id?: string;
  handle?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
};

const PLACEHOLDER_BRANDS = new Set(['my store']);

/** Shopify vendor, omitting the catalog-wide placeholder that is not a brand. */
export function searchableBrand(vendor: string | null | undefined): string {
  const value = (vendor || '').trim();
  if (!value || PLACEHOLDER_BRANDS.has(normalizeSearchText(value))) return '';
  return value;
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

const TIER = {
  exactTitle: 5,
  exactBrand: 4,
  strong: 3,
  description: 2,
  fuzzy: 1,
} as const;

type FieldName = 'title' | 'brand' | 'description' | 'meta';
type MatchKind = 'exact' | 'prefix' | 'fuzzy';

type TokenHit = {
  field: FieldName;
  kind: MatchKind;
  distance: number;
};

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchTokens(query: string): string[] {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  const meaningful = tokens.filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  return meaningful.length > 0 ? meaningful : tokens.filter((token) => token.length >= 2);
}

function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    let rowBest = max + 1;
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, matrix[i - 2][j - 2] + 1);
      }
      matrix[i][j] = best;
      if (best < rowBest) rowBest = best;
    }
    if (rowBest > max) return max + 1;
  }
  return matrix[a.length][b.length];
}

function maxFuzzyDistance(token: string): number {
  if (token.length >= 8) return 2;
  if (token.length >= 5) return 1;
  return 0;
}

function matchToken(queryToken: string, fieldToken: string, field: FieldName): TokenHit | null {
  if (!fieldToken) return null;
  if (queryToken === fieldToken) return { field, kind: 'exact', distance: 0 };
  const prefixMin = field === 'description' ? 4 : 3;
  if (
    field !== 'meta' &&
    queryToken.length >= prefixMin &&
    fieldToken.startsWith(queryToken)
  ) {
    return { field, kind: 'prefix', distance: 0 };
  }
  if (field !== 'title' && field !== 'brand') return null;
  const max = maxFuzzyDistance(queryToken);
  if (max === 0) return null;
  const distance = editDistance(queryToken, fieldToken, max);
  if (distance <= max) return { field, kind: 'fuzzy', distance };
  return null;
}

function hitQuality(hit: TokenHit): number {
  const kind = hit.kind === 'exact' ? 300 : hit.kind === 'prefix' ? 200 : 100;
  const field = hit.field === 'title' ? 40 : hit.field === 'brand' ? 30 : hit.field === 'description' ? 20 : 10;
  return kind + field - hit.distance;
}

function bestHit(token: string, fields: { field: FieldName; tokens: string[] }[]): TokenHit | null {
  let best: TokenHit | null = null;
  let bestQuality = 0;
  for (const field of fields) {
    for (const fieldToken of field.tokens) {
      const hit = matchToken(token, fieldToken, field.field);
      if (!hit) continue;
      const quality = hitQuality(hit);
      if (!best || quality > bestQuality) {
        best = hit;
        bestQuality = quality;
      }
    }
  }
  return best;
}

/** Higher scores are better. Zero means the product is not a result. */
export function shopSearchScore(product: SearchableProduct, query: string): number {
  const qNorm = normalizeSearchText(query);
  if (qNorm.length < 2) return 0;
  const tokens = searchTokens(query);
  if (tokens.length === 0) return 0;

  const title = normalizeSearchText(product.name || '');
  const brand = normalizeSearchText(searchableBrand(product.vendor));
  const description = normalizeSearchText(product.description || '');
  const meta = normalizeSearchText(
    [searchableCategory(product.category), ...(product.tags || [])].filter(Boolean).join(' ')
  );
  const fields = [
    { field: 'title' as const, tokens: title.split(' ').filter(Boolean) },
    { field: 'brand' as const, tokens: brand.split(' ').filter(Boolean) },
    { field: 'description' as const, tokens: description.split(' ').filter(Boolean) },
    { field: 'meta' as const, tokens: meta.split(' ').filter(Boolean) },
  ];

  if (title === qNorm) return TIER.exactTitle * 1_000_000 + 1_000;
  if (brand && brand === qNorm) {
    const titleBonus = title.startsWith(qNorm) ? 500 : 0;
    return TIER.exactBrand * 1_000_000 + titleBonus;
  }

  const hits: TokenHit[] = [];
  for (const token of tokens) {
    const hit = bestHit(token, fields);
    if (!hit) return 0;
    hits.push(hit);
  }

  const phraseAtStart = title === qNorm || title.startsWith(`${qNorm} `);
  const titleOnly = hits.every((hit) => hit.field === 'title' && hit.kind !== 'fuzzy');
  const brandOnly = hits.every((hit) => hit.field === 'brand' && hit.kind !== 'fuzzy');
  const anyFuzzy = hits.some((hit) => hit.kind === 'fuzzy');
  const closeness = Math.max(0, 160 - Math.abs(title.length - qNorm.length));

  let tier: number = TIER.description;
  let detail = closeness;
  if (phraseAtStart && titleOnly) {
    tier = TIER.strong;
    detail += 5_000;
  } else if (titleOnly) {
    tier = TIER.strong;
    detail += hits.filter((hit) => hit.kind === 'exact').length * 40;
    detail += hits.filter((hit) => hit.kind === 'prefix').length * 20;
  } else if (brandOnly) {
    tier = TIER.strong;
    detail += 10;
  } else if (anyFuzzy) {
    tier = TIER.fuzzy;
    detail -= hits.reduce((sum, hit) => sum + hit.distance, 0);
  }

  return tier * 1_000_000 + detail;
}

export function rankShopProducts<T extends SearchableProduct>(products: readonly T[], query: string): T[] {
  return products
    .map((product, index) => ({ product, index, score: shopSearchScore(product, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.product);
}

export function productSearchPath(product: { handle?: string | null; id: string }): string {
  const key = product.handle?.trim() || product.id;
  return `/shop/${encodeURIComponent(key)}`;
}

export function shopSearchPath(query: string): string {
  const q = query.trim();
  if (!q) return '/shop';
  return `/shop?q=${encodeURIComponent(q)}`;
}

/** Enter or a highlighted suggestion. The last index is “view all results”. */
export function resolveSearchAction(input: {
  query: string;
  activeIndex: number;
  suggestions: { handle?: string | null; id: string }[];
}): string {
  const suggestion = input.suggestions[input.activeIndex];
  if (suggestion && input.activeIndex < input.suggestions.length) {
    return productSearchPath(suggestion);
  }
  return shopSearchPath(input.query);
}
