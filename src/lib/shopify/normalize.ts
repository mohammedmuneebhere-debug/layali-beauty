import { parseMoney } from './client';
import { shopifyImageUrl, SHOP_CARD_IMAGE_WIDTH } from './image';
import type {
  ShopifyCart,
  ShopifyCartLine,
  ShopifyImage,
  ShopifyProduct,
  ShopifyProductVariant,
} from './types';

type GqlMoney = { amount: string; currencyCode: string } | null | undefined;

type GqlImage = {
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
} | null;

type GqlVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: GqlMoney;
  compareAtPrice?: GqlMoney;
  selectedOptions?: { name: string; value: string }[];
  image?: GqlImage;
};

type GqlProduct = {
  id: string;
  handle: string;
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  availableForSale: boolean;
  productType?: string | null;
  tags?: string[];
  vendor?: string | null;
  featuredImage?: GqlImage;
  images?: { nodes: GqlImage[] };
  priceRange?: { minVariantPrice: GqlMoney };
  compareAtPriceRange?: { minVariantPrice: GqlMoney };
  variants?: { nodes: GqlVariant[] };
  collections?: { nodes: { id: string; handle: string; title: string }[] };
};

function mapImage(img: GqlImage): ShopifyImage | null {
  if (!img?.url) return null;
  return {
    url: img.url,
    altText: img.altText ?? null,
    width: img.width ?? null,
    height: img.height ?? null,
  };
}

function mapVariant(v: GqlVariant): ShopifyProductVariant {
  return {
    id: v.id,
    title: v.title,
    availableForSale: v.availableForSale,
    price: parseMoney(v.price?.amount, v.price?.currencyCode || 'SAR'),
    compareAtPrice: v.compareAtPrice
      ? parseMoney(v.compareAtPrice.amount, v.compareAtPrice.currencyCode || 'SAR')
      : null,
    selectedOptions: v.selectedOptions || [],
    image: mapImage(v.image ?? null),
  };
}

export function normalizeProduct(raw: GqlProduct | null | undefined): ShopifyProduct | null {
  if (!raw?.id) return null;

  const variants = (raw.variants?.nodes || []).map(mapVariant);
  const images =
    (raw.images?.nodes || []).map(mapImage).filter((i): i is ShopifyImage => Boolean(i)) || [];
  const featured = mapImage(raw.featuredImage ?? null) || images[0] || null;

  const priceNode = raw.priceRange?.minVariantPrice;
  const compareNode = raw.compareAtPriceRange?.minVariantPrice;
  const compareAmount = compareNode ? Number(compareNode.amount) : 0;
  const priceAmount = priceNode ? Number(priceNode.amount) : variants[0]?.price.amount || 0;

  const defaultVariant =
    variants.find((v) => v.availableForSale) || variants[0] || null;

  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    description: raw.description || '',
    descriptionHtml: raw.descriptionHtml || '',
    availableForSale: raw.availableForSale,
    productType: raw.productType || '',
    tags: raw.tags || [],
    vendor: raw.vendor || '',
    images: featured && images.length === 0 ? [featured] : images,
    featuredImage: featured,
    price: parseMoney(priceAmount, priceNode?.currencyCode || 'SAR'),
    compareAtPrice:
      compareAmount > priceAmount
        ? parseMoney(compareAmount, compareNode?.currencyCode || 'SAR')
        : null,
    variants,
    defaultVariantId: defaultVariant?.id || null,
    collections: (raw.collections?.nodes || []).map((c) => ({
      id: c.id,
      handle: c.handle,
      title: c.title,
    })),
  };
}

type GqlCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  buyerIdentity?: { countryCode?: string | null } | null;
  cost?: { subtotalAmount?: GqlMoney; totalAmount?: GqlMoney };
  discountApplications?: {
    title?: string | null;
    code?: string | null;
    totalAllocatedAmount?: GqlMoney;
  }[];
  lines?: {
    nodes: {
      id: string;
      quantity: number;
      discountAllocations?: {
        discountedAmount?: GqlMoney;
      }[];
      merchandise: {
        id: string;
        title?: string;
        price?: GqlMoney;
        compareAtPrice?: GqlMoney;
        image?: GqlImage;
        product?: {
          id: string;
          handle: string;
          title: string;
          featuredImage?: GqlImage;
        };
      };
    }[];
  };
};

