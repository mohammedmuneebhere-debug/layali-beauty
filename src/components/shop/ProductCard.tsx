'use client';

import { memo } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Card, CardImage, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatPrice, cn } from '@/lib/utils';
import { shopifyImageUrl, SHOP_CARD_IMAGE_WIDTH } from '@/lib/shopify/image';
import type { ShopProduct } from '@/lib/catalog';

export const ProductCard = memo(function ProductCard({
  product,
  addLabel,
  saleLabel,
  soldOutLabel,
  onAdd,
}: {
  product: ShopProduct;
  addLabel: string;
  saleLabel?: string;
  soldOutLabel?: string;
  onAdd: (e: React.MouseEvent, product: ShopProduct) => void;
}) {
  const cover = shopifyImageUrl(
    product.image_url || product.images?.[0] || null,
    SHOP_CARD_IMAGE_WIDTH
  );
  const hover = shopifyImageUrl(product.images?.[1] || null, SHOP_CARD_IMAGE_WIDTH);
  const href = `/shop/${product.handle || product.id}`;
  const onSale =
    product.compare_at_price != null &&
    Number(product.compare_at_price) > Number(product.price);
  const canAdd = Boolean(product.available && product.defaultVariantId);

  return (
    <Link href={href} prefetch={false} className="block h-full min-w-0 focus-ring rounded-2xl">
      <Card hover className="h-full bg-transparent border-0 shadow-none">
        <div className="relative min-w-0">
          <CardImage
            src={cover}
            hoverSrc={hover}
            alt={product.name}
            className="rounded-2xl product-frame"
          />
          {onSale && saleLabel ? (
            <span className="absolute top-3 start-3 rounded-full bg-layali-ivory/90 px-2 py-0.5 text-meta uppercase tracking-[0.12em] text-layali-void">
              {saleLabel}
            </span>
          ) : null}
          {!product.available && soldOutLabel ? (
            <span className="absolute top-3 end-3 rounded-full bg-black/70 px-2 py-0.5 text-meta uppercase tracking-[0.12em] text-white/80">
              {soldOutLabel}
            </span>
          ) : null}
        </div>
        <CardContent className="px-1 pt-4 pb-2">
          <p className="text-meta text-layali-pink uppercase tracking-[0.14em] mb-1.5 truncate">
            {product.vendor || product.category}
          </p>
          <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
            <h3 className="text-product-name text-white leading-snug line-clamp-2 min-w-0">
              {product.name}
            </h3>
            <span className="text-price text-white/90 shrink-0 tabular-nums">
              {formatPrice(Number(product.price))}
            </span>
          </div>
          {onSale ? (
            <span className="text-meta text-white/30 line-through block mb-2">
              {formatPrice(Number(product.compare_at_price))}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className={cn('w-full', !canAdd && 'opacity-50')}
            disabled={!canAdd}
            onClick={(e) => onAdd(e, product)}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> {addLabel}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
});
