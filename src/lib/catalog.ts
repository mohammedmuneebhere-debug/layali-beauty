/**
 * Storefront catalog adapter.
 * Shopify is the authoritative product catalog when configured.
 * Optional city rules live in the Shopify shop record. An empty rule list shows every product.
 */

import { readCatalogRules } from '@/lib/content/store';
import type { CatalogProduct } from '@/lib/shopify/normalize';
import {
  fetchShopifyProductsByIds,
  getCatalogProductByHandle,
  getCatalogProducts,
  isShopifyConfigured,
} from '@/lib/shopify';
import { productDescriptionFields } from '@/lib/shopify/description-html';
import { toCatalogProduct } from '@/lib/shopify/normalize';
import type { ShopifyProduct } from '@/lib/shopify/types';
import { getRegionId } from '@/lib/regions';
import type { RecommendationProduct } from '@/lib/recommendation';

export type ShopVariant = {
  id: string;
  title: string;
  available: boolean;
  price: number;
  compareAtPrice: number | null;
};

function mapShopVariants(
  variants: {
    id: string;
    title: string;
    availableForSale: boolean;
    price: { amount: number };
    compareAtPrice: { amount: number } | null;
  }[]
): ShopVariant[] {
  return variants.map((v) => ({
    id: v.id,
    title: v.title,
    available: v.availableForSale,
    price: v.price.amount,
    compareAtPrice: v.compareAtPrice?.amount ?? null,
  }));
}

export type ShopProduct = CatalogProduct & {
  /** UI fields expected by existing product cards / PDP */
  benefits: string[];
  ingredients: string | null;
  stock_quantity: number;
  is_active: boolean;
  cost_price: null;
  gender: 'female' | 'male' | 'unisex';
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  /**
   * Sanitized Shopify `descriptionHtml` for the product detail page.
   * Absent on catalog-list rows, which only carry the plain description.
   */
  descriptionHtml?: string | null;
};

function toShopProduct(p: CatalogProduct, extras?: { benefits?: string[]; is_featured?: boolean }): ShopProduct {
  return {
    ...p,
    benefits: extras?.benefits || [],
    ingredients: null,
    stock_quantity: p.available ? 99 : 0,
    is_active: p.available,
    cost_price: null,
    gender: 'unisex',
    is_featured: extras?.is_featured ?? false,
    created_at: '',
    updated_at: '',
  };
}

async function loadMetadataMap(
  productIds: string[]
): Promise<Map<string, { benefits: string[]; is_featured: boolean }>> {
  const map = new Map<string, { benefits: string[]; is_featured: boolean }>();
  if (productIds.length === 0) return map;
  const rules = await readCatalogRules();
  for (const row of rules.metadata) {
    if (!productIds.includes(row.shopifyProductId)) continue;
    map.set(row.shopifyProductId, {
      benefits: row.benefits || [],
      is_featured: Boolean(row.featured),
    });
  }
  return map;
}

export async function withProductMetadata(products: ShopProduct[]): Promise<ShopProduct[]> {
  const meta = await loadMetadataMap(products.map((product) => product.shopifyProductId));
  return products.map((product) => {
    const extra = meta.get(product.shopifyProductId);
    if (!extra) return product;
    return {
      ...product,
      benefits: [...new Set([...product.benefits, ...extra.benefits, ...product.tags])],
      is_featured: extra.is_featured || product.is_featured,
    };
  });
}

export async function filterByRegion(
  products: ShopProduct[],
  country: string,
  city: string
): Promise<ShopProduct[]> {
  const regionId = await getRegionId(country, city);
  if (!regionId) return products;
  const rules = await readCatalogRules();
  const rows = rules.productRegions.filter((row) => row.regionId === regionId && row.isAvailable);
  if (rows.length === 0) return products;
  const allowed = new Set(rows.map((row) => row.shopifyProductId));
  return products.filter((product) => allowed.has(product.shopifyProductId));
}

export async function loadShopCatalog(options: {
  category?: string;
  country?: string;
  city?: string;
  query?: string;
  first?: number;
  enrichMetadata?: boolean;
}): Promise<{ products: ShopProduct[]; source: 'shopify' | 'unconfigured' }> {
  if (!isShopifyConfigured()) {
    return { products: [], source: 'unconfigured' };
  }

  const catalog = await getCatalogProducts({
    category: options.category,
    query: options.query,
    // Omit `first` for the full Storefront catalog (cursor-paginated).
    // Callers that need a bound (e.g. trending, AI) pass `first` explicitly.
    first: options.first,
  });

  let products = catalog.map((p) => toShopProduct(p));

  if (options.country && options.city) {
    products = await filterByRegion(products, options.country, options.city);
  }

  if (options.enrichMetadata !== false) {
    products = await withProductMetadata(products);
  }

  return { products, source: 'shopify' };
}

/** Convert shop catalog rows into AI scoring candidates */
export function toRecommendationProducts(products: ShopProduct[]): RecommendationProduct[] {
  return products.map((p) => ({
    shopifyProductId: p.shopifyProductId,
    shopifyVariantId: p.defaultVariantId,
    handle: p.handle,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    image_url: p.image_url,
    category: p.category,
    benefits: [...new Set([...(p.benefits || []), ...(p.tags || [])])],
    tags: p.tags || [],
    available: p.available,
    is_featured: p.is_featured,
  }));
}

/**
 * Load products for survey/AI: Shopify catalog + regional filter + metadata.
 * Single list fetch (not N+1).
 */
export async function loadRecommendationCatalog(options: {
  country?: string;
  city?: string;
}): Promise<{
  products: RecommendationProduct[];
  source: 'shopify' | 'unconfigured';
  error?: string;
}> {
  if (!isShopifyConfigured()) {
    return {
      products: [],
      source: 'unconfigured',
      error: 'Shopify catalog is not configured',
    };
  }

  try {
    const { products, source } = await loadShopCatalog({
      country: options.country,
      city: options.city,
      enrichMetadata: true,
    });

    // Prefer available products for recommendations
    const scored = toRecommendationProducts(products);
    return { products: scored, source };
  } catch (err) {
    console.error('loadRecommendationCatalog failed', err);
    return {
      products: [],
      source: 'shopify',
      error: 'Unable to load products for recommendations',
    };
  }
}

export type ShopDetailProduct = ShopProduct & {
  shopifyVariants: ShopVariant[];
  descriptionHtml: string | null;
};

/** Product-page shape. Uses this product's Shopify descriptionHtml only. */
export function toShopDetailProduct(product: ShopifyProduct): ShopDetailProduct {
  const descriptions = productDescriptionFields(product);
  return {
    ...toShopProduct(toCatalogProduct(product)),
    description: descriptions.description,
    descriptionHtml: descriptions.descriptionHtml,
    shopifyVariants: mapShopVariants(product.variants),
  };
}

export async function loadShopProductByParam(param: string): Promise<ShopDetailProduct | null> {
  if (!isShopifyConfigured() || !param) return null;

  const byHandle = await getCatalogProductByHandle(param);
  if (byHandle) return toShopDetailProduct(byHandle.shopify);

  if (param.startsWith('gid://')) {
    const product = (await fetchShopifyProductsByIds([param]))[0];
    if (product) return toShopDetailProduct(product);

    const { fetchShopifyProductById } = await import('@/lib/shopify/products');
    const byId = await fetchShopifyProductById(param);
    if (!byId) return null;
    return toShopDetailProduct(byId);
  }

  return null;
}
