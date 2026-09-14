'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Minus, Plus, ShoppingBag, Check, Truck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProductImageGallery } from '@/components/shop/ProductImageGallery';
import { FadeIn } from '@/components/ui/FadeIn';
import { RitualRail } from '@/components/commerce/RitualRail';
import { ProductCard } from '@/components/shop/ProductCard';
import { toast } from '@/components/ui/Toast';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import type { ShopProduct, ShopVariant } from '@/lib/catalog';
import { STOREFRONT_NAV_CATEGORIES } from '@/lib/constants';
import { pickSimilarProducts, vendorSearchQuery } from '@/lib/similar-products';
import { pickRitualProducts } from '@/lib/ritual';
import { track } from '@/lib/track';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

export type DetailProduct = ShopProduct & {
  shopifyVariants?: ShopVariant[];
};

function productPhotos(product: DetailProduct | ShopProduct): string[] {
  if (product.images?.length) return product.images;
  return product.image_url ? [product.image_url] : [];
}

function selectableVariants(product: DetailProduct) {
  return (product.shopifyVariants || []).filter((v) => v.title && v.title !== 'Default Title');
}

export function ProductDetailClient({
  productParam,
  initialProduct,
}: {
  productParam: string;
  initialProduct: DetailProduct | null;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const addItem = useCartStore((s) => s.addItem);
  const addingRef = useRef(false);
  const addedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (addedTimeoutRef.current != null) {
        window.clearTimeout(addedTimeoutRef.current);
      }
    };
  }, []);

  const [product, setProduct] = useState<DetailProduct | null>(initialProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [similar, setSimilar] = useState<ShopProduct[]>([]);
  const [ritual, setRitual] = useState<ShopProduct[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState(
    initialProduct?.defaultVariantId || initialProduct?.shopifyVariants?.find((v) => v.available)?.id || ''
  );

  useEffect(() => {
    if (initialProduct) {
      void Promise.resolve().then(() => {
        setProduct(initialProduct);
        setVariantId(
          initialProduct.defaultVariantId ||
            initialProduct.shopifyVariants?.find((v) => v.available)?.id ||
            ''
        );
        setLoading(false);
      });
      track({
        event: 'product_view',
        id: initialProduct.id,
        name: initialProduct.name,
        category: initialProduct.category,
        value: Number(initialProduct.price),
        currency: 'SAR',
      });
      return;
    }

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
      setVariantId(
        json.product.defaultVariantId || json.product.shopifyVariants?.find((v) => v.available)?.id || ''
      );
      setLoading(false);
      track({
        event: 'product_view',
        id: json.product.id,
        name: json.product.name,
        category: json.product.category,
        value: Number(json.product.price),
        currency: 'SAR',
      });
    }

    if (productParam) void load();
  }, [productParam, initialProduct]);

  useEffect(() => {
    if (!product) return;

    let cancelled = false;
    const current = product;

    async function loadSimilar() {
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
          setRitual(pickRitualProducts(current, candidates));
        }
      } catch {
        if (!cancelled) {
          setSimilar([]);
          setRitual([]);
        }
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    }

    void loadSimilar();
    return () => {
      cancelled = true;
    };
  }, [product]);

  const selectedVariant = useMemo(
    () => product?.shopifyVariants?.find((v) => v.id === variantId) || null,
    [product, variantId]
  );

  const handleAddToCart = async () => {
    if (!product || addingRef.current) return;
    const merchandiseId = variantId || product.defaultVariantId;
    if (!merchandiseId) return;

    addingRef.current = true;
    setAdding(true);
    try {
      const image = productPhotos(product)[0] || null;
      const ok = await addItem({
        id: product.id,
        type: 'product',
        name: product.name,
        price: selectedVariant?.price ?? Number(product.price),
        image_url: image,
        merchandiseId,
        quantity,
      });
      if (ok) {
        setAdded(true);
        toast(t.pdp.added);
        track({
          event: 'add_to_cart',
          id: product.id,
          name: product.name,
          category: product.category,
          value: Number(product.price) * quantity,
          currency: 'SAR',
        });
        if (addedTimeoutRef.current != null) {
          window.clearTimeout(addedTimeoutRef.current);
        }
        addedTimeoutRef.current = window.setTimeout(() => {
          addingRef.current = false;
          setAdded(false);
          addedTimeoutRef.current = null;
        }, 2000);
      } else {
        toast(t.pdp.addFailed);
        addingRef.current = false;
      }
    } catch {
      addingRef.current = false;
    } finally {
      setAdding(false);
    }
  };

  const handleAddRelated = (e: React.MouseEvent, p: ShopProduct) => {
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
    }).then((ok) => {
      if (ok) toast(t.pdp.added);
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
        <p className="text-white/50 mb-4">{t.pdp.notFound}</p>
        <Button onClick={() => router.push('/shop')}>{t.pdp.back}</Button>
      </div>
    );
  }

  const description = product.description || '';
  const isLongDescription = description.length > 220;
  const visibleDescription =
    !showFullDescription && isLongDescription
      ? `${description.slice(0, 220).trim()}...`
      : description;
  const variants = selectableVariants(product);
  const inStock = selectedVariant ? selectedVariant.available : product.available || product.stock_quantity > 0;
  const displayPrice = selectedVariant?.price ?? Number(product.price);
  const compareAt = selectedVariant?.compareAtPrice ?? product.compare_at_price;
  const canAdd = Boolean(inStock && (variantId || product.defaultVariantId) && !adding && !added);
  const addButtonLabel = adding ? t.pdp.adding : added ? t.pdp.added : t.pdp.add;
  const categoryMeta = STOREFRONT_NAV_CATEGORIES.find((c) => c.value === product.category);

  return (
    <div className="relative min-h-screen bg-transparent pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] lg:pb-14">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="glow-orb w-[480px] h-[480px] -top-20 right-0 opacity-25" />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-nav text-white/45 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {t.pdp.back}
            </Link>
            {categoryMeta ? (
              <>
                <span className="text-white/25" aria-hidden>
                  /
                </span>
                <Link
                  href={`/shop?category=${categoryMeta.value}`}
                  className="text-nav text-white/45 hover:text-white transition-colors"
                >
                  {categoryMeta.label}
                </Link>
              </>
            ) : null}
          </div>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
            <ProductImageGallery images={productPhotos(product)} alt={product.name} />

            <div>
              <p className="text-meta uppercase tracking-[0.18em] text-layali-pink mb-3">
                {product.vendor || product.category}
              </p>
              <h1 className="font-serif text-heading-lg text-white mb-4">{product.name}</h1>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-price text-xl text-white">{formatPrice(displayPrice)}</span>
                {compareAt && Number(compareAt) > displayPrice ? (
                  <span className="text-body text-white/30 line-through">{formatPrice(Number(compareAt))}</span>
                ) : null}
              </div>

              {description && (
                <div className="mb-8">
                  <h2 className="text-product-name text-white mb-2">{t.pdp.about}</h2>
                  <p className="text-body text-white/55 whitespace-pre-line">{visibleDescription}</p>
                  {isLongDescription && (
                    <button
                      type="button"
                      onClick={() => setShowFullDescription((v) => !v)}
                      className="mt-2 text-sm font-medium text-layali-pink hover:text-layali-pink-light transition-colors"
                    >
                      {showFullDescription ? t.pdp.showLess : t.pdp.readMore}
                    </button>
                  )}
                </div>
              )}

              {product.benefits?.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-ui-heading text-white mb-3">{t.pdp.benefits}</h2>
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
                  <h2 className="text-ui-heading text-white mb-2">{t.pdp.ingredients}</h2>
                  <p className="text-sm text-white/45 leading-relaxed">{product.ingredients}</p>
                </div>
              )}

              {variants.length > 1 && (
                <div className="mb-6">
                  <p className="text-ui-heading text-white mb-3">{t.pdp.variant}</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={!variant.available}
                        onClick={() => setVariantId(variant.id)}
                        className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                          variantId === variant.id
                            ? 'border-layali-pink bg-layali-pink-glow/20 text-white'
                            : 'border-white/15 text-white/70 hover:border-layali-pink/40'
                        } disabled:opacity-40`}
                      >
                        {variant.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <p className="text-ui-heading text-white mb-3">{t.pdp.quantity}</p>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-2">
                  <button
                    type="button"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center text-white/70 hover:text-white"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center tabular-nums text-white">{quantity}</span>
                  <button
                    type="button"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center text-white/70 hover:text-white"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-white/40">
                <span>{t.pdp.curated}</span>
                <span>·</span>
                <span>{inStock ? t.pdp.inStock : t.pdp.outOfStock}</span>
              </div>

              <div className="hidden sm:flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => void handleAddToCart()}
                  loading={adding}
                  disabled={!canAdd}
                >
                  {adding ? null : added ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <ShoppingBag className="w-5 h-5" />
                  )}
                  {addButtonLabel}
                </Button>
                <Link href="/cart" className="flex-1">
                  <Button variant="outline" size="lg" className="w-full">
                    {t.pdp.viewCart}
                  </Button>
                </Link>
              </div>

              <ul className="mt-8 space-y-3 text-sm text-white/55">
                <li className="flex items-start gap-2">
                  <Truck className="mt-0.5 h-4 w-4 text-layali-gold-light" />
                  {t.pdp.delivery}
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-layali-gold-light" />
                  {t.pdp.cod}
                </li>
              </ul>
            </div>
          </div>
        </FadeIn>

        <RitualRail
          products={ritual}
          title={t.completeRitual.title}
          subtitle={t.completeRitual.subtitle}
          addLabel={t.shop.add}
          saleLabel={t.shop.sale}
          soldOutLabel={t.shop.soldOut}
          onAdd={handleAddRelated}
        />

        {(similarLoading || similar.length > 0) && (
          <section className="mt-16 lg:mt-20" aria-labelledby="similar-products-heading">
            <h2 id="similar-products-heading" className="font-serif text-heading-sm text-white mb-2">
              {t.pdp.related}
            </h2>
            <p className="text-body text-white/45 mb-8">{t.pdp.relatedHint}</p>
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
                  <ProductCard
                    key={p.id}
                    product={p}
                    addLabel={t.shop.add}
                    saleLabel={t.shop.sale}
                    soldOutLabel={t.shop.soldOut}
                    onAdd={handleAddRelated}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-white/10 bg-black/85 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur sm:hidden">
        <Button
          size="lg"
          className="w-full touch-manipulation"
          onClick={() => void handleAddToCart()}
          loading={adding}
          disabled={!canAdd}
        >
          {added || adding ? addButtonLabel : `${t.pdp.add} · ${formatPrice(displayPrice)}`}
        </Button>
      </div>
    </div>
  );
}
