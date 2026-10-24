/**
 * Homepage shelves taken from the shop catalog.
 * Selection follows storefront category order and the shop's featured sort.
 * Products are the same catalog objects — nothing is copied into a second catalog.
 */
import { STOREFRONT_NAV_CATEGORIES } from '@/lib/constants';
import { sortShopProducts } from '@/lib/shop-filters';

/** One desktop row of the shop grid. Matches the previous makeup merch preview. */
export const HOME_CATEGORY_PREVIEW_COUNT = 4;

const TRENDING_CATEGORY_ORDER = STOREFRONT_NAV_CATEGORIES.map((category) => category.value);

type ShelfProduct = {
  category: string;
  name: string;
  price: number | string;
};

/** First catalog product in each nav category, in Makeup → Lenses order. */
export function firstProductPerCategory<T extends { category: string }>(
  products: readonly T[]
): T[] {
  const firstByCategory = new Map<string, T>();
  for (const product of products) {
    if (firstByCategory.has(product.category)) continue;
    firstByCategory.set(product.category, product);
  }

  return TRENDING_CATEGORY_ORDER.flatMap((category) => {
    const product = firstByCategory.get(category);
    return product ? [product] : [];
  });
}

/** First `count` products of one category, in the order given (featured catalog order). */
export function firstProductsInCategory<T extends { category: string }>(
  products: readonly T[],
  category: string,
  count = HOME_CATEGORY_PREVIEW_COUNT
): T[] {
  if (count <= 0) return [];
  const picked: T[] = [];
  for (const product of products) {
    if (product.category !== category) continue;
    picked.push(product);
    if (picked.length >= count) break;
  }
  return picked;
}

export function selectHomepageShelves<T extends ShelfProduct>(products: readonly T[]) {
  const featured = sortShopProducts(products, 'featured');
  return {
    trending: firstProductPerCategory(featured),
    makeup: firstProductsInCategory(featured, 'makeup'),
    skincare: firstProductsInCategory(featured, 'skincare'),
  };
}
