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

  const waiting =
    !hydrated ||
    syncStatus === 'idle' ||
    (syncStatus === 'loading' && items.length === 0);
  const failed = syncStatus === 'error' && items.length === 0;

  return {
    waiting,
    failed,
    empty: !waiting && !failed && items.length === 0,
    error,
    retry: () => refresh({ force: true }),
  };
}
