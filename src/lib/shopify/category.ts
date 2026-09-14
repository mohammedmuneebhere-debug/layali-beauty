/**
 * Storefront category slugs used by Shop filters, nav, and catalog mapping.
 * Keep in sync with PRODUCT_CATEGORIES in `@/lib/constants`.
 */
export const STOREFRONT_CATEGORY_SLUGS = [
  'makeup',
  'skincare',
  'haircare',
  'bodycare',
  'fragrance',
  'lenses',
  'combo',
] as const;

export type StorefrontCategorySlug = (typeof STOREFRONT_CATEGORY_SLUGS)[number];

const STOREFRONT_CATEGORY_SET = new Set<string>(STOREFRONT_CATEGORY_SLUGS);

type CategorySource = {
  productType?: string | null;
  tags?: string[];
  collections?: { handle: string; title?: string }[];
  title?: string;
  handle?: string;
};

function normalizeSlug(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function tagSlug(tag: string): string {
  return normalizeSlug(tag).replace(/^category:/, '');
}

/**
 * Cosmetic contact lenses currently live in Shopify as `productType: makeup`
 * with `category:makeup` tags (legacy migration). Identify them from taxonomy
 * first, then from unambiguous title/handle signals — never from "lash".
 */
export function isLensProduct(product: CategorySource): boolean {
  const type = normalizeSlug(product.productType);
  if (
    type === 'lenses' ||
    type === 'lens' ||
    type === 'contact lenses' ||
    type === 'contact lens'
  ) {
    return true;
  }

  for (const collection of product.collections || []) {
    const handle = normalizeSlug(collection.handle);
    const title = normalizeSlug(collection.title);
    if (
      handle === 'lenses' ||
      title === 'lenses' ||
      handle.includes('contact-lens') ||
      title.includes('contact lens')
    ) {
      return true;
    }
  }

  for (const tag of product.tags || []) {
    const slug = tagSlug(tag);
    if (slug === 'lenses' || slug === 'lens' || slug === 'contact-lenses') {
      return true;
    }
  }

  const hay = `${product.title || ''} ${product.handle || ''}`.toLowerCase();
  return /contact lenses?|cosmetic lenses?|colored contact|\blens[\s-]?me\b|\blensme\b/.test(
    hay
  );
}

export function isStorefrontCategory(value: string | null | undefined): value is StorefrontCategorySlug {
  return STOREFRONT_CATEGORY_SET.has(normalizeSlug(value));
}

/**
 * Map a Shopify product onto a single storefront category slug.
 * Prefer live taxonomy (type / collection / tag), then lens title signals,
 * then a conservative default so untyped products remain visible.
 */
export function resolveStorefrontCategory(product: CategorySource): string {
  if (isLensProduct(product)) return 'lenses';

  const type = normalizeSlug(product.productType);
  if (isStorefrontCategory(type)) return type;

  for (const collection of product.collections || []) {
    const handle = normalizeSlug(collection.handle);
    if (isStorefrontCategory(handle)) return handle;
  }

  for (const tag of product.tags || []) {
    const slug = tagSlug(tag);
    if (isStorefrontCategory(slug)) return slug;
  }

  return type || 'skincare';
}
