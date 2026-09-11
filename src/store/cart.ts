import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@/types/database';
import type { ShopifyCart, ShopifyCartLine } from '@/lib/shopify/types';

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
};

type CartState = {
  cartId: string | null;
  checkoutUrl: string | null;
  lines: ShopifyCartLine[];
  totalQuantity: number;
  subtotal: number;
  currencyCode: string;
  loading: boolean;
  error: string | null;

  /** UI-compatible line items (id = Shopify cart line id) */
  items: CartItem[];
  itemCount: () => number;
  total: () => number;

  setFromCart: (cart: ShopifyCart | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
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
  const json = (await res.json()) as { cart?: ShopifyCart; error?: string };
  if (!res.ok) throw new Error(json.error || 'Cart request failed');
  if (!json.cart) throw new Error('Cart response empty');
  return json.cart;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cartId: null,
      checkoutUrl: null,
      lines: [],
      totalQuantity: 0,
      subtotal: 0,
      currencyCode: 'SAR',
      loading: false,
      error: null,
      items: [],

      itemCount: () => get().totalQuantity,
      total: () => get().subtotal,

      setFromCart: (cart) => {
        if (!cart) {
          set({
            cartId: null,
            checkoutUrl: null,
            lines: [],
            items: [],
            totalQuantity: 0,
            subtotal: 0,
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
          currencyCode: cart.subtotal.currencyCode,
          error: null,
        });
      },

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      clearCart: () => get().clearLocalCart(),
      clearLocalCart: () =>
        set({
          cartId: null,
          checkoutUrl: null,
          lines: [],
          items: [],
          totalQuantity: 0,
          subtotal: 0,
          error: null,
        }),

      addVariant: async (merchandiseId, quantity = 1) => {
        set({ loading: true, error: null });
        try {
          const cart = await postCart({
            action: 'add',
            cartId: get().cartId,
            merchandiseId,
            quantity,
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

        let ok = true;
        for (const line of lineInputs) {
          const success = await get().addVariant(line.merchandiseId, line.quantity);
          if (!success) ok = false;
        }
        return ok;
      },

      updateLine: async (lineId, quantity) => {
        const cartId = get().cartId;
        if (!cartId) return false;
        set({ loading: true, error: null });
        try {
          if (quantity <= 0) {
            const cart = await postCart({ action: 'remove', cartId, lineId });
            get().setFromCart(cart);
          } else {
            const cart = await postCart({ action: 'update', cartId, lineId, quantity });
            get().setFromCart(cart);
          }
          set({ loading: false });
          return true;
        } catch (e) {
          set({
            loading: false,
            error: e instanceof Error ? e.message : 'Could not update cart',
          });
          return false;
        }
      },

      removeLine: async (lineId) => {
        const cartId = get().cartId;
        if (!cartId) return false;
        set({ loading: true, error: null });
        try {
          const cart = await postCart({ action: 'remove', cartId, lineId });
          get().setFromCart(cart);
          set({ loading: false });
          return true;
        } catch (e) {
          set({
            loading: false,
            error: e instanceof Error ? e.message : 'Could not remove item',
          });
          return false;
        }
      },

      updateQuantity: async (lineId, quantity) => get().updateLine(lineId, quantity),
      removeItem: async (lineId) => get().removeLine(lineId),

      refresh: async () => {
        const cartId = get().cartId;
        if (!cartId) return;
        try {
          const res = await fetch(`/api/shopify/cart?cartId=${encodeURIComponent(cartId)}`);
          const json = (await res.json()) as { cart?: ShopifyCart | null };
          get().setFromCart(json.cart || null);
        } catch {
          // keep local state
        }
      },
    }),
    {
      name: 'layali-shopify-cart',
      partialize: (s) => ({ cartId: s.cartId }),
    }
  )
);
