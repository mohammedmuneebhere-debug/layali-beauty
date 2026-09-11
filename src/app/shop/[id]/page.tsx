'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingBag, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ProductImageGallery } from '@/components/shop/ProductImageGallery';
import { FadeIn } from '@/components/ui/FadeIn';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@/types/database';

function productPhotos(product: Product): string[] {
  if (product.images?.length) return product.images;
  return product.image_url ? [product.image_url] : [];
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const addItem = useCartStore((s) => s.addItem);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setProduct(null);
        setLoading(false);
        return;
      }

      setProduct(data as Product);
      setLoading(false);
    }

    if (productId) load();
  }, [productId]);

  const handleAddToCart = () => {
    if (!product) return;
    const image = productPhotos(product)[0] || null;
    addItem({
      id: product.id,
      type: 'product',
      name: product.name,
      price: Number(product.price),
      image_url: image,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent pt-24 pb-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-10">
            <div className="aspect-square rounded-3xl bg-layali-surface animate-pulse border border-white/5" />
            <div className="space-y-4">
              <div className="h-8 w-2/3 bg-layali-surface rounded animate-pulse" />
              <div className="h-6 w-1/3 bg-layali-surface rounded animate-pulse" />
              <div className="h-24 bg-layali-surface/80 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center px-4 pt-20">
        <p className="text-white/50 mb-4">Product not found</p>
        <Button onClick={() => router.push('/shop')}>Back to Shop</Button>
      </div>
    );
  }

  const description = product.description || '';
  const isLongDescription = description.length > 220;
  const visibleDescription =
    !showFullDescription && isLongDescription
      ? `${description.slice(0, 220).trim()}...`
      : description;

  return (
    <div className="relative min-h-screen bg-transparent pt-24 pb-14 overflow-hidden">
      <div className="glow-orb w-[480px] h-[480px] -top-20 right-0 opacity-35 pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Shop
          </Link>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
            <ProductImageGallery images={productPhotos(product)} alt={product.name} />

            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-layali-pink mb-3">
                {product.category}
              </p>
              <h1 className="font-serif text-3xl sm:text-4xl font-medium text-white mb-4">
                {product.name}
              </h1>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="font-serif text-2xl text-white">
                  {formatPrice(Number(product.price))}
                </span>
                {product.compare_at_price && (
                  <span className="text-lg text-white/30 line-through">
                    {formatPrice(Number(product.compare_at_price))}
                  </span>
                )}
              </div>

              {description && (
                <div className="mb-8">
                  <h2 className="font-medium text-white mb-2">About this product</h2>
                  <p className="text-white/55 leading-relaxed whitespace-pre-line">
                    {visibleDescription}
                  </p>
                  {isLongDescription && (
                    <button
                      type="button"
                      onClick={() => setShowFullDescription((v) => !v)}
                      className="mt-2 text-sm font-medium text-layali-pink hover:text-layali-pink-light transition-colors"
                    >
                      {showFullDescription ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}

              {product.benefits?.length > 0 && (
                <div className="mb-8">
                  <h2 className="font-medium text-white mb-3">Benefits</h2>
                  <ul className="space-y-2">
                    {product.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2 text-sm text-white/55">
                        <Check className="w-4 h-4 text-layali-pink mt-0.5 flex-shrink-0" />
                        <span className="capitalize">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {product.ingredients && (
                <div className="mb-8">
                  <h2 className="font-medium text-white mb-2">Ingredients</h2>
                  <p className="text-sm text-white/45 leading-relaxed">
                    {product.ingredients}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-white/40">
                <span>Curated Quality</span>
                <span>·</span>
                <span>
                  {product.stock_quantity > 0
                    ? `${product.stock_quantity} in stock`
                    : 'Out of stock'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={handleAddToCart}
                  disabled={product.stock_quantity <= 0}
                >
                  {added ? (
                    <>
                      <Check className="w-5 h-5" /> Added to Cart
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5" /> Add to Cart
                    </>
                  )}
                </Button>
                <Link href="/cart" className="flex-1">
                  <Button variant="outline" size="lg" className="w-full">
                    View Cart
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
