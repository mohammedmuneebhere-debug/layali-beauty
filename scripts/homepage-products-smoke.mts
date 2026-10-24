/**
 * Homepage shelves use the shop catalog order. No network and no Shopify writes.
 * Usage: npm run test:homepage-products
 */
import {
  HOME_CATEGORY_PREVIEW_COUNT,
  firstProductPerCategory,
  firstProductsInCategory,
  selectHomepageShelves,
} from '@/lib/homepage-products';
import { sortShopProducts } from '@/lib/shop-filters';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

type Item = { id: string; name: string; category: string; price: number };

function item(id: string, category: string, price: number, name = id): Item {
  return { id, name, category, price };
}

const catalog: Item[] = [
  item('mk1', 'makeup', 90, 'Lip'),
  item('sk1', 'skincare', 40, 'Serum'),
  item('hc1', 'haircare', 30, 'Oil'),
  item('mk2', 'makeup', 10, 'Blush'),
  item('bc1', 'bodycare', 25, 'Wash'),
  item('fr1', 'fragrance', 120, 'Oud'),
  item('mk3', 'makeup', 15, 'Liner'),
  item('ln1', 'lenses', 50, 'Hazel'),
  item('combo', 'combo', 5, 'Set'),
  item('sk2', 'skincare', 5, 'Toner'),
  item('sk3', 'skincare', 70, 'Cream'),
  item('sk4', 'skincare', 8, 'Mist'),
  item('sk5', 'skincare', 9, 'Mask'),
  item('other', 'uncategorized', 1, 'Other'),
];
const originalIds = catalog.map((product) => product.id);

const shelves = selectHomepageShelves(catalog);

assert('preview count is four', HOME_CATEGORY_PREVIEW_COUNT === 4);
assert(
  'trending shelf is the first product of each nav category',
  shelves.trending.map((product) => product.id).join(',') === 'mk1,sk1,hc1,bc1,fr1,ln1'
);
assert(
  'category shelf follows taxonomy order even when lenses appears first',
  firstProductPerCategory([
    item('ln-first', 'lenses', 10),
    item('mk-later', 'makeup', 10),
    item('sk-later', 'skincare', 10),
  ])
    .map((product) => product.id)
    .join(',') === 'mk-later,sk-later,ln-first'
);
assert('shelf keeps the same product records', shelves.trending[0] === catalog[0]);
assert(
  'makeup shelf is the first makeup products in catalog order',
  shelves.makeup.map((product) => product.id).join(',') === 'mk1,mk2,mk3'
);
assert(
  'skincare shelf stops at four',
  shelves.skincare.map((product) => product.id).join(',') === 'sk1,sk2,sk3,sk4'
);
assert('combo is not filed into the category shelf', shelves.trending.every((product) => product.category !== 'combo'));
assert('catalog order is unchanged', catalog.map((product) => product.id).join(',') === originalIds.join(','));
assert('catalog still contains every product', catalog.length === originalIds.length);

const missingHairAndLenses = catalog.filter(
  (product) => product.category !== 'haircare' && product.category !== 'lenses'
);
const partialShelf = firstProductPerCategory(missingHairAndLenses);
assert(
  'empty categories are omitted',
  partialShelf.length === 4 &&
    partialShelf.every((product) => product.category !== 'haircare' && product.category !== 'lenses')
);
assert(
  'remaining categories keep taxonomy order',
  partialShelf.map((product) => product.category).join(',') === 'makeup,skincare,bodycare,fragrance'
);

const priced = [item('expensive', 'makeup', 200, 'Expensive'), item('cheap', 'makeup', 5, 'Cheap')];
assert(
  'featured order is not a price ranking',
  selectHomepageShelves(priced).makeup.map((product) => product.id).join(',') === 'expensive,cheap'
);
assert(
  'shop price sort is still available',
  sortShopProducts(priced, 'price-asc').map((product) => product.id).join(',') === 'cheap,expensive'
);
assert(
  'shop price sort does not mutate the catalog',
  priced.map((product) => product.id).join(',') === 'expensive,cheap'
);
assert(
  'featured sort keeps catalog order',
  sortShopProducts(priced, 'featured').map((product) => product.id).join(',') === 'expensive,cheap'
);

const onlySkincare = firstProductsInCategory(catalog, 'skincare', 2);
assert(
  'category slice respects the requested count',
  onlySkincare.map((product) => product.id).join(',') === 'sk1,sk2'
);
assert('a zero count returns no products', firstProductsInCategory(catalog, 'makeup', 0).length === 0);
assert(
  'an empty catalog yields empty shelves',
  selectHomepageShelves([]).trending.length === 0 &&
    selectHomepageShelves([]).makeup.length === 0 &&
    selectHomepageShelves([]).skincare.length === 0
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('homepage product checks passed');
