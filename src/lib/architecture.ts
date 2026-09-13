/**
 * Layali data ownership (Phase 1)
 *
 * Shopify = SINGLE SOURCE OF TRUTH for commerce
 *   products, variants, prices, inventory, collections,
 *   cart, orders, fulfillment
 *   (Layali custom COD checkout creates Shopify orders via Admin draft orders;
 *    hosted Shopify web checkout is not used for COD)
 *
 * Supabase = SINGLE SOURCE OF TRUTH for Layali application data
 *   auth/profiles, surveys, AI recommendation history,
 *   regions/outlets, addresses, banners,
 *   trending selection/order (Shopify product GIDs + sort_order only),
 *   layali_product_metadata / regions / costs, shopify_order_links,
 *   shopify_product_links (legacy products.id → Shopify GID mapping)
 *
 * Trending product title/images/price/inventory remain Shopify-owned.
 * Supabase does not duplicate those commerce fields.
 *
 * Next.js = UI + orchestration (Shopify + Supabase clients)
 * Zustand = Shopify cart ID + UI/optimistic state only (not authoritative cart)
 */

export type CommerceOwner = 'shopify';
export type AppDataOwner = 'supabase';

export const OWNERSHIP = {
  products: 'shopify' as CommerceOwner,
  variants: 'shopify' as CommerceOwner,
  prices: 'shopify' as CommerceOwner,
  inventory: 'shopify' as CommerceOwner,
  collections: 'shopify' as CommerceOwner,
  cart: 'shopify' as CommerceOwner,
  checkout: 'shopify' as CommerceOwner,
  orders: 'shopify' as CommerceOwner,
  profiles: 'supabase' as AppDataOwner,
  surveys: 'supabase' as AppDataOwner,
  regions: 'supabase' as AppDataOwner,
  addresses: 'supabase' as AppDataOwner,
  banners: 'supabase' as AppDataOwner,
  trending: 'supabase' as AppDataOwner,
  aiRecommendations: 'supabase' as AppDataOwner,
  productMetadata: 'supabase' as AppDataOwner,
  productRegions: 'supabase' as AppDataOwner,
  productCosts: 'supabase' as AppDataOwner,
  orderLinks: 'supabase' as AppDataOwner,
  productLinks: 'supabase' as AppDataOwner,
} as const;
