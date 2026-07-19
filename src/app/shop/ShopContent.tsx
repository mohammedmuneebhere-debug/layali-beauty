'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShoppingBag, Filter } from 'lucide-react';
import { Card, CardImage, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/FadeIn';
import { createClient } from '@/lib/supabase/client';
import { getProductsForRegion, getPublicProducts } from '@/lib/products';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import type { Product } from '@/types/database';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { BannerCarousel } from '@/components/banners/BannerCarousel';
import { PromoOffersGrid } from '@/components/banners/PromoOffersGrid';
import {
  SHOP_HERO_BANNERS,
  BRAND_PROMO_GRID,
} from '@/lib/banners';

export default function ShopContent() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [isGuest, setIsGuest] = useState(false);
  const [userRegion, setUserRegion] = useState<{ gender: string; city: string; country: string } | null>(null);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Women-only storefront — always show female catalog
      const gender = 'female';
      let city = '';
      let country = '';

      if (user) {
        setIsGuest(false);
        const { data: profile } = await supabase
          .from('profiles')
          .select('city, country')
          .eq('id', user.id)
          .single();

        if (profile) {
          city = profile.city || '';
          country = profile.country || '';
          if (city && country) {
            setUserRegion({ gender, city, country });
          }
        }

        if (city && country) {
          const regional = await getProductsForRegion(supabase, {
            gender,
            country,
            city,
            category: category || undefined,
          });
          setProducts(regional);
          setLoading(false);
          return;
        }

        const fallback = await getPublicProducts(supabase, {
          category: category || undefined,
          gender,
        });
        setProducts(fallback);
        setLoading(false);
        return;
      }

      setIsGuest(true);
      setUserRegion(null);
      const publicProducts = await getPublicProducts(supabase, {
        category: category || undefined,
        gender,
      });
      setProducts(publicProducts);
      setLoading(false);
    }

    load();
  }, [category]);

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    const image = product.images?.[0] || product.image_url;
    addItem({
      id: product.id,
      type: 'product',
      name: product.name,
      price: Number(product.price),
      image_url: image,
    });
  };

  const productCover = (product: Product) => product.images?.[0] || product.image_url;

  return (
    <div className="relative min-h-screen page-shell pt-24 pb-16 overflow-hidden">
      <div className="glow-orb w-[500px] h-[500px] -top-40 -right-20 opacity-40 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="mb-6">
          <p className="text-xs tracking-[0.28em] uppercase text-layali-pink mb-2">
            Authentic Korean Skincare
          </p>
          <h1 className="font-serif text-4xl lg:text-5xl font-bold text-white mb-3">{t.shop.title}</h1>
          {userRegion ? (
            <p className="text-white/60">
              {t.shop.region} {userRegion.city}, {userRegion.country}
            </p>
          ) : isGuest ? (
            <p className="text-white/60">
              {t.shop.guest} —{' '}
              <Link href="/auth/signin?redirect=/checkout" className="text-layali-pink hover:text-layali-pink-light transition-colors">
                {t.shop.signIn}
              </Link>
            </p>
          ) : (
            <p className="text-white/60">{t.shop.signedIn}</p>
          )}
        </FadeIn>

        <FadeIn className="mb-8">
          <BannerCarousel
            slides={SHOP_HERO_BANNERS}
            className="border border-layali-pink/20"
          />
        </FadeIn>

        <div className="flex flex-wrap gap-2 mb-10">
          <button
            onClick={() => setCategory('')}
            className={`px-4 py-2 rounded-full text-xs tracking-[0.14em] uppercase font-medium transition-all border ${
              !category
                ? 'bg-layali-pink-glow text-white border-layali-pink-glow shadow-[0_0_16px_rgba(212,46,124,0.35)]'
                : 'bg-transparent text-white/50 border-white/15 hover:border-layali-pink/40 hover:text-white'
            }`}
          >
            {t.shop.all}
          </button>
          {PRODUCT_CATEGORIES.filter((c) => c.value !== 'combo').map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-xs tracking-[0.14em] uppercase font-medium transition-all border ${
                category === cat.value
                  ? 'bg-layali-pink-glow text-white border-layali-pink-glow shadow-[0_0_16px_rgba(212,46,124,0.35)]'
                  : 'bg-transparent text-white/50 border-white/15 hover:border-layali-pink/40 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl bg-layali-surface animate-pulse border border-white/5" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Filter className="w-12 h-12 mx-auto text-layali-pink/50 mb-4" />
            <p className="text-white/45">
              {userRegion
                ? `No products available at our ${userRegion.city} outlet yet.`
                : 'No products available yet.'}
            </p>
          </div>
        ) : (
          <>
            <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
              {products.slice(0, 8).map((product) => (
                <StaggerItem key={product.id}>
                  <Link href={`/shop/${product.id}`} className="block h-full">
                    <Card hover className="h-full bg-transparent border-0 shadow-none">
                      <div className="relative">
                        <CardImage src={productCover(product)} alt={product.name} className="rounded-2xl border border-white/8" />
                        {(product.images?.length || 0) > 1 && (
                          <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-white text-[10px] tracking-wide border border-white/10">
                            {product.images.length} photos
                          </span>
                        )}
                      </div>
                      <CardContent className="px-1 pt-4 pb-2">
                        <p className="text-[10px] text-layali-pink uppercase tracking-[0.2em] mb-1.5">
                          {product.category}
                        </p>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <h3 className="font-serif text-lg text-white leading-snug line-clamp-2">
                            {product.name}
                          </h3>
                          <span className="font-serif text-lg text-white/90 shrink-0">
                            {formatPrice(Number(product.price))}
                          </span>
                        </div>
                        {product.compare_at_price && (
                          <span className="text-sm text-white/30 line-through block mb-2">
                            {formatPrice(Number(product.compare_at_price))}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={(e) => handleAddToCart(e, product)}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" /> {t.shop.add}
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerContainer>

            {products.length > 4 && (
              <div className="my-12">
                <p className="text-xs tracking-[0.22em] uppercase text-layali-pink mb-3">
                  Featured brands
                </p>
                <PromoOffersGrid items={BRAND_PROMO_GRID} />
              </div>
            )}

            {products.length > 8 && (
              <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
                {products.slice(8).map((product) => (
                  <StaggerItem key={product.id}>
                    <Link href={`/shop/${product.id}`} className="block h-full">
                      <Card hover className="h-full bg-transparent border-0 shadow-none">
                        <div className="relative">
                          <CardImage src={productCover(product)} alt={product.name} className="rounded-2xl border border-white/8" />
                          {(product.images?.length || 0) > 1 && (
                            <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-white text-[10px] tracking-wide border border-white/10">
                              {product.images.length} photos
                            </span>
                          )}
                        </div>
                        <CardContent className="px-1 pt-4 pb-2">
                          <p className="text-[10px] text-layali-pink uppercase tracking-[0.2em] mb-1.5">
                            {product.category}
                          </p>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <h3 className="font-serif text-lg text-white leading-snug line-clamp-2">
                              {product.name}
                            </h3>
                            <span className="font-serif text-lg text-white/90 shrink-0">
                              {formatPrice(Number(product.price))}
                            </span>
                          </div>
                          {product.compare_at_price && (
                            <span className="text-sm text-white/30 line-through block mb-2">
                              {formatPrice(Number(product.compare_at_price))}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={(e) => handleAddToCart(e, product)}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" /> {t.shop.add}
                          </Button>
                        </CardContent>
                      </Card>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            )}
          </>
        )}
      </div>
    </div>
  );
}
