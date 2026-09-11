'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShoppingBag, Filter, Search, X, ChevronLeft, ChevronRight, PackageOpen } from 'lucide-react';
import { Card, CardImage, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/FadeIn';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart';
import { formatPrice, cn } from '@/lib/utils';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import type { ShopProduct } from '@/lib/catalog';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { DynamicBannerCarousel } from '@/components/banners/DynamicBanners';
import { collectBrands, detectBrand, PAGE_SIZE } from '@/lib/shop-filters';

const VALID_CATEGORIES = new Set(
  PRODUCT_CATEGORIES.filter((c) => c.value !== 'combo').map((c) => c.value)
);

function normalizeCategory(value: string | null | undefined) {
  if (!value) return '';
  return VALID_CATEGORIES.has(value) ? value : '';
}

function writeCategoryToUrl(next: string) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (next) params.set('category', next);
  else params.delete('category');
  const qs = params.toString();
  const url = qs ? `/shop?${qs}` : '/shop';
  window.history.replaceState(window.history.state, '', url);
}

function ProductCard({
  product,
  addLabel,
  onAdd,
}: {
  product: ShopProduct;
  addLabel: string;
  onAdd: (e: React.MouseEvent, product: ShopProduct) => void;
}) {
  const cover = product.images?.[0] || product.image_url;
  const href = `/shop/${product.handle || product.id}`;

  return (
    <Link href={href} prefetch={false} className="block h-full">
      <Card hover className="h-full bg-transparent border-0 shadow-none">
        <div className="relative">
          <CardImage src={cover} alt={product.name} className="rounded-2xl border border-white/8" />
          {(product.images?.length || 0) > 1 && (
            <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-white text-[10px] tracking-wide border border-white/10">
              {product.images.length} photos
            </span>
          )}
        </div>
        <CardContent className="px-1 pt-4 pb-2">
          <p className="text-eyebrow text-layali-pink uppercase tracking-[0.2em] mb-1.5">
            {product.category}
          </p>
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-serif text-heading-sm text-white leading-snug line-clamp-2">
              {product.name}
            </h3>
            <span className="font-serif text-heading-sm text-white/90 shrink-0">
              {formatPrice(Number(product.price))}
            </span>
          </div>
          {product.compare_at_price && (
            <span className="text-sm text-white/30 line-through block mb-2">
              {formatPrice(Number(product.compare_at_price))}
            </span>
          )}
          <Button size="sm" variant="outline" className="w-full" onClick={(e) => onAdd(e, product)}>
            <ShoppingBag className="w-3.5 h-3.5" /> {addLabel}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ShopContent() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const categoryFromUrl = normalizeCategory(searchParams.get('category'));
  const [category, setCategory] = useState(categoryFromUrl);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [isGuest, setIsGuest] = useState(false);
  const [userRegion, setUserRegion] = useState<{
    gender: string;
    city: string;
    country: string;
  } | null>(null);
  const addItem = useCartStore((s) => s.addItem);

  // Sync only when Next navigation changes the URL (e.g. home → /shop?category=…)
  useEffect(() => {
    setCategory(categoryFromUrl);
    setPage(1);
    setBrand('');
  }, [categoryFromUrl]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const gender = 'female';
      let city = '';
      let country = '';

      if (user) {
        if (!cancelled) setIsGuest(false);
        const { data: profile } = await supabase
          .from('profiles')
          .select('city, country')
          .eq('id', user.id)
          .single();

        if (profile) {
          city = profile.city || '';
          country = profile.country || '';
          if (city && country && !cancelled) {
            setUserRegion({ gender, city, country });
          }
        }
      } else if (!cancelled) {
        setIsGuest(true);
        setUserRegion(null);
      }

      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (country) params.set('country', country);

      const res = await fetch(`/api/shopify/products?${params.toString()}`);
      const json = (await res.json()) as {
        products?: ShopProduct[];
        configured?: boolean;
        message?: string;
      };

      if (!cancelled) {
        setProducts(json.products || []);
        setCatalogMessage(
          json.configured === false
            ? json.message || 'Shopify catalog is not configured yet.'
            : null
        );
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, brand, minPrice, maxPrice]);

  const selectCategory = useCallback((value: string) => {
    const next = normalizeCategory(value);
    setCategory((prev) => {
      if (prev === next) return prev;
      return next;
    });
    setPage(1);
    setBrand('');
    writeCategoryToUrl(next);
  }, []);

  const brands = useMemo(() => {
    const inCategory = category ? products.filter((p) => p.category === category) : products;
    return collectBrands(inCategory);
  }, [products, category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;

    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (brand && detectBrand(p.name) !== brand) return false;
      const price = Number(p.price);
      if (min != null && !Number.isNaN(min) && price < min) return false;
      if (max != null && !Number.isNaN(max) && price > max) return false;
      if (q) {
        const hay = `${p.name} ${p.description || ''} ${p.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, category, search, brand, minPrice, maxPrice]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const clearFilters = () => {
    setSearch('');
    setBrand('');
    setMinPrice('');
    setMaxPrice('');
    setPage(1);
    selectCategory('');
  };

  const hasSearchOrExtraFilters = Boolean(search || brand || minPrice || maxPrice);
  const hasActiveFilters = Boolean(category || hasSearchOrExtraFilters);
  const isEmptySection =
    !loading && filtered.length === 0 && Boolean(category) && !hasSearchOrExtraFilters;
  const isEmptySearch = !loading && filtered.length === 0 && hasSearchOrExtraFilters;

  const handleAddToCart = useCallback(
    (e: React.MouseEvent, product: ShopProduct) => {
      e.preventDefault();
      e.stopPropagation();
      if (!product.defaultVariantId) return;
      const image = product.images?.[0] || product.image_url;
      void addItem({
        id: product.id,
        type: 'product',
        name: product.name,
        price: Number(product.price),
        image_url: image,
        merchandiseId: product.defaultVariantId,
      });
    },
    [addItem]
  );

  const goToPage = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const chipClass = (active: boolean) =>
    cn(
      'px-4 py-2 rounded-full text-xs tracking-[0.14em] uppercase font-medium transition-colors border',
      active
        ? 'bg-layali-pink-glow text-white border-layali-pink-glow'
        : 'bg-transparent text-white/50 border-white/15 hover:border-layali-pink/40 hover:text-white'
    );

  const categoryChips = (
    <>
      <button type="button" onClick={() => selectCategory('')} className={chipClass(!category)}>
        {t.shop.all}
      </button>
      {PRODUCT_CATEGORIES.filter((c) => c.value !== 'combo').map((cat) => (
        <button
          key={cat.value}
          type="button"
          onClick={() => selectCategory(cat.value)}
          className={chipClass(category === cat.value)}
        >
          {cat.label}
        </button>
      ))}
    </>
  );

  return (
    <div className="relative min-h-screen page-shell pt-24 pb-16 overflow-hidden">
      <div className="glow-orb w-[500px] h-[500px] -top-40 -right-20 opacity-40 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="mb-6">
          <p className="text-eyebrow tracking-[0.28em] uppercase text-layali-pink mb-2">
            {t.shop.eyebrow}
          </p>
          <h1 className="font-serif text-heading-lg text-white mb-3">{t.shop.title}</h1>
          {userRegion ? (
            <p className="text-body text-white/60">
              {t.shop.region} {userRegion.city}, {userRegion.country}
            </p>
          ) : isGuest ? (
            <p className="text-body text-white/60">
              {t.shop.guest} —{' '}
              <Link
                href="/auth/signin?redirect=/checkout"
                prefetch={false}
                className="text-layali-pink hover:text-layali-pink-light transition-colors"
              >
                {t.shop.signIn}
              </Link>
            </p>
          ) : (
            <p className="text-body text-white/60">{t.shop.signedIn}</p>
          )}
        </FadeIn>

        <div className="mb-8">
          <DynamicBannerCarousel placement="shop_hero" className="border border-layali-pink/20" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.shop.searchPlaceholder}
              className="w-full rounded-full bg-white/5 border border-white/15 text-white placeholder:text-white/35 py-3 ps-10 pe-4 text-sm focus:outline-none focus:border-layali-pink/50"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-xs tracking-[0.14em] uppercase font-medium border transition-colors',
              filtersOpen || hasActiveFilters
                ? 'bg-layali-pink-glow text-white border-layali-pink-glow'
                : 'bg-transparent text-white/70 border-white/20 hover:border-layali-pink/40'
            )}
          >
            <Filter className="w-4 h-4" />
            {t.shop.filters}
            {hasActiveFilters && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-white/20 text-[10px] flex items-center justify-center">
                !
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="mb-8 rounded-2xl border border-white/10 bg-black/45 p-4 sm:p-5 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">{t.shop.filters}</p>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-layali-pink hover:text-layali-pink-light inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> {t.shop.clearFilters}
              </button>
            </div>

            <div>
              <p className="text-eyebrow text-white/50 mb-2 uppercase tracking-[0.16em]">{t.shop.type}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectCategory('')}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs border transition-colors',
                    !category
                      ? 'bg-layali-pink-glow text-white border-layali-pink-glow'
                      : 'border-white/15 text-white/60 hover:border-layali-pink/40'
                  )}
                >
                  {t.shop.all}
                </button>
                {PRODUCT_CATEGORIES.filter((c) => c.value !== 'combo').map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => selectCategory(cat.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs border transition-colors',
                      category === cat.value
                        ? 'bg-layali-pink-glow text-white border-layali-pink-glow'
                        : 'border-white/15 text-white/60 hover:border-layali-pink/40'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {brands.length > 0 && (
              <div>
                <p className="text-eyebrow text-white/50 mb-2 uppercase tracking-[0.16em]">{t.shop.brand}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setBrand('')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs border transition-colors',
                      !brand
                        ? 'bg-layali-pink-glow text-white border-layali-pink-glow'
                        : 'border-white/15 text-white/60 hover:border-layali-pink/40'
                    )}
                  >
                    {t.shop.all}
                  </button>
                  {brands.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrand(b)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs border transition-colors',
                        brand === b
                          ? 'bg-layali-pink-glow text-white border-layali-pink-glow'
                          : 'border-white/15 text-white/60 hover:border-layali-pink/40'
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-eyebrow text-white/50 mb-2 uppercase tracking-[0.16em]">
                {t.shop.priceRange}
              </p>
              <div className="flex items-center gap-3 max-w-md">
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder={t.shop.minPrice}
                  className="w-full rounded-xl bg-white/5 border border-white/15 text-white px-3 py-2 text-sm focus:outline-none focus:border-layali-pink/50"
                />
                <span className="text-white/30">—</span>
                <input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder={t.shop.maxPrice}
                  className="w-full rounded-xl bg-white/5 border border-white/15 text-white px-3 py-2 text-sm focus:outline-none focus:border-layali-pink/50"
                />
              </div>
            </div>
          </div>
        )}

        {!filtersOpen && <div className="flex flex-wrap gap-2 mb-8">{categoryChips}</div>}

        {!loading && filtered.length > 0 && (
          <p className="text-sm text-white/45 mb-5">
            {t.shop.showing} {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} {t.shop.of} {filtered.length}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] rounded-2xl bg-layali-surface animate-pulse border border-white/5"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 px-4">
            <PackageOpen className="w-12 h-12 mx-auto text-layali-pink/50 mb-4" />
            <p className="font-serif text-heading-sm text-white mb-2">
              {isEmptySearch ? t.shop.noMatch : t.shop.comingSoon}
            </p>
            {catalogMessage && (
              <p className="text-sm text-amber-200/80 mb-4 max-w-2xl">{catalogMessage}</p>
            )}
            {isEmptySection && (
              <p className="text-sm text-white/45 max-w-md mx-auto capitalize">
                {PRODUCT_CATEGORIES.find((c) => c.value === category)?.label || category}
              </p>
            )}
            {(isEmptySearch || isEmptySection) && (
              <button
                type="button"
                onClick={() => {
                  if (isEmptySection) selectCategory('');
                  else clearFilters();
                }}
                className="mt-5 text-sm text-layali-pink hover:underline"
              >
                {isEmptySection ? t.shop.all : t.shop.clearFilters}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Plain grid — no Framer remount/stagger (was causing section-switch lag) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
              {pageItems.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  addLabel={t.shop.add}
                  onAdd={handleAddToCart}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-white/45">
                  {t.shop.page} {currentPage} {t.shop.of} {totalPages}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => goToPage(currentPage - 1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/20 text-sm text-white disabled:opacity-35 disabled:cursor-not-allowed hover:border-layali-pink/50 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                    {t.shop.previous}
                  </button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((n) => {
                        if (totalPages <= 7) return true;
                        return n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1;
                      })
                      .map((n, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showEllipsis = prev != null && n - prev > 1;
                        return (
                          <span key={n} className="inline-flex items-center gap-1.5">
                            {showEllipsis && <span className="text-white/30 px-1">…</span>}
                            <button
                              type="button"
                              onClick={() => goToPage(n)}
                              className={cn(
                                'min-w-[36px] h-9 rounded-full text-sm transition-colors',
                                n === currentPage
                                  ? 'bg-layali-pink-glow text-white'
                                  : 'text-white/60 hover:bg-white/10'
                              )}
                            >
                              {n}
                            </button>
                          </span>
                        );
                      })}
                  </div>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => goToPage(currentPage + 1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/20 text-sm text-white disabled:opacity-35 disabled:cursor-not-allowed hover:border-layali-pink/50 transition-colors"
                  >
                    {t.shop.next}
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
