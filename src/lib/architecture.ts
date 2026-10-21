/**
 * Layali data ownership
 *
 * Shopify is the source of truth for commerce and customer accounts:
 * products, variants, prices, inventory, collections, cart, checkout,
 * orders, customer identity, profile, and saved addresses.
 *
 * Shop and customer JSON metafields hold Layali-only records Shopify does
 * not model: banners, curated combos, trending order, city availability,
 * beauty notes, cost of goods, reviews, and support messages.
 *
 * Staff access is an email allowlist (LAYALI_STAFF_EMAILS). A customer
 * session never grants admin.
 *
 * Next.js orchestrates the Storefront API, Admin API, and Customer Account API.
 */

export type CommerceOwner = 'shopify';
export type AppDataOwner = 'shopify';

export const OWNERSHIP = {
  products: 'shopify' as CommerceOwner,
  variants: 'shopify' as CommerceOwner,
  prices: 'shopify' as CommerceOwner,
  inventory: 'shopify' as CommerceOwner,
  collections: 'shopify' as CommerceOwner,
  cart: 'shopify' as CommerceOwner,
  checkout: 'shopify' as CommerceOwner,
  orders: 'shopify' as CommerceOwner,
  profiles: 'shopify' as AppDataOwner,
  surveys: 'shopify' as AppDataOwner,
  regions: 'shopify' as AppDataOwner,
  addresses: 'shopify' as AppDataOwner,
  banners: 'shopify' as AppDataOwner,
  trending: 'shopify' as AppDataOwner,
  aiRecommendations: 'shopify' as AppDataOwner,
  productMetadata: 'shopify' as AppDataOwner,
  productRegions: 'shopify' as AppDataOwner,
  productCosts: 'shopify' as AppDataOwner,
  orderLinks: 'shopify' as AppDataOwner,
  productLinks: 'shopify' as AppDataOwner,
} as const;
