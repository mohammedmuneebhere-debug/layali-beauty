'use client';

import { useEffect } from 'react';
import { useCartStore } from '@/store/cart';

/** Hydrate Shopify cart lines from persisted cartId after mount */
export function CartHydrator() {
  const refresh = useCartStore((s) => s.refresh);
  const cartId = useCartStore((s) => s.cartId);

  useEffect(() => {
    if (cartId) void refresh();
  }, [cartId, refresh]);

  return null;
}
