'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchActiveBanners } from '@/lib/site-banners';
import type { BannerPlacement } from '@/types/database';
import type { BannerSlide } from '@/lib/banners';
import { BannerCarousel } from '@/components/banners/BannerCarousel';
import { PromoOffersGrid } from '@/components/banners/PromoOffersGrid';

type CarouselProps = Omit<React.ComponentProps<typeof BannerCarousel>, 'slides'>;

export function DynamicBannerCarousel({
  placement,
  ...props
}: CarouselProps & { placement: BannerPlacement }) {
  const [slides, setSlides] = useState<BannerSlide[]>([]);

  useEffect(() => {
    const supabase = createClient();
    void fetchActiveBanners(supabase, placement).then(setSlides);
  }, [placement]);

  if (slides.length === 0) return null;
  return <BannerCarousel slides={slides} {...props} />;
}

export function DynamicPromoGrid({
  placement = 'promo_grid',
  className,
}: {
  placement?: BannerPlacement;
  className?: string;
}) {
  const [items, setItems] = useState<BannerSlide[]>([]);

  useEffect(() => {
    const supabase = createClient();
    void fetchActiveBanners(supabase, placement).then(setItems);
  }, [placement]);

  if (items.length === 0) return null;

  const gridItems = items.map((item) => ({
    ...item,
    span: item.span || ('half' as const),
  }));

  return <PromoOffersGrid items={gridItems} className={className} />;
}