export function normalizeCart(raw: GqlCart | null | undefined): ShopifyCart | null {
  if (!raw?.id) return null;

  // Only sellable lines — qty 0 is Shopify's OOS placeholder and must not drive UI totals.
  const lines: ShopifyCartLine[] = (raw.lines?.nodes || [])
    .map((line) => {
      const m = line.merchandise;
      if (!m?.id || !m.product) return null;
      if (!line.quantity || line.quantity <= 0) return null;
      const image =
        mapImage(m.image ?? null) || mapImage(m.product.featuredImage ?? null);

      let discountSum = 0;
      let discountCurrency = m.price?.currencyCode || 'SAR';
      for (const alloc of line.discountAllocations || []) {
        const amt = Number(alloc.discountedAmount?.amount || 0);
        if (amt > 0) {
          discountSum += amt;
          discountCurrency = alloc.discountedAmount?.currencyCode || discountCurrency;
        }
      }

      const compareAt = m.compareAtPrice
        ? parseMoney(m.compareAtPrice.amount, m.compareAtPrice.currencyCode || 'SAR')
        : null;
      const price = parseMoney(m.price?.amount, m.price?.currencyCode || 'SAR');

      return {
        id: line.id,
        quantity: line.quantity,
        merchandiseId: m.id,
        productId: m.product.id,
        productHandle: m.product.handle,
        title: m.product.title,
        variantTitle: m.title || '',
        price,
        compareAtPrice:
          compareAt && compareAt.amount > price.amount ? compareAt : null,
        image,
        discountAmount:
          discountSum > 0 ? parseMoney(discountSum, discountCurrency) : null,
      } satisfies ShopifyCartLine;
    })
    .filter((l): l is ShopifyCartLine => Boolean(l));

  const subtotal = parseMoney(
    raw.cost?.subtotalAmount?.amount,
    raw.cost?.subtotalAmount?.currencyCode || 'SAR'
  );
  const total = parseMoney(
    raw.cost?.totalAmount?.amount ?? raw.cost?.subtotalAmount?.amount,
    raw.cost?.totalAmount?.currencyCode ||
      raw.cost?.subtotalAmount?.currencyCode ||
      'SAR'
  );

  // Prefer cart.discountApplications.totalAllocatedAmount (Shopify money, not %).
  const discounts = (raw.discountApplications || [])
    .map((app) => {
      const amt = Number(app.totalAllocatedAmount?.amount || 0);
      if (!(amt > 0)) return null;
      const title = app.code?.trim() || app.title?.trim() || 'Discount';
      return {
        title,
        amount: parseMoney(amt, app.totalAllocatedAmount?.currencyCode || 'SAR'),
      };
    })
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return {
    id: raw.id,
    checkoutUrl: raw.checkoutUrl,
    // Authoritative sellable count = sum of kept lines (never count Shopify qty-0 OOS placeholders)
    totalQuantity: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotal,
    total,
    discounts,
    buyerCountryCode: raw.buyerIdentity?.countryCode ?? null,
    lines,
  };
}

/**
 * UI-facing product shape compatible with existing storefront cards
 * (keeps visual components stable during migration).
 */
export type CatalogProduct = {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  category: string;
  image_url: string | null;
  images: string[];
  available: boolean;
  defaultVariantId: string | null;
  shopifyProductId: string;
  vendor: string;
  tags: string[];
};

export function toCatalogProduct(p: ShopifyProduct): CatalogProduct {
  const category =
    p.productType ||
    p.collections[0]?.handle ||
    p.tags.find((t) =>
      ['makeup', 'skincare', 'haircare', 'bodycare', 'fragrance', 'combo'].includes(
        t.toLowerCase()
      )
    ) ||
    'skincare';

  return {
    id: p.id,
    handle: p.handle,
    name: p.title,
    description: p.description || null,
    price: p.price.amount,
    compare_at_price: p.compareAtPrice?.amount ?? null,
    category: category.toLowerCase(),
    // Prefer featuredImage; CDN-size for cards (GraphQL list transform + query param safety net).
    image_url: shopifyImageUrl(p.featuredImage?.url || null, SHOP_CARD_IMAGE_WIDTH),
    images: p.images
      .map((i) => shopifyImageUrl(i.url, SHOP_CARD_IMAGE_WIDTH))
      .filter((u): u is string => Boolean(u)),
    available: p.availableForSale,
    defaultVariantId: p.defaultVariantId,
    shopifyProductId: p.id,
    vendor: p.vendor,
    tags: p.tags,
  };
}
