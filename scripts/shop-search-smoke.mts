/**
 * Shop search ranking. No network and no Shopify writes.
 * Usage: npm run test:search
 */
import { filterShopProducts } from '@/lib/shop-filters';
import {
  normalizeSearchText,
  productSearchPath,
  resolveSearchAction,
  shopSearchPath,
  shopSearchScore,
} from '@/lib/shop-search';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

type Row = {
  id: string;
  handle: string;
  name: string;
  description?: string;
  category: string;
  vendor: string;
  price: number;
};

const mascara: Row = {
  id: '1',
  handle: 'bourjois-mascara',
  name: 'Bourjois Twist Up The Volume Mascara - Ultra Black',
  category: 'makeup',
  vendor: 'Bourjois',
  price: 40,
};
const exactMascara: Row = {
  id: '2',
  handle: 'house-mascara',
  name: 'Mascara',
  category: 'makeup',
  vendor: 'House',
  price: 20,
};
const brandNamedMascara: Row = {
  id: '3',
  handle: 'brand-cream',
  name: 'Daily Cream',
  category: 'skincare',
  vendor: 'Mascara',
  price: 22,
};
const described: Row = {
  id: '4',
  handle: 'cotton-pads',
  name: 'Cotton Pads',
  description: 'Use with mascara.',
  category: 'skincare',
  vendor: 'House',
  price: 12,
};
const toner: Row = {
  id: '5',
  handle: 'isntree-hyaluronic-acid-toner-plus-200-ml',
  name: 'Isntree Hyaluronic Acid Toner Plus – 200 ml',
  description: 'A hydrating toner.',
  category: 'skincare',
  vendor: 'Isntree',
  price: 49,
};
const otherToner: Row = {
  id: '6',
  handle: 'isntree-ultra-low-toner',
  name: 'Isntree Ultra-Low Molecular Hyaluronic Acid Toner – 300 ml',
  description: 'Another toner.',
  category: 'skincare',
  vendor: 'Isntree',
  price: 55,
};
const serum: Row = {
  id: '7',
  handle: 'isntree-serum',
  name: 'Isntree Hyaluronic Acid Serum',
  description: 'A serum for dry skin.',
  category: 'skincare',
  vendor: 'Isntree',
  price: 60,
};
const maybelline: Row = {
  id: '8',
  handle: 'maybelline-fit-me',
  name: 'Fit Me Foundation',
  category: 'makeup',
  vendor: 'Maybelline',
  price: 35,
};
const unrelated: Row = {
  id: '9',
  handle: 'rose-soap',
  name: 'Rose Soap',
  description: 'A gentle bar.',
  category: 'bodycare',
  vendor: 'House',
  price: 15,
};

const catalog = [
  unrelated,
  described,
  brandNamedMascara,
  otherToner,
  serum,
  toner,
  maybelline,
  mascara,
  exactMascara,
];

assert('normalizes case, punctuation, and whitespace', normalizeSearchText('  MaScArA — Ultra! ') === 'mascara ultra');

const mascar = filterShopProducts(catalog, { search: 'mascar' }).map((product) => product.handle);
assert('mascar matches mascara products', mascar.includes('bourjois-mascara') && mascar.includes('house-mascara'));
assert('mascar does not include the soap', !mascar.includes('rose-soap'));

const named = filterShopProducts(catalog, { search: 'Isntree Hyaluronic Acid Toner' }).map(
  (product) => product.handle
);
assert('exact product-name search returns the toner first', named[0] === 'isntree-hyaluronic-acid-toner-plus-200-ml');
assert('the named toner ranks above the other hyaluronic toner', named.indexOf('isntree-hyaluronic-acid-toner-plus-200-ml') < named.indexOf('isntree-ultra-low-toner'));

const brand = filterShopProducts(catalog, { search: 'Maybelline' }).map((product) => product.handle);
assert('brand search returns Maybelline products', brand[0] === 'maybelline-fit-me');
assert('brand search omits unrelated products', !brand.includes('rose-soap'));

const partial = filterShopProducts(catalog, { search: 'maybell' }).map((product) => product.handle);
assert('partial brand name matches Maybelline', partial.includes('maybelline-fit-me') && !partial.includes('rose-soap'));

const partialTitle = filterShopProducts(catalog, { search: 'Twist Up' }).map((product) => product.handle);
assert('partial title matches the Bourjois mascara', partialTitle[0] === 'bourjois-mascara');

const typo = filterShopProducts(catalog, { search: 'mascra' }).map((product) => product.handle);
assert('a one-edit typo still matches mascara', typo.includes('house-mascara') || typo.includes('bourjois-mascara'));

const spaced = filterShopProducts(catalog, { search: '   mAsCaRa   ' }).map((product) => product.id);
const plain = filterShopProducts(catalog, { search: 'mascara' }).map((product) => product.id);
assert('case and whitespace do not change the result set', spaced.join() === plain.join());

assert('an irrelevant query has no results', filterShopProducts(catalog, { search: 'zzzzqqqq' }).length === 0);
assert(
  'a placeholder vendor is not treated as a brand',
  shopSearchScore(
    { name: 'Rose Soap', vendor: 'My Store', description: 'A bar of soap.' },
    'my store'
  ) === 0
);
assert('an empty query keeps the catalog', filterShopProducts(catalog, { search: '   ' }).length === catalog.length);

const ranked = filterShopProducts(catalog, { search: 'mascara' }).map((product) => product.handle);
assert('exact title ranks first', ranked[0] === 'house-mascara');
assert('exact brand ranks above a description mention', ranked.indexOf('brand-cream') < ranked.indexOf('cotton-pads'));
assert(
  'a title match ranks above a description mention',
  ranked.indexOf('bourjois-mascara') < ranked.indexOf('cotton-pads')
);
assert(
  'fuzzy typo scores below an exact title',
  shopSearchScore(exactMascara, 'mascra') < shopSearchScore(exactMascara, 'mascara')
);

assert(
  'clicking a suggestion opens that product',
  productSearchPath({ id: 'gid://shopify/Product/2', handle: 'bourjois-mascara' }) === '/shop/bourjois-mascara' &&
    resolveSearchAction({
      query: 'mascar',
      activeIndex: 0,
      suggestions: [{ id: '1', handle: 'bourjois-mascara' }],
    }) === '/shop/bourjois-mascara'
);
assert(
  'submitting a query opens filtered shop results',
  shopSearchPath('  mascar ') === '/shop?q=mascar' &&
    resolveSearchAction({
      query: 'mascar',
      activeIndex: -1,
      suggestions: [{ id: '1', handle: 'bourjois-mascara' }],
    }) === '/shop?q=mascar' &&
    resolveSearchAction({
      query: 'mascar',
      activeIndex: 1,
      suggestions: [{ id: '1', handle: 'bourjois-mascara' }],
    }) === '/shop?q=mascar'
);
assert(
  'shop results for that query stay on mascara',
  filterShopProducts(catalog, { search: 'mascar' }).every((product) =>
    /mascar/i.test(`${product.name} ${product.vendor} ${product.description || ''}`)
  ) && !filterShopProducts(catalog, { search: 'mascar' }).some((product) => product.handle === 'rose-soap')
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('shop search smoke passed');
