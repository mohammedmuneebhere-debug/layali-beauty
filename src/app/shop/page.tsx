'use client';

import { Suspense } from 'react';
import ShopPage from './ShopContent';

export default function Shop() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-transparent py-12 pt-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl bg-layali-surface animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    }>
      <ShopPage />
    </Suspense>
  );
}
