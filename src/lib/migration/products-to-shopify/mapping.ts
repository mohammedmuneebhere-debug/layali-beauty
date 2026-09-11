import type { Product } from '@/types/database';

/** Deterministic unique Shopify handle from title + Supabase product id. */
export function buildShopifyHandle(product: Pick<Product, 'id' | 'name'>): string {
  const base = slugify(product.name) || 'product';
  const suffix = product.id.replace(/-/g, '').slice(0, 8);
  const handle = `${base}-${suffix}`;
  return handle.slice(0, 255);
}

/** Base slug without uniqueness suffix (for collision reporting). */
export function buildBaseHandleSlug(name: string): string {
  return slugify(name) || 'product';
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 200);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toDescriptionHtml(description: string | null): string | undefined {
  if (!description?.trim()) return undefined;
  const trimmed = description.trim();
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }
  return `<p>${escapeHtml(trimmed)}</p>`;
}

export function collectImageUrls(product: Product): string[] {
  const urls: string[] = [];
  const push = (url: string | null | undefined) => {
    const u = url?.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) return;
    if (urls.includes(u)) return;
    urls.push(u);
  };
  push(product.image_url);
  for (const img of product.images ?? []) push(img);
  return urls;
}

export function formatShopifyPrice(value: number): string {
  return Number(value).toFixed(2);
}

export function buildProductTags(product: Product): string[] {
  const tags = new Set<string>();
  tags.add('layali-migrated');
  tags.add(`gender:${product.gender}`);
  if (product.category) tags.add(`category:${product.category}`);
  if (product.is_featured) tags.add('featured');
  return Array.from(tags);
}

export type ProductValidationIssue = {
  productId: string;
  name: string;
  messages: string[];
};

export function validateProductForMigration(product: Product): string[] {
  const errors: string[] = [];
  if (!product.id) errors.push('Missing product id');
  if (!product.name?.trim()) errors.push('Missing name/title');
  if (product.price == null || Number.isNaN(Number(product.price))) {
    errors.push('Missing or invalid price');
  } else if (Number(product.price) < 0) {
    errors.push('Negative price');
  }
  if (
    product.compare_at_price != null &&
    (Number.isNaN(Number(product.compare_at_price)) ||
      Number(product.compare_at_price) < 0)
  ) {
    errors.push('Invalid compare_at_price');
  }
  if (
    product.stock_quantity == null ||
    Number.isNaN(Number(product.stock_quantity)) ||
    product.stock_quantity < 0
  ) {
    errors.push('Invalid stock_quantity');
  }
  return errors;
}
