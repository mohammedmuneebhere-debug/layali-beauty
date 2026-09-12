import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@/types/database';
import type { ShopifyCart, ShopifyCartDiscount, ShopifyCartLine } from '@/lib/shopify/types';

export type AddToCartInput = {
  /** Shopify product GID (for display / legacy) */
  id: string;
  type: 'product' | 'combo';
  name: string;
  price: number;
  image_url: string | null;
  quantity?: number;
  /** Required for Shopify Cart API — variant GID */
  merchandiseId?: string;
  /** Extra variant GIDs (AI combo: add all lines at same quantity) */
  merchandiseIds?: string[];
  /** Preferred for curated combos with per-line quantities */
  lines?: { merchandiseId: string; quantity: number }[];
  /** Optional ISO country for Markets inventory (e.g. SA, AE) */
  countryCode?: string;
  /** Optional profile country label (e.g. "Saudi Arabia", "UAE") */
  countryLabel?: string;
};

type CartState = {
  cartId: string | null;
  checkoutUrl: string | null;
  lines: ShopifyCartLine[];
  totalQuantity: number;
  subtotal: number;
  totalAmount: number;
  currencyCode: string;
  /** Shopify cart discounts from allocations (title + amount); not hardcoded %. */
  discounts: ShopifyCartDiscount[];
  loading: boolean;
  updatingLineId: string | null;
  error: string | null;
  countryCode: string | null;

  /** UI-compatible line items (id = Shopify cart line id) */
  items: CartItem[];
  itemCount: () => number;
  total: () => number;

  setFromCart: (cart: ShopifyCart | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCountry: (countryCode?: string | null, countryLabel?: string | null) => void;
  clearCart: () => void;
  clearLocalCart: () => void;

  addVariant: (merchandiseId: string, quantity?: number) => Promise<boolean>;
  addItem: (item: AddToCartInput) => Promise<boolean>;
  updateQuantity: (lineId: string, quantity: number) => Promise<boolean>;
  removeItem: (lineId: string) => Promise<boolean>;
  updateLine: (lineId: string, quantity: number) => Promise<boolean>;
  removeLine: (lineId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
};

function linesToItems(lines: ShopifyCartLine[]): CartItem[] {
  return lines.map((line) => ({
    id: line.id,
    type: 'product' as const,
    name:
      line.variantTitle && line.variantTitle !== 'Default Title'
        ? `${line.title} — ${line.variantTitle}`
        : line.title,
    price: line.price.amount,
    quantity: line.quantity,
    image_url: line.image?.url || null,
  }));
}

async function postCart(body: Record<string, unknown>) {
  const res = await fetch('/api/shopify/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    cart?: ShopifyCart;
    error?: string;
    throttled?: boolean;
    warnings?: { code: string; message: string }[];
  };
  if (res.status === 429 || json.throttled) {
    throw new Error(
      json.error === 'Throttled' || /throttl/i.test(json.error || '')
        ? 'Cart temporarily unavailable (rate limited). Try again shortly.'
        : json.error || 'Cart temporarily unavailable (rate limited). Try again shortly.'
    );
  }
  if (!res.ok) throw new Error(json.error || 'Cart request failed');
  if (!json.cart) throw new Error(json.error || 'Cart response empty');
  return json.cart;
}

/** In-flight + short TTL dedupe — CartHydrator, cart page, and checkout all call refresh. */
let refreshInFlight: Promise<void> | null = null;
let lastRefreshCompletedAt = 0;
const REFRESH_TTL_MS = 1500;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cartId: null,
      checkoutUrl: null,
      lines: [],
      totalQuantity: 0,
      subtotal: 0,
      totalAmount: 0,
      currencyCode: 'SAR',
      discounts: [],
      loading: false,
      updatingLineId: null,
      error: null,
      countryCode: null,
      items: [],

      itemCount: () => get().totalQuantity,
      total: () => get().totalAmount || get().subtotal,

      setFromCart: (cart) => {
        if (!cart) {
          set({
            cartId: null,
            checkoutUrl: null,
            lines: [],
            items: [],
            totalQuantity: 0,
            subtotal: 0,
            totalAmount: 0,
            discounts: [],
            updatingLineId: null,
          });
          return;
        }
        set({
          cartId: cart.id,
          checkoutUrl: cart.checkoutUrl,
          lines: cart.lines,
          items: linesToItems(cart.lines),
          totalQuantity: cart.totalQuantity,
          subtotal: cart.subtotal.amount,
          totalAmount: cart.total?.amount ?? cart.subtotal.amount,
          currencyCode: cart.subtotal.currencyCode || 'SAR',
          discounts: cart.discounts || [],
          countryCode: cart.buyerCountryCode || get().countryCode,
          error: null,
          updatingLineId: null,
        });
      },

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setCountry: (countryCode, countryLabel) => {
        if (countryCode?.trim()) {
          set({ countryCode: countryCode.trim().toUpperCase() });
          return;
        }
        if (countryLabel?.trim()) {
          // Store label temporarily; API maps via countryLabel on add
          set({ countryCode: null });
        }
      },

      clearCart: () => get().clearLocalCart(),
      clearLocalCart: () =>
        set({
          cartId: null,
          checkoutUrl: null,
          lines: [],
          items: [],
          totalQuantity: 0,
          subtotal: 0,
          totalAmount: 0,
          discounts: [],
          error: null,
          updatingLineId: null,
        }),

      addVariant: async (merchandiseId, quantity = 1) => {
        set({ loading: true, error: null });
        try {
          const cart = await postCart({
            action: 'add',
            cartId: get().cartId,
            merchandiseId,
            quantity,
            countryCode: get().countryCode,
          });
          get().setFromCart(cart);
          set({ loading: false });
          return true;
        } catch (e) {
          set({
            loading: false,
            error: e instanceof Error ? e.message : 'Could not add to cart',
          });
          return false;
        }
      },

      addItem: async (item) => {
        if (item.countryCode) {
          set({ countryCode: item.countryCode.trim().toUpperCase() });
        }

        const lineInputs =
          item.lines?.filter((l) => l.merchandiseId) ||
          (item.merchandiseIds?.length
            ? item.merchandiseIds.map((merchandiseId) => ({
                merchandiseId,
                quantity: item.quantity ?? 1,
              }))
            : item.merchandiseId
              ? [{ merchandiseId: item.merchandiseId, quantity: item.quantity ?? 1 }]
              : []);

        if (lineInputs.length === 0) {
          set({
            error:
              'This item is not linked to Shopify yet. Add a product/variant GID before adding to cart.',
          });
          return false;
        }

        set({ loading: true, error: null });
        try {
          // One browser POST → one Storefront mutation for all combo lines (no partial add).
          const cart = await postCart({
            action: 'add',
            cartId: get().cartId,
            lines: lineInputs,
            countryCode: item.countryCode || get().countryCode,
            countryLabel: item.countryLabel,
          });
          get().setFromCart(cart);
          set({ loading: false });
          return true;
        } catch (e) {
          set({
            loading: false,
            error: e instanceof Error ? e.message : 'Could not add to cart',
          });
          return false;
        }
      },

      updateLine: async (lineId, quantity) => {
        const cartId = get().cartId;
        if (!cartId) return false;
        if (get().updatingLineId) return false;

        const nextQty = Math.floor(Number(quantity));
        if (!Number.isFinite(nextQty)) return false;

        set({ loading: true, updatingLineId: lineId, error: null });
        try {
          if (nextQty <= 0) {
            const cart = await postCart({ action: 'remove', cartId, lineId });
            get().setFromCart(cart);
          } else {
            const cart = await postCart({
              action: 'update',
              cartId,
              lineId,
              quantity: nextQty,
            });
            get().setFromCart(cart);
            const line = cart.lines.find((l) => l.id === lineId);
            if (nextQty > 0 && !line) {
              set({
                error:
                  cart.warnings?.[0]?.message ||
                  'This item is not available to purchase in the current market.',
              });
            } else if (line && line.quantity < nextQty && cart.warnings?.length) {
              set({
                error: cart.warnings[0]?.message || 'Could not update quantity',
              });
            }
          }
          set({ loading: false, updatingLineId: null });
          return true;
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Could not update cart';
          set({
            loading: false,
            updatingLineId: null,
            error: message,
          });
          // Keep last successful cart in memory — never refresh after a failed write
          // (that used to fire another Shopify GET and clear UI on 502/null).
          return false;
        }
      },

      removeLine: async (lineId) => {
        const cartId = get().cartId;
        if (!cartId) return false;
        if (get().updatingLineId) return false;
        set({ loading: true, updatingLineId: lineId, error: null });
        try {
          const cart = await postCart({ action: 'remove', cartId, lineId });
          get().setFromCart(cart);
          set({ loading: false, updatingLineId: null });
          return true;
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Could not remove item';
          set({
            loading: false,
            updatingLineId: null,
            error: message,
          });
          return false;
        }
      },

      updateQuantity: async (lineId, quantity) => get().updateLine(lineId, quantity),
      removeItem: async (lineId) => get().removeLine(lineId),

      refresh: async () => {
        const cartId = get().cartId;
        if (!cartId) {
          get().setFromCart(null);
          return;
        }
        if (refreshInFlight) return refreshInFlight;
        if (Date.now() - lastRefreshCompletedAt < REFRESH_TTL_MS) return;

        refreshInFlight = (async () => {
          try {
            const res = await fetch(`/api/shopify/cart?cartId=${encodeURIComponent(cartId)}`);
            const json = (await res.json()) as {
              cart?: ShopifyCart | null;
              error?: string;
              throttled?: boolean;
            };
            if (res.status === 429 || json.throttled) {
              set({ error: 'Cart temporarily unavailable (rate limited). Try again shortly.' });
              return;
            }
            if (!res.ok) {
              // Distinguish API failure from empty cart — do not wipe local cartId on 502.
              set({
                error: json.error || 'Unable to load cart. Please try again.',
              });
              return;
            }
            if (!json.cart) {
              get().clearLocalCart();
              return;
            }
            get().setFromCart(json.cart);
          } catch {
            set({ error: 'Unable to load cart. Please try again.' });
          } finally {
            lastRefreshCompletedAt = Date.now();
            refreshInFlight = null;
          }
        })();

        return refreshInFlight;
      },
    }),
    {
      name: 'layali-shopify-cart',
      partialize: (s) => ({ cartId: s.cartId, countryCode: s.countryCode }),
      // Never rehydrate line items / totals from localStorage — Shopify is SOT.
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<CartState>;
        return {
          ...current,
          cartId: typeof p.cartId === 'string' ? p.cartId : null,
          countryCode: typeof p.countryCode === 'string' ? p.countryCode : null,
          items: [],
          lines: [],
          totalQuantity: 0,
          subtotal: 0,
          totalAmount: 0,
          discounts: [],
          checkoutUrl: null,
          error: null,
        };
      },
    }
  )
);
