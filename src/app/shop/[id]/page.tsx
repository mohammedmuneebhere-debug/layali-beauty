'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingBag, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardImage, CardContent } from '@/components/ui/Card';
import { ProductImageGallery } from '@/components/shop/ProductImageGallery';
import { FadeIn } from '@/components/ui/FadeIn';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import type { ShopProduct } from '@/lib/catalog';
import { pickSimilarProducts, vendorSearchQuery } from '@/lib/similar-products';
import { shopifyImageUrl } from '@/lib/shopify/image';

type DetailProduct = ShopProduct & {
  shopifyVariants?: { id: string; available: boolean }[];
};

function productPhotos(product: DetailProduct | ShopProduct): string[] {
  if (product.images?.length) return product.images;
  return product.image_url ? [product.image_url] : [];
}

function SimilarProductCard({
  product,
  onAdd,
}: {
  product: ShopProduct;
  onAdd: (e: React.MouseEvent, product: ShopProduct) => void;
}) {
  const cover = shopifyImageUrl(product.images?.[0] || product.image_url, 480);
  const href = `/shop/${product.handle || product.id}`;

  return (
    <Link href={href} prefetch={false} className="block h-full">
      <Card hover className="h-full bg-transparent border-0 shadow-none">
        <div className="relative">
          <CardImage src={cover} alt={product.name} className="rounded-2xl border border-white/8" />
        </div>
        <CardContent className="px-1 pt-4 pb-2">
          <p className="text-meta text-layali-pink uppercase tracking-[0.14em] mb-1.5">
            {product.vendor || product.category}
          </p>
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-product-name text-white leading-snug line-clamp-2 min-w-0">
              {product.name}
            </h3>
            <span className="text-price text-white/90 shrink-0 tabular-nums">
              {formatPrice(Number(product.price))}
            </span>
          </div>
          {product.compare_at_price && (
            <span className="text-meta text-white/30 line-through block mb-2">
              {formatPrice(Number(product.compare_at_price))}
            </span>
          )}
          <Button size="sm" variant="outline" className="w-full" onClick={(e) => onAdd(e, product)}>
            <ShoppingBag className="w-3.5 h-3.5" /> Add
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productParam = params.id as string;
  const addItem = useCartStore((s) => s.addItem);

  const [product, setProduct] = useState<DetailProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [similar, setSimilar] = useState<ShopProduct[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const qs = productParam.startsWith('gid://')
        ? `id=${encodeURIComponent(productParam)}`
        : `handle=${encodeURIComponent(productParam)}`;
      const res = await fetch(`/api/shopify/products?${qs}`);
      const json = (await res.json()) as { product?: DetailProduct | null };

      if (!res.ok || !json.product) {
        setProduct(null);
        setLoading(false);
        return;
      }

      setProduct(json.product);
      setLoading(false);
    }

    if (productParam) void load();
  }, [productParam]);

  // Similar products after main PDP is ready — bounded fetch, uses Storefront cache (revalidate ~60s).
  useEffect(() => {
    if (!product) return;

    let cancelled = false;
    const current = product;

    async function loadSimilar() {
      // Defer so setState is not synchronous inside the effect body.
      await Promise.resolve();
      if (cancelled) return;
      setSimilarLoading(true);
      try {
        const candidates: ShopProduct[] = [];
        const vendor = current.vendor?.trim();

        if (vendor) {
          const params = new URLSearchParams({
            q: vendorSearchQuery(vendor),
            first: '24',
          });
          const res = await fetch(`/api/shopify/products?${params}`);
          const json = (await res.json()) as { products?: ShopProduct[] };
          candidates.push(...(json.products || []));
        }

        let picked = pickSimilarProducts(candidates, current);
        if (picked.length < 4 && current.category) {
          const params = new URLSearchParams({
            category: current.category,
            first: '24',
          });
          const res = await fetch(`/api/shopify/products?${params}`);
          const json = (await res.json()) as { products?: ShopProduct[] };
          candidates.push(...(json.products || []));
          picked = pickSimilarProducts(candidates, current);
        }

        if (!cancelled) {
          setSimilar(picked);
        }
      } catch {
        if (!cancelled) setSimilar([]);
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    }

    void loadSimilar();
    return () => {
      cancelled = true;
    };
  }, [product]);

  const handleAddToCart = () => {
    if (!product?.defaultVariantId) return;
    const image = productPhotos(product)[0] || null;
    void addItem({
      id: product.id,
      type: 'product',
      name: product.name,
      price: Number(product.price),
      image_url: image,
      merchandiseId: product.defaultVariantId,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleAddSimilar = (e: React.MouseEvent, p: ShopProduct) => {
    e.preventDefault();
    e.stopPropagation();
    if (!p.defaultVariantId) return;
    const image = productPhotos(p)[0] || null;
    void addItem({
      id: p.id,
      type: 'product',
      name: p.name,
      price: Number(p.price),
      image_url: image,
      merchandiseId: p.defaultVariantId,
    });
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
  const inStock = product.available || product.stock_quantity > 0;

  return (
    <div className="relative min-h-screen bg-transparent pt-24 pb-14 overflow-hidden">
      <div className="glow-orb w-[480px] h-[480px] -top-20 right-0 opacity-35 pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-nav text-white/45 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> Back to Shop
          </Link>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
            <ProductImageGallery images={productPhotos(product)} alt={product.name} />

            <div>
              <p className="text-meta uppercase tracking-[0.18em] text-layali-pink mb-3">
                {product.vendor || product.category}
              </p>
              <h1 className="font-serif text-heading-lg text-white mb-4">
                {product.name}
              </h1>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-price text-xl text-white">
                  {formatPrice(Number(product.price))}
                </span>
                {product.compare_at_price && (
                  <span className="text-body text-white/30 line-through">
                    {formatPrice(Number(product.compare_at_price))}
                  </span>
                )}
              </div>

              {description && (
                <div className="mb-8">
                  <h2 className="text-product-name text-white mb-2">About this product</h2>
                  <p className="text-body text-white/55 whitespace-pre-line">
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
                  <h2 className="text-ui-heading text-white mb-3">Benefits</h2>
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
                  <h2 className="text-ui-heading text-white mb-2">Ingredients</h2>
                  <p className="text-sm text-white/45 leading-relaxed">
                    {product.ingredients}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-white/40">
                <span>Curated Quality</span>
                <span>·</span>
                <span>{inStock ? 'In stock' : 'Out of stock'}</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={handleAddToCart}
                  disabled={!inStock || !product.defaultVariantId}
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

        {(similarLoading || similar.length > 0) && (
          <section className="mt-16 lg:mt-20" aria-labelledby="similar-products-heading">
            <h2
              id="similar-products-heading"
              className="font-serif text-heading-sm text-white mb-2"
            >
              You May Also Like
            </h2>
            <p className="text-body text-white/45 mb-8">
              Similar picks from the same brand and category
            </p>
            {similarLoading && similar.length === 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[4/5] rounded-2xl bg-layali-surface animate-pulse border border-white/5"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
                {similar.map((p) => (
                  <SimilarProductCard key={p.id} product={p} onAdd={handleAddSimilar} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
