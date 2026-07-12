'use client';

import { Suspense } from 'react';
import ShopPage from './ShopContent';

export default function Shop() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-layali-cream py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-layali-pink-light/30 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    }>
      <ShopPage />
    </Suspense>
  );
}
