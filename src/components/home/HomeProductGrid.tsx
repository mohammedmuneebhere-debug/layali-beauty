'use client';

import { useCallback } from 'react';
import { ProductCard } from '@/components/shop/ProductCard';
import { toast } from '@/components/ui/Toast';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { track } from '@/lib/track';
import type { ShopProduct } from '@/lib/catalog';
import { useCartStore } from '@/store/cart';

/** Same card grid the shop uses, so homepage shelves share image, price, and cart behavior. */
export function HomeProductGrid({ products }: { products: ShopProduct[] }) {
  const { t } = useLanguage();
  const addItem = useCartStore((s) => s.addItem);

  const handleAddToCart = useCallback(
    (e: React.MouseEvent, product: ShopProduct) => {
      e.preventDefault();
      e.stopPropagation();
      if (!product.defaultVariantId) return;
      const image = product.image_url || product.images?.[0];
      void addItem({
        id: product.id,
        type: 'product',
        name: product.name,
        price: Number(product.price),
        image_url: image,
        merchandiseId: product.defaultVariantId,
      }).then((ok) => {
        if (ok) {
          toast(t.pdp.added);
          track({
            event: 'add_to_cart',
            id: product.id,
            name: product.name,
            category: product.category,
            value: Number(product.price),
            currency: 'SAR',
          });
        }
      });
    },
    [addItem, t.pdp.added]
  );

  if (products.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          addLabel={t.shop.add}
          saleLabel={t.shop.sale}
          soldOutLabel={t.shop.soldOut}
          onAdd={handleAddToCart}
        />
      ))}
    </div>
  );
}
