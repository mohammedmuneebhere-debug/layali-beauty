/** Normalized Shopify commerce types for UI (not raw GraphQL) */

export type Money = {
  amount: number;
  currencyCode: string;
};

export type ShopifyImage = {
  url: string;
  altText: string | null;
  width?: number | null;
  height?: number | null;
};

export type ShopifyProductVariant = {
  id: string; // GID
  title: string;
  availableForSale: boolean;
  price: Money;
  compareAtPrice: Money | null;
  selectedOptions: { name: string; value: string }[];
  image: ShopifyImage | null;
};

export type ShopifyProduct = {
  id: string; // GID
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  availableForSale: boolean;
  productType: string;
  tags: string[];
  vendor: string;
  images: ShopifyImage[];
  featuredImage: ShopifyImage | null;
  price: Money;
  compareAtPrice: Money | null;
  variants: ShopifyProductVariant[];
  /** First available / default variant for add-to-cart */
  defaultVariantId: string | null;
  collections: { id: string; handle: string; title: string }[];
};

export type ShopifyCartLine = {
  id: string;
  quantity: number;
  merchandiseId: string;
  productId: string;
  productHandle: string;
  title: string;
  variantTitle: string;
  price: Money;
  /** Variant compare-at when Shopify provides it (may be null). */
  compareAtPrice: Money | null;
  image: ShopifyImage | null;
  /** Sum of Shopify line discountAllocations.discountedAmount (not a hardcoded %). */
  discountAmount: Money | null;
};

/** Aggregated cart discount from Shopify allocations — title/code + money only. */
export type ShopifyCartDiscount = {
  title: string;
  amount: Money;
};

export type CartWarning = {
  code: string;
  message: string;
  target?: string | null;
};

export type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  subtotal: Money;
  /** Shopify cart.cost.totalAmount — authoritative checkout total estimate */
  total: Money;
  /** Shopify-applied discounts (from line allocations); empty when none. */
  discounts: ShopifyCartDiscount[];
  buyerCountryCode?: string | null;
  lines: ShopifyCartLine[];
  /** Non-blocking Shopify cart mutation warnings (e.g. MERCHANDISE_OUT_OF_STOCK) */
  warnings?: CartWarning[];
};

export type ShopifyCollection = {
  id: string;
  handle: string;
  title: string;
  description: string;
};
