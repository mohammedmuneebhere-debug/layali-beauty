/**
 * Shop category classification. No network and no Shopify writes.
 * Usage: npm run test:category
 */
import { UNCATEGORIZED_CATEGORY, classifiedCategoryLabel, resolveStorefrontCategory, searchableCategory } from '@/lib/shopify/category';
import { toCatalogProduct } from '@/lib/shopify/normalize';
import { filterShopProducts, PAGE_SIZE, paginateShopProducts } from '@/lib/shop-filters';
import type { ShopifyProduct } from '@/lib/shopify/types';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

function catalogProduct(overrides: Partial<ShopifyProduct> = {}) {
  const product: ShopifyProduct = {
    id: overrides.id || 'gid://shopify/Product/1',
    handle: overrides.handle || 'sample',
    title: overrides.title || 'Sample',
    description: overrides.description || '',
    descriptionHtml: '',
    availableForSale: true,
    productType: overrides.productType || '',
    tags: overrides.tags || [],
    vendor: overrides.vendor || 'Brand',
    images: [],
    featuredImage: null,
    price: { amount: 25, currencyCode: 'SAR' },
    compareAtPrice: null,
    variants: [],
    defaultVariantId: 'gid://shopify/ProductVariant/1',
    collections: overrides.collections || [],
  };
  return toCatalogProduct(product);
}

assert(
  'product type makeup is makeup',
  resolveStorefrontCategory({ productType: 'Makeup' }) === 'makeup'
);
assert(
  'product type skincare stays skincare',
  resolveStorefrontCategory({ productType: 'skincare' }) === 'skincare'
);
assert(
  'collection handle classifies haircare',
  resolveStorefrontCategory({
    productType: '',
    collections: [{ handle: 'haircare', title: 'Hair' }],
  }) === 'haircare'
);
assert(
  'category tag classifies fragrance',
  resolveStorefrontCategory({ productType: '', tags: ['category:fragrance'] }) === 'fragrance'
);
assert(
  'plain tag classifies bodycare',
  resolveStorefrontCategory({ productType: '', tags: ['bodycare'] }) === 'bodycare'
);
assert(
  'contact-lens product type is lenses',
  resolveStorefrontCategory({ productType: 'contact lenses', title: 'Daily pair' }) === 'lenses'
);
assert(
  'LensMe title is lenses without a product type',
  resolveStorefrontCategory({
    productType: '',
    title: 'LensMe Colored Contact Lenses – Petroleum',
    handle: 'lensme-colored-contact-lenses-petroleum',
  }) === 'lenses'
);
assert(
  'a mascara title does not become makeup or skincare',
  resolveStorefrontCategory({
    productType: '',
    title: 'Bourjois Twist Up The Volume Mascara - Ultra Black',
    handle: 'bourjois-twist-up-the-volume-mascara-ultra-black',
  }) === UNCATEGORIZED_CATEGORY
);
assert(
  'missing taxonomy is uncategorized',
  resolveStorefrontCategory({ productType: '', tags: [], collections: [], title: 'Untitled' }) ===
    UNCATEGORIZED_CATEGORY
);
assert(
  'a non-slug product type is kept and is not skincare',
  resolveStorefrontCategory({ productType: 'Serum' }) === 'serum'
);
assert(
  'known product type wins over a different collection',
  resolveStorefrontCategory({
    productType: 'makeup',
    collections: [{ handle: 'skincare' }],
  }) === 'makeup'
);
assert('uncategorized is not a customer label', classifiedCategoryLabel(UNCATEGORIZED_CATEGORY) === '');
assert('makeup remains a customer label', classifiedCategoryLabel('makeup') === 'makeup');

const mascara = catalogProduct({
  id: 'gid://shopify/Product/2',
  handle: 'bourjois-mascara',
  title: 'Bourjois Twist Up The Volume Mascara - Ultra Black',
  vendor: 'Bourjois',
  price: { amount: 40, currencyCode: 'SAR' },
});
const toner = catalogProduct({
  id: 'gid://shopify/Product/3',
  handle: 'isntree-toner',
  title: 'Isntree Hyaluronic Acid Toner Plus – 200 ml',
  vendor: 'Isntree',
  price: { amount: 55, currencyCode: 'SAR' },
});
const lipstick = catalogProduct({
  id: 'gid://shopify/Product/4',
  handle: 'sephora-lip-stain',
  title: 'SEPHORA COLLECTION Cream Lip Stain',
  productType: 'makeup',
  vendor: 'Sephora',
  price: { amount: 70, currencyCode: 'SAR' },
});
const lenses = catalogProduct({
  id: 'gid://shopify/Product/5',
  handle: 'lensme-colored-contact-lenses-petroleum',
  title: 'LensMe Colored Contact Lenses – Petroleum',
  vendor: 'LensMe',
  price: { amount: 45, currencyCode: 'SAR' },
});
const shampoo = catalogProduct({
  id: 'gid://shopify/Product/6',
  handle: 'sample-shampoo',
  title: 'Sample shampoo',
  tags: ['category:haircare'],
  vendor: 'Brand',
  price: { amount: 30, currencyCode: 'SAR' },
});

