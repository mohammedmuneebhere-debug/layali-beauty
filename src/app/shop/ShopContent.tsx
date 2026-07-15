'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShoppingBag, Filter } from 'lucide-react';
import { Card, CardImage, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/FadeIn';
import { createClient } from '@/lib/supabase/client';
import { getProductsForRegion } from '@/lib/products';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import type { Product } from '@/types/database';

export default function ShopContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [userRegion, setUserRegion] = useState<{ gender: string; city: string; country: string } | null>(null);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      let gender = 'female';
      let city = '';
      let country = '';

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('gender, city, country')
          .eq('id', user.id)
          .single();

        if (profile) {
          gender = profile.gender || 'female';
          city = profile.city || '';
          country = profile.country || '';
          setUserRegion({ gender, city, country });
        }
      }

      if (!city || !country) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const data = await getProductsForRegion(supabase, {
        gender,
        country,
        city,
        category: category || undefined,
      });

      setProducts(data);
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
    <div className="min-h-screen bg-layali-cream py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="mb-8">
          <h1 className="font-serif text-4xl font-bold text-layali-black mb-2">Shop</h1>
          {userRegion && (
            <p className="text-layali-black/60">
              Showing products for {userRegion.gender === 'female' ? 'women' : 'men'} in {userRegion.city}, {userRegion.country}
            </p>
          )}
        </FadeIn>

        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setCategory('')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              !category ? 'bg-layali-black text-white' : 'bg-white text-layali-black hover:bg-layali-pink-light'
            }`}
          >
            All
          </button>
          {PRODUCT_CATEGORIES.filter((c) => c.value !== 'combo').map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                category === cat.value ? 'bg-layali-black text-white' : 'bg-white text-layali-black hover:bg-layali-pink-light'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-layali-pink-light/30 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Filter className="w-12 h-12 mx-auto text-layali-pink mb-4" />
            <p className="text-layali-black/60">
              {userRegion
                ? `No products available at our ${userRegion.city} outlet yet.`
                : 'Sign in and set your region to see available products.'}
            </p>
          </div>
        ) : (
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <StaggerItem key={product.id}>
                <Link href={`/shop/${product.id}`} className="block h-full">
                  <Card hover>
                    <div className="relative">
                      <CardImage src={productCover(product)} alt={product.name} />
                      {(product.images?.length || 0) > 1 && (
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px]">
                          {product.images.length} photos
                        </span>
                      )}
                    </div>
                    <CardContent>
                      <p className="text-xs text-layali-pink-dark uppercase tracking-wide mb-1">
                        {product.category}
                      </p>
                      <h3 className="font-medium text-layali-black mb-1 line-clamp-1">{product.name}</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-layali-black">{formatPrice(Number(product.price))}</span>
                          {product.compare_at_price && (
                            <span className="text-sm text-layali-black/40 line-through ml-2">
                              {formatPrice(Number(product.compare_at_price))}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => handleAddToCart(e, product)}
                        >
                          <ShoppingBag className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </div>
  );
}
