import type { BannerPlacement, SiteBanner } from '@/types/database';
import type { BannerSlide } from '@/lib/banners';
import {
  LANDING_HERO_BANNERS,
  SHOP_HERO_BANNERS,
  BRAND_PROMO_GRID,
} from '@/lib/banners';

export const BANNER_PLACEMENTS: { value: BannerPlacement; label: string; description: string }[] = [
  {
    value: 'landing_hero',
    label: 'Landing Page — Hero Carousel',
    description: 'Large rotating banners at the top of the home page',
  },
  {
    value: 'shop_hero',
    label: 'Shop Page — Hero Carousel',
    description: 'Rotating banners at the top of the shop catalog',
  },
  {
    value: 'promo_grid',
    label: 'Promo Grid (Home & Shop)',
    description: 'Advertisement tiles shown on both landing and shop pages',
  },
];

function fallbackForPlacement(placement: BannerPlacement): BannerSlide[] {
  switch (placement) {
    case 'landing_hero':
      return LANDING_HERO_BANNERS;
    case 'shop_hero':
      return SHOP_HERO_BANNERS;
    case 'promo_grid':
      return BRAND_PROMO_GRID;
    default:
      return [];
  }
}

export function siteBannerToSlide(banner: SiteBanner): BannerSlide {
  return {
    src: banner.image_url,
    alt: banner.alt_text,
    href: banner.href || undefined,
    width: banner.image_width || undefined,
    height: banner.image_height || undefined,
    span: banner.span || undefined,
  };
}

export function slidesForPlacement(rows: SiteBanner[], placement: BannerPlacement): BannerSlide[] {
  const now = Date.now();
  const active = rows.filter((row) => {
    if (row.placement !== placement || !row.is_active) return false;
    if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
    if (row.ends_at && new Date(row.ends_at).getTime() < now) return false;
    return true;
  });
  if (active.length === 0) return fallbackForPlacement(placement);
  return active.map(siteBannerToSlide);
}