assert('mapped mascara is uncategorized', mascara.category === UNCATEGORIZED_CATEGORY);
assert('mapped lipstick keeps makeup', lipstick.category === 'makeup');
assert('mapped lenses stay lenses', lenses.category === 'lenses');
assert('mapped tagged shampoo is haircare', shampoo.category === 'haircare');

const catalog = [mascara, toner, lipstick, lenses, shampoo];
const all = filterShopProducts(catalog, {});
assert('All keeps every product', all.length === catalog.length);
assert(
  'All still includes unclassified products',
  all.some((product) => product.id === mascara.id) && all.some((product) => product.id === toner.id)
);

for (const category of ['makeup', 'skincare', 'haircare', 'bodycare', 'fragrance', 'lenses', 'combo']) {
  const visible = filterShopProducts(catalog, { category });
  const leaked = visible.some((product) => product.category === UNCATEGORIZED_CATEGORY);
  assert(`${category} does not include unclassified products`, !leaked);
}

assert(
  'makeup filter keeps the typed lipstick only',
  filterShopProducts(catalog, { category: 'makeup' }).map((product) => product.handle).join() ===
    'sephora-lip-stain'
);
assert(
  'skincare filter is empty when nothing is typed skincare',
  filterShopProducts(catalog, { category: 'skincare' }).length === 0
);
assert(
  'lenses filter keeps the contact lenses',
  filterShopProducts(catalog, { category: 'lenses' }).length === 1
);
assert(
  'search still finds an unclassified mascara',
  filterShopProducts(catalog, { search: 'mascara' }).length === 1
);
assert(
  'the uncategorized sentinel is not a search hit',
  filterShopProducts(catalog, { search: 'uncategorized' }).length === 0
);
assert(
  'a real department remains searchable on a classified product',
  filterShopProducts(catalog, { search: 'makeup' }).map((product) => product.handle).join() ===
    'sephora-lip-stain'
);
assert('searchable category omits the sentinel', searchableCategory(UNCATEGORIZED_CATEGORY) === '');
assert('searchable category keeps a real department', searchableCategory('lenses') === 'lenses');
assert('searchable category keeps a non-slug product type', searchableCategory('Serum') === 'Serum');

const serum = catalogProduct({
  id: 'gid://shopify/Product/7',
  handle: 'sample-serum',
  title: 'Sample treatment',
  productType: 'Serum',
  vendor: 'Brand',
  price: { amount: 35, currencyCode: 'SAR' },
});
assert('a non-slug product type stays searchable', filterShopProducts([serum], { search: 'serum' }).length === 1);
assert(
  'brand filter still finds the unclassified Bourjois product',
  filterShopProducts(catalog, { brand: 'Bourjois' }).length === 1
);
assert(
  'price filter still applies to unclassified products',
  filterShopProducts(catalog, { maxPrice: '50' }).every((product) => Number(product.price) <= 50)
);

const many = Array.from({ length: PAGE_SIZE + 1 }, (_, index) =>
  catalogProduct({
    id: `gid://shopify/Product/${100 + index}`,
    handle: `item-${index}`,
    title: index === PAGE_SIZE ? 'Bourjois Mascara Page Two' : `Toner ${index}`,
    vendor: 'Brand',
  })
);
const pagedAll = filterShopProducts(many, {});
const page1 = paginateShopProducts(pagedAll, 1);
const page2 = paginateShopProducts(pagedAll, 2);
assert('page size stays 12', page1.pageItems.length === PAGE_SIZE);
assert('the extra unclassified product is on page 2', page2.pageItems.length === 1);
assert('page 2 is still the unclassified catalog', page2.pageItems[0]?.category === UNCATEGORIZED_CATEGORY);
assert(
  'pagination does not drop products',
  page1.pageItems.length + page2.pageItems.length === many.length
);
const makeupPage = paginateShopProducts(
  filterShopProducts(
    [...many, lipstick],
    { category: 'makeup' }
  ),
  1
);
assert('makeup pagination does not pull in unclassified products', makeupPage.pageItems.length === 1);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('category classification checks passed');
