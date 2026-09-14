'use client';

import { ProductCard } from '@/components/shop/ProductCard';
import type { ShopProduct } from '@/lib/catalog';
import { ritualStepFor } from '@/lib/ritual';
import { track } from '@/lib/track';

export function RitualRail({
  products,
  title,
  subtitle,
  addLabel,
  saleLabel,
  soldOutLabel,
  onAdd,
}: {
  products: ShopProduct[];
  title: string;
  subtitle?: string;
  addLabel: string;
  saleLabel?: string;
  soldOutLabel?: string;
  onAdd: (e: React.MouseEvent, product: ShopProduct) => void;
}) {
  if (products.length < 2) return null;

  return (
    <section className="mt-16 lg:mt-20" aria-labelledby="ritual-rail-heading">
      <h2 id="ritual-rail-heading" className="font-serif text-heading-sm text-white mb-2">
        {title}
      </h2>
      {subtitle ? <p className="text-body text-white/45 mb-8">{subtitle}</p> : null}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
        {products.map((product) => (
          <div key={product.id} className="min-w-0">
            <p className="text-meta uppercase tracking-[0.16em] text-layali-gold-light mb-3">
              {ritualStepFor(product)}
            </p>
            <ProductCard
              product={product}
              addLabel={addLabel}
              saleLabel={saleLabel}
              soldOutLabel={soldOutLabel}
              onAdd={(e, p) => {
                track({ event: 'recommendation_click', id: p.id, name: p.name, category: p.category });
                onAdd(e, p);
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
