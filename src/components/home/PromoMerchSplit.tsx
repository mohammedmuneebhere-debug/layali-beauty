'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { PromoArtwork } from '@/components/home/PromoArtwork';
import { formatPrice } from '@/lib/utils';
import type { CatalogProduct } from '@/lib/shopify/normalize';

type PromoMerchSplitProps = {
  /** Artwork on the start side (LTR left); false = products first on desktop */
  artworkFirst: boolean;
  src: string;
  alt: string;
  href: string;
  width: number;
  height: number;
  categoryLabel: string;
  shopAllLabel: string;
  products: CatalogProduct[];
  category: string;
};

/**
 * Editorial merch module: campaign artwork + curated category product previews.
 * Desktop is asymmetric; mobile stacks artwork then products.
 */
export function PromoMerchSplit({
  artworkFirst,
  src,
  alt,
  href,
  width,
  height,
  categoryLabel,
  shopAllLabel,
  products,
  category,
}: PromoMerchSplitProps) {
  const preview = products
    .filter((p) => p.category === category && p.image_url && p.handle)
    .slice(0, 4);

  const artwork = (
    <FadeIn className="min-w-0">
      <PromoArtwork src={src} alt={alt} href={href} width={width} height={height} />
    </FadeIn>
  );

  const merch = (
    <FadeIn className="min-w-0 flex flex-col justify-center">
      <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
        <h2 className="font-serif text-heading-md text-white sm:text-heading-lg">{categoryLabel}</h2>
        <Link
          href={href}
          prefetch
          className="inline-flex shrink-0 items-center gap-1.5 text-nav uppercase tracking-[0.12em] text-white/70 transition-colors hover:text-layali-pink-light"
        >
          {shopAllLabel} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>

      {preview.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {preview.map((product) => (
            <Link
              key={product.id}
              href={`/shop/${product.handle}`}
              prefetch={false}
              className="group min-w-0 rounded-2xl focus-ring"
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image_url!}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-white/85">{product.name}</p>
              <p className="mt-0.5 text-sm text-layali-pink-light">{formatPrice(product.price)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <Link
          href={href}
          prefetch
          className="inline-flex w-fit items-center gap-2 rounded-full border border-layali-pink/40 px-5 py-2.5 text-nav uppercase tracking-[0.12em] text-white transition-colors hover:border-layali-pink hover:bg-layali-pink/10"
        >
          {shopAllLabel} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      )}
    </FadeIn>
  );

  if (preview.length === 0) {
    return (
      <section className="relative overflow-x-clip py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
            <h2 className="font-serif text-heading-md text-white sm:text-heading-lg">{categoryLabel}</h2>
            <Link
              href={href}
              prefetch
              className="inline-flex shrink-0 items-center gap-1.5 text-nav uppercase tracking-[0.12em] text-white/70 transition-colors hover:text-layali-pink-light"
            >
              {shopAllLabel} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </FadeIn>
          <div className="mx-auto w-full max-w-5xl">{artwork}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-x-clip py-12 sm:py-16 lg:py-20">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 sm:gap-10 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8">
        <div className={artworkFirst ? 'lg:order-1' : 'lg:order-2'}>{artwork}</div>
        <div className={artworkFirst ? 'lg:order-2' : 'lg:order-1'}>{merch}</div>
      </div>
    </section>
  );
}
