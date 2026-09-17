'use client';

import { useEffect } from 'react';
import { bootCartStore } from '@/store/cart';

/** Persist + Shopify cart boot. Always settles so "Loading cart…" cannot hang. */
export function CartHydrator() {
  useEffect(() => {
    void bootCartStore();
  }, []);

  return null;
}
