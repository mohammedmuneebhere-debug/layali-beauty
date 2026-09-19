'use client';

import { useEffect } from 'react';
import { bootCartStore, useCartStore } from '@/store/cart';

export function useCartSyncView() {
  useEffect(() => {
    void bootCartStore();
  }, []);

  const hydrated = useCartStore((s) => s.hydrated);
  const syncStatus = useCartStore((s) => s.syncStatus);
  const items = useCartStore((s) => s.items);
  const error = useCartStore((s) => s.error);
  const refresh = useCartStore((s) => s.refresh);

  // SSR and the first client paint both have hydrated=false. After boot,
  // empty carts wait only while sync is idle/loading — never after ready/error.
  const waiting =
    !hydrated || (items.length === 0 && syncStatus !== 'ready' && syncStatus !== 'error');
  const failed = syncStatus === 'error' && items.length === 0;

  return {
    waiting,
    failed,
    empty: !waiting && !failed && items.length === 0,
    error,
    retry: () => refresh({ force: true }),
  };
}
