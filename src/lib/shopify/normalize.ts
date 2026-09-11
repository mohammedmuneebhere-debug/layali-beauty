import { parseMoney } from './client';
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
  cost?: { subtotalAmount?: GqlMoney };
  lines?: {
    nodes: {
      id: string;
      quantity: number;
      merchandise: {
        id: string;
        title?: string;
        price?: GqlMoney;
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

  const lines: ShopifyCartLine[] = (raw.lines?.nodes || [])
    .map((line) => {
      const m = line.merchandise;
      if (!m?.id || !m.product) return null;
      const image =
        mapImage(m.image ?? null) || mapImage(m.product.featuredImage ?? null);
      return {
        id: line.id,
        quantity: line.quantity,
        merchandiseId: m.id,
        productId: m.product.id,
        productHandle: m.product.handle,
        title: m.product.title,
        variantTitle: m.title || '',
        price: parseMoney(m.price?.amount, m.price?.currencyCode || 'SAR'),
        image,
      } satisfies ShopifyCartLine;
    })
    .filter((l): l is ShopifyCartLine => Boolean(l));

  return {
    id: raw.id,
    checkoutUrl: raw.checkoutUrl,
    totalQuantity: raw.totalQuantity,
    subtotal: parseMoney(
      raw.cost?.subtotalAmount?.amount,
      raw.cost?.subtotalAmount?.currencyCode || 'SAR'
    ),
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
    image_url: p.featuredImage?.url || null,
    images: p.images.map((i) => i.url),
    available: p.availableForSale,
    defaultVariantId: p.defaultVariantId,
    shopifyProductId: p.id,
    vendor: p.vendor,
    tags: p.tags,
  };
}
